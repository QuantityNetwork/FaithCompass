# Superseded

The Supabase migrations and RLS tests in this directory are superseded by
[ADR 0001](../docs/adr/0001-persistence.md), which chooses Firebase (Firestore and Firebase Auth, EU region).
They are kept, not deleted, as a reference for the data model and the editorial invariants. No Supabase project was
ever connected to production. The CI `rls` job keeps running until Firestore emulator rules tests replace it.
