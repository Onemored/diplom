import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useParams } from "react-router-dom";

import {
  editStorageFile,
  fetchFiles,
  removeStorageFile,
  shareStorageFile,
  uploadStorageFile,
} from "../app/store.js";

export function StoragePage() {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const location = useLocation();
  const { userId } = useParams();
  const selectedOwnerId = userId ?? null;
  const {
    ownerId,
    owner,
    items,
    status,
    error,
    uploadStatus,
    updatingId,
    deletingId,
    sharingId,
  } = useSelector((state) => state.files);
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
      {items.length > 0 ? (
        <FilesTable
          deletingId={deletingId}
          files={items}
          onDeleteFile={(file) => dispatch(removeStorageFile(file.id))}
          onEditFile={(payload) => dispatch(editStorageFile(payload))}
          onShareFile={(file) => dispatch(shareStorageFile(file.id))}
          sharingId={sharingId}
          updatingId={updatingId}
        />
      ) : null}
    </section>
  );
}

function FilesTable({
  deletingId,
  files,
  onDeleteFile,
  onEditFile,
  onShareFile,
  sharingId,
  updatingId,
}) {
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
            <th scope="col">Действия</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow
              deletingId={deletingId}
              file={file}
              key={file.id}
              onDeleteFile={onDeleteFile}
              onEditFile={onEditFile}
              onShareFile={onShareFile}
              sharingId={sharingId}
              updatingId={updatingId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileRow({ deletingId, file, onDeleteFile, onEditFile, onShareFile, sharingId, updatingId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [originalName, setOriginalName] = useState(file.originalName);
  const [comment, setComment] = useState(file.comment);
  const [copyStatus, setCopyStatus] = useState("");
  const isUpdating = updatingId === file.id;
  const isDeleting = deletingId === file.id;
  const isSharing = sharingId === file.id;

  const handleEdit = async (event) => {
    event.preventDefault();
    const result = await onEditFile({
      fileId: file.id,
      originalName,
      comment,
    });
    if (editStorageFile.fulfilled.match(result)) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setOriginalName(file.originalName);
    setComment(file.comment);
    setIsEditing(false);
  };

  const handleShare = async () => {
    setCopyStatus("");
    const result = await onShareFile(file);
    if (shareStorageFile.fulfilled.match(result)) {
      try {
        await navigator.clipboard.writeText(result.payload.publicUrl);
        setCopyStatus("Ссылка скопирована.");
      } catch {
        setCopyStatus("Ссылка готова. Скопируйте её вручную.");
      }
    }
  };

  if (isEditing) {
    return (
      <tr>
        <th scope="row">
          <input
            aria-label={`Новое имя файла ${file.originalName}`}
            className="table-input"
            onChange={(event) => setOriginalName(event.target.value)}
            type="text"
            value={originalName}
          />
        </th>
        <td>
          <input
            aria-label={`Новый комментарий файла ${file.originalName}`}
            className="table-input"
            onChange={(event) => setComment(event.target.value)}
            type="text"
            value={comment}
          />
        </td>
        <td>{formatBytes(file.size)}</td>
        <td>{formatDateTime(file.uploadedAt)}</td>
        <td>{file.lastDownloadedAt ? formatDateTime(file.lastDownloadedAt) : "Не скачивали"}</td>
        <td>
          <form className="table-actions" onSubmit={handleEdit}>
            <button
              className="link-button table-button"
              disabled={isUpdating}
              title="Сохранить новое имя и комментарий файла"
              type="submit"
            >
              {isUpdating ? "Сохраняем..." : "Сохранить"}
            </button>
            <button
              className="link-button table-button"
              onClick={handleCancel}
              title="Отменить редактирование без сохранения"
              type="button"
            >
              Отмена
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <th scope="row">{file.originalName}</th>
      <td>{file.comment || "—"}</td>
      <td>{formatBytes(file.size)}</td>
      <td>{formatDateTime(file.uploadedAt)}</td>
      <td>{file.lastDownloadedAt ? formatDateTime(file.lastDownloadedAt) : "Не скачивали"}</td>
      <td>
        <div className="table-actions">
          <a href={file.downloadUrl} title="Скачать файл с сервера">
            Скачать
          </a>
          <button
            className="link-button table-button"
            onClick={() => setIsEditing(true)}
            title="Изменить имя файла или комментарий"
            type="button"
          >
            Изменить
          </button>
          <button
            className="link-button table-button"
            disabled={isSharing}
            onClick={handleShare}
            title="Получить публичную ссылку и скопировать её"
            type="button"
          >
            {isSharing ? "Готовим..." : "Публичная ссылка"}
          </button>
          <button
            className="link-button table-button danger-button"
            disabled={isDeleting}
            onClick={() => confirmDeleteFile(file, onDeleteFile)}
            title="Удалить файл после подтверждения"
            type="button"
          >
            {isDeleting ? "Удаляем..." : "Удалить"}
          </button>
          {file.publicUrl ? (
            <input
              aria-label={`Публичная ссылка файла ${file.originalName}`}
              className="table-input public-link-input"
              readOnly
              type="text"
              value={file.publicUrl}
            />
          ) : null}
          {copyStatus ? (
            <span className="success-message" role="status">
              {copyStatus}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function confirmDeleteFile(file, onDeleteFile) {
  if (window.confirm(`Удалить файл ${file.originalName}? Это действие нельзя отменить.`)) {
    onDeleteFile(file);
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

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
