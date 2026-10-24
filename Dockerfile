# Wishlist's image: the built web app AND the API on one port (8080), so an install is this and Postgres.
# On start it waits for the database, applies migrations and creates its keys (app/boot.py), so nothing
# runs by hand. Built for linux/amd64 and linux/arm64 by .github/workflows/release.yml.

FROM --platform=$BUILDPLATFORM node:24 AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit
COPY frontend/ ./
# Empty: the API is on the same origin.
ARG VITE_API_URL=
RUN npm run build

# The exact Python pyproject pins (3.12.7), so uv builds the venv on it instead of downloading one into
# /root, where the app user could not run it.
FROM python:3.12.7-slim
ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONPATH=/app
WORKDIR /app/
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=backend/uv.lock,target=uv.lock \
    --mount=type=bind,source=backend/pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-dev --no-install-project
COPY backend/scripts /app/scripts
COPY backend/pyproject.toml backend/uv.lock backend/alembic.ini /app/
COPY backend/app /app/app
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev
COPY --from=web /web/dist /app/web

RUN useradd --create-home --uid 1000 app && chown -R app:app /app
USER app
ENV ENVIRONMENT=production \
    PORT=8080 \
    WEB_ROOT=/app/web
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s \
  CMD python -c "import urllib.request,os; urllib.request.urlopen('http://127.0.0.1:'+os.environ['PORT']+'/api/v1/utils/health-check/')"
CMD ["bash", "scripts/start-with-prestart.sh"]

LABEL org.opencontainers.image.title="Wishlist" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
