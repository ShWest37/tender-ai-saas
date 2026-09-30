# Tender AI Director

> SaaS-платформа для автоматизации участия в тендерах: поиск, AI-генерация заявок, аналитика и управление.

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.1+-000000.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

---

## 📋 Содержание

- [Обзор проекта](#-обзор-проекта)
- [Архитектура](#-архитектура)
- [Структура проекта](#-структура-проекта)
- [Модули и их назначение](#-модули-и-их-назначение)
- [Требования](#-требования)
- [Быстрый старт (Docker)](#-быстрый-старт-docker)
- [Локальная разработка](#-локальная-разработка)
- [Деплой на VPS](#-деплой-на-vps)
- [Переменные окружения](#-переменные-окружения)
- [API документация](#-api-документация)
- [Мониторинг](#-мониторинг)
- [Тестирование](#-тестирование)
- [CI/CD](#-cicd)
- [Безопасность](#-безопасность)

---

## 🎯 Обзор проекта

**Tender AI Director** — это комплексная SaaS-платформа, которая автоматизирует процесс участия в государственных и коммерческих тендерах. Платформа объединяет:

- **Парсинг тендеров** с крупнейших площадок (SberAST, RTS-Tender, Roseltorg)
- **AI-генерацию заявок** с использованием YandexGPT и GigaChat
- **Векторный поиск** по базе тендеров (pgvector)
- **Управление заявками** и отслеживание статусов
- **Аналитику** и отчётность
- **Уведомления** через email и MAX Messenger
- **Платёжную систему** YooKassa для подписок

### Ключевые возможности

| Функция | Описание |
|---------|----------|
| 🔍 Парсинг тендеров | Автоматический сбор с SberAST, RTS-Tender, Roseltorg |
| 🤖 AI-генерация | Создание заявок на основе параметров тендера |
| 🔎 AI-поиск поставщиков | Сверка ТЗ тендера с прайс-листами: соответствие, цена, сроки |
| 📊 Аналитика | Дашборды, графики, статистика участия |
| 🔔 Уведомления | Email, in-app, MAX Messenger |
| 💳 Подписки | Интеграция с YooKassa, тарифные планы, 3 дня демо после регистрации |
| 👥 Управление пользователями | Роли, права доступа, админ-панель |
| 📝 Блог | Контент-маркетинг, рубрики, поиск, управление статьями |

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx (Reverse Proxy)                   │
│                    :80 (HTTP) → :443 (HTTPS)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Frontend    │    │   Backend     │    │  Prometheus   │
│   Next.js     │◄──►│   FastAPI     │◄──►│  + Grafana    │
│   :3000       │    │   :8000       │    │  :9090/:3001  │
└───────────────┘    └───────┬───────┘    └───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │    │    Redis      │    │    Celery     │
│  + pgvector   │    │   (Cache)     │    │   Worker      │
│  :5432        │    │   :6379       │    │   + Beat      │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Технологический стек

**Backend:**
- Python 3.11+, FastAPI, Uvicorn
- SQLAlchemy 2.0 (async), Alembic
- PostgreSQL 16 + pgvector
- Redis, Celery
- Pydantic v2, python-jose, passlib
- Playwright, BeautifulSoup4 (парсинг)
- YandexGPT, GigaChat (AI)
- YooKassa (платежи)
- Prometheus Client (метрики)

**Frontend:**
- Next.js 14 (App Router)
- React 18, TypeScript
- Tailwind CSS, Framer Motion
- Axios, Recharts, React Markdown

**Инфраструктура:**
- Docker, Docker Compose
- Nginx (reverse proxy, SSL)
- Prometheus + Grafana (мониторинг)
- GitHub Actions (CI/CD)
- Ansible (деплой)

---

## 📁 Структура проекта

```
tender-ai-saas/
│
├── .github/workflows/          # CI/CD пайплайны
│   ├── ci.yml                  # Тестирование при push/PR
│   └── cd.yml                  # Сборка и публикация Docker Hub
│
├── backend/                    # FastAPI приложение
│   ├── Dockerfile              # Образ backend
│   ├── requirements.txt        # Python зависимости
│   ├── alembic.ini             # Конфигурация Alembic
│   ├── alembic/                # Миграции БД
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/           # Файлы миграций
│   │
│   └── app/
│       ├── main.py             # Точка входа FastAPI
│       │
│       ├── core/               # Ядро приложения
│       │   ├── config.py       # Настройки (Pydantic Settings)
│       │   ├── security.py     # JWT, хеширование паролей
│       │   └── dependencies.py # DI зависимости FastAPI
│       │
│       ├── db/                 # Слой данных
│       │   ├── session.py      # AsyncSession, engine
│       │   ├── models.py       # SQLAlchemy модели
│       │   └── schemas.py      # Pydantic схемы
│       │
│       ├── api/                # API роутеры
│       │   ├── router.py       # Сборный роутер
│       │   └── routers/        # Доменные роутеры
│       │       ├── auth.py     # Авторизация/регистрация
│       │       ├── tenders.py  # Тендеры
│       │       ├── applications.py  # Заявки
│       │       ├── decisions.py     # Решения
│       │       ├── payments.py      # Платежи
│       │       ├── notifications.py # Уведомления
│       │       ├── ai.py            # AI агент
│       │       ├── blog.py          # Блог
│       │       └── admin.py         # Админ-панель
│       │
│       ├── services/           # Бизнес-логика
│       │   ├── auth_service.py
│       │   ├── tender_service.py
│       │   ├── payment_service.py
│       │   ├── notification_service.py
│       │   ├── parsers/        # Парсеры тендеров
│       │   │   ├── base_parser.py
│       │   │   ├── sber_ast.py
│       │   │   ├── rts_tender.py
│       │   │   ├── roseltorg.py
│       │   │   └── parser_manager.py
│       │   └── crypto/         # КриптоПро (ЭЦП)
│       │       └── crypto_pro.py
│       │
│       ├── ai/                 # AI модуль
│       │   ├── llm_router.py   # Маршрутизация LLM
│       │   ├── rag_engine.py   # RAG поиск
│       │   ├── tender_generator.py  # Генерация заявок
│       │   ├── tender_critic.py     # Критика заявок
│       │   ├── embeddings.py   # Векторные эмбеддинги
│       │   └── prompts/        # Промпты
│       │
│       └── tasks/              # Celery задачи
│           ├── celery_app.py   # Конфигурация Celery
│           ├── parse_tasks.py  # Задачи парсинга
│           ├── ai_tasks.py     # AI задачи
│           └── notification_tasks.py
│
├── frontend/                   # Next.js приложение
│   ├── Dockerfile              # Образ frontend
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   │
│   └── src/
│       ├── app/                # App Router
│       │   ├── layout.tsx      # Корневой layout
│       │   ├── page.tsx        # Главная страница
│       │   ├── auth/           # Страницы авторизации
│       │   ├── dashboard/      # Личный кабинет
│       │   └── admin/          # Админ-панель
│       │
│       ├── components/         # React компоненты
│       │   ├── layout/         # Header, Footer, Sidebar
│       │   ├── ui/             # Button, Input, Modal
│       │   ├── home/           # Hero, Features, Pricing
│       │   └── modals/         # Register, Login
│       │
│       ├── lib/                # Утилиты
│       │   ├── api.ts          # Axios клиент
│       │   ├── auth.ts         # Хелперы авторизации
│       │   └── utils.ts        # Общие утилиты
│       │
│       └── hooks/              # React Hooks
│           ├── useAuth.ts
│           ├── useTenders.ts
│           └── useNotifications.ts
│
├── monitoring/                 # Мониторинг
│   ├── prometheus/
│   │   └── prometheus.yml      # Конфигурация Prometheus
│   └── grafana/
│       └── provisioning/       # Дашборды Grafana
│
├── nginx/                      # Nginx конфигурация
│   ├── nginx.conf              # Основной конфиг
│   └── ssl/                    # SSL сертификаты
│
├── ansible/                    # Ansible плейбуки
│   ├── inventory/              # Хосты
│   ├── playbooks/              # Плейбуки деплоя
│   └── roles/                  # Роли (docker, nginx, monitoring)
│
├── docs/                       # Документация
│   ├── architecture.md
│   ├── api.md
│   └── deployment.md
│
├── .env.example                # Пример переменных окружения
├── .env                        # Переменные окружения (не в git)
├── .gitignore
├── Makefile                    # Команды для разработки
├── docker-compose.yml          # Оркестрация сервисов
└── docker-compose.prod.yml     # Продакшн конфигурация
```

---

## 🧩 Модули и их назначение

### Backend модули

| Модуль | Путь | Назначение |
|--------|------|------------|
| **Core** | `app/core/` | Конфигурация, безопасность, зависимости |
| **Database** | `app/db/` | Модели, миграции, сессии |
| **API Routers** | `app/api/routers/` | REST API эндпоинты |
| **Services** | `app/services/` | Бизнес-логика, парсеры, криптография |
| **AI** | `app/ai/` | LLM маршрутизация, RAG, генерация |
| **Tasks** | `app/tasks/` | Фоновые задачи Celery |

### Frontend модули

| Модуль | Путь | Назначение |
|--------|------|------------|
| **App** | `src/app/` | Страницы (App Router) |
| **Components** | `src/components/` | Переиспользуемые компоненты |
| **Lib** | `src/lib/` | API клиент, утилиты |
| **Hooks** | `src/hooks/` | React хуки |

### Инфраструктурные модули

| Модуль | Путь | Назначение |
|--------|------|------------|
| **Monitoring** | `monitoring/` | Prometheus + Grafana |
| **Nginx** | `nginx/` | Reverse proxy, SSL |
| **Ansible** | `ansible/` | Автоматизация деплоя |
| **CI/CD** | `.github/workflows/` | GitHub Actions |

---

## 📋 Требования

### Для Docker запуска
- Docker 24.0+
- Docker Compose 2.20+

### Для локальной разработки
- Python 3.11+
- Node.js 18+
- PostgreSQL 16+
- Redis 7+

### Для VPS сервера
- Ubuntu 22.04+ / Debian 12+
- 2+ CPU, 4+ GB RAM
- 20+ GB диск

---

## 🚀 Быстрый старт (Docker)

### 1. Клонирование репозитория

```bash
git clone https://github.com/itech24/tender-ai-saas.git
cd tender-ai-saas
```

### 2. Настройка окружения

```bash
cp .env.example .env
```

Отредактируйте `.env` и заполните все необходимые переменные (см. [Переменные окружения](#-переменные-окружения)).

### 3. Запуск всех сервисов

```bash
docker compose up -d
```

### 4. Проверка работы

| Сервис | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/api/docs |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

### 5. Создание администратора

```bash
make admin
```

---

## 💻 Локальная разработка

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Запуск
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Запуск
npm run dev
```

### Тесты

```bash
# Все тесты
make test

# Конкретный модуль
docker compose exec backend pytest tests/test_auth.py -v
```

---

## 🌐 Деплой на VPS

### Автоматический деплой (Ansible)

```bash
cd ansible
ansible-playbook -i inventory/hosts.yml playbooks/deploy_app.yml
```

### Ручной деплой

#### 1. Подготовка сервера

```bash
# Установка Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install docker-compose-plugin
```

#### 2. Клонирование и настройка

```bash
git clone https://github.com/itech24/tender-ai-saas.git /opt/tender-ai
cd /opt/tender-ai
cp .env.example .env
nano .env  # Заполните переменные
```

#### 3. SSL сертификаты (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 4. Запуск

```bash
docker compose -f docker-compose.prod.yml up -d
```

#### 5. Миграции

```bash
docker compose exec backend alembic upgrade head
```

---

## ⚙️ Переменные окружения

### База данных
| Переменная | Описание | Пример |
|------------|----------|--------|
| `POSTGRES_USER` | Пользователь PostgreSQL | `tender_admin` |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL | `СЛОЖНЫЙ_ПАРОЛЬ_32_СИМВОЛА` |
| `POSTGRES_DB` | Имя базы данных | `tender_saas` |
| `DATABASE_URL` | Строка подключения | `postgresql+asyncpg://...` |

### Redis
| Переменная | Описание |
|------------|----------|
| `REDIS_URL` | URL подключения к Redis |
| `CELERY_BROKER_URL` | URL для Celery broker |

### JWT
| Переменная | Описание | Генерация |
|------------|----------|-----------|
| `SECRET_KEY` | Секретный ключ JWT | `openssl rand -hex 32` |
| `ALGORITHM` | Алгоритм шифрования | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Время жизни access token | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Время жизни refresh token | `7` |

### YooKassa
| Переменная | Описание |
|------------|----------|
| `YOOKASSA_SHOP_ID` | ID магазина |
| `YOOKASSA_SECRET_KEY` | Секретный ключ |
| `YOOKASSA_WEBHOOK_URL` | URL для webhook |

### AI (LLM)
| Переменная | Описание |
|------------|----------|
| `YANDEX_GPT_API_KEY` | API ключ Yandex Cloud |
| `YANDEX_GPT_FOLDER_ID` | ID каталога Yandex Cloud |
| `GIGACHAT_CLIENT_ID` | Client ID GigaChat |
| `GIGACHAT_CLIENT_SECRET` | Client Secret GigaChat |
| `DEFAULT_LLM_PROVIDER` | Провайдер по умолчанию |

### Email
| Переменная | Описание |
|------------|----------|
| `SMTP_HOST` | SMTP сервер |
| `SMTP_PORT` | Порт SMTP |
| `SMTP_USER` | Пользователь SMTP |
| `SMTP_PASSWORD` | Пароль SMTP |
| `EMAIL_FROM` | Email отправителя |

### Приложение
| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `APP_ENV` | Окружение | `production` |
| `APP_HOST` | Хост | `0.0.0.0` |
| `APP_PORT` | Порт | `8000` |
| `FRONTEND_URL` | URL фронтенда | `https://bidflow.ru` |
| `DEMO_DAYS` | Дней демо-режима | `3` |

---

## 📚 API документация

После запуска доступна интерактивная документация:

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **OpenAPI JSON**: http://localhost:8000/api/openapi.json

### Основные эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/v1/auth/register` | Регистрация |
| `POST` | `/api/v1/auth/login` | Авторизация |
| `GET` | `/api/v1/tenders` | Список тендеров |
| `POST` | `/api/v1/ai/generate` | AI генерация заявки |
| `POST` | `/api/v1/suppliers/search` | AI-поиск поставщиков по ТЗ тендера |
| `GET` | `/api/v1/suppliers/categories` | Каталог категорий (по умолчанию — IT-оборудование) |
| `GET` | `/api/v1/suppliers/sources` | Источники прайс-листов (админ) |
| `POST` | `/api/v1/suppliers/sources/{id}/sync` | Обновление прайса Excel/CSV/JSON (админ) |
| `GET` | `/api/v1/notifications` | Уведомления |
| `POST` | `/api/v1/payments/webhook` | Webhook YooKassa |

---

## 🔍 AI-поиск поставщиков

Функция сверяет техническое задание тендера (ТЗ, полученное после парсинга) со строками
прайс-листов поставщиков и возвращает строгий JSON:

```json
{
  "match_percentage": 92.5,
  "matched_specs": ["Процессор: Intel Core i5", "Цена укладывается в НМЦК"],
  "mismatched_specs": ["Гарантия: 12 месяцев — в предложении 24 месяца"],
  "warnings": ["Срок поставки не указан в прайсе — уточните у поставщика"]
}
```

**Как устроено**

1. `app/services/supplier_match.py` собирает ТЗ из тендера (характеристики, НМЦК, срок подачи),
   отбирает релевантные позиции прайса и отправляет пару «ТЗ + строка прайса» в YandexGPT
   (промпт: «Сравни требования ТЗ и предложение поставщика…»). При недоступности LLM работает
   детерминированная проверка — цена, сроки, наличие и характеристики.
2. `app/services/price_import.py` скачивает открытые прайс-листы (Excel/CSV/JSON) или ответ
   API и разбирает столбцы «Наименование», «Цена», «Артикул», «Срок поставки». Если источник
   недоступен — подключается встроенный демо-каталог, а ошибка показывается администратору.
3. В админ-панели: **Поставщики** — источники, пресеты B2B-дистрибьюторов (Ситилинк, Комус)
   и выбор категории по умолчанию («IT-оборудование (компьютеры, серверы, периферия)») в
   **Настройки сайта**.
4. В кабинете: карточка тендера → кнопка **«🔍 Найти поставщиков по этому ТЗ»** → таблица
   сравнения с цветовой индикацией: ✅ зелёный (соответствует), ⚠️ жёлтый (замечания),
   ❌ красный (не соответствует).

**Запуск сравнения из консоли**

```bash
cd backend

# встроенный пример (без вызова LLM)
python scripts/ai_supplier_compare.py --demo --no-llm

# ТЗ из БД + строка прайса из файла
python scripts/ai_supplier_compare.py --tender-id 123 --offer offer.json
```

---

## 📊 Мониторинг

### Prometheus
- **URL**: http://localhost:9090
- **Метрики**: HTTP запросы, время ответа, статусы

### Grafana
- **URL**: http://localhost:3001
- **Логин**: `admin` / `admin123` (по умолчанию)
- **Дашборды**: Tender Dashboard (предустановлен)

### Health Check
```bash
curl http://localhost:8000/health
# {"status": "ok", "env": "production"}
```

---

## 🧪 Тестирование

```bash
# Запуск всех тестов
make test

# Тесты с покрытием
docker compose exec backend pytest tests/ --cov=app --cov-report=html

# Конкретный тест
docker compose exec backend pytest tests/test_auth.py -v
```

---

## 🔄 CI/CD

Проект использует GitHub Actions для автоматизации:

### CI (`.github/workflows/ci.yml`)
- Запуск тестов при push и PR
- Проверка линтеров
- Проверка типов

### CD (`.github/workflows/cd.yml`)
- Сборка Docker образов
- Публикация в Docker Hub
- Автоматический деплой (опционально)

---

## 🔒 Безопасность

- **JWT токены** с ротацией refresh token
- **Rate limiting** на публичных эндпоинтах (slowapi)
- **CORS** настройки для фронтенда
- **bcrypt** для хеширования паролей
- **HTTPS** через Nginx + Let's Encrypt
- **Webhooks** с проверкой подписи

---

## 📝 Makefile команды

| Команда | Описание |
|---------|----------|
| `make install` | Установка зависимости |
| `make dev` | Запуск в режиме разработки |
| `make test` | Запуск тестов |
| `make up` | Скачать образы и запустить |
| `make down` | Остановить сервисы |
| `make logs` | Показать логи |
| `make migrate` | Применить миграции |
| `make admin` | Создать администратора |
| `make restart` | Перезапустить сервисы |
| `make clean` | Очистить все данные |

---

## 📄 Лицензия

Проприетарное ПО. Все права защищены.

---

## 📞 Поддержка

- **Email**: support@bidflow.ru
- **Документация**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/itech24/tender-ai-saas/issues)
