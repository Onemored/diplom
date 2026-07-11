import logging

from config.api import AuthenticationRequiredError
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from users.views import enforce_csrf

from storage.models import StoredFile
from storage.serializers import FileOwnerSerializer, StoredFileSerializer
from storage.services import FileRequiredError, save_uploaded_file

User = get_user_model()
logger = logging.getLogger(__name__)


class StorageAccessDeniedError(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Нет доступа к выбранному хранилищу."
    default_code = "storage_access_denied"


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


class FileDownloadPlaceholderView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, file_id):
        raise NotFound()
