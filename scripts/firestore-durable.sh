#!/usr/bin/env bash
# ADR 0001 step 8: the workflow's record survives a full restart of the database process.
# Phase 1 writes in one emulator process and exports its data on exit; phase 2 starts a new emulator process from
# that export and must read the same record back (same canonical hash). Uses the emulator only, never the live project.
set -euo pipefail
DIR="$(mktemp -d)"
export DURABLE_MANIFEST="$DIR/manifest.json"
DURABLE_PHASE=write "${FIREBASE_BIN:-firebase}" emulators:exec --only firestore --project abrahammoses-a0a26 --export-on-exit "$DIR/export" \
  "npx vitest run tests/firestore/durable.test.ts"
DURABLE_PHASE=read "${FIREBASE_BIN:-firebase}" emulators:exec --only firestore --project abrahammoses-a0a26 --import "$DIR/export" \
  "npx vitest run tests/firestore/durable.test.ts"
echo "Durable across restart: OK"
