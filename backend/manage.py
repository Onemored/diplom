#!/usr/bin/env python
import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as error:
        raise ImportError(
            "Django is not installed. Activate the virtual environment and install "
            "backend/requirements/dev.txt."
        ) from error

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
