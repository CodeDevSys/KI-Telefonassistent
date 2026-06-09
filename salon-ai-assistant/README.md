# Salon AI Assistant

Cloud-basiertes Telefon-MVP für einen KI-Telefonassistenten eines Friseursalons.

Nach dem Deployment läuft alles zentral auf Render.com:

- Backend
- Admin Login
- Terminübersicht
- Twilio Voice Webhook
- Twilio Media Stream WebSocket
- OpenAI Realtime Voice Integration
- Persistente SQLite-Datenbank auf Render Disk

Es wird kein lokaler Laptop und kein ngrok für den Betrieb benötigt.

Ziel-URL:

```text
https://salon-ai-assistant.onrender.com
```

Öffentliche Seiten:

```text
https://salon-ai-assistant.onrender.com/login
https://salon-ai-assistant.onrender.com/appointments
```

## 1. Architektur

1. Kunde ruft die Twilio-Telefonnummer an.
2. Twilio ruft `POST /voice` auf Render auf.
3. Render antwortet mit TwiML und startet einen Twilio Media Stream.
4. Twilio verbindet sich per WebSocket mit `wss://salon-ai-assistant.onrender.com/voice/stream`.
5. OpenAI Realtime verarbeitet Sprache live.
6. Die KI nutzt echte Backend-Tools für Verfügbarkeit und Buchung.
7. Termine werden in SQLite auf der persistenten Render Disk gespeichert.
8. Das Admin-Dashboard aktualisiert die Terminliste alle 5 Sekunden automatisch.

## 2. Datenbank

Für das MVP wird SQLite verwendet.

Auf Render wird die Datenbank dauerhaft auf einer persistenten Disk gespeichert:

```text
/var/data/salon.sqlite
```

Die Disk wird über `render.yaml` angelegt:

```yaml
disk:
  name: salon-ai-data
  mountPath: /var/data
  sizeGB: 1
```

Wichtig:

- Render Free Services haben keine persistente Disk.
- Das Blueprint nutzt deshalb `plan: starter`.
- Nur Daten unter `/var/data` bleiben über Deploys und Restarts hinweg erhalten.

## 3. Render Account erstellen

1. Öffnen:

```text
https://render.com
```

2. Account erstellen oder einloggen.
3. Render mit GitHub verbinden.

## 4. GitHub Repository verbinden

1. In Render auf `New` klicken.
2. `Blueprint` auswählen.
3. GitHub Repository auswählen.
4. Render erkennt die Datei `render.yaml` im Repository.
5. Blueprint bestätigen.

Das Blueprint erstellt den Web Service:

```text
salon-ai-assistant
```

Mit der erwarteten URL:

```text
https://salon-ai-assistant.onrender.com
```

Falls der Name auf Render bereits vergeben ist, zeigt Render eine leicht andere URL an. Dann muss `PUBLIC_BASE_URL` auf diese tatsächliche URL gesetzt werden.

## 5. Environment Variables setzen

In Render beim Service `salon-ai-assistant` die Environment Variables prüfen und setzen:

```env
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ADMIN_USER=
ADMIN_PASS=
SESSION_SECRET=
PUBLIC_BASE_URL=https://salon-ai-assistant.onrender.com
```

Zusätzlich setzt `render.yaml`:

```env
SQLITE_PATH=/var/data/salon.sqlite
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_VOICE=alloy
```

Empfohlene Werte:

```env
ADMIN_USER=admin
ADMIN_PASS=salon123
SESSION_SECRET=<langer-zufaelliger-wert>
```

`OPENAI_API_KEY` ist Pflicht. Ohne diesen Key startet kein Fake- oder Demo-Modus für Telefonie.

## 6. Deploy starten

1. In Render den Blueprint deployen.
2. Warten, bis der Service `Live` ist.
3. Health Check öffnen:

```text
https://salon-ai-assistant.onrender.com/health
```

Erwartete Antwort:

```json
{ "ok": true }
```

## 7. Twilio Account und Telefonnummer

1. Twilio Account erstellen:

```text
https://www.twilio.com/try-twilio
```

