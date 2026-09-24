"""
Маршрутизатор LLM с автоматическим fallback.
Основной: YandexGPT Pro
Fallback: GigaChat Pro
"""
import httpx
import logging
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class LLMRouter:
    def __init__(self, provider: str = None):
        self.primary_provider = provider or settings.DEFAULT_LLM_PROVIDER
        self.fallback_provider = "gigachat" if self.primary_provider == "yandex_gpt" else "yandex_gpt"

    async def chat(self, messages: list[dict], max_retries: int = 2) -> str:
        """
        Вызов LLM с автоматическим fallback.
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                return await self._call_provider(self.primary_provider, messages)
            except Exception as e:
                last_error = e
                logger.warning(f"Primary provider {self.primary_provider} failed: {e}")
            
            try:
                return await self._call_provider(self.fallback_provider, messages)
            except Exception as e:
                last_error = e
                logger.warning(f"Fallback provider {self.fallback_provider} failed: {e}")
        
        raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")

    async def _call_provider(self, provider: str, messages: list[dict]) -> str:
        if provider == "yandex_gpt":
            return await self._yandex_gpt(messages)
        elif provider == "gigachat":
            return await self._gigachat(messages)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    async def _yandex_gpt(self, messages: list[dict]) -> str:
        url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
        headers = {
            "Authorization": f"Api-Key {settings.YANDEX_GPT_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "modelUri": f"gpt://{settings.YANDEX_GPT_FOLDER_ID}/yandexgpt/latest",
            "completionOptions": {
                "stream": False,
                "temperature": 0.3,
                "maxTokens": 8000,
            },
            "messages": messages,
        }
        
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["result"]["alternatives"][0]["message"]["text"]

    async def _gigachat(self, messages: list[dict]) -> str:
        from gigachat import GigaChat
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _sync_call():
            with GigaChat(
                credentials=f"{settings.GIGACHAT_CLIENT_ID}:{settings.GIGACHAT_CLIENT_SECRET}",
                verify_ssl_certs=False,
                model="GigaChat-Pro",
            ) as giga:
                response = giga.chat(messages)
                return response.choices[0].message.content
        
        return await loop.run_in_executor(None, _sync_call)