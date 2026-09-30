"""
RAG-система на pgvector.
Заменяет Milvus. Работает прямо в PostgreSQL.

Преимущества:
- Не нужен отдельный сервис
- ACID-транзакции
- Простые бэкапы
- Экономия 4 GB RAM
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.db.models import KnowledgeDocument
from app.ai.embeddings import get_embeddings

# Единый маркер отказа: модель обязана вернуть его, если ответа нет в документации.
NOT_FOUND_MESSAGE = "Требование не найдено в документации, проверьте вручную"


class RAGEngine:
    """
    RAG-движок на pgvector.
    Использует cosine similarity для поиска релевантных документов.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_document(
        self,
        text: str,
        user_id: int = None,
        source: str = "general",
        metadata: dict = None,
    ):
        """
        Добавляет документ в векторную БД.
        """
        embedding = await get_embeddings(text)
        
        doc = KnowledgeDocument(
            user_id=user_id,
            text=text,
            source=source,
            metadata_json=metadata or {},
            embedding=embedding,
        )
        self.db.add(doc)
        await self.db.flush()
        return doc.id

    async def search_chunks(
        self,
        query: str,
        user_id: int,
        top_k: int = 5,
        min_similarity: float = 0.5,
    ) -> list[dict]:
        """
        Возвращает релевантные фрагменты в структурированном виде (с источником
        и оценкой сходства). Нужен для «жёсткого» RAG: цитаты и проверка того,
        что модель отвечает только по документации.
        """
        query_embedding = await get_embeddings(query)

        sql = text("""
            SELECT 
                text,
                source,
                1 - (embedding <=> :query_embedding) as similarity
            FROM knowledge_documents
            WHERE 
                (user_id = :user_id OR user_id IS NULL)
                AND embedding <=> :query_embedding < :max_distance
            ORDER BY embedding <=> :query_embedding
            LIMIT :top_k
        """)

        max_distance = 1 - min_similarity

        result = await self.db.execute(sql, {
            "query_embedding": query_embedding,
            "user_id": user_id,
            "max_distance": max_distance,
            "top_k": top_k,
        })

        return [
            {"text": row[0], "source": row[1], "similarity": float(row[2])}
            for row in result.fetchall()
        ]

    async def search(
        self,
        query: str,
        user_id: int,
        top_k: int = 5,
        min_similarity: float = 0.5,
    ) -> str:
        """
        Ищет релевантные документы для подстановки в промпт LLM.
        """
        chunks = await self.search_chunks(query, user_id, top_k, min_similarity)

        if not chunks:
            return NOT_FOUND_MESSAGE

        context_parts = [
            f"[Источник: {c['source']}, сходство: {c['similarity']:.2f}]\n{c['text']}"
            for c in chunks
        ]

        return "\n\n---\n\n".join(context_parts)

    async def delete_user_documents(self, user_id: int):
        """Удаляет все документы пользователя."""
        result = await self.db.execute(
            text("DELETE FROM knowledge_documents WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        await self.db.flush()
        return result.rowcount




def build_grounded_context(chunks: list[dict]) -> tuple[str, bool]:
    """
    Собирает «жёсткий» RAG-контекст: только процитированные фрагменты
    документации с явным запретом отвечать из общих знаний.

    :return: (текст_контекста, найден_ли_контекст)
    """
    if not chunks:
        return (
            f"ДОКУМЕНТАЦИЯ НЕ НАЙДЕНА. Если для ответа требуется информация из документации, "
            f"верни строго: \"{NOT_FOUND_MESSAGE}\".",
            False,
        )

    parts = []
    for idx, chunk in enumerate(chunks, start=1):
        source = chunk.get("source") or "без источника"
        similarity = chunk.get("similarity", 0.0)
        parts.append(
            f"--- ФРАГМЕНТ {idx} [Источник: {source}, сходство: {similarity:.2f}] ---\n"
            f"{chunk.get('text', '')}"
        )

    header = (
        "ЕДИНСТВЕННЫЙ ДОСТУПНЫЙ ИСТОЧНИК ИСТИНЫ — фрагменты документации ниже.\n"
        "Запрещено использовать общие знания, догадки и типовые формулировки.\n"
        f"Если ответа нет в этих фрагментах — верни строго: \"{NOT_FOUND_MESSAGE}\".\n"
        "Каждое замечание обязательно подкрепляй дословной цитатой (evidence_quote) "
        "из фрагментов ниже."
    )
    separator = chr(10) + chr(10)
    return header + separator + separator.join(parts), True