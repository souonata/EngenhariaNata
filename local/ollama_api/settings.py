import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    llm_provider: str
    ollama_url: str
    ollama_model: str
    openrouter_url: str
    openrouter_api_key: str
    openrouter_model_default: str
    openrouter_model_hunter_alpha: str
    openrouter_model_healer_alpha: str
    openrouter_site_url: str
    openrouter_site_name: str
    api_bearer_tokens: set[str]
    allowed_origins: list[str]
    request_timeout_seconds: float
    rate_limit_per_minute: int
    max_prompt_chars: int
    system_prompt: str



def _parse_allowed_origins(raw_origins: str) -> list[str]:
    origins = [item.strip() for item in raw_origins.split(',') if item.strip()]
    return origins or ['*']


def _parse_bearer_tokens(raw_tokens: str, fallback_token: str) -> set[str]:
    tokens = {item.strip() for item in raw_tokens.split(',') if item.strip()}
    if tokens:
        return tokens

    fallback = fallback_token.strip()
    return {fallback} if fallback else set()


def _parse_provider(raw_provider: str) -> str:
    provider = raw_provider.strip().lower()
    return provider if provider in {'ollama', 'openrouter'} else 'ollama'



def get_settings() -> Settings:
    return Settings(
        llm_provider=_parse_provider(os.getenv('LLM_PROVIDER', 'ollama')),
        ollama_url=os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434/api/chat').strip(),
        ollama_model=os.getenv('OLLAMA_MODEL', 'gpt-oss:20b').strip(),
        openrouter_url=os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions').strip(),
        openrouter_api_key=os.getenv('OPENROUTER_API_KEY', '').strip(),
        openrouter_model_default=os.getenv('OPENROUTER_MODEL_DEFAULT', '').strip(),
        openrouter_model_hunter_alpha=os.getenv('OPENROUTER_MODEL_HUNTER_ALPHA', '').strip(),
        openrouter_model_healer_alpha=os.getenv('OPENROUTER_MODEL_HEALER_ALPHA', '').strip(),
        openrouter_site_url=os.getenv('OPENROUTER_SITE_URL', '').strip(),
        openrouter_site_name=os.getenv('OPENROUTER_SITE_NAME', '').strip(),
        api_bearer_tokens=_parse_bearer_tokens(
            os.getenv('API_BEARER_TOKENS', ''),
            os.getenv('API_BEARER_TOKEN', ''),
        ),
        allowed_origins=_parse_allowed_origins(os.getenv('ALLOWED_ORIGINS', '*')),
        request_timeout_seconds=float(os.getenv('REQUEST_TIMEOUT_SECONDS', '120')),
        rate_limit_per_minute=max(1, int(os.getenv('RATE_LIMIT_PER_MINUTE', '20'))),
        max_prompt_chars=max(100, int(os.getenv('MAX_PROMPT_CHARS', '4000'))),
        system_prompt=os.getenv('SYSTEM_PROMPT', '').strip(),
    )
