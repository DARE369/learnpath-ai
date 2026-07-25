## LearnPath AI backend — container image for Fly.io.
#
# Replaces Railway's nixpacks.toml (Railway-only). The apt packages below are
# the exact system binaries the app needs at runtime:
#   tesseract-ocr  -> OCR engine for pytesseract (image + scanned-PDF text)
#   poppler-utils  -> pdftoppm, used by pdf2image to rasterise PDF pages
#   ffmpeg         -> audio extraction for the Whisper/Groq transcript fallback
# Python is pinned to 3.11 to match runtime.txt (wheels for anthropic/anyio/
# httpcore don't exist for 3.14 — see the project's local-dev note).

FROM python:3.11.9-slim

# System binaries. Kept in one layer; lists cleaned to keep the image small.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        poppler-utils \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first so this layer caches across code-only changes.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# App code.
COPY . .

# Fly sets PORT (defaults to 8080 via fly.toml internal_port). Bind to it so the
# same image works locally (PORT unset -> 8080) and on Fly.
ENV PORT=8080
EXPOSE 8080

# Single uvicorn worker — the app keeps in-process state (cost_tracker budgets,
# rate limiter, cache L1, the WebSocket connection registry, and the two
# APScheduler jobs). Multiple workers would each get their own copy and break
# those; scaling out horizontally needs Redis first (tracked in the ledger).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
