# Oracle Cloud Free Tier Deployment (VEGA Jewellery Events And Exhibitions)

## Architecture and honest status
This deploys the current VEGA Next.js workspace as a Docker container on an Ubuntu VM. It uses Supabase hosted Postgres/Auth/Storage as the backend; the browser app requires the Supabase URL and anon/public key. This is a deployable frontend workspace, **not the complete production ERP**. Several screens still use sample/scaffold data. Do not store sensitive passport/visa or payment information before production-grade features, authorization/RLS, backups, and security review are implemented.

## A. Oracle VM prerequisites
Create an Ubuntu 22.04/24.04 VM in OCI Compute. A1 Flex (Arm) with modest resources is suitable for testing, subject to Always Free capacity. Assign a public IPv4. In the VCN Security List or NSG allow ingress TCP 22 from your own IP `/32`, and TCP 80 from `0.0.0.0/0`. Prefer HTTPS after testing.

## B. Install Docker on Ubuntu
SSH into the server:
```bash
ssh -i path/to/private-key ubuntu@YOUR_PUBLIC_IP
```
Install Docker Engine and Compose plugin:
```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
newgrp docker
docker --version
docker compose version
```

## C. Upload source ZIP
Upload this ZIP from Windows PowerShell (replace public IP/key paths):
```powershell
scp -i "C:\path\oracle-key.key" "VEGA_Jewellery_Events_And_Exhibitions_Oracle_Free_Tier.zip" ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/
```
On the VM:
```bash
sudo apt install -y unzip
mkdir -p ~/vega && cd ~/vega
unzip -o ~/VEGA_CRM_ERP_Oracle_Free_Tier.zip
cd vega-cloud-app
```
(If ZIP extraction creates a parent directory, `cd` into the folder containing Dockerfile and docker-compose.yml.)

## D. Configure Supabase (free dev tier can be used)
1. Create a Supabase project at https://supabase.com/.
2. In Supabase SQL Editor, execute migrations in ascending order: `supabase/migrations/0001_vega_schema.sql`, `0002_expansion_modules.sql`, `0003_advanced_business_ai_integrations.sql`.
3. In Supabase Project Settings → API, copy Project URL and publishable/anon key.
4. Create `.env` on VM:
```bash
cp .env.example .env
nano .env
```
Set:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```
Never use a service-role key in a browser-exposed variable. Review and enable correct RLS policies before any real user data.

## E. Build and run
From folder containing compose:
```bash
docker compose up -d --build
docker compose ps
docker compose logs -f vega-crm
```
Browse `http://YOUR_PUBLIC_IP`. For updates, upload revised source and run `docker compose up -d --build`.

## F. Troubleshooting
- Check container: `docker compose ps`
- Logs: `docker compose logs --tail=200 vega-crm`
- Rebuild: `docker compose build --no-cache && docker compose up -d`
- If site times out: confirm OCI ingress TCP/80 and VM Ubuntu firewall; `sudo ufw status`.
- If dashboard shows Supabase env error, verify `.env` values and rebuild (NEXT_PUBLIC values are baked into the Next.js build).
- No admin login ships in this app; configure Supabase Auth and create your account.
