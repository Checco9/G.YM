import { hash, verify } from "@node-rs/argon2";

/** argon2id con i parametri di default della libreria (memory-hard). */
export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | null = null;
/** Hash fittizio per consumare lo stesso tempo anche quando l'utente non esiste. */
export const dummyHash = () => (dummy ??= hash("password-fittizia-per-timing"));
