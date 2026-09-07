#!/bin/bash
# Runs once, on first Postgres initialisation, as the superuser. Creates the
# least-privilege runtime role `app_user`. Its password comes from the
# APP_DB_PASSWORD env var (must match DATABASE_URL in .env). Avoid single quotes
# in the password. Table-level GRANTs for this role are applied by migration 0006.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
      CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD '${APP_DB_PASSWORD}';
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_DB_USER};
EOSQL

echo "app role '${APP_DB_USER}' ensured"
