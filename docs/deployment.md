# Production-развёртывание My Cloud

Документ фиксирует проверенный порядок развёртывания приложения на CloudVPS REG.RU.
Секреты, пароли, приватные SSH-ключи и реальные токены API не хранятся в репозитории.

## Проверенная площадка

```text
Провайдер: REG.RU CloudVPS
Регион: openstack-spb1
Тариф: c1-m1-d10-base
ОС: Ubuntu 24.04 LTS
Публичный адрес: https://cloud.apolos.ru/
IP: 89.104.71.144
```

На сервере используются системные пакеты Ubuntu:

- Python 3.12;
- PostgreSQL 16;
- Node.js LTS 22;
- Nginx;
- Certbot;
- Gunicorn из `backend/requirements/base.txt`.

## DNS

Для домена создана A-запись:

```text
cloud.apolos.ru -> 89.104.71.144
```

Перед выпуском сертификата запись должна отвечать у публичных DNS:

```bash
nslookup cloud.apolos.ru 8.8.8.8
nslookup cloud.apolos.ru 1.1.1.1
```

## Переменные production-окружения

Файл с переменными расположен на сервере вне Git:

```text
/opt/mycloud/.env
```

Минимальные значения:

```dotenv
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=cloud.apolos.ru,89.104.71.144,localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=https://cloud.apolos.ru,http://cloud.apolos.ru,http://89.104.71.144
DJANGO_SESSION_COOKIE_SECURE=true
DJANGO_CSRF_COOKIE_SECURE=true
DJANGO_SECURE_SSL_REDIRECT=true
DJANGO_SECURE_HSTS_SECONDS=0

POSTGRES_DB=mycloud
POSTGRES_USER=mycloud
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_CONN_MAX_AGE=60

FILE_STORAGE_ROOT=/opt/mycloud/var/storage
DJANGO_STATIC_ROOT=/opt/mycloud/var/static
FRONTEND_DIST_DIR=/opt/mycloud/frontend/dist
```

`DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` и `INITIAL_ADMIN_PASSWORD` задаются только на сервере.
После первого создания администратора пароль можно убрать из окружения процесса.

## Nginx

Nginx завершает HTTPS, отдаёт собранную статику и проксирует остальные запросы в Gunicorn.

Ключевые части конфигурации:

```nginx
server {
    server_name cloud.apolos.ru 89.104.71.144;
    client_max_body_size 100m;

    location /static/ {
        alias /opt/mycloud/var/static/;
        access_log off;
        expires 30d;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}
```

Проверка и перезагрузка:

```bash
nginx -t
systemctl reload nginx
```

## Сертификат HTTPS

Сертификат выпускается после появления DNS-записи:

```bash
certbot --nginx -d cloud.apolos.ru --non-interactive --agree-tos --register-unsafely-without-email --redirect
```

Certbot создаёт timer для автоматического продления:

```bash
systemctl is-active certbot.timer
certbot certificates
```

## Сборка и запуск приложения

Команды выполняются из `/opt/mycloud`:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements/base.txt
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn build

set -a
. ./.env
set +a

.venv/bin/python backend/manage.py migrate --noinput
.venv/bin/python backend/manage.py collectstatic --noinput
.venv/bin/python backend/manage.py bootstrap_admin
```

Приложение запускается systemd-сервисом `mycloud` через Gunicorn на `127.0.0.1:8000`.

Проверка:

```bash
systemctl is-active mycloud
systemctl status mycloud --no-pager
```

## Smoke-проверки после развёртывания

```bash
curl -I https://cloud.apolos.ru/
curl https://cloud.apolos.ru/api/v1/health/
curl -I https://cloud.apolos.ru/static/assets/<actual-build-file>.js
```

Через браузер проверяются:

1. открытие главной страницы;
2. регистрация нового пользователя;
3. вход и выход;
4. загрузка файла;
5. скачивание файла с оригинальным именем;
6. получение публичной ссылки;
7. скачивание по публичной ссылке без авторизации;
8. административный список пользователей.

## Резервное копирование

Минимальный состав резервной копии:

- дамп PostgreSQL базы `mycloud`;
- каталог пользовательских файлов `/opt/mycloud/var/storage`;
- серверный файл окружения `/opt/mycloud/.env`, сохранённый отдельно от публичного репозитория.

Ручной дамп БД:

```bash
sudo -u postgres pg_dump mycloud > /root/backups/mycloud-$(date +%F).sql
```

Архив файлов:

```bash
tar -czf /root/backups/mycloud-storage-$(date +%F).tar.gz /opt/mycloud/var/storage
```

Перед миграциями в production сначала создаётся свежая копия БД и пользовательских файлов.

## Автодеплой из GitHub Actions

После добавления GitHub Secrets workflow на `main` может загрузить новый код на сервер и выполнить сборку.

Необходимые secrets:

```text
DEPLOY_HOST=89.104.71.144
DEPLOY_USER=root
DEPLOY_PORT=22
DEPLOY_SSH_KEY=<private ssh key>
```

Workflow не должен хранить `.env`, токены REG.RU, пароль БД или пароль администратора.
Серверный `/opt/mycloud/.env` сохраняется между деплоями.
