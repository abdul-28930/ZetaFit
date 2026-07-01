# Daily DB backup setup -- Oracle VM

## 1. Install pg_dump / pg_restore (Postgres client tools)

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client
pg_dump --version
```

## 2. Install rclone

```bash
curl https://rclone.org/install.sh | sudo bash
rclone version
```

## 3. Configure rclone for Backblaze B2

```bash
rclone config
```

Follow the prompts:
- `n` for new remote
- name: `b2backup`
- storage type: search/enter `b2` (Backblaze B2)
- account (keyID): `00580d55c64f0dc0000000001`
- key (applicationKey): `K005Dg2an5Ca6zptoM6yo++NGHs5CcA`
- hard_delete: `true` (actually deletes files instead of hiding them -- keeps storage costs at zero for pruned backups)
- Leave remaining options as defaults
- `y` to confirm, `q` to quit config

Test it connects:
```bash
rclone lsd b2backup:zetafit
```
Should return an empty list (no error) since the bucket is empty so far.

## 4. Add DB connection string to backend/.env

```bash
nano ~/ZetaFit/backend/.env
```

Add this line (replace [YOUR-PASSWORD] with your real Supabase DB password,
found in the same Connection String page where you copied the URI):

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.yjsrqprlfeclowntmrvu.supabase.co:5432/postgres
```

## 5. Make scripts executable

```bash
chmod +x ~/ZetaFit/backend/scripts/backup_db.sh
chmod +x ~/ZetaFit/backend/scripts/restore_db.sh
```

## 6. Test the backup manually first

```bash
~/ZetaFit/backend/scripts/backup_db.sh
```

Watch the output -- should show pg_dump running, compression, upload to B2,
and a success message. Then verify it landed in B2:

```bash
rclone lsf b2backup:zetafit/db-backups/
```

You should see something like `zetafit_2026-06-30_16-45-00.dump.gz`.

## 7. Set up the daily cron job (3 AM IST)

```bash
crontab -e
```

Add this line (3:00 AM IST = 21:30 UTC the previous day -- VM is on UTC):

```
30 21 * * * /home/ubuntu/ZetaFit/backend/scripts/backup_db.sh >> /home/ubuntu/backups/cron.log 2>&1
```

Save and exit. Confirm it's registered:
```bash
crontab -l
```

## 8. CRITICAL: Test a restore at least once

A backup you've never restored from is not a backup, it's a hope.

Spin up a free throwaway Postgres for testing -- easiest options:
- A second free Supabase project (free tier, just for this test)
- Or a local Postgres via Docker: `docker run -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15`

Add to `backend/.env`:
```
RESTORE_TARGET_URL=postgresql://postgres:test@localhost:5433/postgres
```

Then:
```bash
~/ZetaFit/backend/scripts/restore_db.sh
```

Confirm with `yes` when prompted, let it run, then connect to that target
DB and spot-check a few tables (`SELECT count(*) FROM members;` etc.) to
confirm the restore actually worked.

## Monitoring

Check recent backup logs anytime:
```bash
tail -n 50 ~/backups/backup.log
```

Check cron actually fired (look for entries around 21:30 UTC daily):
```bash
tail -n 50 ~/backups/cron.log
```

List what's currently backed up:
```bash
rclone lsf b2backup:zetafit/db-backups/ --format "tsp"
```
