import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { App } from "./App.jsx";
import { setAnonymous, store } from "./store.js";

function renderApp(initialPath = "/") {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
}

describe("App", () => {
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
    store.dispatch(setAnonymous());

    expect(store.getState().auth).toEqual({
      user: null,
      status: "anonymous",
      error: null,
    });
  });
});
