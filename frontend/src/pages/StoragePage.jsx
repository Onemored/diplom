import { useLocation } from "react-router-dom";

export function StoragePage() {
  const location = useLocation();
  const accessDenied = location.state?.accessDenied;

  return (
    <section className="page-card">
      <h1>Файловое хранилище</h1>
      {accessDenied ? <p role="alert">{accessDenied}</p> : null}
      <p>Здесь появятся загрузка, список файлов и действия с публичными ссылками.</p>
    </section>
  );
}
