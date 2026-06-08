# Salon AI Assistant

Echtes Telefon-MVP für einen KI-Telefonassistenten eines Friseursalons.

Der Ablauf ist real:

1. Kunde ruft eine Twilio-Telefonnummer an.
2. Twilio ruft den lokalen Node.js Server über ngrok auf.
3. `POST /voice` gibt TwiML mit `Connect Stream` zurück.
4. Twilio öffnet einen WebSocket zu `/voice/stream`.
5. OpenAI Realtime verarbeitet die Sprache live.
6. Die KI nutzt echte Backend-Tools für Verfügbarkeit und Buchung.
7. Termine werden in SQLite gespeichert.
8. Die Friseurin sieht neue Termine im Admin-Dashboard.

Es gibt keinen Chat-Demo-Modus und keine Dummy-Daten.

## 1. Installation

```bash
npm install
```

## 2. ENV konfigurieren

```bash
cp .env.example .env
```

`.env` ausfüllen:

```env
PORT=3000
PUBLIC_BASE_URL=https://IHRE-NGROK-DOMAIN.ngrok-free.app
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_VOICE=alloy
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
ADMIN_USER=admin
ADMIN_PASS=salon123
SESSION_SECRET=bitte-aendern
```

Wichtig:

- `OPENAI_API_KEY` ist Pflicht für echte Live-Sprache.
- `PUBLIC_BASE_URL` muss die öffentliche HTTPS-ngrok-URL sein.
- Für Twilio Media Streams wird daraus automatisch `wss://.../voice/stream`.

## 3. Server starten

```bash
npm start
```

Der Server läuft lokal unter:

```text
http://localhost:3000
```

Beim ersten Start wird automatisch `salon.sqlite` erstellt.

## 4. ngrok installieren und starten

ngrok installieren:

```bash
npm install -g ngrok
```

Oder von der offiziellen Seite installieren:

```text
https://ngrok.com/download
```

Tunnel starten:

```bash
ngrok http 3000
```

ngrok zeigt eine öffentliche HTTPS-URL, zum Beispiel:

```text
https://abc123.ngrok-free.app
```

Diese URL in `.env` setzen:

```env
PUBLIC_BASE_URL=https://abc123.ngrok-free.app
```

Server danach neu starten.

## 5. Twilio Trial Account einrichten

1. Twilio Account erstellen:

```text
https://www.twilio.com/try-twilio
```

2. Trial-Telefonnummer kaufen:
   - Twilio Console öffnen.
   - `Phone Numbers` auswählen.
   - Eine Voice-fähige Nummer kaufen.

3. Verified Caller ID einrichten:
   - Twilio Trial Accounts dürfen nur verifizierte Ziel-/Anrufernummern nutzen.
   - In der Twilio Console `Verified Caller IDs` öffnen.
   - Ihre eigene Handynummer verifizieren.
   - Den Bestätigungscode eingeben.

Hinweis:

Mit einem Twilio Trial Account können Sie nur von beziehungsweise zu verifizierten Nummern testen. Für echte beliebige Kundenanrufe muss der Twilio Account upgegradet werden.

## 6. Twilio Webhook konfigurieren

In der Twilio Console die gekaufte Telefonnummer öffnen.

Unter `Voice Configuration`:

- `A call comes in`: `Webhook`
- URL:

```text
https://abc123.ngrok-free.app/voice
```

- Methode: `HTTP POST`

Speichern.

Twilio öffnet anschließend bei jedem Anruf automatisch den Media Stream:

```text
wss://abc123.ngrok-free.app/voice/stream
```

## 7. Testanruf durchführen

1. Server starten:

```bash
npm start
```

2. ngrok starten:

```bash
ngrok http 3000
```

3. `PUBLIC_BASE_URL` in `.env` auf die aktuelle ngrok-URL setzen.
4. Server neu starten.
5. Twilio Voice Webhook auf `https://IHRE-NGROK-URL/voice` setzen.
6. Mit der verifizierten Telefonnummer die Twilio-Nummer anrufen.

Der Assistent begrüßt den Kunden und führt die Terminbuchung per Sprache durch.

## 8. Gesprächslogik

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
7. Termin in SQLite speichern
8. Termin bestätigen

Die KI darf Termine nicht frei erfinden. Sie muss diese Backend-Tools nutzen:

- `checkAvailability(date, time)`
- `getAvailableSlots(date, time)`
- `createAppointment(name, phone, service, date, time)`

## 9. Slot- und Öffnungszeiten

- Alle Termine dauern 30 Minuten.
- Montag bis Freitag: 09:00 bis 18:00
- Samstag: 09:00 bis 14:00
- Sonntag: geschlossen
- Doppelbuchungen werden durch einen eindeutigen SQLite-Index verhindert.

## 10. Admin Login

Login:

```text
http://localhost:3000/login
```

Standarddaten:

- Benutzername: `admin`
- Passwort: `salon123`

Konfigurierbar über:

```env
ADMIN_USER=admin
ADMIN_PASS=salon123
```

Terminübersicht:

```text
http://localhost:3000/appointments
```

Neue Termine aus echten Telefonanrufen werden direkt aus SQLite geladen.

## 11. API und Routen

```text
GET  /login
POST /login
GET  /logout
GET  /appointments
POST /voice
WS   /voice/stream
GET  /health
```

## 12. Projektstruktur

```text
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
```

## 13. Erweiterungsmöglichkeiten

- SMS-Bestätigung nach erfolgreicher Buchung.
- Kalenderansicht im Admin-Dashboard.
- Absagen und Umbuchungen per Sprache.
- Unterschiedliche Dauer je Dienstleistung.
- Persistenter Session Store für produktiven Betrieb.
- Validierung von Twilio-Signaturen für öffentliche Deployments.
