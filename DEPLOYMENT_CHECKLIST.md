# DEPLOYMENT_CHECKLIST.md

Praktische Checkliste für die fertige Demo.

## Repository

□ GitHub Repository erstellt

□ Code in GitHub gepusht

□ `render.yaml` liegt im Repository-Root

□ Projektordner `salon-ai-assistant/` ist vorhanden

□ Setup-Dateien sind vorhanden:

```text
TWILIO_SETUP.md
RENDER_SETUP.md
DEPLOYMENT_CHECKLIST.md
```

## Render

□ Render Account erstellt

□ GitHub mit Render verbunden

□ Blueprint aus `render.yaml` gestartet

□ Render Service `salon-ai-assistant` erstellt

□ Render Service läuft

□ Render URL bekannt:

```text
https://salon-ai-assistant.onrender.com
```

□ Falls Render eine andere URL vergeben hat, `PUBLIC_BASE_URL` angepasst

□ Persistent Disk angelegt

□ Persistent Disk Mount Path ist:

```text
/var/data
```

□ `SQLITE_PATH` gesetzt:

```env
SQLITE_PATH=/var/data/salon.sqlite
```

□ Health Check erreichbar:

```text
https://salon-ai-assistant.onrender.com/health
```

□ Health Check Antwort:

```json
{ "ok": true }
```

□ Render Logs geprüft

□ Keine Startfehler in den Logs

## Environment Variables

□ `OPENAI_API_KEY` gesetzt

□ `TWILIO_ACCOUNT_SID` gesetzt

□ `TWILIO_AUTH_TOKEN` gesetzt

□ `TWILIO_PHONE_NUMBER` gesetzt

□ `ADMIN_USER` gesetzt

□ `ADMIN_PASS` gesetzt

□ `SESSION_SECRET` gesetzt

□ `PUBLIC_BASE_URL` gesetzt:

```env
PUBLIC_BASE_URL=https://salon-ai-assistant.onrender.com
```

□ Optional für erste Demo:

```env
TWILIO_VALIDATE_WEBHOOKS=false
```

## Admin Dashboard

□ Login Seite erreichbar:

```text
https://salon-ai-assistant.onrender.com/login
```

□ Login mit `ADMIN_USER` und `ADMIN_PASS` erfolgreich

□ Terminübersicht erreichbar:

```text
https://salon-ai-assistant.onrender.com/appointments
```

□ Terminübersicht lädt ohne Fehler

□ Auto-Refresh ist aktiv

□ Neue Termine erscheinen innerhalb von 5 Sekunden

## Datenbank

□ Datenbank wird automatisch erstellt

□ Datenbank liegt auf Render Disk:

```text
/var/data/salon.sqlite
```

□ Tabelle `appointments` wird automatisch angelegt

□ Doppelbuchungen werden verhindert

□ Termine bleiben nach Render Restart erhalten

## OpenAI

□ OpenAI Account aktiv

□ OpenAI API Key erstellt:

```text
https://platform.openai.com/api-keys
```

□ OpenAI API Key in Render gesetzt

□ OpenAI Account hat Zugriff auf Realtime Voice

□ Keine OpenAI-Fehler in Render Logs beim Testanruf

## Twilio

□ Twilio Trial Account erstellt

□ Twilio Telefonnummer aktiv

□ Eigene Handynummer als Verified Caller ID konfiguriert

□ `TWILIO_PHONE_NUMBER` entspricht der gekauften Twilio Nummer

□ Voice Webhook gesetzt:

```text
https://salon-ai-assistant.onrender.com/voice
```

□ Voice Webhook Methode:

```text
HTTP POST
```

□ Twilio Nummer lässt sich vom verifizierten Handy anrufen

□ Anruf wird nicht sofort abgebrochen

□ KI begrüßt den Anrufer

□ KI versteht Dienstleistung

□ KI versteht Terminwunsch

□ KI fragt Name und Telefonnummer ab

□ KI bestätigt den Termin

## Demo-Test

□ Tablet: Login-Seite geöffnet

□ Tablet: Eingeloggt

□ Tablet: Terminübersicht sichtbar

□ Handy: Twilio Nummer angerufen

□ Handy: Mit KI gesprochen

□ Termin erfolgreich vereinbart

□ Termin gespeichert

□ Termin erscheint im Dashboard

□ Termin erscheint innerhalb von 5 Sekunden

## Fehlerprüfung

□ Falls Login nicht funktioniert: `ADMIN_USER` und `ADMIN_PASS` geprüft

□ Falls Anruf fehlschlägt: Twilio Webhook URL geprüft

□ Falls KI nicht spricht: `OPENAI_API_KEY` und Render Logs geprüft

□ Falls Termine nicht bleiben: Render Disk und `SQLITE_PATH` geprüft

□ Falls Dashboard nicht aktualisiert: Browser-Konsole und `/api/appointments` geprüft

## Fertig

□ System ist vollständig cloud-basiert

□ Kein Laptop erforderlich

□ Kein ngrok erforderlich

□ Twilio kommuniziert direkt mit Render

□ OpenAI läuft serverseitig über Render

□ Termine werden zentral gespeichert

□ Dashboard zeigt Live-Termine
