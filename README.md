# Hei Hei Bot (Node)

Discord bot in Node 20 using discord.js v14. It exposes two slash commands:

- `/sprint project:<name>`
- `/gap project:<name>`

Each sends a signed JSON payload to `LINDY_WEBHOOK_URL` using header `X-Signature: sha256=<hmac>` and `X-Timestamp`.

## Environment

Copy `.env.example` to `.env` and fill values:

```
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=           # optional (faster sync for one server)
LINDY_WEBHOOK_URL=
LINDY_WEBHOOK_SECRET=
```

## Local run

```
npm i
npm run start
```

Invite your bot with scopes `bot applications.commands`. If `DISCORD_GUILD_ID` is set, slash commands appear instantly in that server; otherwise global commands can take ~1 hour.

## Deploy to Fly.io

1. Create app (one-time):

```
fly launch --no-deploy
```

2. Set secrets (never commit `.env`):

```
fly secrets set   DISCORD_BOT_TOKEN="..."   DISCORD_CLIENT_ID="..."   DISCORD_GUILD_ID="..."   LINDY_WEBHOOK_URL="https://..."   LINDY_WEBHOOK_SECRET="super-long-random-string"
```

3. Deploy & view logs:

```
fly deploy
fly logs
```

## Notes

- Requires Node >= 20.
- No inbound HTTP server is required; this is a long-lived worker connecting to Discord's gateway.
