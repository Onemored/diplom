import { Link } from "react-router-dom";

export function HomePage({ user }) {
  return (
    <section className="page-card">
      <p className="eyebrow">Персональное файловое хранилище</p>
      <h1>My Cloud</h1>
      {user ? (
        <>
          <p>
            Вы вошли как <strong>{user.username}</strong>
            {user.isAdmin ? " с правами администратора" : ""}. Можно сразу перейти к файлам
            или продолжить работу из верхнего меню.
          </p>
          <div className="actions">
            <Link className="button" to="/storage">
              Мои файлы
            </Link>
            {user.isAdmin ? (
              <Link className="button button-secondary" to="/admin/users">
                Пользователи
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p>
            Загружайте файлы, храните комментарии, скачивайте документы с оригинальными именами
            и делитесь обезличенными публичными ссылками.
          </p>
          <div className="actions">
            <Link className="button" to="/register">
              Зарегистрироваться
            </Link>
            <Link className="button button-secondary" to="/login">
              Войти
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
