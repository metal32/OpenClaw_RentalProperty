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

## SSH Quick Reference

### Connect to VM

```bash
# Using SSH alias (requires ~/.ssh/config setup)
ssh openclaw-vm

# Or using full command
ssh -o StrictHostKeyChecking=no azureuser@4.155.35.255
```

### SSH Config Setup (one-time, on your local machine)

Add this to `~/.ssh/config`:

```
Host openclaw-vm
    HostName 4.155.35.255
    User azureuser
    StrictHostKeyChecking no
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

### OpenClaw Commands (run on VM)

```bash
# Start OpenClaw gateway + browser
openclaw config set browser.headless false
Xvfb :99 -screen 0 1280x1024x24 &>/dev/null &
export DISPLAY=:99
systemctl --user restart openclaw-gateway
sleep 8
DISPLAY=:99 openclaw browser --browser-profile openclaw start

# Check gateway status
ps aux | grep openclaw-gateway

# View config
cat ~/.openclaw/openclaw.json
```

### Cron Job Management (run on VM)

```bash
# List all cron jobs
openclaw cron list

# Check scheduler status
openclaw cron status

# Manually trigger a job (use job ID from 'cron list')
openclaw cron run <job-id>

# Add a new job
openclaw cron add --name 'job-name' --every 6h --message '/skill-name' \
  --session isolated --timeout-seconds 300 \
  --announce --channel telegram --to <chat-id>

# Disable / enable / remove a job
openclaw cron disable <job-id>
openclaw cron enable <job-id>
openclaw cron rm <job-id>
```

### VM Security Commands (run on VM)

```bash
# Firewall status
sudo ufw status

# Check banned IPs
sudo fail2ban-client status sshd

# View recent SSH attacks
sudo grep 'Invalid user' /var/log/auth.log | tail -10

# Manually ban/unban an IP
sudo fail2ban-client set sshd banip <ip>
sudo fail2ban-client set sshd unbanip <ip>

# Apply security updates
sudo apt update && sudo apt upgrade -y

# Run full hardening script (first time on new VM)
sudo bash scripts/harden-vm.sh
```

### File Transfer (from local machine)

```bash
# Copy a file to VM
scp local-file.txt openclaw-vm:~/destination/

# Copy a file from VM
scp openclaw-vm:~/.openclaw/some-file.json ./

# Copy entire directory to VM
scp -r ./workspace/ openclaw-vm:~/.openclaw/workspace/
```

### Cookie Update (Facebook Session)

When the Facebook session expires (cron job stops finding posts), update cookies:

1. Open Facebook in Chrome on your local machine
2. Click the **EditThisCookie** extension → Export (copies JSON to clipboard)
3. Paste into a file, e.g. `cookies.json`
4. Run:

```powershell
.\scripts\update-fb-cookies.ps1 -CookieFile cookies.json
```

The script will upload cookies to the VM, write them to Chrome's database, restart the browser, and verify login — all in one command.

> ⚠️ **Never commit `cookies.json`** — it contains session tokens.

## Secrets (DO NOT COMMIT)

The following must be set in your `openclaw.json` (not tracked in git):
- `channels.telegram.botToken` — Telegram bot token from BotFather
- `gateway.auth.token` — Gateway authentication token
