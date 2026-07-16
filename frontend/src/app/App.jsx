import { NavLink, Route, Routes } from "react-router-dom";

import { AdminUsersPage } from "../pages/AdminUsersPage.jsx";
import { HomePage } from "../pages/HomePage.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { StoragePage } from "../pages/StoragePage.jsx";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="app-logo" to="/">
          My Cloud
        </NavLink>
        <nav className="app-nav" aria-label="Основная навигация">
          <NavLink to="/">Главная</NavLink>
          <NavLink to="/login">Вход</NavLink>
          <NavLink to="/register">Регистрация</NavLink>
          <NavLink to="/storage">Мои файлы</NavLink>
          <NavLink to="/admin/users">Пользователи</NavLink>
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
