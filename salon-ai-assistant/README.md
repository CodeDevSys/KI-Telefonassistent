# Salon AI Assistant

## 1. Projektübersicht

Dieses Projekt ist ein kleines MVP für einen KI-Telefonassistenten für einen Friseursalon.

Ein Kunde ruft über Twilio Voice an. Der Assistent führt auf Deutsch durch die Terminvereinbarung, erkennt Dienstleistung und Terminwunsch mit OpenAI, prüft die Verfügbarkeit in SQLite und speichert den Termin nur, wenn der 30-Minuten-Slot frei ist.

Die Friseurin kann sich über eine einfache Weboberfläche einloggen und alle Termine ansehen.

Unterstützte Dienstleistungen:

- Haare schneiden
- Haare färben
- Styling

Jede Dienstleistung dauert 30 Minuten.

Öffnungszeiten:

- Montag bis Freitag: 09:00 bis 18:00
- Samstag: 09:00 bis 14:00
- Sonntag: geschlossen

## 2. Installation

```bash
npm install
```

## 3. ENV konfigurieren

Kopieren Sie die Beispieldatei:

```bash
cp .env.example .env
```

Danach die Werte in `.env` setzen:

```env
PORT=3000
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ADMIN_USER=admin
ADMIN_PASS=salon123
SESSION_SECRET=supersecret
```

Hinweise:

- `OPENAI_API_KEY` wird für flexibles Verstehen von Dienstleistung und Datum/Uhrzeit genutzt.
- Ohne OpenAI-Key gibt es einfache Fallback-Erkennung für typische deutsche Eingaben.
- `ADMIN_USER`, `ADMIN_PASS` und `SESSION_SECRET` sollten produktiv geändert werden.

## 4. Server starten

```bash
npm start
```

Der Server läuft standardmäßig unter:

```text
http://localhost:3000
```

Beim ersten Start wird automatisch eine SQLite-Datenbank `salon.sqlite` erstellt und die Tabelle `appointments` angelegt.

## 5. Twilio konfigurieren

In der Twilio Console:

1. Eine Voice-fähige Telefonnummer öffnen.
2. Unter Voice Webhook die URL setzen:

```text
https://IHRE-DOMAIN/voice
```

3. Methode auf `POST` setzen.
4. Für lokale Tests kann ein Tunnel wie ngrok genutzt werden:

```bash
ngrok http 3000
```

Dann die HTTPS-ngrok-URL bei Twilio eintragen:

```text
https://...ngrok-free.app/voice
```

Der weitere Gesprächsfluss läuft über:

```text
POST /voice/next
```

## 6. Login-Daten

Standardwerte:

- Benutzername: `admin`
- Passwort: `salon123`

Die Werte sind über `.env` konfigurierbar:

```env
ADMIN_USER=admin
ADMIN_PASS=salon123
```

Login:

```text
GET /login
```

Terminübersicht:

```text
GET /appointments
```

## 7. Projektstruktur

```text
salon-ai-assistant/
  server.js
  db.js
  voice.js
  .env.example
  package.json
  README.md
  /views
    login.html
    appointments.html
  /public
    style.css
```

## 8. Erweiterungsmöglichkeiten

- Kalenderansicht für Termine ergänzen.
- Dienstleistungen mit unterschiedlichen Dauern speichern.
- Kundendaten in einer separaten Tabelle verwalten.
- SMS-Bestätigung über Twilio senden.
- Terminabsagen und Umbuchungen unterstützen.
- Bessere OpenAI-Prompts für komplexere Gesprächssituationen ergänzen.
- Admin-Seite um Such- und Filterfunktionen erweitern.
- Persistenten Session Store für produktiven Betrieb nutzen.
