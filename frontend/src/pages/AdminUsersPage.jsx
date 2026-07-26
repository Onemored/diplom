import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { changeUserRole, fetchUsers, removeUser } from "../app/store.js";

export function AdminUsersPage() {
  const dispatch = useDispatch();
  const { items, status, error, roleUpdatingId, deletingId } = useSelector((state) => state.users);

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
      {error ? (
        <p className="error-message" role="alert">
          {error.message}
        </p>
      ) : null}
      {status === "succeeded" && items.length === 0 ? (
        <p role="status">Пользователей пока нет.</p>
      ) : null}
      {items.length > 0 ? (
        <UsersTable
          deletingId={deletingId}
          onDeleteUser={(user) => dispatch(removeUser(user.id))}
          onToggleRole={(user) =>
            dispatch(changeUserRole({ userId: user.id, isAdmin: !user.isAdmin }))
          }
          roleUpdatingId={roleUpdatingId}
          users={items}
        />
      ) : null}
    </section>
  );
}

function UsersTable({ deletingId, onDeleteUser, onToggleRole, roleUpdatingId, users }) {
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
                <div className="table-actions">
                  <Link to={`/admin/users/${user.id}/files`}>Открыть файлы</Link>
                  <button
                    className="link-button table-button"
                    disabled={roleUpdatingId === user.id}
                    onClick={() => confirmRoleChange(user, onToggleRole)}
                    type="button"
                  >
                    {user.isAdmin ? "Сделать пользователем" : "Сделать администратором"}
                  </button>
                  <button
                    className="link-button table-button danger-button"
                    disabled={deletingId === user.id}
                    onClick={() => confirmDelete(user, onDeleteUser)}
                    type="button"
                  >
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function confirmRoleChange(user, onToggleRole) {
  const nextRole = user.isAdmin ? "пользователем" : "администратором";
  if (window.confirm(`Сделать ${user.username} ${nextRole}?`)) {
    onToggleRole(user);
  }
}

function confirmDelete(user, onDeleteUser) {
  if (window.confirm(`Удалить пользователя ${user.username}? Это действие нельзя отменить.`)) {
    onDeleteUser(user);
  }
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
