import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, Route, Routes } from "react-router-dom";

import { fetchCurrentUser } from "./store.js";
import { AdminUsersPage } from "../pages/AdminUsersPage.jsx";
import { HomePage } from "../pages/HomePage.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { StoragePage } from "../pages/StoragePage.jsx";

export function App() {
  const dispatch = useDispatch();
  const { user, status } = useSelector((state) => state.auth);

  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, status]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="app-shell">
        <main className="app-main">
          <section className="page-card" aria-live="polite">
            <h1>Загрузка приложения</h1>
            <p>Проверяем текущую сессию.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="app-logo" to="/">
          My Cloud
        </NavLink>
        <nav className="app-nav" aria-label="Основная навигация">
          <NavLink to="/">Главная</NavLink>
          {user ? (
            <>
              <NavLink to="/storage">Мои файлы</NavLink>
              {user.isAdmin ? <NavLink to="/admin/users">Пользователи</NavLink> : null}
              <button className="link-button" type="button">
                Выход
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Вход</NavLink>
              <NavLink to="/register">Регистрация</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:userId/files" element={<StoragePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
