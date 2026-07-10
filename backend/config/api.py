from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    ParseError,
    PermissionDenied,
    UnsupportedMediaType,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Конфликт данных."
    default_code = "conflict"

    def __init__(self, code: str, message: str):
        super().__init__(detail=message, code=code)


class CsrfPermissionDenied(PermissionDenied):
    default_detail = "CSRF-токен отсутствует или неверен."
    default_code = "csrf_failed"


class AuthenticationRequiredError(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Требуется вход в систему."
    default_code = "authentication_required"


class InvalidCredentialsError(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Неверный логин или пароль."
    default_code = "invalid_credentials"


def error_payload(code: str, message: str, fields: dict | None = None) -> dict:
    payload = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if fields:
        payload["error"]["fields"] = fields
    return payload


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    code = _get_error_code(exc)
    message = _get_error_message(exc, response.status_code)
    fields = response.data if isinstance(exc, ValidationError) else None

    return Response(
        error_payload(code=code, message=message, fields=fields),
        status=response.status_code,
        headers=response.headers,
    )


def csrf_failure(request, reason=""):
    return JsonResponse(
        error_payload(
            code="csrf_failed",
            message="CSRF-токен отсутствует или неверен.",
        ),
        status=status.HTTP_403_FORBIDDEN,
    )


def _get_error_code(exc) -> str:
    if isinstance(exc, ValidationError):
        return "validation_error"
    if isinstance(exc, AuthenticationFailed):
        return "invalid_credentials"
    if isinstance(exc, NotAuthenticated):
        return "authentication_required"
    if isinstance(exc, CsrfPermissionDenied):
        return "csrf_failed"
    if isinstance(exc, PermissionDenied):
        return "permission_denied"
    if isinstance(exc, ParseError):
        return "bad_request"
    if isinstance(exc, UnsupportedMediaType):
        return "unsupported_media_type"

    detail = getattr(exc, "detail", None)
    if hasattr(detail, "code"):
        return str(detail.code)

    return getattr(exc, "default_code", "internal_error")


def _get_error_message(exc, status_code: int) -> str:
    if isinstance(exc, ValidationError):
        return "Проверьте введённые данные."
    if isinstance(exc, AuthenticationFailed):
        return "Неверный логин или пароль."
    if isinstance(exc, NotAuthenticated):
        return "Требуется вход в систему."
    if isinstance(exc, CsrfPermissionDenied):
        return "CSRF-токен отсутствует или неверен."
    if isinstance(exc, PermissionDenied):
        return "Недостаточно прав для выполнения действия."
    if isinstance(exc, ParseError):
        return "Тело запроса невозможно обработать."
    if isinstance(exc, UnsupportedMediaType):
        return "Формат тела запроса не поддерживается."

    detail = getattr(exc, "detail", None)
    if isinstance(detail, str):
        return detail

    status_messages = {
        status.HTTP_400_BAD_REQUEST: "Некорректный запрос.",
        status.HTTP_404_NOT_FOUND: "Ресурс не найден.",
        status.HTTP_409_CONFLICT: "Конфликт данных.",
        status.HTTP_500_INTERNAL_SERVER_ERROR: "Внутренняя ошибка сервера.",
    }
    return status_messages.get(status_code, "Ошибка выполнения запроса.")
