"""
Единая настройка логирования для всего приложения.
Вызывается один раз при старте (в app.main) и в воркерах Celery.
"""
import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """
    Настраивает корневой логгер: человекочитаемый формат в stdout.
    Идемпотентно — повторные вызовы не плодят дубли хендлеров.
    """
    root = logging.getLogger()
    root.setLevel(level.upper())

    # Убираем уже добавленные нами хендлеры, чтобы не было двойных логов
    for handler in list(root.handlers):
        if getattr(handler, "_tender_ai_handler", False):
            root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level.upper())
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    handler._tender_ai_handler = True
    root.addHandler(handler)

    # Приглушаем болтливые сторонние библиотеки
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
