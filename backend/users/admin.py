from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class MyCloudUserAdmin(UserAdmin):
    list_display = (
        "username",
        "email",
        "full_name",
        "is_admin",
        "is_active",
        "date_joined",
    )
    list_filter = ("is_admin", "is_active", "is_staff", "is_superuser")
    search_fields = ("username", "email", "full_name")
    ordering = ("username",)
    readonly_fields = ("storage_path", "date_joined", "last_login")

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Персональная информация", {"fields": ("full_name", "email")}),
        (
            "My Cloud",
            {"fields": ("is_admin", "storage_path")},
        ),
        (
            "Права доступа Django",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Важные даты", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "full_name",
                    "is_admin",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
