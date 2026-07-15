# App image for thissentencedoesnotexist (Litestar + uvicorn, managed by PDM).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PDM_CHECK_UPDATE=false

WORKDIR /app

# PDM drives dependency install from the lockfile.
RUN pip install --no-cache-dir pdm

# Install deps first (layer cached until the lock/manifest changes).
COPY pyproject.toml pdm.lock ./
RUN pdm install --prod --no-editable

# Then just the application code: the app module and the static UI it serves.
COPY app.py ./
COPY static/ ./static/

EXPOSE 8000

# Bind to 0.0.0.0 so the port is reachable from outside the container.
CMD ["pdm", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
