#!/data/data/com.termux/files/usr/bin/bash
# Watch cloudflared logs and extract tunnel URL
# Runs as a PM2 process

TUNNEL_FILE="/tmp/tunnel_url.txt"
TUNNEL_LOCK="/tmp/tunnel_url.lock"
INTERVAL=15
LAST_URL=""

while true; do
  # Get URL from cloudflared API (localhost:2000/metrics or similar)
  # For quick tunnels, we parse the log output
  URL=$(pm2 logs cloudflared --nostream --lines 50 2>/dev/null | grep -oP 'https?://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1)
  
  if [ -z "$URL" ]; then
    # Try alternative: check if we can find the URL from cloudflared process
    URL=$(pm2 show cloudflared 2>/dev/null | grep -oP 'https?://[a-zA-Z0-9.-]+\.trycloudflare\.com')
  fi
  
  if [ -z "$URL" ]; then
    # Fallback: try accessing localhost:3001 API to find what the server thinks
    URL=$(curl -s -o /dev/null -w "%{redirect_url}" http://localhost:3001/api/wa/tunnel-url 2>/dev/null || echo "")
  fi

  if [ -n "$URL" ] && [ "$URL" != "$LAST_URL" ]; then
    echo "$URL" > "$TUNNEL_FILE"
    chmod 644 "$TUNNEL_FILE"
    LAST_URL="$URL"
    echo "[Tunnel Watch] URL updated: $URL"
  fi
  
  sleep "$INTERVAL"
done
