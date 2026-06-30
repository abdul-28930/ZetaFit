# ZetaFit Backend Services

FastAPI service for server-side jobs that don't belong in Next.js -- currently:
GST invoice PDF generation via WeasyPrint.

## Local setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # fill in real Supabase values
```

WeasyPrint needs system libraries (Pango, Cairo) -- on Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y \
  libpango-1.0-0 libpangocairo-1.0-0 libcairo2 \
  libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
```

## Run locally

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Test it's alive:
```bash
curl http://localhost:8000/health
```

Generate an invoice (replace with a real payment id from Supabase):
```bash
curl -X POST http://localhost:8000/api/invoice/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FASTAPI_SECRET" \
  -d '{"payment_id": "your-payment-uuid"}'
```

## Required Supabase setup (one-time)

1. Create a Storage bucket named `invoices` (Storage -> New bucket).
   - **Public**: OFF (we use signed URLs, not public access)
2. Confirm RLS is NOT blocking the service role key -- the service role
   bypasses RLS automatically, but double check the bucket policies allow
   service-role inserts (default Supabase behaviour, usually no action needed).

## Deploy to Oracle VM with Cloudflare Quick Tunnel

```bash
# 1. Install cloudflared (one-time)
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# 2. Set up systemd service for FastAPI
sudo nano /etc/systemd/system/zetafit-backend.service
```

```ini
[Unit]
Description=ZetaFit FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/ZetaFit/backend
ExecStart=/home/ubuntu/ZetaFit/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable zetafit-backend
sudo systemctl start zetafit-backend

# 3. Set up systemd service for the Cloudflare tunnel
sudo nano /etc/systemd/system/cloudflared-tunnel.service
```

```ini
[Unit]
Description=Cloudflare Quick Tunnel
After=network.target zetafit-backend.service

[Service]
User=ubuntu
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel
sudo systemctl start cloudflared-tunnel

# 4. Grab the public URL
sudo journalctl -u cloudflared-tunnel -f
# Look for a line containing https://something.trycloudflare.com
```

Copy that URL into your Next.js `.env` / Vercel env vars as `FASTAPI_URL`.

WARNING: Quick tunnel URLs change on every restart. If the VM reboots or the
service restarts, re-check the URL and update `FASTAPI_URL` on Vercel.
For a stable URL, switch to a named Cloudflare Tunnel later.

## Pulling updates on the VM

```bash
cd ~/ZetaFit
git pull origin abdul
cd backend
source venv/bin/activate
pip install -r requirements.txt   # only if requirements changed
sudo systemctl restart zetafit-backend
```
