from config.api import ConflictError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from users.models import username_validator

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    fullName = serializers.CharField(source="full_name")
    isAdmin = serializers.BooleanField(source="is_admin")

    class Meta:
        model = User
        fields = ("id", "username", "fullName", "email", "isAdmin")


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=20)
    fullName = serializers.CharField(max_length=255, source="full_name")
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        username = value.strip().lower()
        try:
            username_validator(username)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error

        if User.objects.filter(username__iexact=username).exists():
            raise ConflictError(
                code="username_already_exists",
                message="Логин уже зарегистрирован.",
            )
        return username

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ConflictError(
                code="email_already_exists",
                message="Email уже зарегистрирован.",
            )
        return email

    def validate_fullName(self, value):
        full_name = value.strip()
        if not full_name:
            raise serializers.ValidationError("Укажите полное имя.")
        return full_name

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        return value

    def validate(self, attrs):
        user = User(
            username=attrs["username"],
            email=attrs["email"],
            full_name=attrs["full_name"],
        )
        field_errors = {}

        try:
            user.full_clean(exclude=("password",))
        except DjangoValidationError as error:
            field_errors.update(error.message_dict)

        if field_errors:
            raise serializers.ValidationError(field_errors)

        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        return value.strip().lower()
