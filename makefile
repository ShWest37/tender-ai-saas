.PHONY: help install dev test pull up down logs migrate admin restart clean

help: ## Показать справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Установить зависимости
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev: ## Запустить в режиме разработки
	docker compose up -d
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "Grafana: http://localhost:3001"

test: ## Запустить тесты
	docker compose exec backend pytest tests/ -v

pull: ## Скачать свежие образы из Docker Hub (сборка — в GitHub Actions)
	docker compose pull backend frontend

up: ## Скачать образы и запустить все сервисы
	docker compose pull backend frontend
	docker compose up -d

down: ## Остановить все сервисы
	docker compose down

logs: ## Показать логи
	docker compose logs -f

migrate: ## Применить миграции БД
	docker compose exec backend alembic upgrade head

admin: ## Создать администратора
	docker compose exec backend python -c "import asyncio; from app.db.session import AsyncSessionLocal; from app.db.models import User, UserRole; from app.core.security import get_password_hash; asyncio.run((lambda: __import__('asyncio').get_event_loop().run_until_complete(__import__('app.db.session', fromlist=['AsyncSessionLocal']).AsyncSessionLocal().__aenter__().then(lambda db: db.add(User(email='admin@bidflow.ru', hashed_password=get_password_hash('admin_password'), full_name='Admin', role=UserRole.ADMIN, is_active=True)) and db.commit())))())"

restart: ## Перезапустить все сервисы
	docker compose restart

clean: ## Очистить все данные (ВНИМАНИЕ: удалит БД!)
	docker compose down -v
	rm -rf pgdata/ prometheus_data/ grafana_data/