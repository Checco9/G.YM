/** Genera le chiavi VAPID per le notifiche push: `npm run vapid`. */
const webpush = require("web-push");
const keys = webpush.generateVAPIDKeys();
console.log("\nAggiungi queste variabili d'ambiente (su Vercel e nel file .env):\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:tua-email@esempio.it");
console.log(`CRON_SECRET=${require("node:crypto").randomBytes(24).toString("hex")}\n`);
console.log("La chiave privata e CRON_SECRET sono segrete: non vanno mai pubblicate.\n");
