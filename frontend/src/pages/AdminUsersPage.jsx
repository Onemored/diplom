import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { fetchUsers } from "../app/store.js";

export function AdminUsersPage() {
  const dispatch = useDispatch();
  const { items, status, error } = useSelector((state) => state.users);

  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchUsers());
    }
  }, [dispatch, status]);

  return (
    <section className="page-card">
      <h1>Пользователи</h1>
      <p>Список пользователей, их роли и текущая статистика файлового хранилища.</p>
      {status === "loading" ? <p role="status">Загружаем пользователей.</p> : null}
      {status === "failed" ? (
        <p className="error-message" role="alert">
          {error.message}
        </p>
      ) : null}
      {status === "succeeded" && items.length === 0 ? (
        <p role="status">Пользователей пока нет.</p>
      ) : null}
      {items.length > 0 ? <UsersTable users={items} /> : null}
    </section>
  );
}

function UsersTable({ users }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption>Пользователи My Cloud</caption>
        <thead>
          <tr>
            <th scope="col">Логин</th>
            <th scope="col">Имя</th>
            <th scope="col">Email</th>
            <th scope="col">Роль</th>
            <th scope="col">Файлы</th>
            <th scope="col">Объём</th>
            <th scope="col">Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <th scope="row">{user.username}</th>
              <td>{user.fullName}</td>
              <td>{user.email}</td>
              <td>{user.isAdmin ? "Администратор" : "Пользователь"}</td>
              <td>{user.fileCount}</td>
              <td>{formatBytes(user.storageSize)}</td>
              <td>
                <Link to={`/admin/users/${user.id}/files`}>Открыть файлы</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 Б";
  }

  const units = ["Б", "КБ", "МБ", "ГБ"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}
