# TWILIO_SETUP.md

Schritt-für-Schritt-Anleitung für die echte Twilio-Telefonie.

Ziel:

```text
Handy -> Twilio Telefonnummer -> Render Webhook -> OpenAI Realtime -> PostgreSQL Termin -> Dashboard
```

Render-Ziel-URL:

```text
https://salon-ai-assistant.onrender.com
```

Voice Webhook:

```text
https://salon-ai-assistant.onrender.com/voice
```

## 1. Twilio Trial Account erstellen

1. Öffnen:

```text
https://www.twilio.com/try-twilio
```

2. Registrierung durchführen.
3. E-Mail-Adresse bestätigen.
4. Telefonnummer bestätigen.
5. Twilio Console öffnen:

```text
https://console.twilio.com
```

Screenshot-Beschreibung:

- Links befindet sich die Twilio-Navigation.
- Oben rechts ist das Account-Menü.
- Auf der Startseite sieht man häufig den Bereich `Account Info` mit `Account SID` und `Auth Token`.

## 2. Account SID und Auth Token kopieren

1. In der Twilio Console öffnen:

```text
https://console.twilio.com/us1/account/keys-credentials/api-keys
```

Oder über:

```text
Console -> Account -> API keys & tokens
```

2. `Account SID` kopieren.
3. `Auth Token` anzeigen und kopieren.

Diese Werte später in Render setzen:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Screenshot-Beschreibung:

- Ein Feld heißt `Account SID`.
- Daneben oder darunter befindet sich `Auth Token`.
- Der Auth Token ist zuerst verborgen und wird per Klick auf ein Auge-/Show-Symbol sichtbar.

## 3. Twilio Telefonnummer auswählen

1. Öffnen:

```text
https://console.twilio.com/us1/develop/phone-numbers/manage/search
```

Oder über:

```text
Console -> Phone Numbers -> Manage -> Buy a number
```

2. Filter setzen:
   - Capability: `Voice`
   - Optional: Land auswählen
3. Eine Nummer auswählen.
4. Nummer kaufen.

Die Nummer später in Render setzen:

```env
TWILIO_PHONE_NUMBER=+1234567890
```

Screenshot-Beschreibung:

- Es gibt eine Suchmaske für Telefonnummern.
- In einer Tabelle stehen verfügbare Nummern.
- Jede Nummer zeigt Capabilities wie `Voice`, `SMS`, `MMS`.
- Rechts gibt es einen Button wie `Buy` oder `Purchase`.

## 4. Verified Caller ID konfigurieren

Wichtig für Twilio Trial:

Ein Trial Account darf nur mit verifizierten Telefonnummern telefonieren.

1. Öffnen:

```text
https://console.twilio.com/us1/develop/phone-numbers/manage/verified
```

Oder über:

```text
Console -> Phone Numbers -> Manage -> Verified Caller IDs
```

2. `Add a new Caller ID` anklicken.
3. Eigene Handynummer eingeben.
4. Twilio sendet einen Code per Anruf oder SMS.
5. Code eingeben.
6. Warten, bis die Nummer als verified angezeigt wird.

Screenshot-Beschreibung:

- Auf der Seite steht eine Liste verifizierter Nummern.
- Oben oder rechts gibt es einen Button `Add a new Caller ID`.
- Nach erfolgreicher Prüfung steht die Nummer in der Tabelle.

## 5. Voice Webhook setzen

1. Twilio Telefonnummer öffnen:

```text
https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
```

Oder:

```text
Console -> Phone Numbers -> Manage -> Active numbers
```

2. Die gekaufte Telefonnummer anklicken.
3. Zum Abschnitt `Voice Configuration` scrollen.
4. Bei `A call comes in` auswählen:

```text
Webhook
```

5. URL eintragen:

```text
https://salon-ai-assistant.onrender.com/voice
```

6. Methode setzen:

```text
HTTP POST
```

7. Speichern.

Screenshot-Beschreibung:

- Die Detailseite der Nummer zeigt Abschnitte für Messaging und Voice.
- Im Voice-Bereich gibt es `A call comes in`.
- Darunter steht ein URL-Feld.
- Neben dem URL-Feld befindet sich ein Dropdown für `HTTP GET` oder `HTTP POST`.
- Unten gibt es einen Button `Save configuration`.

## 6. Render Environment Variables prüfen

In Render müssen diese Variablen gesetzt sein:

```env
PUBLIC_BASE_URL=https://salon-ai-assistant.onrender.com
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+...
OPENAI_API_KEY=sk-...
ADMIN_USER=admin
ADMIN_PASS=salon123
SESSION_SECRET=<langer-zufaelliger-wert>
```

Optional:

```env
TWILIO_VALIDATE_WEBHOOKS=false
```

Für die erste Demo sollte `TWILIO_VALIDATE_WEBHOOKS=false` bleiben.

Wenn später Signaturprüfung gewünscht ist:

```env
TWILIO_VALIDATE_WEBHOOKS=true
```

Dann muss `PUBLIC_BASE_URL` exakt der in Twilio eingetragenen Domain entsprechen.

## 7. Testanruf durchführen

1. Render Service muss `Live` sein.
2. Health Check öffnen:

```text
https://salon-ai-assistant.onrender.com/health
```

Erwartung:

```json
{ "ok": true }
```

3. Mit der verifizierten Handynummer die Twilio-Nummer anrufen.
4. Erwartung:
   - Der Anruf wird angenommen.
   - Die KI sagt: `Hallo, vielen Dank für Ihren Anruf. Wie kann ich Ihnen helfen?`
   - Termin per Sprache vereinbaren.
   - Termin wird gespeichert.

## 8. Häufige Fehler

### Twilio sagt, die Nummer ist nicht erlaubt

Ursache:

- Trial Account.
- Anrufende Nummer ist nicht verifiziert.

Lösung:

- Nummer unter `Verified Caller IDs` verifizieren.

### Anruf bricht sofort ab

Prüfen:

- Render Service ist `Live`.
- Twilio Webhook ist exakt:

```text
https://salon-ai-assistant.onrender.com/voice
```

- Methode ist `HTTP POST`.
- `OPENAI_API_KEY` ist in Render gesetzt.

### KI spricht nicht

Prüfen:

- Render Logs öffnen.
- Nach `OpenAI Realtime Fehler` suchen.
- OpenAI API Key prüfen.
- OpenAI Account muss Zugriff auf Realtime Voice haben.

### WebSocket Fehler

Prüfen:

- `PUBLIC_BASE_URL` ist korrekt.
- Twilio Webhook zeigt auf dieselbe Domain.
- TwiML muss enthalten:

```text
wss://salon-ai-assistant.onrender.com/voice/stream
```

Das kann mit einem Test-POST geprüft werden:

```bash
curl -X POST https://salon-ai-assistant.onrender.com/voice
```
