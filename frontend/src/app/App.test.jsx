import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.jsx";
import { createAppStore, fetchCurrentUser, setAnonymous } from "./store.js";

function renderApp(initialPath = "/", preloadedAuth = { user: null, status: "anonymous", error: null }) {
  const store = createAppStore({
    auth: preloadedAuth,
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

  it("renders the storage route", () => {
    renderApp("/storage");

    expect(screen.getByRole("heading", { name: "Файловое хранилище" })).toBeInTheDocument();
  });

  it("renders the admin users route", () => {
    renderApp("/admin/users");

    expect(screen.getByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
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
