/**
 * Thin client for the Néra Wear Django REST backend.
 *
 * It deliberately mirrors the small slice of the previous client's shape that
 * the app actually uses (`from(...).select(...).eq(...)`, `auth`, `storage`,
 * `rpc`) so route components did not have to be rewritten. Everything speaks
 * plain JSON over HTTPS to Django REST Framework.
 */

const CONFIGURED_API_URL = (import.meta.env['VITE_API_URL'] as string | undefined)?.replace(/\/$/, "");

export const API_URL = CONFIGURED_API_URL ?? "http://localhost:8000/api";

/** True when no API host has been configured, so every request would fail. */
export const API_URL_CONFIGURED = Boolean(CONFIGURED_API_URL);

const UNREACHABLE_MESSAGE = API_URL_CONFIGURED
  ? "We couldn't reach the store. Check your connection and try again."
  : "The store's API address hasn't been set yet, so no products can load. Set VITE_API_URL to the deployed Django backend.";


const STORAGE_KEY = "nera.session";

export type ApiUser = { id: string; email: string; is_store_admin: boolean };
export type Session = { access_token: string; refresh_token: string; user: ApiUser };
export type ApiError = { message: string; code?: string };
export type ApiResult<T = any[]> = { data: T; error: ApiError | null; count?: number };

type Filter = [string, string, unknown];

/* ------------------------------------------------------------------ session */

let session: Session | null = null;
let loaded = false;

function readStored(): Session | null {
  if (typeof window === "undefined") return null;
  if (!loaded) {
    loaded = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      session = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      session = null;
    }
  }
  return session;
}

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED";
const listeners = new Set<(event: AuthEvent, session: Session | null) => void>();

