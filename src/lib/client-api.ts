"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Chiamata JSON alle nostre API. Lancia ApiError con un messaggio leggibile. */
export async function call<T = unknown>(method: string, url: string, body?: unknown, opts?: { keepalive?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      keepalive: opts?.keepalive,
    });
  } catch {
    throw new ApiError("Nessuna connessione", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Qualcosa è andato storto", res.status, data.fields);
  return data as T;
}
