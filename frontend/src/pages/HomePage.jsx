import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <section className="page-card">
      <p className="eyebrow">Персональное файловое хранилище</p>
      <h1>My Cloud</h1>
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
    </section>
  );
}
