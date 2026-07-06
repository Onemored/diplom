# Конфигурация My Cloud

Документ описывает настройки local, test и production-окружений. Значения поступают из переменных окружения; секреты не хранятся в репозитории.

## Принципы

- Один набор исходного кода используется во всех окружениях.
- Безопасные значения по умолчанию допускаются только для локальной разработки и тестов.
- Production не запускается без обязательных секретов и адресов.
- `.env` используется локально и исключён из Git.
- `.env.example` содержит имена переменных и безопасные примеры без реальных паролей и токенов.
- Переменные проверяются при старте; ошибка конфигурации должна быть понятной и возникать до обслуживания запросов.
- В журналах не выводятся секреты, строки подключения, cookie и токены.

## Структура настроек Django

```text
backend/config/settings/
├── __init__.py
├── base.py
├── local.py
├── test.py
└── production.py
```

### `base.py`

Содержит общие приложения, middleware, шаблоны, локализацию, REST Framework, пользовательскую модель, логирование и настройки файлового хранилища.

### `local.py`

Содержит удобные параметры разработки:

- `DEBUG=True`;
- адреса localhost;
- вывод журнала в консоль;
- локальное подключение к PostgreSQL;
- разрешённый origin dev-сервера Vite.

### `test.py`

Содержит изолированные параметры тестов:

- отдельную тестовую БД PostgreSQL;
- временный каталог файлов;
- ускоренный хешер паролей;
- предсказуемый уровень журналирования;
- запрет обращения к production-хранилищу.

SQLite не используется для основной backend-проверки, чтобы тесты учитывали поведение PostgreSQL. Допускаются узкие unit-тесты без БД.

### `production.py`

Включает:

- `DEBUG=False`;
- обязательный `SECRET_KEY`;
- явные `ALLOWED_HOSTS` и `CSRF_TRUSTED_ORIGINS`;
- HTTPS и безопасные cookie;
- production PostgreSQL;
- собранную статику;
- постоянный каталог файлов;
- уровень журналирования не ниже `INFO`, если временно не включена диагностика.

## Выбор окружения

Переменная `DJANGO_SETTINGS_MODULE` задаёт модуль:

```text
config.settings.local
config.settings.test
config.settings.production
```

Для локальных команд значение можно безопасно задавать в `manage.py` по умолчанию как `config.settings.local`. Production-процесс всегда передаёт модуль явно.

## Переменные Django

| Переменная | Local | Production | Назначение |
|---|---:|---:|---|
| `DJANGO_SETTINGS_MODULE` | Необязательно | Обязательно | Выбор настроек |
| `DJANGO_SECRET_KEY` | Безопасное dev-значение | Обязательно | Подпись сессий и служебных данных |
| `DJANGO_DEBUG` | `true` | `false` | Режим отладки |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Обязательно | Список допустимых host через запятую |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Dev-адреса | Обязательно | Полные HTTPS-origin через запятую |
| `DJANGO_LOG_LEVEL` | `DEBUG` | `INFO` | Уровень консольного журнала |
| `DJANGO_TIME_ZONE` | `Asia/Yekaterinburg` | Явно | Часовой пояс отображения и администрирования |

`USE_TZ=True` остаётся включённым. В БД даты хранятся с учётом UTC, API возвращает ISO 8601 с часовым поясом, интерфейс форматирует их средствами браузера.

## Переменные PostgreSQL

Используется набор отдельных переменных, чтобы не раскрывать полную строку подключения в одном значении:

| Переменная | Пример local | Production |
|---|---|---:|
| `POSTGRES_DB` | `mycloud` | Обязательно |
| `POSTGRES_USER` | `mycloud` | Обязательно |
| `POSTGRES_PASSWORD` | `local_password` | Обязательно, секрет |
| `POSTGRES_HOST` | `127.0.0.1` | Обязательно |
| `POSTGRES_PORT` | `5432` | Обязательно |
| `POSTGRES_CONN_MAX_AGE` | `0` | Рекомендуется настроить |

Для production дополнительно включается проверка доступности БД перед миграциями. Пароль не передаётся аргументом командной строки и не печатается.

## Файловое хранилище

| Переменная | Пример local | Production |
|---|---|---:|
| `FILE_STORAGE_ROOT` | `./var/storage` | Обязательный абсолютный постоянный путь |
| `FILE_UPLOAD_MAX_BYTES` | `104857600` | Обязательно |
| `FILE_COMMENT_MAX_LENGTH` | `1000` | Обязательно |
| `FILE_NAME_MAX_LENGTH` | `255` | Обязательно |

Начальный лимит загрузки — 100 МБ. Он должен быть одинаково согласован в Django, веб-сервере и документации. Изменение лимита не требует изменения кода.

Каталог `FILE_STORAGE_ROOT`:

- не находится внутри исходного кода, `STATIC_ROOT` или доступного напрямую media-каталога;
- создаётся при развёртывании с минимальными правами пользователя приложения;
- сохраняется между перезапусками;
- включается в резервное копирование вместе с БД;
- в тестах заменяется временным каталогом.

## Начальный администратор

