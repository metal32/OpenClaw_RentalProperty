# OpenClaw Rental Property Agent

An OpenClaw AI agent that monitors Facebook rental groups for rooms near Microsoft Prestige Fern Galaxy, Bellandur, Bangalore and sends relevant listings via Telegram.

## Structure

```
├── config/
│   └── openclaw.json.template   # Config template (fill in your tokens)
├── workspace/
│   ├── AGENTS.md                # Agent behavior & workspace rules
│   ├── BOOTSTRAP.md             # First-run onboarding flow
│   ├── HEARTBEAT.md             # Periodic check configuration
│   ├── IDENTITY.md              # Agent identity
│   ├── SOUL.md                  # Agent personality & values
│   ├── TOOLS.md                 # Environment-specific tool notes
│   ├── USER.md                  # Info about the human user
│   └── skills/
│       └── facebook-groups/
│           ├── SKILL.md         # Facebook rental scraping skill
│           └── sent_posts.json  # Dedup tracker for sent notifications
├── skills/
│   └── facebook-groups/
│       └── SKILL.md             # Skill definition
├── cron/
│   └── jobs.json                # Scheduled jobs
├── canvas/
│   └── index.html               # OpenClaw Canvas test page
└── scripts/                     # Setup/utility scripts
```

## Setup on a New VM

1. Install OpenClaw on the VM
2. Copy `config/openclaw.json.template` to `~/.openclaw/openclaw.json`
3. Fill in your secrets (`botToken`, gateway `token`)
4. Copy `workspace/` contents to `~/.openclaw/workspace/`
5. Copy `skills/` to `~/.openclaw/workspace/skills/`
6. Run `openclaw onboard` to complete setup

## Secrets (DO NOT COMMIT)

The following must be set in your `openclaw.json` (not tracked in git):
- `channels.telegram.botToken` — Telegram bot token from BotFather
- `gateway.auth.token` — Gateway authentication token
