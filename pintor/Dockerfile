FROM python:3.11-slim@sha256:9c900dea9e8fb7e16277c179b555cc72d29a352dbc33cff48ad5a0412fd5bfc7

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PINTOR_WEB_ROOT=/data

WORKDIR /app

COPY pyproject.toml README.md requirements-web.lock ./
COPY src ./src

RUN python -m pip install --no-cache-dir -r requirements-web.lock \
    && python -m pip install --no-cache-dir --no-deps rapidocr==3.9.2 \
    && rapidocr check \
    && python -m pip install --no-cache-dir --no-build-isolation --no-deps . \
    && groupadd --gid 10001 pintor \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin pintor \
    && mkdir -p /data \
    && chown -R pintor:pintor /data

USER 10001:10001

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=3)"

CMD ["pintor-web"]
