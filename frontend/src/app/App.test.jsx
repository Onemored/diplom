import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.jsx";
import { createAppStore, fetchCurrentUser, setAnonymous } from "./store.js";

function renderApp(
  initialPath = "/",
  preloadedAuth = { user: null, status: "anonymous", error: null },
  preloadedState = {},
) {
  const store = createAppStore({
    auth: preloadedAuth,
    ...preloadedState,
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
}

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the home page", () => {
    renderApp();

    expect(screen.getByRole("heading", { name: "My Cloud" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Зарегистрироваться" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("renders the login route", () => {
    renderApp("/login");

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("redirects authenticated user from login", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    renderApp("/login", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
  });

  it("validates required login fields", async () => {
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Укажите логин и пароль.");
  });

  it("logs in user and navigates to storage", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        if (url === "/api/v1/users/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ items: [] }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              id: 1,
              username: "user123",
              fullName: "Алексей Петров",
              email: "user@example.com",
              isAdmin: false,
            }),
        });
      }),
    );
    renderApp("/login");

    await user.type(screen.getByLabelText("Логин"), "user123");
    await user.type(screen.getByLabelText("Пароль"), "Strong#7");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("heading", { name: "Файловое хранилище" })).toBeInTheDocument();
  });

  it("logs in admin and navigates to users", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              id: 1,
              username: "admin123",
              fullName: "Администратор",
              email: "admin@example.com",
              isAdmin: true,
            }),
        });
      }),
    );
    renderApp("/login");

    await user.type(screen.getByLabelText("Логин"), "admin123");
    await user.type(screen.getByLabelText("Пароль"), "Strong#7");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
  });

  it("shows login server error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 401,
          ok: false,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              error: {
                code: "invalid_credentials",
                message: "Неверный логин или пароль.",
              },
            }),
        });
      }),
    );
    renderApp("/login");

    await user.type(screen.getByLabelText("Логин"), "user123");
    await user.type(screen.getByLabelText("Пароль"), "Wrong#7");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Неверный логин или пароль.");
  });

  it("renders authenticated user navigation", () => {
    renderApp("/", {
      user: {
        id: 1,
        username: "user123",
        fullName: "Алексей Петров",
        email: "user@example.com",
        isAdmin: false,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("link", { name: "Мои файлы" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Пользователи" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выход" })).toBeInTheDocument();
  });

  it("renders admin navigation", () => {
    renderApp("/", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("link", { name: "Пользователи" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });

  it("renders the register route", () => {
    renderApp("/register");

    expect(screen.getByRole("heading", { name: "Регистрация" })).toBeInTheDocument();
  });

  it("redirects authenticated user from register", () => {
    renderApp("/register", {
      user: {
        id: 1,
        username: "user123",
        fullName: "Алексей Петров",
        email: "user@example.com",
        isAdmin: false,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("heading", { name: "Файловое хранилище" })).toBeInTheDocument();
  });

  it("redirects authenticated admin from register", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    renderApp("/register", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
  });

  it("validates register form before request", async () => {
    const user = userEvent.setup();
    renderApp("/register");

    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(screen.getAllByRole("alert")).toHaveLength(4);
    expect(screen.getByText(/Логин должен начинаться/)).toBeInTheDocument();
  });

  it("validates mismatched register passwords", async () => {
    const user = userEvent.setup();
    renderApp("/register");

    await user.type(screen.getByLabelText("Логин"), "user123");
    await user.type(screen.getByLabelText("Полное имя"), "Алексей Петров");
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "Strong#7");
    await user.type(screen.getByLabelText("Повтор пароля"), "Strong#8");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(screen.getByText("Пароли не совпадают.")).toBeInTheDocument();
  });

  it("registers user and navigates to login", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 201,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              id: 1,
              username: "user123",
              fullName: "Алексей Петров",
              email: "user@example.com",
              isAdmin: false,
            }),
        });
      }),
    );
    renderApp("/register");

    await user.type(screen.getByLabelText("Логин"), "user123");
    await user.type(screen.getByLabelText("Полное имя"), "Алексей Петров");
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "Strong#7");
    await user.type(screen.getByLabelText("Повтор пароля"), "Strong#7");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Регистрация завершена. Теперь войдите в приложение.")).toBeInTheDocument();
  });

  it("shows register field error from server", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 409,
          ok: false,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              error: {
                code: "username_already_exists",
                message: "Логин уже зарегистрирован.",
              },
            }),
        });
      }),
    );
    renderApp("/register");

    await user.type(screen.getByLabelText("Логин"), "user123");
    await user.type(screen.getByLabelText("Полное имя"), "Алексей Петров");
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Пароль"), "Strong#7");
    await user.type(screen.getByLabelText("Повтор пароля"), "Strong#7");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Логин уже зарегистрирован.");
  });

  it("redirects guest from storage route to login", () => {
    renderApp("/storage");

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("renders the storage route for authenticated user", () => {
    renderApp("/storage", {
      user: {
        id: 1,
        username: "user123",
        fullName: "Алексей Петров",
        email: "user@example.com",
        isAdmin: false,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("heading", { name: "Файловое хранилище" })).toBeInTheDocument();
  });

  it("redirects guest from admin users route to login", () => {
    renderApp("/admin/users");

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("redirects regular user from admin users route to storage", () => {
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "user123",
        fullName: "Алексей Петров",
        email: "user@example.com",
        isAdmin: false,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("heading", { name: "Файловое хранилище" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Раздел доступен только администратору.");
  });

  it("renders the admin users route for admin", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: 1,
                  username: "admin123",
                  fullName: "Администратор",
                  email: "admin@example.com",
                  isAdmin: true,
                  fileCount: 0,
                  storageSize: 0,
                },
                {
                  id: 2,
                  username: "user123",
                  fullName: "Алексей Петров",
                  email: "user@example.com",
                  isAdmin: false,
                  fileCount: 4,
                  storageSize: 2457600,
                },
              ],
            }),
        }),
      ),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем пользователей.");
  });

  it("shows loaded users table for admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              items: [
                {
                  id: 1,
                  username: "admin123",
                  fullName: "Администратор",
                  email: "admin@example.com",
                  isAdmin: true,
                  fileCount: 0,
                  storageSize: 0,
                },
                {
                  id: 2,
                  username: "user123",
                  fullName: "Алексей Петров",
                  email: "user@example.com",
                  isAdmin: false,
                  fileCount: 4,
                  storageSize: 2457600,
                },
              ],
            }),
        }),
      ),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(await screen.findByRole("table", { name: "Пользователи My Cloud" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "admin123" })).toBeInTheDocument();
    expect(screen.getByText("0 Б")).toBeInTheDocument();
    expect(screen.getByText("2,3 МБ")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Открыть файлы" })[0]).toHaveAttribute(
      "href",
      "/admin/users/1/files",
    );
  });

  it("updates user role after confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/users/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: 1,
                    username: "admin123",
                    fullName: "Администратор",
                    email: "admin@example.com",
                    isAdmin: true,
                    fileCount: 0,
                    storageSize: 0,
                  },
                  {
                    id: 2,
                    username: "user123",
                    fullName: "Алексей Петров",
                    email: "user@example.com",
                    isAdmin: false,
                    fileCount: 4,
                    storageSize: 2457600,
                  },
                ],
              }),
          });
        }
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              id: 2,
              username: "user123",
              fullName: "Алексей Петров",
              email: "user@example.com",
              isAdmin: true,
              fileCount: 4,
              storageSize: 2457600,
            }),
        });
      }),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(await screen.findByRole("button", { name: "Сделать администратором" }));

    expect(window.confirm).toHaveBeenCalledWith("Сделать user123 администратором?");
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Сделать пользователем" })).toHaveLength(2),
    );
  });

  it("does not update user role when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 2,
                username: "user123",
                fullName: "Алексей Петров",
                email: "user@example.com",
                isAdmin: false,
                fileCount: 0,
                storageSize: 0,
              },
            ],
          }),
      }),
    );
    vi.stubGlobal("confirm", vi.fn(() => false));
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(await screen.findByRole("button", { name: "Сделать администратором" }));

    expect(window.confirm).toHaveBeenCalledWith("Сделать user123 администратором?");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows role update error for admin", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/users/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: 1,
                    username: "admin123",
                    fullName: "Администратор",
                    email: "admin@example.com",
                    isAdmin: true,
                    fileCount: 0,
                    storageSize: 0,
                  },
                ],
              }),
          });
        }
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 409,
          ok: false,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              error: {
                code: "last_admin_required",
                message: "Нельзя убрать последнего администратора.",
              },
            }),
        });
      }),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(await screen.findByRole("button", { name: "Сделать пользователем" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Нельзя убрать последнего администратора.",
    );
  });

  it("deletes user after confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/users/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: 2,
                    username: "user123",
                    fullName: "Алексей Петров",
                    email: "user@example.com",
                    isAdmin: false,
                    fileCount: 0,
                    storageSize: 0,
                  },
                ],
              }),
          });
        }
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 204,
          ok: true,
          headers: new Headers(),
        });
      }),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(await screen.findByRole("button", { name: "Удалить" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Удалить пользователя user123? Это действие нельзя отменить.",
    );
    await waitFor(() =>
      expect(screen.queryByRole("rowheader", { name: "user123" })).not.toBeInTheDocument(),
    );
  });

  it("does not delete user when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 2,
                username: "user123",
                fullName: "Алексей Петров",
                email: "user@example.com",
                isAdmin: false,
                fileCount: 0,
                storageSize: 0,
              },
            ],
          }),
      }),
    );
    vi.stubGlobal("confirm", vi.fn(() => false));
    vi.stubGlobal("fetch", fetchMock);
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(await screen.findByRole("button", { name: "Удалить" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Удалить пользователя user123? Это действие нельзя отменить.",
    );
    expect(screen.getByRole("rowheader", { name: "user123" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows delete user error for admin", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/users/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: 1,
                    username: "admin123",
                    fullName: "Администратор",
                    email: "admin@example.com",
                    isAdmin: true,
                    fileCount: 0,
                    storageSize: 0,
                  },
                ],
              }),
          });
        }
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.reject(new Error("network"));
      }),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(await screen.findByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось подключиться к серверу.",
    );
  });

  it("renders disabled user action buttons while request is running", () => {
    renderApp(
      "/admin/users",
      {
        user: {
          id: 1,
          username: "admin123",
          fullName: "Администратор",
          email: "admin@example.com",
          isAdmin: true,
        },
        status: "authenticated",
        error: null,
      },
      {
        users: {
          items: [
            {
              id: 2,
              username: "user123",
              fullName: "Алексей Петров",
              email: "user@example.com",
              isAdmin: false,
              fileCount: 0,
              storageSize: 10737418240,
            },
          ],
          status: "succeeded",
          error: null,
          roleUpdatingId: 2,
          deletingId: 2,
        },
      },
    );

    expect(screen.getByText("10 ГБ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сделать администратором" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeDisabled();
  });

  it("shows empty users list state for admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () => Promise.resolve({ items: [] }),
        }),
      ),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(await screen.findByText("Пользователей пока нет.")).toBeInTheDocument();
  });

  it("shows users loading error for admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 403,
          ok: false,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              error: {
                code: "admin_required",
                message: "Доступно только администратору.",
              },
            }),
        }),
      ),
    );
    renderApp("/admin/users", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Доступно только администратору.");
  });

  it("renders selected user storage route for admin", () => {
    renderApp("/admin/users/7/files", {
      user: {
        id: 1,
        username: "admin123",
        fullName: "Администратор",
        email: "admin@example.com",
        isAdmin: true,
      },
      status: "authenticated",
      error: null,
    });

    expect(screen.getByRole("heading", { name: "Файловое хранилище" })).toBeInTheDocument();
  });

  it("renders the not found route", () => {
    renderApp("/unknown");

    expect(screen.getByRole("heading", { name: "Страница не найдена" })).toBeInTheDocument();
  });

  it("stores anonymous session state", () => {
    const store = createAppStore();

    store.dispatch(setAnonymous());

    expect(store.getState().auth).toEqual({
      user: null,
      status: "anonymous",
      error: null,
    });
  });

  it("renders session loading state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 401,
          ok: false,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              error: {
                code: "authentication_required",
                message: "Требуется вход в систему.",
              },
            }),
        }),
      ),
    );

    renderApp("/", { user: null, status: "idle", error: null });

    expect(screen.getByRole("heading", { name: "Загрузка приложения" })).toBeInTheDocument();
  });

  it("stores authenticated session state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              id: 1,
              username: "user123",
              fullName: "Алексей Петров",
              email: "user@example.com",
              isAdmin: false,
            }),
        }),
      ),
    );
    const store = createAppStore();

    await store.dispatch(fetchCurrentUser());

    expect(store.getState().auth.status).toBe("authenticated");
    expect(store.getState().auth.user.username).toBe("user123");
  });

  it("logs out user from navigation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 204,
          ok: true,
          headers: new Headers(),
        }),
      ),
    );
    renderApp("/", {
      user: {
        id: 1,
        username: "user123",
        fullName: "Алексей Петров",
        email: "user@example.com",
        isAdmin: false,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(screen.getByRole("button", { name: "Выход" }));

    expect(await screen.findByRole("link", { name: "Вход" })).toBeInTheDocument();
  });

  it("keeps user visible when logout request fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/v1/auth/csrf/") {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ csrfToken: "token" }),
          });
        }
        return Promise.resolve({
          status: 500,
          ok: false,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              error: {
                code: "internal_error",
                message: "Внутренняя ошибка сервера.",
              },
            }),
        });
      }),
    );
    renderApp("/", {
      user: {
        id: 1,
        username: "user123",
        fullName: "Алексей Петров",
        email: "user@example.com",
        isAdmin: false,
      },
      status: "authenticated",
      error: null,
    });

    await user.click(screen.getByRole("button", { name: "Выход" }));

    expect(await screen.findByRole("button", { name: "Выход" })).toBeInTheDocument();
  });

  it("stores failed session state", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    const store = createAppStore();

    await store.dispatch(fetchCurrentUser());

    expect(store.getState().auth).toMatchObject({
      user: null,
      status: "failed",
      error: {
        code: "network_error",
        message: "Не удалось подключиться к серверу.",
        fields: null,
      },
    });
  });

  it("stores structured api error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 500,
          ok: false,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: () =>
            Promise.resolve({
              error: {
                code: "internal_error",
                message: "Внутренняя ошибка сервера.",
              },
            }),
        }),
      ),
    );
    const store = createAppStore();

    await store.dispatch(fetchCurrentUser());

    expect(store.getState().auth).toMatchObject({
      user: null,
      status: "failed",
      error: {
        code: "internal_error",
        message: "Внутренняя ошибка сервера.",
        fields: null,
      },
    });
  });
});
