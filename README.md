# TempMailTelegramBot

TempMail + Telegram Bot hosted on Cloudflare Workers

## Features
- Create temporary email via `/new`
- Check inbox via `/inbox`
- Read email via inline buttons
- Single email per Telegram user
- Stores history in Workers KV

## Setup on Cloudflare
1. Create a new Worker
2. Paste `index.js` code
3. Create KV namespace: `USER_KV`
4. Add Secrets:
   - `TELEGRAM_TOKEN` → Your Bot Token
   - `TELEGRAM_SECRET_PATH` → Random secret path
5. Save & Deploy
6. Register webhook: `https://<your-worker>.workers.dev/registerWebhook`
7. Test Telegram bot commands:
   - `/start`, `/new`, `/inbox`