| Переменная | Local | Production | Назначение |
|---|---:|---:|---|
| `INITIAL_ADMIN_USERNAME` | `admin` | Обязательно при первом запуске | Логин начального администратора |
| `INITIAL_ADMIN_EMAIL` | Локальный адрес | Обязательно при первом запуске | Email администратора |
| `INITIAL_ADMIN_FULL_NAME` | `Администратор` | Обязательно при первом запуске | Отображаемое имя |
| `INITIAL_ADMIN_PASSWORD` | Задаётся вручную | Обязательно при первом запуске | Пароль, не сохраняемый в репозитории |

Идемпотентная management-команда:

- создаёт пользователя только при отсутствии;
- назначает `is_admin=True`;
- не меняет существующий пароль при повторном запуске;
- не выводит пароль;
- завершает работу с ошибкой, если при первом создании нет обязательных значений;
- после создания позволяет удалить `INITIAL_ADMIN_PASSWORD` из окружения процесса.

## Сессия, CSRF и HTTPS

Production-настройки:

```text
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Lax
CSRF_COOKIE_SECURE=True
CSRF_COOKIE_SAMESITE=Lax
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=<включается после проверки HTTPS>
```

Если HTTPS завершается на reverse proxy reg.ru, Django получает корректный признак защищённого запроса через доверенную настройку proxy. Заголовок нельзя принимать от произвольного клиента без контроля веб-сервера.

`CSRF_COOKIE_HTTPONLY` не включается, если frontend читает cookie для заголовка `X-CSRFToken`. Альтернативно токен можно получать из JSON-ответа `/api/v1/auth/csrf/`; окончательный вариант фиксируется тестом API-клиента.

## CORS и dev-сервер

В production frontend и API обслуживаются одним origin, поэтому CORS не требуется.

В local возможны два режима:

1. Vite proxy перенаправляет `/api` и `/public` на Django — предпочтительный режим, сохраняющий один origin для браузера.
2. Раздельные origin с явно разрешённым dev-адресом — только если proxy мешает конкретной проверке.

Предпочтительно использовать Vite proxy и не добавлять CORS-зависимость без необходимости.

## Статические файлы и SPA

| Переменная | Пример | Назначение |
|---|---|---|
| `DJANGO_STATIC_ROOT` | `./var/static` | Результат `collectstatic` |
| `FRONTEND_DIST_DIR` | `../frontend/dist` | Production-сборка Vite |

Последовательность production-сборки:

1. `yarn install --frozen-lockfile`;
2. `yarn build`;
3. сбор или копирование frontend-артефактов в доступное Django место;
4. `python manage.py collectstatic --noinput`;
5. миграции;
6. создание начального администратора;
7. запуск production-процесса.

Стратегия копирования уточняется после создания каркаса и проверяется на чистой сборке. API и публичное скачивание имеют приоритет над fallback SPA.

## Vite

Frontend использует только публичные несекретные переменные с префиксом `VITE_`.

| Переменная | Пример | Назначение |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Базовый путь API |
| `VITE_DEV_PROXY_TARGET` | `http://127.0.0.1:8000` | Цель local proxy, не попадает в production-код |

Секреты нельзя передавать через `VITE_`: такие значения встраиваются в JavaScript и доступны пользователю.

## Журналирование

Формат консольного сообщения включает:

- дату и время;
- уровень;
- имя logger;
- сообщение;
- request ID при наличии;
- идентификатор пользователя при наличии и необходимости.

Не журналируются:

- пароли;
- email в обычных сообщениях;
- session cookie;
- CSRF-токены;
- публичные токены;
- содержимое файлов;
- полный абсолютный путь;
- значения переменных окружения.

## Тестовое окружение

Тесты должны:

- создавать отдельную БД автоматически;
- использовать временный `FILE_STORAGE_ROOT`;
- очищать физические файлы после выполнения;
- не зависеть от локального `.env` разработчика;
- не обращаться к reg.ru или другим внешним сервисам;
- проверять production-настройки отдельным system check или smoke-командой без запуска реального сервера.

## Проверка конфигурации

Перед коммитом конфигурации выполняются:

```text
python manage.py check
python manage.py check --deploy --settings=config.settings.production
python manage.py test
yarn validate
```

Production-проверка получает безопасные временные значения обязательных переменных. Реальные секреты в команду, CI и журнал не вставляются.

## Содержимое будущего `.env.example`

```dotenv
DJANGO_SETTINGS_MODULE=config.settings.local
DJANGO_SECRET_KEY=replace-with-local-development-key
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://localhost:5173
DJANGO_LOG_LEVEL=DEBUG
DJANGO_TIME_ZONE=Asia/Yekaterinburg

POSTGRES_DB=mycloud
POSTGRES_USER=mycloud
POSTGRES_PASSWORD=replace-with-local-password
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_CONN_MAX_AGE=0

FILE_STORAGE_ROOT=./var/storage
FILE_UPLOAD_MAX_BYTES=104857600
FILE_COMMENT_MAX_LENGTH=1000
FILE_NAME_MAX_LENGTH=255

INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_FULL_NAME=Администратор
INITIAL_ADMIN_PASSWORD=replace-before-first-run

DJANGO_STATIC_ROOT=./var/static
FRONTEND_DIST_DIR=../frontend/dist
```

Пример предназначен только для локальной разработки. Production использует отдельные значения, переданные безопасным способом инфраструктурой.
