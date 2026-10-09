# Local Hub Installation & Operational Runbook

Deploying Restaurant OS Local Hub on an in-restaurant mini-PC or laptop.

---

## 1. Hardware Requirements & Assumptions

- **Machine**: Intel N100 / Core i3 mini-PC, Raspberry Pi 5 (8GB), or dedicated store laptop.
- **Network**: Static local IP address on restaurant router (e.g. `192.168.1.100`).
- **OS**: Ubuntu Server 22.04 LTS / Debian 12 / Windows with WSL2 Docker.
- **Storage**: Minimum 32GB SSD storage.

---

## 2. Quickstart Installation

1. Clone or copy project files to target host:

   ```bash
   git clone <repo-url> /opt/restaurant-os-hub
   cd /opt/restaurant-os-hub/docker
   ```

2. Run the automated installer:

   ```bash
   chmod +x install-hub.sh backup.sh
   ./install-hub.sh
   ```

3. Verify service health:
   ```bash
   curl http://localhost:3000/health
   # Returns: {"status":"ok","uptime":...}
   ```

---

## 3. Database Backup & Disaster Recovery Drill

### Automated Nightly Backup

The `hub-backup` container executes `backup.sh` daily, generating timestamped dumps in `/backups`:

```bash
ls -lh /opt/restaurant-os-hub/docker/backups
# hub_backup_20261009_020000.sql.gz
```

Backups older than 14 days are rotated and purged automatically.

### Restoration Drill

To restore the Local Hub from a backup file:

```bash
# 1. Stop API container
docker compose -f docker-compose.hub.yml stop hub-api

# 2. Decompress and restore into PostgreSQL
gunzip -c /backups/hub_backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i restaurant-hub-db psql -U postgres -d restaurant_hub

# 3. Restart Hub API
docker compose -f docker-compose.hub.yml start hub-api
```
