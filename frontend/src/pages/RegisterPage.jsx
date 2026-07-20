import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";

import { registerAccount } from "../app/store.js";

const usernamePattern = /^[A-Za-z][A-Za-z0-9]{3,19}$/;
const initialForm = {
  username: "",
  fullName: "",
  email: "",
  password: "",
  passwordConfirm: "",
};

export function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState(initialForm);
  const [clientErrors, setClientErrors] = useState({});
  const isSubmitting = status === "loading";

  if (user) {
    return <Navigate to={user.isAdmin ? "/admin/users" : "/storage"} replace />;
  }

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setClientErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateRegisterForm(form);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const result = await dispatch(
      registerAccount({
        username: form.username,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      }),
    );
    setForm(initialForm);

    if (registerAccount.fulfilled.match(result)) {
      navigate("/login", { replace: true, state: { registered: true } });
    }
  };

  const fieldErrors = {
    ...error?.fields,
    ...clientErrors,
  };

  return (
    <section className="page-card form-card">
      <h1>Регистрация</h1>
      <form className="form-stack" onSubmit={handleSubmit}>
        <FieldError message={fieldErrors.username?.[0]} />
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
        <FieldError message={fieldErrors.fullName?.[0]} />
        <label>
          Полное имя
          <input
            autoComplete="name"
            name="fullName"
            onChange={handleChange}
            type="text"
            value={form.fullName}
          />
        </label>
        <FieldError message={fieldErrors.email?.[0]} />
        <label>
          Email
          <input
            autoComplete="email"
            name="email"
            onChange={handleChange}
            type="email"
            value={form.email}
          />
        </label>
        <FieldError message={fieldErrors.password?.[0]} />
        <label>
          Пароль
          <input
            autoComplete="new-password"
            name="password"
            onChange={handleChange}
            type="password"
            value={form.password}
          />
        </label>
        <FieldError message={fieldErrors.passwordConfirm?.[0]} />
        <label>
          Повтор пароля
          <input
            autoComplete="new-password"
            name="passwordConfirm"
            onChange={handleChange}
            type="password"
            value={form.passwordConfirm}
          />
        </label>
        {error && !error.fields ? (
          <p className="error-message" role="alert">
            {error.message}
          </p>
        ) : null}
        <button className="button" disabled={isSubmitting} type="submit">
          Зарегистрироваться
        </button>
      </form>
    </section>
  );
}

function validateRegisterForm(form) {
  const errors = {};
  if (!usernamePattern.test(form.username.trim())) {
    errors.username = ["Логин должен начинаться с латинской буквы и содержать 4–20 символов."];
  }
  if (!form.fullName.trim()) {
    errors.fullName = ["Укажите полное имя."];
  }
  if (!form.email.includes("@")) {
    errors.email = ["Укажите корректный email."];
  }
  if (form.password.length < 8) {
    errors.password = ["Пароль должен содержать не менее 8 символов."];
  }
  if (form.password !== form.passwordConfirm) {
    errors.passwordConfirm = ["Пароли не совпадают."];
  }
  return errors;
}

function FieldError({ message }) {
  if (!message) {
    return null;
  }
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}
