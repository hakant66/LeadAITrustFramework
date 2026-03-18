FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1

COPY apps/core-svc/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY apps/core-svc/ ./
RUN chmod +x /app/start.sh

EXPOSE 8001
CMD ["/app/start.sh"]
