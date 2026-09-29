# Cymatic Logic Lead Notifier

A deliberately small Cloudflare Worker that receives **Tally** form-submission webhooks and sends a short, high-signal notification to **Telegram**.

## Scope

This service does exactly one thing:

```
Tally submission -> Cloudflare Worker -> Telegram Bot API
```

No database, queue, dashboard, CRM, or generic notification framework.

## Required secrets

Configure these as Cloudflare Worker secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TALLY_WEBHOOK_SECRET`

Do **not** commit any of them to GitHub.

## Deploy

```bash
npm install
npx wrangler login
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TALLY_WEBHOOK_SECRET
npm run deploy
```

Wrangler will print the Worker URL, typically:

```
https://cymaticlogic-lead-notifier.<account>.workers.dev/
```

Use that URL as the Tally webhook endpoint.

## Tally setup

For **Cymatic Logic — Diagnostic Intake**:

1. Open the published form.
2. Go to Integrations -> Webhooks.
3. Add the deployed Worker URL.
4. Enable a signing secret.
5. Put the same value into the Worker secret `TALLY_WEBHOOK_SECRET`.
6. Send a test submission.

The Worker rejects unsigned or invalid requests.

## Telegram setup

Create or reuse a Telegram bot and obtain:

- Bot token -> `TELEGRAM_BOT_TOKEN`
- Target chat/user ID -> `TELEGRAM_CHAT_ID`

The bot must be able to send messages to that chat.

## Notification shape

The Telegram message intentionally stays short:

```
🚨 New Cymatic Logic Lead

Name · Company
Email
Budget: ...
Urgency: ...

Problem:
...

Stack:
...
```

The full submission remains in Tally / Discord.

## Development

```bash
npm install
npm test
npm run dev
```

Health check:

```bash
curl https://<worker-url>/
```

Expected response:

```
Cymatic Logic Lead Notifier
```