function setSession(next: Session | null, event: AuthEvent) {
  session = next;
  loaded = true;
  if (typeof window !== "undefined") {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((fn) => fn(event, next));
}

/* ------------------------------------------------------------------ fetching */

async function request<T>(
  path: string,
  init: RequestInit & { retryOnAuthFailure?: boolean } = {},
): Promise<ApiResult<T>> {
  const current = readStored();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body) headers.set("Content-Type", "application/json");
  if (current?.access_token) headers.set("Authorization", `Bearer ${current.access_token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    return { data: null as T, error: { message: UNREACHABLE_MESSAGE } };
  }

  // One transparent refresh attempt when the access token has expired.
  if (response.status === 401 && current?.refresh_token && init.retryOnAuthFailure !== false) {
    const refreshed = await refreshSession(current.refresh_token);
    if (refreshed) return request<T>(path, { ...init, retryOnAuthFailure: false });
    setSession(null, "SIGNED_OUT");
  }

  let body: any = null;
  try {
    body = response.status === 204 ? null : await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail = body?.error ?? body?.detail ?? body;
    return {
      data: null as T,
      error: {
        message: typeof detail === "string" ? detail : detail?.message ?? "Something went wrong. Please try again.",
        code: detail?.code ?? String(response.status),
      },
      count: 0,
    };
  }
  return { data: (body?.data ?? null) as T, error: null, count: body?.count };
}

async function refreshSession(refreshToken: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const body = await res.json().catch(() => null);
  if (!body?.data?.access_token) return false;
  setSession(body.data as Session, "TOKEN_REFRESHED");
  return true;
}

/* ------------------------------------------------------------------- queries */

class Query<T = any[]> implements PromiseLike<ApiResult<T>> {
  private filters: Filter[] = [];
  private ordering: [string, boolean][] = [];
  private take?: number;
  private wantSingle = false;
  private headOnly = false;

  constructor(
    private table: string,
    private mode: "select" | "insert" | "update" | "upsert" | "delete",
    private payload?: unknown,
    private conflictTarget?: string,
  ) {}

  private where(op: string, field: string, value: unknown) {
    this.filters.push([op, field, value]);
    return this;
  }

  eq(field: string, value: unknown) { return this.where("eq", field, value); }
  neq(field: string, value: unknown) { return this.where("neq", field, value); }
  gt(field: string, value: unknown) { return this.where("gt", field, value); }
  gte(field: string, value: unknown) { return this.where("gte", field, value); }
  lt(field: string, value: unknown) { return this.where("lt", field, value); }
  lte(field: string, value: unknown) { return this.where("lte", field, value); }
  is(field: string, value: unknown) { return this.where("is", field, value); }
  in(field: string, values: readonly unknown[]) { return this.where("in", field, Array.from(values)); }
  ilike(field: string, pattern: string) { return this.where("ilike", field, pattern.replace(/%/g, "")); }

  order(field: string, opts?: { ascending?: boolean }) {
    this.ordering.push([field, opts?.ascending !== false]);
    return this;
  }

  limit(n: number) { this.take = n; return this; }

  select(_columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (opts?.head) this.headOnly = true;
    return this;
  }

  single() { this.wantSingle = true; return this as unknown as Query<any>; }
  maybeSingle() { this.wantSingle = true; return this as unknown as Query<any>; }

  private search() {
    const params = new URLSearchParams();
    if (this.filters.length) params.set("filters", JSON.stringify(this.filters));
    if (this.ordering.length) params.set("order", JSON.stringify(this.ordering));
    if (this.take) params.set("limit", String(this.take));
    if (this.wantSingle) params.set("single", "1");
    if (this.headOnly) params.set("head", "1");
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  private async run(): Promise<ApiResult<T>> {
    const base = `/db/${this.table}/`;
    if (this.mode === "select") return request<T>(`${base}${this.search()}`);
    if (this.mode === "delete") return request<T>(`${base}${this.search()}`, { method: "DELETE" });
    if (this.mode === "update") {
      const result = await request<any[]>(`${base}${this.search()}`, {
        method: "PATCH",
        body: JSON.stringify({ values: this.payload }),
      });
      return this.shape(result);
    }
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const result = await request<any[]>(base, {
      method: "POST",
      body: JSON.stringify({ rows, upsert: this.mode === "upsert", on_conflict: this.conflictTarget }),
    });
    return this.shape(result);
  }

  private shape(result: ApiResult<any[]>): ApiResult<T> {
    if (result.error) return { data: null as T, error: result.error };
    const rows = result.data ?? [];
    return { data: (this.wantSingle ? rows[0] ?? null : rows) as T, error: null, count: result.count };
  }

  then<R1 = ApiResult<T>, R2 = never>(
    onfulfilled?: ((value: ApiResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class TableClient {
  constructor(private table: string) {}
  select(columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    return new Query(this.table, "select").select(columns, opts);
  }
  insert(rows: unknown) { return new Query(this.table, "insert", rows); }
  update(values: unknown) { return new Query(this.table, "update", values); }
  upsert(rows: unknown, opts?: { onConflict?: string }) {
    return new Query(this.table, "upsert", rows, opts?.onConflict);
  }
  delete() { return new Query(this.table, "delete"); }
}

/* --------------------------------------------------------------------- auth */

const auth = {
  async getSession() {
    const current = readStored();
    return { data: { session: current }, error: null };
  },

  async getUser() {
    const current = readStored();
    if (!current) return { data: { user: null }, error: null };
    const { data, error } = await request<{ user: ApiUser }>("/auth/user/");
    if (error || !data?.user) return { data: { user: current.user }, error: null };
    return { data: { user: data.user }, error: null };
  },

  async signUp(payload: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
    const meta = payload.options?.data ?? {};
    const { data, error } = await request<Session>("/auth/signup/", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        full_name: meta['full_name'] ?? "",
        phone: meta['phone'] ?? "",
      }),
    });
    if (error || !data) return { data: { session: null, user: null }, error };
    setSession(data, "SIGNED_IN");
    return { data: { session: data, user: data.user }, error: null };
  },

  async signInWithPassword(payload: { email: string; password: string }) {
    const { data, error } = await request<Session>("/auth/signin/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (error || !data) return { data: { session: null, user: null }, error };
    setSession(data, "SIGNED_IN");
    return { data: { session: data, user: data.user }, error: null };
  },

  async signOut() {
    setSession(null, "SIGNED_OUT");
    return { error: null };
  },

  onAuthStateChange(callback: (event: AuthEvent, session: Session | null) => void) {
    listeners.add(callback);
    // Fire once so subscribers get the restored session without an extra call.
    const current = readStored();
    if (current) queueMicrotask(() => callback("SIGNED_IN", current));
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  },
};

/* ------------------------------------------------------------------ storage */

function storageBucket(bucket: string) {
  const folder = bucket === "gift-images" ? "gift-images" : bucket === "category-images" ? "category-images" : "product-images";
  return {
    async upload(path: string, file: File, _opts?: { contentType?: string; upsert?: boolean }) {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const { data, error } = await request<{ path: string; public_url: string }>("/storage/upload/", {
        method: "POST",
        body: form,
      });
      if (error) return { data: null, error };
      lastUploads.set(`${folder}/${path}`, data.public_url);
      lastUploads.set(path, data.public_url);
      return { data: { path: data.path, publicUrl: data.public_url }, error: null };
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: lastUploads.get(path) ?? lastUploads.get(`${folder}/${path}`) ?? path } };
    },
  };
}

const lastUploads = new Map<string, string>();

/* ---------------------------------------------------------------------- api */

export const api = {
  from: (table: string) => new TableClient(table),
  rpc: async <T = any>(name: string, params?: Record<string, unknown>) => {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params ?? {})) body[key.replace(/^_/, "")] = value;
    return request<T>(`/rpc/${name}/`, { method: "POST", body: JSON.stringify(body) });
  },
  auth,
  storage: { from: storageBucket },
  reviewSummary: (productId: string) =>
    request<{ average: number; total: number; breakdown: Record<string, number> }>(
      `/products/${productId}/review-summary/`,
    ),
  config: () => request<Record<string, string | number>>("/config/"),
};

/** Kept as a named export so existing imports keep working unchanged. */
export const supabase = api;
export default api;
