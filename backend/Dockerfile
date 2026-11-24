FROM python:3.15-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /opt/app

COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable


FROM python:3.15-slim AS runtime

ARG UID=1010
ARG GID=1010

RUN groupadd -g "${GID}" paramo \
    && useradd --create-home --no-log-init -u "${UID}" -g paramo paramo

WORKDIR /opt/app

COPY --from=builder --chown=paramo:paramo /opt/app/.venv /opt/app/.venv
COPY --from=builder --chown=paramo:paramo /opt/app/src /opt/app/src

ENV PATH="/opt/app/.venv/bin:$PATH" \
    PYTHONPATH="/opt/app/src" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER paramo

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]