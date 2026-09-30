"""
AI-агент подготовки тендерной заявки: генерация + гибридный AI-критик.

Архитектура снижения риска галлюцинаций:
1) Генерация — LLM заполняет форму заявки ТОЛЬКО по контексту профиля и
   «жёсткого» RAG (только фрагменты документации, иначе — маркер NOT_FOUND).
2) Гибридный критик — сначала детерминированные проверки (код: ИНН, цены,
   сроки, форматы, отрицания), затем строгий LLM-критик, и в конце
   верификация цитат: замечание без подтверждённой цитаты из документации
   помечается как галлюцинация и блокирует автоприёмку.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_router import LLMRouter
from app.ai.rag_engine import RAGEngine, build_grounded_context
from app.db.models import Application, Tender, User
from app.services.deterministic_checks import (
    NOT_FOUND_MESSAGE,
    run_deterministic_checks,
    verify_evidence_quotes,
)

logger = logging.getLogger("app.services.ai")

GENERATION_SYSTEM_PROMPT = (
    "Ты — эксперт по подготовке заявок на государственные и корпоративные закупки (44-ФЗ, 223-ФЗ). "
    "Ты заполняешь форму заявки СТРОГО на основании предоставленного контекста и документации. "
    "ЗАПРЕЩЕНО придумывать реквизиты, цены, сроки, коды ОКПД2 и характеристики, которых нет в контексте. "
    f"Если данных нет — верни маркер «{NOT_FOUND_MESSAGE}». "
    "Отвечай строго в JSON без пояснений."
)

CRITIC_SYSTEM_PROMPT = (
    "Ты — педантичный и строгий рецензент тендерных заявок уровня приёмной комиссии. "
    "Твоя задача — найти ЛЮБЫЕ несоответствия требованиям и риски отклонения заявки.\n"
    "ЖЁСТКИЕ ПРАВИЛА:\n"
    "1) Используй ТОЛЬКО фрагменты документации из сообщения пользователя. "
    "Общие знания, типовые формулировки и догадки запрещены.\n"
    "2) Если требования нет в документации — не выдумывай его, а добавь в массив "
    f"not_found текст «{NOT_FOUND_MESSAGE}».\n"
    "3) Каждое замечание подкрепляй ДОСЛОВНОЙ цитатой из документации в поле evidence_quote.\n"
    "4) Замечание без подтверждённой цитаты недействительно.\n"
    "5) Отрицания («не», «без», «запрещено», «не менее») критичны: их пропуск — грубая ошибка.\n"
    "Отвечай строго в JSON без пояснений."
)


def _extract_json(text: str) -> dict:
    """
    LLM может обернуть JSON в ```json ... ``` или добавить пояснения —
    вытаскиваем первую вложенную JSON-структуру.
    """
    text = text.strip()
    if text.startswith("```"):
        # снимаем markdown-ограждение
        text = text.split("```")
        text = text[1] if len(text) > 1 else text[0]
        text = text.replace("json", "", 1)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {"raw": text}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {"raw": text}


async def _collect_rag_chunks(db: AsyncSession, user: User, tender: Tender) -> list[dict]:
    """
    «Жёсткий» RAG: тянем только релевантные фрагменты документации.
    Ошибка RAG не должна ломать генерацию/критику — возвращаем пустой список.
    """
    rag = RAGEngine(db)
    query = f"{tender.title}. {tender.description or ''}"
    try:
        return await rag.search_chunks(query=query, user_id=user.id, top_k=5)
    except Exception as exc:  # noqa: BLE001 — нет ключей/эмбеддингов/сети
        logger.warning("RAG search failed, continue without context: %s", exc)
        return []


def _company_context(user: User) -> str:
    """Текстовая выжимка профиля компании для промпта."""
    if user.company_profile_json:
        return f"[Профиль компании]\n{json.dumps(user.company_profile_json, ensure_ascii=False)}"
    if user.company_name or user.inn:
        return f"[Профиль компании]\nНазвание: {user.company_name}\nИНН: {user.inn}"
    return "[Профиль компании]\nДанные не заполнены."


async def _build_context(db: AsyncSession, user: User, tender: Tender) -> tuple[str, bool, list[dict]]:
    """
    Контекст для промпта: профиль компании + «жёсткий» RAG-контекст.

    :return: (текст контекста, найден ли RAG-контекст, список чанков)
    """
    chunks = await _collect_rag_chunks(db, user, tender)
    grounded_text, grounded = build_grounded_context(chunks)
    context = "\n\n".join([_company_context(user), f"[Документация]\n{grounded_text}"])
    return context, grounded, chunks


def _normalize_confidence(value) -> Optional[float]:
    """Приводит уверенность к диапазону 0..1 (модель могла вернуть проценты)."""
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return None
    if confidence > 1:
        confidence = confidence / 100.0
    return max(0.0, min(1.0, confidence))


def _normalize_llm_issues(raw_issues) -> list[dict]:
    """
    Приводит замечания LLM к единому виду. Модель может вернуть как строки,
    так и объекты — поддерживаем оба варианта.
    """
    issues: list[dict] = []
    for item in raw_issues or []:
        if isinstance(item, str):
            issues.append({
                "severity": "major",
                "field": None,
                "message": item,
                "evidence_quote": None,
            })
        elif isinstance(item, dict):
            issues.append({
                "severity": str(item.get("severity", "major")).lower(),
                "field": item.get("field"),
                "message": str(item.get("message") or item.get("issue") or ""),
                "evidence_quote": item.get("evidence_quote") or item.get("quote"),
            })
    return issues


def _deterministic_issues(report: dict) -> list[dict]:
    """Превращает проваленные/предупреждающие проверки в единый список замечаний."""
    issues = []
    for check in report.get("checks", []):
        if check.get("status") in ("fail", "warn"):
            issues.append({
                "severity": check.get("severity", "minor"),
                "field": check.get("code"),
                "message": check.get("message", ""),
                "evidence_quote": None,
                "source": "deterministic",
            })
    return issues


async def generate_application(
    db: AsyncSession,
    user: User,
    tender: Tender,
    application: Optional[Application] = None,
) -> Application:
    """
    Генерирует содержимое заявки и сохраняет его в Application(generated_content).
    Статус -> AI_GENERATED. Контекст — «жёсткий» RAG (только документация).
    """
    llm = LLMRouter()
    context, grounded, _chunks = await _build_context(db, user, tender)

    user_prompt = (
        f"Данные тендера:\n"
        f"Название: {tender.title}\n"
        f"Площадка: {tender.platform}\n"
        f"Закон: {tender.law_type}\n"
        f"Начальная цена: {tender.initial_price}\n"
        f"Заказчик: {tender.customer_name}\n"
        f"Описание: {tender.description or '—'}\n\n"
        f"Контекст компании и документация:\n{context}\n\n"
        "Заполни форму заявки. Верни JSON вида "
        '{"offer_price": <число>, "delivery_terms": "...", "warranty": "...", '
        '"qualification": "...", "notes": "..."}\n'
        "Не придумывай данные, которых нет в контексте."
    )

    raw = await llm.chat(
        [
            {"role": "system", "text": GENERATION_SYSTEM_PROMPT},
            {"role": "user", "text": user_prompt},
        ]
    )
    content = _extract_json(raw)

    if application is None:
        application = Application(user_id=user.id, tender_id=tender.id)
        db.add(application)

    application.generated_content = content
    application.status = "ai_generated"
    # Фиксируем, был ли вообще найден контекст документации — это влияет на риск.
    application.deterministic_report = {
        "generation_grounding": {"context_found": grounded},
    }
    await db.flush()

    logger.info(
        "Generated application %s for tender %s (grounded=%s)",
        application.id, tender.id, grounded,
    )
    return application


def _build_source_text(tender: Tender, rag_chunks: list[dict]) -> str:
    """Текст-источник истины: описание тендера + фрагменты документации."""
    return "\n\n".join(
        filter(None, [tender.description or "", *(c.get("text", "") for c in rag_chunks)])
    )


def _assemble_report(
    deterministic: dict,
    *,
    grounded: Optional[bool],
    rag_chunks: list[dict],
    llm_issues: list[dict] | tuple = (),
    llm_recommendations: list[str] | tuple = (),
    llm_not_found: list[str] | tuple = (),
    llm_confidence: Optional[float] = None,
    llm_admitted: Optional[bool] = None,
    llm_meta: Optional[dict] = None,
    llm_status: str = "completed",
    hallucinated_quotes: list[str] | tuple = (),
) -> dict:
    """
    Собирает единый отчёт критика из детерминированной и LLM-частей.

    llm_status:
    - pending     — LLM-этап ещё выполняется в очереди (быстрый ответ API);
    - completed   — LLM ответил, цитаты проверены;
    - unavailable — LLM недоступен (нет ключей/провайдер упал);
    - skipped     — LLM отключён вызывающей стороной.
    """
    llm_issues = list(llm_issues)
    issues = _deterministic_issues(deterministic) + llm_issues
    critical_issues = [i for i in issues if i.get("severity") == "critical"]
    major_issues = [i for i in issues if i.get("severity") == "major"]

    llm_available = bool((llm_meta or {}).get("available"))
    llm_pending = llm_status == "pending"

    # Пока LLM-этап не завершён (или недоступен) — смысловая проверка не выполнена,
    # поэтому заявку нельзя считать готовой к подаче.
    requires_manual_review = bool(
        llm_pending
        or llm_status == "unavailable"
        or not grounded
        or hallucinated_quotes
        or llm_not_found
        or not llm_available
        or deterministic.get("is_blocking")
        or deterministic.get("failed")
    )

    # Итоговая уверенность = минимум из детерминированной и LLM-оценки,
    # дополнительно штрафуем за галлюцинации и отсутствие документации.
    confidences = [deterministic.get("confidence", 0.0)]
    if llm_confidence is not None:
        confidences.append(llm_confidence)
    confidence = min(confidences)
    if hallucinated_quotes:
        confidence = min(confidence, 0.2)
    if grounded is False:
        confidence = min(confidence, 0.5)
    confidence = round(max(0.0, confidence), 4)

    admitted = bool(
        not requires_manual_review
        and not critical_issues
        and llm_status == "completed"
        and llm_admitted is not False
    )

    return {
        "confidence": confidence,
        "admitted": admitted,
        "requires_manual_review": requires_manual_review,
        "issues": issues,
        "critical_issues_count": len(critical_issues),
        "major_issues_count": len(major_issues),
        "recommendations": list(llm_recommendations),
        "not_found": list(llm_not_found),
        "hallucinated_evidence": list(hallucinated_quotes),
        "grounding": {
            "context_found": grounded,
            "chunks_count": len(rag_chunks),
            "sources": sorted({c.get("source") or "без источника" for c in rag_chunks}),
            "pending": llm_pending,
        },
        "deterministic": deterministic,
        "llm": llm_meta or {"available": False, "error": None, "raw": None},
        "llm_status": llm_status,
        "disclaimer_required": True,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


async def run_deterministic_critique(
    db: AsyncSession,
    tender: Tender,
    application: Application,
    *,
    user: Optional[User] = None,
    use_rag: bool = False,
    llm_status: str = "pending",
) -> dict:
    """
    Синхронный (быстрый) этап критика: только код, без обращения к LLM.

    Выполняется прямо в HTTP-запросе, чтобы пользователь мгновенно увидел
    объективные ошибки (цена, ИНН, сроки, форматы). Сохраняет промежуточный
    critic_report со статусом llm_status (по умолчанию "pending" — LLM в очереди).

    :param use_rag: подтягивать ли документацию (сетевой вызов эмбеддингов).
        По умолчанию False — синхронный этап не должен ждать сеть.
    :param llm_status: "pending" (LLM будет запущен) или "skipped" (LLM отключён).
    """
    content = application.generated_content or {}
    rag_chunks: list[dict] = []
    grounded: Optional[bool] = None

    if use_rag and user is not None:
        rag_chunks = await _collect_rag_chunks(db, user, tender)
        _, grounded = build_grounded_context(rag_chunks)

    deterministic = run_deterministic_checks(
        tender,
        content,
        source_text=_build_source_text(tender, rag_chunks),
        company_inn=(user.inn if user is not None else None),
        is_final=bool(application.final_content),
    )

    # Не теряем отметку о «заземлении» генерации, выставленную на этапе генерации.
    previous = application.deterministic_report or {}
    if "generation_grounding" in previous:
        deterministic["generation_grounding"] = previous["generation_grounding"]

    report = _assemble_report(
        deterministic,
        grounded=grounded,
        rag_chunks=rag_chunks,
        llm_meta={"available": False, "pending": llm_status == "pending", "error": None, "raw": None},
        llm_status=llm_status,
    )

    application.deterministic_report = deterministic
    application.critic_report = report
    application.ai_confidence_score = deterministic.get("confidence")
    # Любая новая проверка аннулирует прежнее подтверждение пользователя.
    application.disclaimer_accepted = False
    application.review_confirmed_at = None
    await db.flush()

    logger.info(
        "Deterministic critique finished application %s: confidence=%s failed=%s",
        application.id, deterministic.get("confidence"), deterministic.get("failed_count"),
    )
    return deterministic


async def run_llm_critique(
    db: AsyncSession,
    tender: Tender,
    application: Application,
    *,
    user: Optional[User] = None,
) -> dict:
    """
    LLM-этап критика: строгая проверка по «жёсткому» RAG + верификация цитат.
    Тяжёлая операция — вызывается из Celery, а не из HTTP-запроса.
    """
    content = application.generated_content or {}

    rag_chunks = await _collect_rag_chunks(db, user, tender) if user is not None else []
    grounded_text, grounded = build_grounded_context(rag_chunks)
    source_text = _build_source_text(tender, rag_chunks)

    deterministic = application.deterministic_report or {}
    if "checks" not in deterministic:
        # Задача запущена без предварительного синхронного этапа — считаем сами.
        deterministic = run_deterministic_checks(
            tender,
            content,
            source_text=source_text,
            company_inn=(user.inn if user is not None else None),
            is_final=bool(application.final_content),
        )

    llm = LLMRouter()
    user_prompt = (
        f"Проверь черновик заявки на соответствие требованиям тендера.\n\n"
        f"Тендер: {tender.title}\n"
        f"Начальная цена: {tender.initial_price}\n"
        f"Срок подачи: {tender.submission_deadline}\n"
        f"Черновик заявки (JSON):\n{json.dumps(content, ensure_ascii=False)}\n\n"
        f"Результаты автоматических проверок кодом (не перепроверяй их, учитывай):\n"
        f"{json.dumps(deterministic.get('checks', []), ensure_ascii=False)}\n\n"
        f"Документация (единственный источник истины):\n{grounded_text}\n\n"
        "Верни JSON вида "
        '{"confidence": <0..1>, '
        '"issues": [{"severity": "critical|major|minor", "field": "...", '
        '"message": "...", "evidence_quote": "..."}], '
        '"recommendations": ["..."], "not_found": ["..."], "admitted": true/false}'
    )

    llm_meta: dict = {"available": False, "error": None, "raw": None}
    llm_issues: list[dict] = []
    llm_recommendations: list[str] = []
    llm_not_found: list[str] = []
    llm_confidence: Optional[float] = None
    llm_admitted: Optional[bool] = None

    try:
        raw = await llm.chat(
            [
                {"role": "system", "text": CRITIC_SYSTEM_PROMPT},
                {"role": "user", "text": user_prompt},
            ]
        )
        parsed = _extract_json(raw)
        llm_meta = {"available": True, "error": None, "raw": parsed}
        llm_issues = _normalize_llm_issues(parsed.get("issues"))
        llm_recommendations = [str(r) for r in (parsed.get("recommendations") or [])]
        llm_not_found = [str(n) for n in (parsed.get("not_found") or [])]
        llm_confidence = _normalize_confidence(parsed.get("confidence"))
        if isinstance(parsed.get("admitted"), bool):
            llm_admitted = parsed["admitted"]
    except Exception as exc:  # noqa: BLE001 — LLM недоступен: остаёмся на детерминизме
        logger.warning("LLM critic unavailable, using deterministic checks only: %s", exc)
        llm_meta = {"available": False, "error": str(exc), "raw": None}

    # Верификация цитат (анти-галлюцинации): без подтверждённой цитаты замечание недостоверно.
    quotes = [i.get("evidence_quote") for i in llm_issues if i.get("evidence_quote")]
    hallucinated_quotes = verify_evidence_quotes(quotes, source_text) if grounded else list(quotes)
    for issue in llm_issues:
        quote = issue.get("evidence_quote")
        issue["grounded"] = bool(quote) and quote not in hallucinated_quotes
        issue["source"] = "llm"

    report = _assemble_report(
        deterministic,
        grounded=grounded,
        rag_chunks=rag_chunks,
        llm_issues=llm_issues,
        llm_recommendations=llm_recommendations,
        llm_not_found=llm_not_found,
        llm_confidence=llm_confidence,
        llm_admitted=llm_admitted,
        llm_meta=llm_meta,
        llm_status="completed" if llm_meta["available"] else "unavailable",
        hallucinated_quotes=hallucinated_quotes,
    )

    application.critic_report = report
    application.deterministic_report = deterministic
    application.ai_confidence_score = report["confidence"]
    application.disclaimer_accepted = False
    application.review_confirmed_at = None
    await db.flush()

    logger.info(
        "LLM critique finished application %s: confidence=%s admitted=%s manual_review=%s",
        application.id, report["confidence"], report["admitted"], report["requires_manual_review"],
    )
    return report


async def critique_application(
    db: AsyncSession,
    tender: Tender,
    application: Application,
    *,
    user: Optional[User] = None,
    use_llm: bool = True,
) -> Application:
    """
    Полный гибридный критик (детерминизм + LLM) в одном вызове.

    Используется внутри Celery-задачи генерации, где всё и так выполняется
    в фоне. Для HTTP-эндпоинта применяйте run_deterministic_critique +
    постановку run_llm_critique в очередь.
    """
    await run_deterministic_critique(db, tender, application, user=user, use_rag=use_llm)
    if use_llm:
        await run_llm_critique(db, tender, application, user=user)
    return application
