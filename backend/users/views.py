import logging

from config.api import (
    AuthenticationRequiredError,
    ConflictError,
    CsrfPermissionDenied,
    InvalidCredentialsError,
)
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from storage.services import schedule_user_storage_cleanup

from users.serializers import (
    AdminUserSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserRoleSerializer,
    UserSerializer,
    with_storage_stats,
)

User = UserSerializer.Meta.model

logger = logging.getLogger(__name__)


def enforce_csrf(request):
    reason = CSRFCheck(lambda current_request: None).process_view(
        request._request,
        None,
        (),
        {},
    )
    if reason:
        raise CsrfPermissionDenied()


def enforce_authenticated(request):
    if not request.user.is_authenticated:
        raise AuthenticationRequiredError()


def enforce_admin(request):
    enforce_authenticated(request)
    if not request.user.is_active or not request.user.is_admin:
        raise PermissionDenied()


def has_other_active_admin(user):
    return User.objects.filter(is_active=True, is_admin=True).exclude(pk=user.pk).exists()


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        enforce_csrf(request)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        logger.info("User registered: user_id=%s", user.id)

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            logger.warning("User login rejected")
            raise InvalidCredentialsError()

        login(request, user)
        logger.info("User logged in: user_id=%s", user.id)

        return Response(UserSerializer(user).data)


class CurrentUserView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        enforce_authenticated(request)
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        enforce_authenticated(request)
        enforce_csrf(request)
        user_id = request.user.id
        logout(request)
        logger.info("User logged out: user_id=%s", user_id)

        return Response(status=status.HTTP_204_NO_CONTENT)


class UserListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        enforce_admin(request)
        users = with_storage_stats(User.objects.order_by("-date_joined", "-id"))

        return Response({"items": AdminUserSerializer(users, many=True).data})


class UserRoleView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request, user_id):
        enforce_admin(request)
        enforce_csrf(request)

        serializer = UserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_user = get_object_or_404(User, pk=user_id)
        next_is_admin = serializer.validated_data["is_admin"]

        if target_user.is_admin and not next_is_admin and not has_other_active_admin(target_user):
            raise ConflictError(
                code="last_admin_required",
                message="Нельзя оставить систему без активного администратора.",
            )

        target_user.is_admin = next_is_admin
        target_user.save(update_fields=("is_admin",))
        logger.info(
            "User role updated: actor_id=%s target_id=%s is_admin=%s",
            request.user.id,
            target_user.id,
            target_user.is_admin,
        )

        user = with_storage_stats(User.objects.filter(pk=target_user.pk)).get()
        return Response(AdminUserSerializer(user).data)


class UserDetailView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request, user_id):
        enforce_admin(request)
        enforce_csrf(request)

        target_user = get_object_or_404(User, pk=user_id)
        if target_user.pk == request.user.pk:
            raise ConflictError(
                code="cannot_delete_current_user",
                message="Нельзя удалить текущую учётную запись.",
            )
        if target_user.is_admin and not has_other_active_admin(target_user):
            raise ConflictError(
                code="last_admin_required",
                message="Нельзя оставить систему без активного администратора.",
            )

        storage_path = target_user.storage_path
        target_user_id = target_user.id

        with transaction.atomic():
            target_user.delete()
            schedule_user_storage_cleanup(storage_path)

        logger.info(
            "User deleted: actor_id=%s target_id=%s",
            request.user.id,
            target_user_id,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
