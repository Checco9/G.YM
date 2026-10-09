# Architettura di G.YM

## Principi
1. **Correttezza dei dati**: volume, PR, livelli, streak, progressione e valori attuali degli obiettivi *non sono mai salvati*; si calcolano dalle serie completate. Una sola fonte di verità.
2. **Logica separata dalla UI**: le regole vivono in `src/modules/*/domain` come funzioni pure, testate con Vitest.
3. **Moduli per dominio**: ogni modulo ha `domain/` (regole pure), `repository.ts` (DB), `service.ts` (casi d'uso e autorizzazione), `schemas.ts` (Zod).
4. **Il server non si fida del client**: ogni route valida con Zod, verifica la sessione e filtra per `user_id`.

## Struttura
```
src/
  app/                 route e pagine (solo composizione)
    (auth)/            login, registrazione
    (app)/             home, gym, progress, profile (con navigazione)
    (workout)/         workout in corso e riepilogo (a tutto schermo, senza nav)
    api/               route handler sottili: api() = origin check + sessione + errori
  modules/
    auth/              argon2id, sessioni a cookie httpOnly (token hashato in DB)
    exercises/         catalogo di sistema + esercizi personali
    workouts/          schede, avvio, autosave, fine allenamento
    stats/             volume, 1RM, PR, streak, dashboard, calendario
    strength/          livelli per esercizio e per muscolo
    body/              peso corporeo
    goals/             obiettivi (valore attuale calcolato)
    gamification/      XP, livelli account, badge, sfide, classifica (V2)
    social/            feed, post, commenti, reazioni, foto (V3)
    diet/              alimenti, diario, acqua, obiettivi, andamento (V4)
    profile/
  config/              muscoli, catalogo esercizi e soglie di forza (dati, non codice)
  components/          UI riutilizzabile; body-map/ è data-driven (regions.ts)
  db/                  schema Drizzle, migrazioni, seed idempotente
  lib/                 db, env, errori, rate limit, date, formattazione
```

## Regole di dominio (V1)
- **Volume** serie = peso × ripetizioni; workout = somma delle serie completate.
- **1RM stimato**: Epley, solo serie da 1 a 12 ripetizioni.
- **PR**: confronto con i soli workout precedenti; il primo risultato di un esercizio non è PR; un evento per esercizio per workout. Tipi: `estimated_1rm` e `weight`.
- **Livello esercizio**: rapporto 1RM / peso corporeo attuale, confrontato con le soglie in `strength_standards` (per sesso). Senza dati, peso o sesso resta "non classificato".
- **Livello muscolo**: il più alto tra gli esercizi *primari* (`muscleLevel` in `strength/domain/levels.ts`; è l'unico punto da cambiare se vorrai far contare i secondari).
- **Progressione 30 giorni**: variazione media del 1RM stimato rispetto a prima della finestra, sugli esercizi primari allenati di recente.
- **Streak**: settimane consecutive (lun-dom) con almeno un allenamento; la settimana corrente ancora vuota non interrompe la serie.
- **Fuso orario**: i giorni si calcolano nel fuso del profilo (`lib/dates.ts`).

## Workout in corso
Il client tiene lo stato completo, lo salva in `localStorage` a ogni modifica e lo invia con `PUT /api/workouts/:id` (debounce 600 ms). Gli id di esercizi e serie li genera il client, quindi il salvataggio è **idempotente**: si può ripetere in sicurezza. Se la rete cade, i dati restano sul telefono e l'invio riprova da solo; alla riapertura la bozza locale viene recuperata. Un solo workout può essere "in corso" per utente.

## Sicurezza
- Password: argon2id. Sessioni: token casuale a 256 bit, in DB solo l'hash SHA-256; cookie `httpOnly`, `SameSite=Lax`, `Secure` in produzione; 30 giorni.
- CSRF: `SameSite=Lax` + controllo `Origin` su ogni richiesta che modifica dati.
- XSS: React esegue l'escape; CSP con nonce per richiesta (middleware), `frame-ancestors 'none'`, HSTS, `nosniff`.
- SQL injection: solo query parametrizzate (Drizzle).
- Rate limiting su login (per IP e per email) e registrazione, salvato su Postgres (funziona anche su serverless).
- Autorizzazione: ogni query filtra per `user_id`; gli id generati dal client vengono verificati.
- Nessun segreto nel frontend; configurazione solo da variabili d'ambiente; errori 500 generici.

## Come aggiungere le funzionalità future
- **Nuovi muscoli**: `config/muscles.ts` + regione in `components/body-map/regions.ts` + `npm run db:seed`.
- **Nuove soglie o esercizi**: `config/exercises.ts` + `npm run db:seed` (idempotente).
- **Gamification (V2)**: nuovo modulo `modules/gamification` che legge lo storico (XP e badge derivati o con tabelle proprie `achievements`, `user_achievements`).
- **Social (V3)**: nuove tabelle `friendships`, `posts`, `comments`, `likes` che puntano a `users` e `workouts`; nessuna modifica alle tabelle V1.
- **Dieta (V4)**: modulo separato `modules/diet` con `foods`, `meals`, `meal_items`; la voce "Dieta" è già predisposta (bloccata) in Home.
- **Unità imperiali**: i dati sono in kg; basta una colonna `unit_system` nel profilo e la conversione in `lib/format.ts`.

## V2: gamification
Tutto è **derivato dallo storico**, niente è salvato (tranne le sfide create dall'utente e l'opt-in alla classifica):
- **XP** (`gamification/domain/xp.ts`): 50 per allenamento (min. 3 serie, uno al giorno), 2 per serie (max 30 per allenamento), 40 per record, 60 per settimana con almeno 3 allenamenti, 150 per sfida completata, più l'XP dei badge. Cancellare un allenamento ricalcola tutto in modo coerente.
- **Livello account**: `livello = floor(sqrt(XP / 100)) + 1` (soglie 0, 100, 400, 900...), con titoli da "Matricola" a "Leggenda".
- **Badge** (`domain/achievements.ts`): 39 definizioni in famiglie (allenamenti, serie, volume, costanza, record, varietà, corpo, forza). Ognuno sa calcolare progresso e data di sblocco; il riepilogo mostra i badge sbloccati proprio da quel workout. I badge di *forza* dipendono dallo stato attuale (peso corporeo, livelli) quindi non danno XP.
- **Sfide** (`domain/challenges.ts`): traguardi a tempo (allenamenti, volume, serie, record) con stato attiva / completata / scaduta, massimo 5 attive.
- **Obiettivi avanzati**: oltre a carico, peso e numero di allenamenti ora anche 1RM stimato, volume totale e settimane di fila.
- **Classifica locale**: solo per chi attiva `leaderboard_opt_in`; vede e viene visto solo chi partecipa.
Per materializzare badge e sblocchi (es. per il feed della V3) basterà una tabella `user_achievements` scritta a fine workout dalla stessa logica.

## Prestazioni
- **Regione**: app (`vercel.json`, fra1) e database vanno tenuti nella stessa regione: ogni query paga la distanza.
- **Meno viaggi al database**: storico in 2 query parallele e memoizzato per richiesta (`cache` di React); il salvataggio del workout usa upsert a blocchi (circa 11 query a prescindere da quante serie ci sono); i controlli di validazione partono in parallelo.
- **Cache dei dati quasi statici** (`unstable_cache`, 1 ora): soglie di forza, collegamenti esercizio-muscolo ed elenco esercizi dell'utente (invalidato alla creazione/eliminazione di un esercizio).
- **Calcoli in una sola passata**: analisi dei livelli e PR calcolati una volta per richiesta.
- **Navigazione**: schermate di caricamento (`loading.tsx`) mostrate subito, cache del router di 30 s per le pagine già viste (ogni modifica fa `router.refresh()`), storico paginato (30 alla volta), font solo latino.

## Sicurezza del database
Tutte le tabelle hanno la Row Level Security attiva (`.enableRLS()` nello schema, verificato con un ruolo senza privilegi: legge 0 righe). Ogni nuova tabella deve avere `.enableRLS()`.

## V3: community
Pensata per un gruppo piccolo e per **non rallentare l'app**:
- **Niente amicizie né richieste**: il feed è visibile a tutti gli iscritti (che si registrano con il codice di invito). Meno tabelle, meno join, nessuna logica di permessi da valutare a ogni lettura.
- **Un post = un allenamento concluso** (unico per allenamento), creabile anche giorni dopo. Contiene descrizione (max 500 caratteri) e foto facoltativa. Se l'allenamento viene eliminato, sparisce anche il post (e la sua foto).
- **Istantanea al momento del post**: nome, durata, serie, volume, record ed esercizi in evidenza sono salvati nel post (`snapshot`, jsonb). Gli allenamenti conclusi non cambiano, quindi il feed non deve mai ricalcolare PR o volumi: **3 query per pagina** a prescindere dal numero di post.
- **Paginazione a cursore** su `(created_at, id)` con il timestamp testuale a microsecondi (con un `Date` JS si perderebbero righe), 10 post per pagina, "Mostra altri" che carica solo il JSON della pagina successiva.
- **Reazioni**: 5 chiavi fisse (💪🏻 🔥 👏 🏆 ❤️), una riga per (post, utente, reazione), toggle idempotente con aggiornamento immediato nell'interfaccia. **Commenti**: max 500 caratteri, li elimina l'autore o il proprietario del post. Limiti di frequenza su post, commenti, reazioni e foto.
- **Foto**: ridimensionate e ricompresse nel browser (1080 px, JPEG), caricate dal server (che controlla firma JPEG, dimensione e frequenza) su Supabase Storage con percorso `<userId>/<uuid>.jpg`. Sono servite dalla CDN, con dimensioni note e caricamento pigro (nessun salto di layout). Nel database si salva solo il percorso. Il server rifiuta percorsi di altri utenti.
- **Classifica ampliata** (`gamification/domain/leaderboard.ts`): XP, allenamenti, volume, tempo in palestra, record, varietà di esercizi, costanza e "più sostenuto" (reazioni e commenti ricevuti), su 7 giorni, 30 giorni o sempre. Gli storici di tutti i partecipanti si caricano in due query, con le serie già aggregate dal database; il risultato è in cache con aggiornamento in background (stale-while-revalidate, 5 minuti), quindi aprire la pagina non costa nulla.
- **Misure** (dati sintetici: 22 utenti, 60.000 serie, 300 post, 1.500 commenti, 3.000 reazioni; database locale): feed 34 ms e 3 query, pagina successiva 12 ms, post con 155 commenti 41 ms, reazione 10 ms, classifica a freddo circa 0,6 s con 21 utenti da 3.000 serie ciascuno (a caldo 22 ms).

Scelte volutamente rinviate: notifiche (V5), profili pubblici, messaggi diretti.

## V4: modalità Dieta
- **Due modalità, due gruppi di route**: Palestra (`(app)`) e Dieta (`(diet)`, URL `/diet/...`) hanno layout, navigazione e codice propri. Il codice della dieta si scarica solo quando ci si entra (le pagine pesano 1-6 kB), quindi non appesantisce la palestra. Il passaggio tra le due è una schermata di caricamento a tutto schermo (`ModeTransition`) che compare al tocco e sparisce quando la nuova modalità è pronta. Nella barra in basso "Dieta" occupa il posto di "Profilo", che si apre dall'avatar in Home (e dalla barra laterale su desktop).
- **Catalogo alimenti** (`config/foods.ts`, 194 voci, valori medi per 100 g/ml con porzioni tipiche): dati, non codice; `npm run db:seed` li aggiorna senza cambiare gli id. Un test verifica che le calorie siano coerenti con i macronutrienti e che gli slug siano unici. L'utente può creare alimenti personali (max 500) con i valori in etichetta.
- **Ricerca istantanea**: l'elenco (catalogo in cache lato server + alimenti personali) si scarica una sola volta in background e si filtra nel browser, senza richieste a ogni lettera. I "recenti" derivano dal diario (un tocco per aggiungere di nuovo la stessa quantità).
- **Diario con valori salvati**: ogni voce conserva nome, quantità e valori nutrizionali della quantità registrata. Così modificare o eliminare un alimento non altera i giorni passati e il riepilogo di un giorno è una somma, senza join. Il server ricalcola sempre i valori dal catalogo: non si fida di quelli del client. Modificare la quantità riscala i valori già salvati.
- **Acqua**: un totale per utente e giorno (upsert atomico, tetto di 10 L). **Aggiunta veloce** per piatti senza alimento in catalogo, **copia da ieri** per pasto (una sola query).
- **Obiettivi**: calorie, proteine, carboidrati, grassi e acqua; ripartizioni predefinite per percentuale, controllo di coerenza calorie/macro e calcolatore del fabbisogno (Mifflin-St Jeor, fattore di attività, obiettivo, soglia minima di sicurezza), tutto in `diet/domain` con test. È una stima orientativa e la pagina lo dichiara.
- **Andamento**: calorie e acqua per giorno su 7/14/30 giorni con linea dell'obiettivo, medie dei macro, giorni in obiettivo (±10%).
- **Home**: una query in più (obiettivo e calorie di oggi). 
- **Misure** (120 giorni di diario, circa 1.400 voci; database locale): diario del giorno 43 ms e 5 query, andamento 30 giorni 47 ms, elenco alimenti 20 ms, aggiunta di un alimento 22 ms.
- **Sicurezza**: le quattro nuove tabelle hanno RLS attiva (verificato con un ruolo pubblico: legge 0 righe), ogni query filtra per utente e le date accettate vanno da un anno fa a domani.

Predisposto ma non attivo: lettore di codici a barre (colonna `foods.barcode`).
