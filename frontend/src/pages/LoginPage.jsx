import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

import { loginAccount } from "../app/store.js";

const initialForm = {
  username: "",
  password: "",
};

export function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState(initialForm);
  const [clientError, setClientError] = useState("");
  const isSubmitting = status === "loading";

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setClientError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.username.trim() || !form.password) {
      setClientError("Укажите логин и пароль.");
      return;
    }

    const result = await dispatch(
      loginAccount({
        username: form.username,
        password: form.password,
      }),
    );
    setForm(initialForm);

    if (loginAccount.fulfilled.match(result)) {
      navigate(result.payload.isAdmin ? "/admin/users" : "/storage", { replace: true });
    }
  };

  return (
    <section className="page-card form-card">
      <h1>Вход</h1>
      {location.state?.registered ? (
        <p className="success-message" role="status">
          Регистрация завершена. Теперь войдите в приложение.
        </p>
      ) : null}
      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          Логин
          <input
            autoComplete="username"
            name="username"
            onChange={handleChange}
            type="text"
            value={form.username}
          />
        </label>
        <label>
          Пароль
          <input
            autoComplete="current-password"
            name="password"
            onChange={handleChange}
            type="password"
            value={form.password}
          />
        </label>
        {clientError || error ? (
          <p className="error-message" role="alert">
            {clientError || error.message}
          </p>
        ) : null}
        <button className="button" disabled={isSubmitting} type="submit">
          Войти
        </button>
      </form>
    </section>
  );
}
