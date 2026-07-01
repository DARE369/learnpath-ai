const TOKEN_KEY = "access_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });

  if (res.status === 429) {
    const raw = res.headers.get("Retry-After") ?? "60";
    const retryAfter = parseInt(raw, 10);
    throw new ApiRequestError(429, "Too many requests — please slow down.", isNaN(retryAfter) ? 60 : retryAfter);
  }

  if (!res.ok) {
    const body: { detail?: string; message?: string } = await res.json().catch(() => ({}));
    throw new ApiRequestError(res.status, body.detail ?? body.message ?? res.statusText);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const api = {
  get: <T>(url: string, init?: Omit<RequestInit, "method" | "body">) => request<T>(url, init),
  post: <T>(url: string, body?: unknown, init?: Omit<RequestInit, "method">) =>
    request<T>(url, { ...init, method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body?: unknown, init?: Omit<RequestInit, "method">) =>
    request<T>(url, { ...init, method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string, init?: Omit<RequestInit, "method" | "body">) =>
    request<T>(url, { ...init, method: "DELETE" }),
};
