#!/bin/bash
#
# Deploy OurHome to a fresh Hostinger VPS running Ubuntu 24.04.
# Run this on the VPS as a user with sudo privileges.
#
# Before running:
#   1. Provision the VPS from Hostinger.
#   2. Point your domain's A record at the VPS IP and wait for propagation.
#   3. Copy this file to the VPS: scp deploy-to-hostinger.sh user@your-vps-ip:/tmp/
#   4. SSH in and run: bash /tmp/deploy-to-hostinger.sh
#

set -euo pipefail

DOMAIN="ourhome.bio"          # change if needed
APP_DIR="/opt/ourhome-bio"
SERVICE_USER="ourhome"
REPO_URL="https://github.com/ClayTech-Industries/ourhome-bio.git"

echo "=== OurHome Hostinger VPS deploy ==="

# Update and install dependencies
echo "[1/9] Updating packages and installing Node.js + git..."
sudo apt-get update -y
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create service user
echo "[2/9] Creating service user..."
sudo useradd -r -m -s /bin/false "$SERVICE_USER" 2> /dev/null || true

# Ensure home directory exists with correct ownership (some VPS images don't create it)
sudo mkdir -p "/home/$SERVICE_USER"
sudo chown "$SERVICE_USER:$SERVICE_USER" "/home/$SERVICE_USER"

# Prepare app directory
echo "[3/9] Preparing app directory..."
sudo mkdir -p "$APP_DIR"
sudo chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

# Clone or pull repo on the correct branch
echo "[4/9] Cloning OurHome repo (branch: sprint1-core-build)..."
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$SERVICE_USER" bash -c "cd '$APP_DIR' && git fetch origin && git checkout sprint1-core-build && git reset --hard origin/sprint1-core-build"
else
  sudo -u "$SERVICE_USER" git clone -b sprint1-core-build "$REPO_URL" "$APP_DIR"
fi

# Install dependencies (legacy-peer-deps avoids zod peer conflict) and build
echo "[5/9] Installing dependencies and building..."
sudo -u "$SERVICE_USER" bash -c "cd '$APP_DIR' && npm install --no-audit --no-fund --legacy-peer-deps && npm run build"

# Create .env.production placeholder if it doesn't exist
echo "[6/9] Checking environment variables..."
if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "⚠️  Please create $APP_DIR/.env.production with your production secrets."
  echo "   You can copy from .env.example and fill in the keys."
fi

# Install PM2 to keep the app running
echo "[7/9] Installing PM2..."
sudo npm install -g pm2

# PM2 ecosystem
echo "[8/9] Configuring PM2..."
sudo -u "$SERVICE_USER" tee "$APP_DIR/ecosystem.config.js" > /dev/null <<'EOF'
module.exports = {
  apps: [{
    name: 'ourhome-bio',
    script: 'npm',
    args: 'run start:prod',
    cwd: '/opt/ourhome-bio',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
    env_file: '/opt/ourhome-bio/.env.production',
    error_file: '/opt/ourhome-bio/logs/err.log',
    out_file: '/opt/ourhome-bio/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
  }],
};
EOF

sudo -u "$SERVICE_USER" mkdir -p "$APP_DIR/logs"

# Nginx reverse proxy
echo "[9/9] Configuring Nginx..."
sudo tee "/etc/nginx/sites-available/$DOMAIN" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Increase limits for file uploads / AI messages
        client_max_body_size 50M;
        proxy_read_timeout 120s;
    }
}
EOF

sudo ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
sudo nginx -t && sudo systemctl restart nginx

# SSL
echo "=== Requesting SSL certificate ==="
sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || true

# Save PM2 startup and start the app
echo "[PM2] Starting OurHome..."
sudo mkdir -p /home/$SERVICE_USER/.pm2
sudo chown -R $SERVICE_USER:$SERVICE_USER /home/$SERVICE_USER/.pm2
sudo chmod 755 /usr/bin/node
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo -u "$SERVICE_USER" pm2 delete ourhome-bio 2>/dev/null || true
sudo -u "$SERVICE_USER" pm2 start "$APP_DIR/ecosystem.config.js"
sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u "$SERVICE_USER" --hp "/home/$SERVICE_USER"
sudo -u "$SERVICE_USER" pm2 save

echo ""
echo "=== Done ==="
echo "OurHome should be live at https://$DOMAIN"
echo "Check status: sudo -u $SERVICE_USER pm2 status"
echo "View logs:    sudo -u $SERVICE_USER pm2 logs ourhome-bio"
