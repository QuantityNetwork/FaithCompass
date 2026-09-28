#!/usr/bin/env bash
# Download a PostgREST binary for the integration suite (npm run test:postgrest).
set -euo pipefail
VERSION="${POSTGREST_VERSION:-12.2.3}"
DEST="${1:-.cache/postgrest}"
mkdir -p "$DEST"
if [ ! -x "$DEST/postgrest" ]; then
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/v${VERSION}/postgrest-v${VERSION}-linux-static-x64.tar.xz" | tar -xJ -C "$DEST"
fi
echo "$(cd "$DEST" && pwd)/postgrest"
