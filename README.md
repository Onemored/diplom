# My Cloud

Дипломный проект: облачное хранилище файлов с Django, PostgreSQL и React SPA.

Приложение позволяет пользователям регистрироваться, входить в систему, загружать файлы, скачивать их с оригинальным именем, редактировать название и комментарий, удалять файлы и получать обезличенные публичные ссылки. Администратор может управлять пользователями и открывать хранилище любого пользователя.

Production-версия: https://cloud.apolos.ru/

Исходное задание сохранено в [docs/assignment.md](docs/assignment.md).

## Возможности

- регистрация с проверкой логина, email и пароля;
- сессионная аутентификация и выход;
- роли обычного пользователя и администратора;
- административная таблица пользователей со статистикой файлов;
- загрузка файлов с комментарием;
- список файлов с размером, датой загрузки и датой последнего скачивания;
- переименование файла и изменение комментария;
- удаление файла из БД и с диска;
- авторизованное скачивание с оригинальным именем;
- публичная обезличенная ссылка на скачивание без входа;
- единый Django-сервер для API, публичных ссылок и production-сборки SPA;
- автоматические backend/frontend-проверки и CI.

## Стек

- Python 3.14;
- Django 6;
- Django REST Framework;
- PostgreSQL;
- React 19;
- Redux Toolkit;
- React Router;
- Vite;
- Yarn Classic 1.22.22;
- Vitest, Testing Library, Ruff, Coverage.py;
- GitHub Actions.

Production-развёртывание проверено на Ubuntu 24.04 LTS, Python 3.12, PostgreSQL 16, Node.js 24 LTS, Nginx, Gunicorn и Certbot.

## Структура проекта

```text
backend/   Django-проект, API, модели, миграции и backend-тесты
frontend/  React SPA на Vite
docs/      проектная документация и исходное задание
.github/   CI workflow
```

## Быстрый локальный запуск

### 1. Подготовка окружения

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements/dev.txt
corepack enable
yarn install --frozen-lockfile
```

### 2. PostgreSQL

Создайте локальную БД и пользователя:

```bash
createuser mycloud
createdb --owner=mycloud mycloud
psql postgres
```

В консоли PostgreSQL задайте пароль и разрешите создание тестовой БД:

```text
\password mycloud
ALTER ROLE mycloud CREATEDB;
\q
```

### 3. Переменные окружения

```bash
cp .env.example .env
```

В `.env` замените значения `replace-*`, особенно:

- `DJANGO_SECRET_KEY`;
- `POSTGRES_PASSWORD`;
- `INITIAL_ADMIN_PASSWORD`.

Файл `.env` исключён из Git.

### 4. Миграции и начальный администратор

```bash
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py bootstrap_admin
```

Команда `bootstrap_admin` идемпотентна: повторный запуск не меняет пароль существующего администратора.

### 5. Запуск разработки

В первом терминале:

```bash
.venv/bin/python backend/manage.py runserver
```

Во втором терминале:

```bash
yarn dev
```

Frontend запускается через Vite и обращается к API Django.

## Production-сборка единым Django-сервером

Соберите frontend:

```bash
yarn build
```

Production-команды выполняйте только с production-файлом окружения. Локальный `.env`,
созданный из `.env.example`, предназначен для разработки и не должен использоваться
на публичном сервере без замены значений безопасности.

```bash
set -a
. ./.env
set +a
```

Проверьте конфигурацию, примените миграции и соберите статику:

```bash
.venv/bin/python backend/manage.py check --settings=config.settings.production
.venv/bin/python backend/manage.py migrate --noinput
.venv/bin/python backend/manage.py collectstatic --noinput
.venv/bin/python backend/manage.py bootstrap_admin
```

После этого Django обслуживает:

- `/api/v1/` — REST API;
- `/public/files/<token>/` — публичное скачивание;
- `/static/assets/...` — собранные CSS/JS-файлы SPA;
- остальные пользовательские маршруты SPA через `frontend/dist/index.html`.

Перед production-запуском обязательно задайте:

- `DJANGO_SETTINGS_MODULE=config.settings.production`;
- безопасный `DJANGO_SECRET_KEY`;
- `DJANGO_ALLOWED_HOSTS`;
- `DJANGO_CSRF_TRUSTED_ORIGINS`;
- `DJANGO_SESSION_COOKIE_SECURE=true`;
- `DJANGO_CSRF_COOKIE_SECURE=true`;
- `DJANGO_SECURE_SSL_REDIRECT=true`;
- параметры PostgreSQL;
- постоянный `FILE_STORAGE_ROOT`;
- `DJANGO_STATIC_ROOT`;
- данные начального администратора для первого запуска.

Подробности конфигурации: [docs/configuration.md](docs/configuration.md).

## Развёртывание

Проверенный публичный контур работает на REG.RU CloudVPS:

```text
https://cloud.apolos.ru/
```

Для домена настроена A-запись `cloud.apolos.ru -> 89.104.71.144`, HTTPS-сертификат Let’s Encrypt и автоматическое продление через `certbot.timer`.

Подробный порядок развёртывания, nginx-конфигурация, smoke-проверки и переменные GitHub Secrets для автодеплоя описаны в [docs/deployment.md](docs/deployment.md).

## Проверки

Backend:

```bash
.venv/bin/ruff format --check backend
.venv/bin/ruff check backend
.venv/bin/coverage run backend/manage.py test config.tests users.tests storage.tests --settings=config.settings.test
.venv/bin/coverage report
```

Frontend:

```bash
yarn validate
```

`yarn validate` выполняет lint, тесты с покрытием и production-сборку. Для frontend настроены пороги покрытия 100% по statements, branches, functions и lines.

## Интерфейс

- меню меняется в зависимости от входа и роли пользователя;
- обычный пользователь видит только своё хранилище;
- администратор видит раздел администрирования и может открыть хранилище выбранного пользователя;
- кнопка «Публичная ссылка» получает обезличенный URL и пытается скопировать его в буфер;
- если копирование недоступно, ссылка остаётся в поле рядом с файлом для ручного копирования;
- опасные действия подтверждаются перед отправкой запроса;
- элементы управления доступны с клавиатуры и имеют заметный focus.

## Документация

- [docs/requirements.md](docs/requirements.md) — требования и трассировка;
- [docs/architecture.md](docs/architecture.md) — архитектура;
- [docs/api.md](docs/api.md) — REST API;
- [docs/frontend.md](docs/frontend.md) — frontend-структура;
- [docs/configuration.md](docs/configuration.md) — настройки окружений;
- [docs/deployment.md](docs/deployment.md) — production-развёртывание;
- [docs/development.md](docs/development.md) — рабочие команды разработки;
- [docs/assignment.md](docs/assignment.md) — исходное задание.

## Дополнительные материалы

- Django: https://docs.djangoproject.com/
- Django REST Framework: https://www.django-rest-framework.org/
- PostgreSQL: https://www.postgresql.org/docs/
- React: https://react.dev/
- Redux Toolkit: https://redux-toolkit.js.org/
- React Router: https://reactrouter.com/
- Vite: https://vite.dev/
- Yarn Classic: https://classic.yarnpkg.com/
- Vitest: https://vitest.dev/
- Ruff: https://docs.astral.sh/ruff/
- GitHub Actions: https://docs.github.com/actions
