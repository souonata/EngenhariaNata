from collections import defaultdict, deque
from time import time

from fastapi import Header, HTTPException, Request, status

from settings import Settings


class InMemoryRateLimiter:
    def __init__(self, max_requests_per_minute: int) -> None:
        self.max_requests_per_minute = max_requests_per_minute
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time()
        window_start = now - 60
        queue = self.hits[key]

        while queue and queue[0] < window_start:
            queue.popleft()

        if len(queue) >= self.max_requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='Limite de requisicoes por minuto excedido.',
            )

        queue.append(now)



def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get('x-forwarded-for', '')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'



def validate_bearer_token(settings: Settings, authorization: str | None) -> None:
    configured_tokens = settings.api_bearer_tokens
    if not configured_tokens:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='API_BEARER_TOKEN(S) nao configurado no backend.',
        )

    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Cabecalho Authorization Bearer obrigatorio.',
        )

    token = authorization.replace('Bearer ', '', 1).strip()
    if token not in configured_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Token Bearer invalido.',
        )


async def require_auth(authorization: str | None = Header(default=None)) -> str | None:
    return authorization
