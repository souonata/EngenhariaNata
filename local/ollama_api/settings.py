import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    llm_provider: str
    ollama_url: str
    ollama_tags_url: str
    ollama_pull_url: str
    ollama_model: str
    ollama_model_coordinator: str
    ollama_model_mechanical: str
    ollama_model_electrical: str
    ollama_model_electronic: str
    ollama_model_vision: str
    ollama_model_embedding: str
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
    max_images_per_request: int
    tool_mode_default: str
    allowed_tools: set[str]
    rtfm_root: str
    specialist_default: str
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


def _parse_mode(raw_mode: str) -> str:
    mode = raw_mode.strip().lower()
    return mode if mode in {'off', 'safe', 'full'} else 'safe'


def _parse_csv_set(raw_value: str) -> set[str]:
    return {item.strip() for item in raw_value.split(',') if item.strip()}


def _default_rtfm_root() -> str:
    # Resolves to workspace-level RTFM folder when not explicitly configured.
    workspace_root = Path(__file__).resolve().parents[3]
    return str(workspace_root / 'RTFM')



def get_settings() -> Settings:
    return Settings(
        llm_provider=_parse_provider(os.getenv('LLM_PROVIDER', 'ollama')),
        ollama_url=os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434/api/chat').strip(),
        ollama_tags_url=os.getenv('OLLAMA_TAGS_URL', 'http://127.0.0.1:11434/api/tags').strip(),
        ollama_pull_url=os.getenv('OLLAMA_PULL_URL', 'http://127.0.0.1:11434/api/pull').strip(),
        ollama_model=os.getenv('OLLAMA_MODEL', 'gpt-oss:20b').strip(),
        ollama_model_coordinator=os.getenv('OLLAMA_MODEL_COORDINATOR', 'mistral:7b-instruct').strip(),
        ollama_model_mechanical=os.getenv('OLLAMA_MODEL_MECHANICAL', 'qwen2.5:7b-instruct').strip(),
        ollama_model_electrical=os.getenv('OLLAMA_MODEL_ELECTRICAL', 'qwen2.5-coder:7b').strip(),
        ollama_model_electronic=os.getenv('OLLAMA_MODEL_ELECTRONIC', 'qwen2.5-coder:7b').strip(),
        ollama_model_vision=os.getenv('OLLAMA_MODEL_VISION', 'minicpm-v').strip(),
        ollama_model_embedding=os.getenv('OLLAMA_MODEL_EMBEDDING', 'nomic-embed-text').strip(),
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
        max_images_per_request=max(0, int(os.getenv('MAX_IMAGES_PER_REQUEST', '4'))),
        tool_mode_default=_parse_mode(os.getenv('TOOL_MODE_DEFAULT', 'safe')),
        allowed_tools=_parse_csv_set(os.getenv('ALLOWED_TOOLS', 'rtfm_catalog_search,service_checklist')),
        rtfm_root=os.getenv('RTFM_ROOT', _default_rtfm_root()).strip(),
        specialist_default=os.getenv('SPECIALIST_DEFAULT', 'coordinator').strip(),
        system_prompt=os.getenv('SYSTEM_PROMPT', '').strip(),
    )
