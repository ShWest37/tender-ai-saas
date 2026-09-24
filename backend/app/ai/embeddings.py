"""
Получение эмбеддингов через YandexGPT Embeddings API.
С кешированием в Redis для экономии токенов.
"""
import httpx
import hashlib
import json
from app.core.config import get_settings
import redis.asyncio as redis

settings = get_settings()
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_embeddings(text: str, use_cache: bool = True) -> list[float]:
    """
    Получает эмбеддинг текста.
    """
    text = text[:2000]
    cache_key = f"embedding:{hashlib.md5(text.encode()).hexdigest()}"
    
    if use_cache:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding"
    headers = {
        "Authorization": f"Api-Key {settings.YANDEX_GPT_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "modelUri": f"emb://{settings.YANDEX_GPT_FOLDER_ID}/text-search-query/latest",
        "text": text,
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        embedding = resp.json()["embedding"]
    
    if use_cache:
        await redis_client.setex(
            cache_key,
            7 * 24 * 3600,
            json.dumps(embedding),
        )
    
    return embedding