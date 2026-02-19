#!/usr/bin/env bash
# harden-vm.sh — OpenClaw VM security hardening script
# Run as: sudo bash harden-vm.sh
set -euo pipefail

echo "=== OpenClaw VM Hardening ==="

# 1. UFW Firewall
echo "[1/5] Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw --force enable
echo "  ✓ UFW enabled (SSH only)"

# 2. Disable CUPS
echo "[2/5] Disabling CUPS printing service..."
systemctl stop cups.socket cups.path cups cups-browsed 2>/dev/null || true
systemctl disable cups.socket cups.path cups cups-browsed 2>/dev/null || true
systemctl mask cups.socket cups.path cups cups-browsed 2>/dev/null || true
echo "  ✓ CUPS masked"

# 3. Harden SSH
echo "[3/5] Hardening SSH..."
SSHD_CFG="/etc/ssh/sshd_config"
sed -i 's/^X11Forwarding yes/X11Forwarding no/' "$SSHD_CFG"
grep -q '^MaxAuthTries' "$SSHD_CFG" \
  && sed -i 's/^MaxAuthTries.*/MaxAuthTries 3/' "$SSHD_CFG" \
  || echo 'MaxAuthTries 3' >> "$SSHD_CFG"
grep -q '^LoginGraceTime' "$SSHD_CFG" \
  && sed -i 's/^LoginGraceTime.*/LoginGraceTime 30/' "$SSHD_CFG" \
  || echo 'LoginGraceTime 30' >> "$SSHD_CFG"
sshd -t && systemctl reload sshd
echo "  ✓ SSH hardened (MaxAuthTries=3, X11=off, LoginGrace=30s)"

# 4. Install & configure fail2ban
echo "[4/5] Setting up fail2ban..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
banaction = ufw

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600

[recidive]
enabled = true
filter = recidive
logpath = /var/log/fail2ban.log
bantime = 86400
findtime = 86400
maxretry = 3
EOF
systemctl enable fail2ban
systemctl restart fail2ban
echo "  ✓ fail2ban active (sshd + recidive jails)"

# 5. Security updates
echo "[5/5] Installing security updates..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
echo "  ✓ System updated"

echo ""
echo "=== Hardening complete ==="
echo "Summary:"
ufw status numbered
fail2ban-client status
grep -E 'MaxAuthTries|X11Forwarding|LoginGraceTime' /etc/ssh/sshd_config | grep -v '^#'
