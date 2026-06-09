# RENDER_SETUP.md

Schritt-für-Schritt-Anleitung für das vollständige Cloud Deployment auf Render.com.

Ziel:

```text
https://salon-ai-assistant.onrender.com
```

Öffentliche Seiten:

```text
https://salon-ai-assistant.onrender.com/login
https://salon-ai-assistant.onrender.com/appointments
```

Twilio Voice Webhook:

```text
https://salon-ai-assistant.onrender.com/voice
```

## 1. Render Account erstellen

1. Öffnen:

```text
https://render.com
```

2. `Get Started` anklicken.
3. Mit GitHub anmelden oder Account erstellen.
4. E-Mail bestätigen.

Screenshot-Beschreibung:

- Oben rechts befinden sich Buttons wie `Sign In` und `Get Started`.
- Nach dem Login öffnet sich das Render Dashboard.
- Links oder oben gibt es einen Button `New`.

## 2. GitHub verbinden

1. In Render öffnen:

```text
https://dashboard.render.com
```

2. `New` anklicken.
3. `Blueprint` auswählen.
4. GitHub Zugriff erlauben.
5. Repository auswählen.

Screenshot-Beschreibung:

- Nach Klick auf `New` erscheint eine Liste mit Optionen.
- Die Option heißt `Blueprint`.
- Render zeigt GitHub-Repositories in einer Liste.
- Falls das Repository fehlt, muss GitHub-Zugriff über `Configure account` erweitert werden.

## 3. Deploy über render.yaml starten

Das Repository enthält bereits:

```text
render.yaml
```

Render erkennt daraus automatisch:

```yaml
services:
  - type: web
    name: salon-ai-assistant
    runtime: node
    rootDir: salon-ai-assistant
    plan: starter
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
```

1. Blueprint bestätigen.
2. Render erstellt den Service `salon-ai-assistant`.
3. Build starten lassen.

Wichtig:

- `rootDir` ist `salon-ai-assistant`.
- Der Startbefehl ist `npm start`.
- Render setzt automatisch `PORT`.

## 4. Persistent Disk anlegen

Die persistente Disk ist bereits in `render.yaml` vorbereitet:

```yaml
disk:
  name: salon-ai-data
  mountPath: /var/data
  sizeGB: 1
```

Dadurch wird die SQLite-Datei dauerhaft gespeichert unter:

```text
/var/data/salon.sqlite
```

Wenn Render beim Blueprint fragt, ob die Disk angelegt werden soll:

1. Disk bestätigen.
2. Größe `1 GB` beibehalten.
3. Mount Path `/var/data` beibehalten.

Screenshot-Beschreibung:

- In der Service-Konfiguration gibt es einen Bereich `Disks`.
- Dort steht `salon-ai-data`.
- Mount Path muss `/var/data` sein.

Wichtig:

- Es wird keine PostgreSQL-Datenbank benötigt.
- Das Projekt nutzt `sql.js`, nicht das native Paket `sqlite3`.
- Dadurch gibt es keine `node_sqlite3.node`-/GLIBC-Probleme.

## 5. Environment Variables setzen

In Render:

```text
Service -> Environment
```

Folgende Variablen setzen:

```env
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
ADMIN_USER=admin
ADMIN_PASS=salon123
SESSION_SECRET=<langer-zufaelliger-wert>
PUBLIC_BASE_URL=https://salon-ai-assistant.onrender.com
```

Bereits durch `render.yaml` gesetzt:

```env
SQLITE_PATH=/var/data/salon.sqlite
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_VOICE=alloy
TWILIO_VALIDATE_WEBHOOKS=false
```

Wenn Render eine andere URL vergibt, zum Beispiel:

```text
https://salon-ai-assistant-abc1.onrender.com
```

dann muss `PUBLIC_BASE_URL` exakt auf diese URL geändert werden:

```env
PUBLIC_BASE_URL=https://salon-ai-assistant-abc1.onrender.com
```

Screenshot-Beschreibung:

- Im Render Service gibt es links den Menüpunkt `Environment`.
- Jede Variable besteht aus `Key` und `Value`.
- Secret-Werte können verborgen angezeigt werden.
- Nach Änderung muss `Save Changes` geklickt werden.

## 6. Deploy ausführen

Nach dem Setzen der Environment Variables:

1. Im Render Service `Manual Deploy` anklicken.
2. `Deploy latest commit` auswählen.
3. Logs beobachten.

Erfolgreiche Logs enthalten:

```text
Salon KI-Assistent läuft auf http://localhost:<PORT>
Twilio Voice Webhook: POST /voice
Twilio Media Stream WebSocket: /voice/stream
```

## 7. Logs prüfen

In Render:

```text
Service -> Logs
```

Prüfen:

- Keine Fehler beim Start.
- Keine Meldung wie `Datenbank konnte nicht initialisiert werden`.
- Keine Meldung wie `OPENAI_API_KEY fehlt`, sobald ein Testanruf erfolgt.

Screenshot-Beschreibung:

- Links im Service-Menü steht `Logs`.
- Die Logs laufen live nach unten.
- Fehler erscheinen häufig rot oder mit `Error`.

## 8. Health Check testen

Browser öffnen:

```text
https://salon-ai-assistant.onrender.com/health
```

Erwartete Antwort:

```json
{ "ok": true }
```

Wenn die Antwort nicht kommt:

- Render Service Status prüfen.
- Logs prüfen.
- Environment Variables prüfen.

## 9. Login-Seite testen

Browser öffnen:

```text
https://salon-ai-assistant.onrender.com/login
```

Einloggen mit:

```text
ADMIN_USER
ADMIN_PASS
```

Danach sollte die Terminübersicht öffnen:

```text
https://salon-ai-assistant.onrender.com/appointments
```

Die Terminliste aktualisiert sich alle 5 Sekunden automatisch.

## 10. Twilio Webhook eintragen

Nach erfolgreichem Render Deployment in Twilio setzen:

```text
https://salon-ai-assistant.onrender.com/voice
```

Methode:

```text
HTTP POST
```

Details stehen in:

```text
TWILIO_SETUP.md
```

## 11. OpenAI konfigurieren

1. OpenAI API Key erstellen:

```text
https://platform.openai.com/api-keys
```

2. Key in Render setzen:

```env
OPENAI_API_KEY=sk-...
```

3. Sicherstellen, dass der OpenAI Account Zugriff auf Realtime Voice hat.

Das Projekt nutzt:

```env
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_VOICE=alloy
```

## 12. Demo durchführen

Tablet:

1. Öffnen:

```text
https://salon-ai-assistant.onrender.com/login
```

2. Einloggen.
3. Terminübersicht offen lassen.

Handy:

1. Twilio Nummer anrufen.
2. Mit der KI sprechen.
3. Termin buchen.

Erwartung:

- Termin wird in SQLite gespeichert.
- Termin erscheint innerhalb von 5 Sekunden im Tablet-Dashboard.

## 13. Wenn der Service nicht startet

Prüfen:

- `render.yaml` liegt im Repo-Root.
- `rootDir` ist `salon-ai-assistant`.
- `package.json` enthält `start`.
- `SQLITE_PATH` ist `/var/data/salon.sqlite`.
- Persistent Disk ist bei `/var/data` gemountet.
- `SESSION_SECRET` ist gesetzt.

## 14. Wenn Daten nach Deploy verschwinden

Prüfen:

- Service verwendet Render Disk.
- `SQLITE_PATH=/var/data/salon.sqlite`.
- Datenbank liegt nicht im Projektordner.

Nur `/var/data` ist persistent.
