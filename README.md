# G.YM

Web app mobile-first per registrare gli allenamenti in palestra e seguire i progressi: schede, workout con autosave, storico, calendario, PR, livelli di forza, mappa del corpo fronte/retro, peso corporeo, obiettivi e statistiche. **V2**: XP e livello dell'account, 39 badge, sfide a tempo, obiettivi avanzati e classifica locale facoltativa. **V3**: feed con post (foto e descrizione collegati a un allenamento), commenti e reazioni, classifica con più categorie. **V4**: modalità Dieta con diario alimentare, acqua, obiettivi di calorie e macronutrienti, catalogo di 194 alimenti e alimenti personali. Stack: Next.js 15 (App Router), TypeScript, Tailwind 4, Postgres, Drizzle.

Architettura e regole di calcolo: vedi [ARCHITECTURE.md](./ARCHITECTURE.md).

## Avvio in locale
```bash
npm install
cp .env.example .env        # imposta DATABASE_URL
npm run db:setup            # migrazioni + dati di sistema (muscoli, esercizi, soglie)
npm run dev
```
Test della logica di dominio: `npm test`. Controllo dei tipi: `npm run lint`.

## Pubblicarla gratis (Vercel + Supabase)
1. **Database**: crea un progetto gratuito su [supabase.com](https://supabase.com). **Scegli la regione Europa (Francoforte)**: `vercel.json` fa girare l'app a Francoforte (`fra1`), e tenere app e database vicini è la cosa che più rende l'app veloce.
2. **Stringa di connessione**: da *Connect* copia la **Transaction pooler** (porta 6543) e sostituisci `[YOUR-PASSWORD]`. Se la password ha simboli (`@`, `#`...) vanno codificati (`@` diventa `%40`).
3. **Codice**: carica il progetto su GitHub.
4. **Hosting**: su [vercel.com](https://vercel.com) importa il repository (piano Hobby) e imposta:
   - `DATABASE_URL` = la stringa di Supabase
   - `REGISTRATION_CODE` = un codice a tua scelta (consigliato)
5. Il deploy esegue da solo migrazioni e seed (`vercel-build`): crea le tabelle, attiva la sicurezza RLS e carica muscoli, esercizi e soglie di forza.

Note sul piano gratuito di Supabase: il database è sempre attivo (nessun rallentamento dopo pochi minuti), ma il progetto viene messo in pausa dopo 7 giorni senza attività e va riattivato dalla dashboard. Le tabelle hanno la **Row Level Security attiva**: l'API pubblica di Supabase non può leggerle, l'app si collega direttamente al database.

## Foto dei post (Supabase Storage)
Le foto vanno su Supabase Storage e arrivano direttamente dalla loro CDN, senza passare dall'app (più veloce). Il browser le ridimensiona a 1080 px e le ricomprime prima dell'invio: pesano 100-250 KB e perdono EXIF e posizione GPS.
1. Su Supabase apri **Project Settings, API** e copia il **Project URL** e la chiave **service_role**.
2. Su Vercel aggiungi `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. La chiave `service_role` è segreta: non va mai messa nel codice né in variabili `NEXT_PUBLIC_*`.
3. Rifai il deploy. Il bucket pubblico `post-photos` viene creato da solo al primo upload (limite 2 MB, solo JPEG).

Senza queste due variabili l'app funziona lo stesso: i post si possono scrivere, ma senza foto.
Nota sulla privacy: il bucket è pubblico e i file hanno un nome casuale impossibile da indovinare, ma chi riceve il link di una foto può aprirla. Va bene per un gruppo di amici; per foto più sensibili serve un bucket privato con link firmati (più lento).

## Aggiornare un sito già online
Basta rifare il deploy: le migrazioni mancanti (RLS, sfide, community, dieta) e il seed si applicano da soli e **non toccano i dati esistenti** (workout, serie, schede, obiettivi, esercizi personali). Ripetere il deploy è sicuro. Per prudenza, prima del primo aggiornamento puoi fare una copia del database: `pg_dump "<connessione diretta di Supabase>" > backup.sql`.
Se la migrazione desse problemi col pooler, imposta su Vercel `MIGRATION_DATABASE_URL` con la connessione diretta o "Session pooler".

## Installarla sul telefono
Apri il sito dal browser del telefono e scegli "Aggiungi a schermata Home": si comporta come un'app.

## Variabili d'ambiente
| Nome | Obbligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | sì | connessione Postgres |
| `REGISTRATION_CODE` | no | se impostata, serve per registrarsi |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | no | foto dei post (vedi sopra) |
| `SUPABASE_BUCKET` | no | nome del bucket (default `post-photos`) |
| `MIGRATION_DATABASE_URL` | no | connessione alternativa solo per migrazioni e seed |
| `APP_ORIGIN` | no | origine pubblica (es. `https://tuo-sito.vercel.app`) per il controllo CSRF; se vuota si usa l'header Host |