2. Voice-fähige Telefonnummer kaufen.
3. Bei Trial Accounts die eigene Handynummer als `Verified Caller ID` verifizieren.

Wichtig für Twilio Trial:

- Trial erlaubt nur verifizierte Telefonnummern.
- Für Anrufe von beliebigen Kunden muss der Twilio Account upgegradet werden.

## 8. Twilio Webhook eintragen

In Twilio:

1. `Phone Numbers` öffnen.
2. Gekaufte Nummer auswählen.
3. Unter `Voice Configuration` setzen:

```text
A call comes in: Webhook
URL: https://salon-ai-assistant.onrender.com/voice
Method: HTTP POST
```

Speichern.

Der Media Stream wird automatisch vom Backend erzeugt:

```text
wss://salon-ai-assistant.onrender.com/voice/stream
```

## 9. Testanruf durchführen

1. Render Service muss `Live` sein.
2. Twilio Webhook muss auf Render zeigen:

```text
https://salon-ai-assistant.onrender.com/voice
```

3. Mit der verifizierten Telefonnummer die Twilio-Nummer anrufen.
4. Der KI-Assistent begrüßt den Kunden.
5. Termin per Sprache vereinbaren.
6. Der Termin wird in SQLite gespeichert.

## 10. Praktische Demo

Gerät 1: Tablet

1. Browser öffnen.
2. Login öffnen:

```text
https://salon-ai-assistant.onrender.com/login
```

3. Einloggen.
4. Terminübersicht offen lassen:

```text
https://salon-ai-assistant.onrender.com/appointments
```

Die Tabelle aktualisiert sich alle 5 Sekunden automatisch.

Gerät 2: Handy

1. Twilio Telefonnummer anrufen.
2. Mit dem KI-Assistenten sprechen.
3. Termin buchen.

Ergebnis:

Der neue Termin erscheint ohne manuelles Neuladen in der Terminübersicht auf dem Tablet.

## 11. Gesprächslogik

Die KI spricht Deutsch und folgt diesem Ablauf:

1. Begrüßung
2. Dienstleistung erkennen:
   - Haare schneiden
   - Haare färben
   - Styling
3. Terminwunsch verstehen
4. Verfügbarkeit live in SQLite prüfen
5. Falls belegt oder geschlossen: drei freie Alternativen anbieten
6. Name und Telefonnummer abfragen
7. Termin speichern
8. Termin bestätigen

Die KI muss echte Backend-Tools nutzen:

- `checkAvailability(date, time)`
- `getAvailableSlots(date, time)`
- `createAppointment(name, phone, service, date, time)`

## 12. Slot- und Öffnungszeiten

- Alle Termine dauern 30 Minuten.
- Montag bis Freitag: 09:00 bis 18:00
- Samstag: 09:00 bis 14:00
- Sonntag: geschlossen
- Doppelbuchungen werden durch einen eindeutigen SQLite-Index verhindert.

## 13. Admin Login

Login:

```text
https://salon-ai-assistant.onrender.com/login
```

Terminübersicht:

```text
https://salon-ai-assistant.onrender.com/appointments
```

Die Zugangsdaten werden über Render Environment Variables gesetzt:

```env
ADMIN_USER=
ADMIN_PASS=
```

## 14. API und Routen

```text
GET  /
GET  /health
GET  /login
POST /login
GET  /logout
GET  /appointments
GET  /api/appointments
POST /voice
WS   /voice/stream
```

`/api/appointments` ist geschützt und wird vom Dashboard alle 5 Sekunden abgefragt.

## 15. Projektstruktur

```text
render.yaml

salon-ai-assistant/
  package.json
  server.js
  voice.js
  ai.js
  twilio.js
  db.js
  .env.example
  README.md
  /views
    login.html
    appointments.html
  /public
    style.css
    appointments.js
```

## 16. Lokale Entwicklung optional

Für lokale Entwicklung:

```bash
cd salon-ai-assistant
npm install
cp .env.example .env
npm start
```

Für den echten Cloud-Betrieb wird ausschließlich Render verwendet. Twilio muss dann direkt auf die Render-URL zeigen.
