import logging

from config.api import (
    AuthenticationRequiredError,
    CsrfPermissionDenied,
    InvalidCredentialsError,
)
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import CSRFCheck
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from users.serializers import LoginSerializer, RegisterSerializer, UserSerializer

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
        if not request.user.is_authenticated:
            raise AuthenticationRequiredError()
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not request.user.is_authenticated:
            raise AuthenticationRequiredError()
        enforce_csrf(request)
        user_id = request.user.id
        logout(request)
        logger.info("User logged out: user_id=%s", user_id)

        return Response(status=status.HTTP_204_NO_CONTENT)
