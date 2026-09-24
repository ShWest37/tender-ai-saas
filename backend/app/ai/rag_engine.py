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
        
        rows = result.fetchall()
        
        if not rows:
            return "Релевантных документов не найдено."
        
        context_parts = []
        for row in rows:
            text_content, source, similarity = row
            context_parts.append(
                f"[Источник: {source}, сходство: {similarity:.2f}]\n{text_content}"
            )
        
        return "\n\n---\n\n".join(context_parts)

    async def delete_user_documents(self, user_id: int):
        """Удаляет все документы пользователя."""
        result = await self.db.execute(
            text("DELETE FROM knowledge_documents WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        await self.db.flush()
        return result.rowcount