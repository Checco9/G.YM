export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (m = "Richiesta non valida", f?: Record<string, string>) => new HttpError(400, m, f);
export const unauthorized = (m = "Accesso richiesto") => new HttpError(401, m);
export const forbidden = (m = "Operazione non consentita") => new HttpError(403, m);
export const notFound = (m = "Risorsa non trovata") => new HttpError(404, m);
export const conflict = (m = "Conflitto") => new HttpError(409, m);
export const tooMany = (m = "Troppi tentativi, riprova tra poco") => new HttpError(429, m);
