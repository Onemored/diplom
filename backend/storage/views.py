import logging

from config.api import AuthenticationRequiredError
from django.contrib.auth import get_user_model
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from users.views import enforce_csrf

from storage.models import StoredFile
from storage.serializers import (
    FileOwnerSerializer,
    StoredFileSerializer,
    StoredFileUpdateSerializer,
)
from storage.services import (
    FileRequiredError,
    delete_stored_file,
    open_stored_file,
    save_uploaded_file,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class StorageAccessDeniedError(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Нет доступа к выбранному хранилищу."
    default_code = "storage_access_denied"


class NoChangesError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Не переданы изменения."
    default_code = "no_changes"


class FileListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        owner = _get_storage_owner(request)
        files = StoredFile.objects.filter(owner=owner).order_by("-uploaded_at", "-id")

        return Response(
            {
                "owner": FileOwnerSerializer(owner).data,
                "items": StoredFileSerializer(
                    files,
                    many=True,
                    context={"request": request},
                ).data,
            }
        )

    def post(self, request):
        owner = _get_storage_owner(request, allow_owner_query=True)
        enforce_csrf(request)

        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            raise FileRequiredError()

        stored_file = save_uploaded_file(
            owner=owner,
            uploaded_file=uploaded_file,
            comment=request.POST.get("comment", ""),
        )
        logger.info(
            "File uploaded: user_id=%s owner_id=%s file_id=%s size=%s",
            request.user.id,
            owner.id,
            stored_file.id,
            stored_file.size,
        )

        return Response(
            StoredFileSerializer(stored_file, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class FileDetailView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request, file_id):
        enforce_authenticated(request)
        enforce_csrf(request)
        stored_file = _get_accessible_file(request.user, file_id)

        serializer = StoredFileUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            raise NoChangesError()

        for field, value in serializer.validated_data.items():
            setattr(stored_file, field, value)
        stored_file.full_clean()
        stored_file.save(update_fields=tuple(serializer.validated_data.keys()))

        logger.info(
            "File updated: user_id=%s owner_id=%s file_id=%s",
            request.user.id,
            stored_file.owner_id,
            stored_file.id,
        )

        return Response(StoredFileSerializer(stored_file, context={"request": request}).data)

    def delete(self, request, file_id):
        enforce_authenticated(request)
        enforce_csrf(request)
        stored_file = _get_accessible_file(request.user, file_id)
        owner_id = stored_file.owner_id

        delete_stored_file(stored_file)

        logger.info(
            "File deleted: user_id=%s owner_id=%s file_id=%s",
            request.user.id,
            owner_id,
            file_id,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


def _get_storage_owner(request, allow_owner_query: bool = False):
    if not request.user.is_authenticated:
        raise AuthenticationRequiredError()

    owner_id = request.query_params.get("ownerId") or request.data.get("ownerId")
    if not owner_id:
        return request.user

    if not allow_owner_query and request.query_params.get("ownerId") is None:
        return request.user

    if not request.user.is_admin:
        raise StorageAccessDeniedError()

    return get_object_or_404(User, pk=owner_id)


def enforce_authenticated(request):
    if not request.user.is_authenticated:
        raise AuthenticationRequiredError()


def _get_accessible_file(user, file_id):
    queryset = StoredFile.objects.select_related("owner")
    if not user.is_admin:
        queryset = queryset.filter(owner=user)
    return get_object_or_404(queryset, pk=file_id)


class FileDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, file_id):
        enforce_authenticated(request)
        stored_file = _get_accessible_file(request.user, file_id)

        try:
            file_handle = open_stored_file(stored_file)
        except FileNotFoundError as error:
            raise NotFound() from error

        stored_file.last_downloaded_at = timezone.now()
        stored_file.save(update_fields=("last_downloaded_at",))

        logger.info(
            "File downloaded: user_id=%s owner_id=%s file_id=%s",
            request.user.id,
            stored_file.owner_id,
            stored_file.id,
        )

        return FileResponse(
            file_handle,
            as_attachment=True,
            filename=stored_file.original_name,
        )
