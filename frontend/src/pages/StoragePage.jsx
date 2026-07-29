import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useParams } from "react-router-dom";

import { fetchFiles, uploadStorageFile } from "../app/store.js";

export function StoragePage() {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const location = useLocation();
  const { userId } = useParams();
  const selectedOwnerId = userId ?? null;
  const { ownerId, owner, items, status, error, uploadStatus } = useSelector((state) => state.files);
  const accessDenied = location.state?.accessDenied;
  const [comment, setComment] = useState("");
  const [clientError, setClientError] = useState("");
  const isUploading = uploadStatus === "loading";

  useEffect(() => {
    if (status === "idle" || ownerId !== selectedOwnerId) {
      dispatch(fetchFiles({ ownerId: selectedOwnerId }));
    }
  }, [dispatch, ownerId, selectedOwnerId, status]);

  const handleUpload = async (event) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setClientError("Выберите файл для загрузки.");
      return;
    }

    setClientError("");
    const result = await dispatch(
      uploadStorageFile({
        file,
        comment,
        ownerId: selectedOwnerId,
      }),
    );

    if (uploadStorageFile.fulfilled.match(result)) {
      setComment("");
      fileInputRef.current.value = "";
    }
  };

  return (
    <section className="page-card">
      <h1>Файловое хранилище</h1>
      {accessDenied ? <p role="alert">{accessDenied}</p> : null}
      <p>Файлы выбранного хранилища с комментариями, размером и датами операций.</p>
      {owner ? <p>Владелец: {owner.username}</p> : null}
      <form className="form-stack upload-form" onSubmit={handleUpload}>
        <label>
          Файл
          <input
            name="file"
            onChange={() => setClientError("")}
            ref={fileInputRef}
            type="file"
          />
        </label>
        <label>
          Комментарий
          <input
            maxLength={255}
            name="comment"
            onChange={(event) => setComment(event.target.value)}
            placeholder="Например: финальная версия отчёта"
            type="text"
            value={comment}
          />
        </label>
        {clientError ? (
          <p className="error-message" role="alert">
            {clientError}
          </p>
        ) : null}
        {uploadStatus === "succeeded" ? (
          <p className="success-message" role="status">
            Файл загружен.
          </p>
        ) : null}
        <button className="button" disabled={isUploading} type="submit">
          {isUploading ? "Загружаем..." : "Загрузить файл"}
        </button>
      </form>
      {status === "loading" ? <p role="status">Загружаем файлы.</p> : null}
      {error ? (
        <p className="error-message" role="alert">
          {error.message}
        </p>
      ) : null}
      {status === "succeeded" && items.length === 0 ? <p role="status">Файлов пока нет.</p> : null}
      {items.length > 0 ? <FilesTable files={items} /> : null}
    </section>
  );
}

function FilesTable({ files }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption>Файлы My Cloud</caption>
        <thead>
          <tr>
            <th scope="col">Имя</th>
            <th scope="col">Комментарий</th>
            <th scope="col">Размер</th>
            <th scope="col">Загружен</th>
            <th scope="col">Последнее скачивание</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <th scope="row">{file.originalName}</th>
              <td>{file.comment || "—"}</td>
              <td>{formatBytes(file.size)}</td>
              <td>{formatDateTime(file.uploadedAt)}</td>
              <td>{file.lastDownloadedAt ? formatDateTime(file.lastDownloadedAt) : "Не скачивали"}</td>
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
