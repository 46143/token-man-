# Token Refresh Bot

Dedizierter Discord Bot für automatische Minecraft Bedrock Token Refresh.

## Features

- **Automatischer Token Refresh**: Refresh alle Tokens alle 6 Stunden
- **Discord Slash Commands**: Einfache Verwaltung über Discord
- **Token Storage**: MongoDB oder lokale JSON-Datei
- **Status Monitoring**: Überprüfung des Refresh-Status
- **Channel Notifications**: Automatische Benachrichtigungen in Discord Channels
- **Render.com Hosting**: Bereit für Cloud-Deployment

## Installation

### Lokal

1. **Abhängigkeiten installieren:**
```bash
npm install
```

2. **Konfiguration:**
Bearbeite `config.json` und füge deine Daten ein:
```json
{
  "token": "DEIN_DISCORD_BOT_TOKEN",
  "applicationId": "DEINE_APPLICATION_ID",
  "channels": {
    "refresh": "CHANNEL_ID_REFRESH",
    "add": "CHANNEL_ID_ADD",
    "expired": "CHANNEL_ID_EXPIRED"
  },
  "mongodbUri": "mongodb://localhost:27017/token-refresh-bot"
}
```

### Render.com Hosting

1. **MongoDB Atlas Setup:**
   - Erstelle ein kostenloses MongoDB Atlas Konto
   - Erstelle eine neue Cluster (M0 Free Tier)
   - Erstelle eine Database User
   - Kopiere die Connection String

2. **Render.com Setup:**
   - Erstelle ein neues Web Service auf Render.com
   - Verbinde dein GitHub Repository
   - Füge folgende Environment Variables hinzu:
     - `DISCORD_BOT_TOKEN`: Dein Discord Bot Token
     - `APPLICATION_ID`: Deine Application ID
     - `MONGODB_URI`: Deine MongoDB Connection String
     - `CHANNEL_REFRESH`: Channel ID für Refresh Notifications
     - `CHANNEL_ADD`: Channel ID für Add Notifications
     - `CHANNEL_EXPIRED`: Channel ID für Expired Notifications

3. **Deploy:**
   - Push den Code zu GitHub
   - Render.com wird automatisch deployen

## Commands

### `/token refresh`
Refresh alle Tokens manuell.

### `/token add <key>`
Füge einen neuen Token-Key hinzu (z.B. `user:slot`).

### `/token list`
Liste alle gespeicherten Token-Keys auf.

### `/token status`
Zeige den aktuellen Refresh-Status.

### `/accounts`
Zeige alle verlinkten Minecraft Accounts in einer einfachen Liste.

## Automatischer Refresh

Der Bot refreshed automatisch alle Tokens alle 6 Stunden nach dem Start. Tokens werden nacheinander mit 5 Minuten Abstand refreshed um Rate Limits zu vermeiden.

## Channel Notifications

- **Refresh Channel**: Zeigt Refresh-Status (erfolgreich/fehlgeschlagen)
- **Add Channel**: Zeigt wenn neuer Account hinzugefügt wurde
- **Expired Channel**: Zeigt wenn Tokens abgelaufen sind

## Wichtiger Hinweis

Dieser Bot **nur** für Token Refresh gedacht. Für die initiale Microsoft Authentifizierung musst du einen anderen Bot verwenden (z.B. Versicherungs-Meister Bot). Dieser Bot kann nur bereits authentifizierte Tokens refreshen.

## Token Import

Um Tokens von anderen Bots zu importieren:

1. **Mit MongoDB:**
   - Exportiere die Daten aus der anderen MongoDB
   - Importiere sie in deine MongoDB Atlas Database

2. **Mit JSON:**
   - Kopiere die Auth-Cache-Datei vom anderen Bot
   - Platziere sie im `data/` Ordner dieses Bots
   - Starte den Bot - er wird die Tokens automatisch erkennen

## Start

```bash
npm start
```
