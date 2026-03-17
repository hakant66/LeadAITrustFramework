from celery import Celery

from app.settings import settings

celery_app = Celery(
    "reg-svc",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.trust_decay"],
)

celery_app.conf.update(
    task_default_queue=settings.celery_queue,
    task_routes={"app.tasks.*": {"queue": settings.celery_queue}},
    task_track_started=True,
    task_time_limit=30,
)

# Explicit include above keeps worker registration deterministic.
