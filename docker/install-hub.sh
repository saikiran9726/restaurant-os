#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " Restaurant OS - Local Hub Automated Installer"
echo "=========================================================="

# Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker Engine first."
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.hub"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating default environment file at ${ENV_FILE}..."
    cat <<EOF > "$ENV_FILE"
RESTAURANT_ID=018f9e1e-2895-7800-9831-294719283748
HUB_DEVICE_ID=hub-lan-primary
HUB_API_KEY=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo '')
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 24 ; echo '')
POSTGRES_DB=restaurant_hub
JWT_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 48 ; echo '')
COOKIE_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 48 ; echo '')
CLOUD_SYNC_URL=https://cloud.restaurant-os.internal
EOF
    echo "Generated new secrets in ${ENV_FILE}. Please inspect before launching."
fi

echo "Pulling containers and starting Local Hub services..."
docker compose -f "${SCRIPT_DIR}/docker-compose.hub.yml" --env-file "$ENV_FILE" up -d

echo ""
echo "Local Hub successfully launched!"
echo "Status check: curl http://localhost:3000/health"
echo "Log streams:  docker compose -f ${SCRIPT_DIR}/docker-compose.hub.yml logs -f"
echo "=========================================================="
