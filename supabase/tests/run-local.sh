#!/usr/bin/env bash
# Apply every migration (twice, to prove they are repeatable) to a throwaway
# local PostgreSQL and run the RLS tests. Touches no remote database.
set -euo pipefail
#
# In CI, RLS_DATABASE_URL points at an empty, throwaway PostgreSQL service
# container instead (never a real database).
cd "$(dirname "$0")/../.."
if [[ -n "${RLS_DATABASE_URL:-}" ]]; then
  PSQL=(psql "$RLS_DATABASE_URL" -v ON_ERROR_STOP=1 -q -t -A)
else
  PGBIN=${PGBIN:-/usr/lib/postgresql/17/bin}
  DIR=$(mktemp -d)
  PORT=${PORT:-55432}
  "$PGBIN/initdb" -D "$DIR" -U postgres -A trust >/dev/null
  "$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORT -k $DIR" -l "$DIR/log" start >/dev/null
  trap '"$PGBIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null; rm -rf "$DIR"' EXIT
  PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -t -A)
fi
"${PSQL[@]}" -f supabase/tests/00_local_supabase_stub.sql
for pass in 1 2; do
  for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
  echo "migrations applied (pass $pass)"
done
"${PSQL[@]}" -f supabase/tests/rls_test.sql 2>&1
