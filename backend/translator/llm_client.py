"""LLM client abstraction: Groq primary, Gemini fallback."""
import os
import httpx
import asyncio
from typing import Optional
from utils.logger import logger, log_llm_request


class RateLimitError(Exception):
    pass


class AllProvidersExhausted(Exception):
    pass


class GroqProvider:
    name = "groq"
    base_url = "https://api.groq.com/openai/v1/chat/completions"
    model = "llama-3.3-70b-versatile"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def complete(self, prompt: str, temperature: float = 0.1) -> str:
        if not self.api_key:
            raise RateLimitError("No Groq API key configured")

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "max_tokens": 4096,
                },
            )

            if resp.status_code == 429:
                raise RateLimitError("Groq rate limit hit")
            if resp.status_code != 200:
                logger.error(f"Groq error {resp.status_code}: {resp.text[:200]}")
                raise RateLimitError(f"Groq error: {resp.status_code}")

            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", 0)
            log_llm_request("groq", prompt, content, tokens)
            return content


class GeminiProvider:
    name = "gemini"
    model = "gemini-2.0-flash"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def url(self):
        return f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    async def complete(self, prompt: str, temperature: float = 0.1) -> str:
        if not self.api_key:
            raise RateLimitError("No Gemini API key configured")

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                self.url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.api_key,
                },
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": 4096,
                    },
                },
            )

            if resp.status_code == 429:
                raise RateLimitError("Gemini rate limit hit")
            if resp.status_code != 200:
                logger.error(f"Gemini error {resp.status_code}: {resp.text[:200]}")
                raise RateLimitError(f"Gemini error: {resp.status_code}")

            data = resp.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            log_llm_request("gemini", prompt, content)
            return content


class LLMClient:
    """Multi-provider LLM client with automatic fallback."""

    def __init__(self):
        self.providers = [
            GroqProvider(api_key=os.getenv("GROQ_API_KEY", "")),
            GeminiProvider(api_key=os.getenv("GEMINI_API_KEY", "")),
        ]
        self.current_provider_idx = 0
        self.provider_used = "groq"

    async def complete(self, prompt: str, temperature: float = 0.1) -> str:
        """Try providers in order, backing off when rate‑limited.

        The method will attempt each configured provider. If a provider
        returns a RateLimitError we retry it a few times with exponential
        backoff before moving on to the next provider.  This lets a single
        (slow) provider recover rather than immediately failing the whole
        job.  When all providers have been tried and none succeeded we raise
        AllProvidersExhausted.
        """
        errors = []
        # maximum number of retries per provider before giving up
        max_retries = 3
        for i in range(len(self.providers)):
            idx = (self.current_provider_idx + i) % len(self.providers)
            provider = self.providers[idx]
            retry_delay = 1.0
            for attempt in range(1, max_retries + 1):
                try:
                    result = await provider.complete(prompt, temperature)
                    self.provider_used = provider.name
                    # move pointer so next call starts with same provider
                    self.current_provider_idx = idx
                    return result
                except RateLimitError as e:
                    logger.warning(
                        f"{provider.name} rate limited (attempt {attempt}/{max_retries}): {e}"
                    )
                    errors.append(f"{provider.name}:{e}")
                    if attempt < max_retries:
                        # exponential backoff before retrying same provider
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    else:
                        # give up on this provider, try next one
                        break
            # small pause before switching to next provider to avoid thundering herd
            await asyncio.sleep(0.5)

        raise AllProvidersExhausted(
            f"All LLM providers exhausted. Errors: {'; '.join(errors)}"
        )

    def get_provider_name(self) -> str:
        return self.provider_used
