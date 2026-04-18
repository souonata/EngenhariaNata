import json
import uuid
from collections import defaultdict
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from security import InMemoryRateLimiter, get_client_ip, require_auth, validate_bearer_token
from settings import get_settings

settings = get_settings()
app = FastAPI(title='Engenharia NATA LLM API', version='1.1.0')

MODEL_ALIASES = {
    'hunter-alpha': 'hunter',
    'hunter_alpha': 'hunter',
    'hunter': 'hunter',
    'healer-alpha': 'healer',
    'healer_alpha': 'healer',
    'healer': 'healer',
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type'],
)

rate_limiter = InMemoryRateLimiter(max_requests_per_minute=settings.rate_limit_per_minute)
conversations: dict[str, list[dict[str, str]]] = defaultdict(list)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = Field(default=None, max_length=120)
    model: str | None = Field(default=None, max_length=160)


class HealthResponse(BaseModel):
    status: str
    model: str
    provider: str


@app.get('/health', response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status='ok',
        model=_default_model_for_provider(settings),
        provider=settings.llm_provider,
    )


@app.post('/chat/stream')
async def chat_stream(
    payload: ChatRequest,
    request: Request,
    authorization: str | None = Depends(require_auth),
) -> StreamingResponse:
    validate_bearer_token(settings, authorization)

    client_ip = get_client_ip(request)
    rate_limiter.check(client_ip)

    message = payload.message.strip()
    if len(message) > settings.max_prompt_chars:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Mensagem acima do limite de {settings.max_prompt_chars} caracteres.',
        )

    conversation_id = (payload.conversation_id or '').strip() or str(uuid.uuid4())
    history = conversations[conversation_id]

    messages: list[dict[str, str]] = []
    if settings.system_prompt:
        messages.append({'role': 'system', 'content': settings.system_prompt})

    if history:
        messages.extend(history[-20:])

    messages.append({'role': 'user', 'content': message})

    target_model = _resolve_target_model(settings, payload.model)

    if settings.llm_provider == 'openrouter' and not settings.openrouter_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='OPENROUTER_API_KEY nao configurada no backend.',
        )

    if settings.llm_provider == 'openrouter':
        request_payload = {
            'model': target_model,
            'messages': messages,
            'stream': True,
        }
    else:
        request_payload = {
            'model': target_model,
            'messages': messages,
            'stream': True,
        }

    async def event_generator():
        assistant_content_parts: list[str] = []
        try:
            timeout = httpx.Timeout(settings.request_timeout_seconds)
            async with httpx.AsyncClient(timeout=timeout) as client:
                if settings.llm_provider == 'openrouter':
                    stream_url = settings.openrouter_url
                    headers = _openrouter_headers(settings)
                else:
                    stream_url = settings.ollama_url
                    headers = None

                async with client.stream('POST', stream_url, json=request_payload, headers=headers) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        content = _extract_stream_content(settings.llm_provider, line)
                        if content:
                            assistant_content_parts.append(content)
                            yield sse_event({'type': 'token', 'content': content})

                        if _is_stream_done(settings.llm_provider, line):
                            break

            assistant_text = ''.join(assistant_content_parts).strip()
            history.append({'role': 'user', 'content': message})
            history.append({'role': 'assistant', 'content': assistant_text})

            if len(history) > 30:
                conversations[conversation_id] = history[-30:]

            yield sse_event({'type': 'done', 'conversation_id': conversation_id})
        except httpx.HTTPStatusError as error:
            detail = error.response.text or f'HTTP {error.response.status_code}'
            yield sse_event({'type': 'error', 'message': detail})
        except httpx.RequestError as error:
            provider_name = 'OpenRouter' if settings.llm_provider == 'openrouter' else 'Ollama'
            yield sse_event({'type': 'error', 'message': f'Falha ao conectar no {provider_name}: {error}'})
        except Exception as error:  # noqa: BLE001
            yield sse_event({'type': 'error', 'message': f'Erro interno: {error}'})

    return StreamingResponse(event_generator(), media_type='text/event-stream')



def sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _default_model_for_provider(current_settings) -> str:
    if current_settings.llm_provider == 'openrouter':
        return current_settings.openrouter_model_default or 'nao-configurado'
    return current_settings.ollama_model


def _resolve_target_model(current_settings, requested_model: str | None) -> str:
    raw = (requested_model or '').strip()
    alias = MODEL_ALIASES.get(raw.lower()) if raw else None

    if current_settings.llm_provider == 'openrouter':
        if alias == 'hunter':
            model = current_settings.openrouter_model_hunter_alpha.strip()
            if not model:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='OPENROUTER_MODEL_HUNTER_ALPHA nao configurado no backend.',
                )
            return model

        if alias == 'healer':
            model = current_settings.openrouter_model_healer_alpha.strip()
            if not model:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='OPENROUTER_MODEL_HEALER_ALPHA nao configurado no backend.',
                )
            return model

        if raw:
            return raw

        default_model = current_settings.openrouter_model_default.strip()
        if not default_model:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='OPENROUTER_MODEL_DEFAULT nao configurado no backend.',
            )
        return default_model

    return raw or current_settings.ollama_model


def _openrouter_headers(current_settings) -> dict[str, str]:
    headers = {
        'Authorization': f'Bearer {current_settings.openrouter_api_key}',
        'Content-Type': 'application/json',
    }
    if current_settings.openrouter_site_url:
        headers['HTTP-Referer'] = current_settings.openrouter_site_url
    if current_settings.openrouter_site_name:
        headers['X-Title'] = current_settings.openrouter_site_name
    return headers


def _extract_stream_content(provider: str, line: str) -> str:
    if provider == 'openrouter':
        if not line.startswith('data:'):
            return ''
        data = line.replace('data:', '', 1).strip()
        if not data or data == '[DONE]':
            return ''
        try:
            item: dict[str, Any] = json.loads(data)
        except json.JSONDecodeError:
            return ''
        choices = item.get('choices') or []
        if not choices:
            return ''
        delta = choices[0].get('delta') or {}
        return delta.get('content') or ''

    try:
        item = json.loads(line)
    except json.JSONDecodeError:
        return ''
    return item.get('message', {}).get('content', '') or ''


def _is_stream_done(provider: str, line: str) -> bool:
    if provider == 'openrouter':
        if not line.startswith('data:'):
            return False
        data = line.replace('data:', '', 1).strip()
        if data == '[DONE]':
            return True
        if not data:
            return False
        try:
            item: dict[str, Any] = json.loads(data)
        except json.JSONDecodeError:
            return False
        choices = item.get('choices') or []
        if not choices:
            return False
        return bool(choices[0].get('finish_reason'))

    try:
        item = json.loads(line)
    except json.JSONDecodeError:
        return False
    return bool(item.get('done'))
