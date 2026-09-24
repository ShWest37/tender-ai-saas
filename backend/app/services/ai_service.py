"""
AI-агент подготовки тендерной заявки.

Два прохода:
1) Генерация — собираем контекст (профиль компании + RAG-поиск по базе знаний)
   и просим LLM заполнить форму заявки.
2) AI-критик — вторая модель проверяет черновик, выдаёт замечания и оценку уверенности.
"""
import json
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_router import LLMRouter
from app.ai.rag_engine import RAGEngine
from app.db.models import Application, Tender, User

logger = logging.getLogger("app.services.ai")

GENERATION_SYSTEM_PROMPT = (
    "Ты — эксперт по подготовке заявок на государственные и корпоративные закупки (44-ФЗ, 223-ФЗ). "
    "Заполняешь форму заявки точно на основании данных тендера и профиля компании. "
    "Не выдумывай реквизиты, которых нет в контексте. Отвечай строго в JSON."
)

CRITIC_SYSTEM_PROMPT = (
    "Ты — строгий рецензент тендерных заявок. Ищешь ошибки, несоответствия требованиям "
    "и риски отклонения комиссией. Отвечай строго в JSON."
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


async def _build_context(db: AsyncSession, user: User, tender: Tender) -> str:
    """Контекст для промпта: профиль компании + релевантные документы из RAG."""
    parts = []
    if user.company_profile_json:
        parts.append(f"[Профиль компании]\n{json.dumps(user.company_profile_json, ensure_ascii=False)}")
    elif user.company_name or user.inn:
        parts.append(
            f"[Профиль компании]\nНазвание: {user.company_name}\nИНН: {user.inn}"
        )

    rag = RAGEngine(db)
    query = f"{tender.title}. {tender.description or ''}"
    try:
        rag_context = await rag.search(query=query, user_id=user.id, top_k=5)
        if rag_context and "не найдено" not in rag_context.lower():
            parts.append(f"[База знаний]\n{rag_context}")
    except Exception as exc:  # noqa: BLE001
        # RAG не должен блокировать генерацию (нет эмбеддингов/ключей)
        logger.warning("RAG search failed, continue without context: %s", exc)

    return "\n\n".join(parts) if parts else "Дополнительный контекст отсутствует."


async def generate_application(
    db: AsyncSession,
    user: User,
    tender: Tender,
    application: Optional[Application] = None,
) -> Application:
    """
    Генерирует содержимое заявки и сохраняет его в Application(generated_content).
    Статус -> AI_GENERATED.
    """
    llm = LLMRouter()
    context = await _build_context(db, user, tender)

    user_prompt = (
        f"Данные тендера:\n"
        f"Название: {tender.title}\n"
        f"Площадка: {tender.platform}\n"
        f"Закон: {tender.law_type}\n"
        f"Начальная цена: {tender.initial_price}\n"
        f"Заказчик: {tender.customer_name}\n"
        f"Описание: {tender.description or '—'}\n\n"
        f"Контекст компании и база знаний:\n{context}\n\n"
        "Заполни форму заявки. Верни JSON вида "
        '{"offer_price": <число>, "delivery_terms": "...", "warranty": "...", '
        '"qualification": "...", "notes": "..."}'
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
    await db.flush()

    logger.info("Generated application %s for tender %s", application.id, tender.id)
    return application


async def critique_application(
    db: AsyncSession,
    tender: Tender,
    application: Application,
) -> Application:
    """
    AI-критик проверяет сгенерированный черновик.
    Сохраняет critic_report и ai_confidence_score (0..1).
    """
    llm = LLMRouter()

    user_prompt = (
        f"Проверь черновик заявки на соответствие требованиям тендера.\n\n"
        f"Тендер: {tender.title}\nНачальная цена: {tender.initial_price}\n"
        f"Черновик заявки (JSON):\n{json.dumps(application.generated_content, ensure_ascii=False)}\n\n"
        "Верни JSON вида "
        '{"confidence": <0..1>, "issues": ["..."], "recommendations": ["..."], '
        '"admitted": true/false}'
    )

    raw = await llm.chat(
        [
            {"role": "system", "text": CRITIC_SYSTEM_PROMPT},
            {"role": "user", "text": user_prompt},
        ]
    )
    report = _extract_json(raw)

    # confidence нормализуем в диапазон 0..1
    confidence = report.get("confidence")
    try:
        confidence = float(confidence)
        if confidence > 1:  # модель могла вернуть проценты
            confidence = confidence / 100.0
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = None

    application.critic_report = report
    application.ai_confidence_score = confidence
    await db.flush()

    logger.info(
        "Critic finished application %s: confidence=%s", application.id, confidence
    )
    return application
