from django.urls import path

from users.views import (
    CsrfTokenView,
    CurrentUserView,
    LoginView,
    LogoutView,
    RegisterView,
    UserDetailView,
    UserListView,
    UserRoleView,
)

app_name = "users"

urlpatterns = [
    path("auth/csrf/", CsrfTokenView.as_view(), name="csrf"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/me/", CurrentUserView.as_view(), name="me"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("users/", UserListView.as_view(), name="user-list"),
    path("users/<int:user_id>/role/", UserRoleView.as_view(), name="user-role"),
    path("users/<int:user_id>/", UserDetailView.as_view(), name="user-detail"),
]
