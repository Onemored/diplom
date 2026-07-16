import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-card">
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или вернитесь на главную страницу.</p>
      <Link className="button" to="/">
        На главную
      </Link>
    </section>
  );
}
