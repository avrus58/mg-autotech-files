FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system --gid 10001 analyzer \
    && useradd --system --uid 10001 --gid analyzer --no-create-home --shell /usr/sbin/nologin analyzer \
    && mkdir -p /app \
    && chown analyzer:analyzer /app

WORKDIR /app

COPY --chown=analyzer:analyzer requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY --chown=analyzer:analyzer execution.py network_policy.py main.py ./

USER 10001:10001

EXPOSE 8010
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import urllib.request; response = urllib.request.urlopen('http://127.0.0.1:8010/health', timeout=2); response.close()"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010", "--workers", "1", "--limit-concurrency", "4", "--timeout-keep-alive", "5", "--no-access-log"]
