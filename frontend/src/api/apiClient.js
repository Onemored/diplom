const API_PREFIX = "/api/v1";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  constructor({ status, code, message, fields = null }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function request(path, options = {}) {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  const body = prepareBody(options.body, headers);

  if (UNSAFE_METHODS.has(method.toUpperCase())) {
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    method,
    body,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return null;
  }

  const data = await readJson(response);
  if (!response.ok) {
    throw toApiError(response.status, data);
  }

  return data;
}

export function getCurrentUser() {
  return request("/auth/me/");
}

function prepareBody(body, headers) {
  if (body === undefined || body instanceof FormData) {
    return body;
  }

  if (typeof body === "string") {
    return body;
  }

  headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}

function readCookie(name) {
  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function readJson(response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError({
      status: response.status,
      code: "bad_response",
      message: "Сервер вернул неожиданный ответ.",
    });
  }
  return response.json();
}

function toApiError(status, data) {
  const error = data?.error;
  return new ApiError({
    status,
    code: error?.code ?? "request_error",
    message: error?.message ?? "Не удалось выполнить запрос.",
    fields: error?.fields ?? null,
  });
}
