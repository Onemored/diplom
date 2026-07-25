import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, getCurrentUser, getUsers, request } from "./apiClient.js";

function mockJsonResponse({ status = 200, ok = true, data = {} } = {}) {
  return Promise.resolve({
    status,
    ok,
    headers: new Headers({ "Content-Type": "application/json; charset=utf-8" }),
    json: () => Promise.resolve(data),
  });
}

describe("apiClient", () => {
  afterEach(() => {
    document.cookie = "csrftoken=; Max-Age=0";
    vi.unstubAllGlobals();
  });

  it("loads current user with credentials", async () => {
    const fetchMock = vi.fn(() =>
      mockJsonResponse({
        data: {
          id: 1,
          username: "user123",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).resolves.toEqual({
      id: 1,
      username: "user123",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/me/",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
  });

  it("loads users list", async () => {
    const fetchMock = vi.fn(() =>
      mockJsonResponse({
        data: {
          items: [
            {
              id: 1,
              username: "admin123",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUsers()).resolves.toEqual({
      items: [
        {
          id: 1,
          username: "admin123",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/users/",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
  });


  it("returns null for no content response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 204,
          ok: true,
          headers: new Headers(),
        }),
      ),
    );

    await expect(request("/auth/logout/", { method: "POST" })).resolves.toBeNull();
  });

  it("sends json body and csrf token for unsafe requests", async () => {
    document.cookie = "csrftoken=safe-token";
    const fetchMock = vi.fn(() => mockJsonResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/auth/login/", {
      method: "POST",
      body: {
        username: "user123",
      },
    });

    const [, options] = fetchMock.mock.calls[0];

    expect(options.body).toBe(JSON.stringify({ username: "user123" }));
    expect(options.headers.get("Content-Type")).toBe("application/json");
    expect(options.headers.get("X-CSRFToken")).toBe("safe-token");
  });

  it("does not set content type for form data", async () => {
    const formData = new FormData();
    const fetchMock = vi.fn(() => mockJsonResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/files/", {
      method: "POST",
      body: formData,
    });

    const [, options] = fetchMock.mock.calls[0];

    expect(options.body).toBe(formData);
    expect(options.headers.has("Content-Type")).toBe(false);
  });

  it("sends string body unchanged", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/raw/", {
      method: "POST",
      body: "raw-body",
    });

    const [, options] = fetchMock.mock.calls[0];

    expect(options.body).toBe("raw-body");
    expect(options.headers.has("Content-Type")).toBe(false);
  });

  it("throws structured api error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        mockJsonResponse({
          status: 400,
          ok: false,
          data: {
            error: {
              code: "validation_error",
              message: "Проверьте введённые данные.",
              fields: {
                username: ["Ошибка"],
              },
            },
          },
        }),
      ),
    );

    await expect(request("/auth/register/")).rejects.toMatchObject({
      status: 400,
      code: "validation_error",
      message: "Проверьте введённые данные.",
      fields: {
        username: ["Ошибка"],
      },
    });
  });

  it("throws fallback api error when error payload is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        mockJsonResponse({
          status: 500,
          ok: false,
          data: {},
        }),
      ),
    );

    await expect(request("/broken/")).rejects.toMatchObject({
      status: 500,
      code: "request_error",
      message: "Не удалось выполнить запрос.",
      fields: null,
    });
  });

  it("throws safe error for unexpected response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 502,
          ok: false,
          headers: new Headers({ "Content-Type": "text/html" }),
        }),
      ),
    );

    await expect(request("/auth/me/")).rejects.toBeInstanceOf(ApiError);
    await expect(request("/auth/me/")).rejects.toMatchObject({
      status: 502,
      code: "bad_response",
      message: "Сервер вернул неожиданный ответ.",
    });
  });

  it("throws safe error when content type is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 502,
          ok: false,
          headers: new Headers(),
        }),
      ),
    );

    await expect(request("/auth/me/")).rejects.toMatchObject({
      status: 502,
      code: "bad_response",
    });
  });
});
