# Локальная разработка My Cloud

Документ содержит промежуточные команды разработки. Итоговая инструкция будет перенесена в корневой `README.md` перед сдачей проекта.

## Требования

- Python 3.14;
- PostgreSQL 18;
- Node.js актуальной LTS-ветки;
- Yarn Classic 1.22.22;
- Git.

## Python

Из корня репозитория:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements/dev.txt
```

Проверка установленных зависимостей:

```bash
python -m pip check
```

## PostgreSQL на macOS

Установка и запуск через Homebrew:

```bash
brew install postgresql@18
brew services start postgresql@18
```

Создание отдельной роли и базы приложения:

```bash
createuser mycloud
createdb --owner=mycloud mycloud
psql postgres
```

В открывшейся консоли PostgreSQL пароль назначается интерактивно, чтобы не сохранять его в истории shell:

```text
\password mycloud
\q
```

Пароль должен совпадать с локальным `POSTGRES_PASSWORD`. Значения production здесь не используются.

Проверка службы:

```bash
brew services list
psql --host=127.0.0.1 --username=mycloud --dbname=mycloud
```

Остановка локальной службы, когда разработка не ведётся:

```bash
brew services stop postgresql@18
```

Остановка службы не удаляет кластер и данные. Команды `dropdb`, `dropuser`, удаление каталога PostgreSQL и переинициализация кластера в обычной работе не применяются.

## Переменные окружения

Создайте локальный файл из безопасного примера:

```bash
cp .env.example .env
```

Замените значения `replace-*` и убедитесь, что параметры PostgreSQL соответствуют созданной локальной роли и БД. Файл `.env` исключён из Git.

## Проверки Django

До создания первой миграции доступны проверки каркаса:

```bash
python backend/manage.py check
python backend/manage.py check --database default
python backend/manage.py test config.tests --settings=config.settings.test
```

Первая команда проверяет конфигурацию, вторая дополнительно подтверждает подключение к PostgreSQL, третья запускает базовые тесты.

## Качество backend-кода

```bash
ruff format --check backend
ruff check backend
coverage run backend/manage.py test config.tests --settings=config.settings.test
coverage report
```

Перед коммитом все применимые проверки должны завершаться успешно.

## Правило миграций

- Первая миграция создаётся только после добавления пользовательской модели и `AUTH_USER_MODEL`.
- После первой публикации существующие миграции не переписываются без отдельной причины.
- Новые поля и таблицы добавляются следующими миграциями без пересоздания БД.
- Перед production-миграциями создаётся резервная копия.
- Удаление или необратимое преобразование данных выполняется отдельным согласованным этапом.
