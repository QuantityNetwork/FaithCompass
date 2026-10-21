package main

// Revocation lists (GET /api/passport/revocations): checked with the pinned keys, never fetched by this program.
// A passport listed in the list fails the "revocation" check; one not listed passes only if the list is validly
// signed; otherwise revocation status is uncheckable. Mirrors verifyRevocationList in the TypeScript verifier.

import (
	"encoding/json"
	"fmt"
	"strings"
)

const revocationListKind = "abrahammoses-passport-revocations"

var revocationReasons = map[string]bool{"superseded": true, "withdrawn": true, "error": true, "key-compromise": true}

func revocationListMessage(listSha, kid, issuedAt string) string {
	return "AbrahamMoses revocation list v1\n" + strings.ToLower(listSha) + "\n" + kid + "\n" + issuedAt
}

type RevocationEntry struct {
	Sha, RevokedAt, Reason, SupersededBy string
}

// VerifyRevocationList returns "valid", "unsigned" or "invalid", a detail and the entries.
func VerifyRevocationList(listv any, keys []PinnedKey) (string, string, []RevocationEntry) {
	l, ok := obj(listv)
	if !ok {
		return "invalid", "not a revocation list (version 1)", nil
	}
	kind, _ := str(l["object"])
	ver, okV := l["version"].(json.Number)
	gen, okG := str(l["generated_at"])
	raw, okE := arr(l["entries"])
	if kind != revocationListKind || !okV || ver.String() != "1" || !okG || !okE {
		return "invalid", "not a revocation list (version 1)", nil
	}
	entries := []RevocationEntry{}
	for _, ev := range raw {
		e, ok := obj(ev)
		if !ok {
			return "invalid", "not a revocation list (version 1)", nil
		}
		sha, ok1 := str(e["passport_sha256"])
		at, ok2 := str(e["revoked_at"])
		reason, _ := str(e["reason"])
		sup := ""
		okS := e["superseded_by"] == nil
		if s, isStr := str(e["superseded_by"]); isStr && hex64.MatchString(s) {
			sup, okS = s, true
		}
		if !ok1 || !hex64.MatchString(sha) || !ok2 || !revocationReasons[reason] || !okS {
			return "invalid", "not a revocation list (version 1)", nil
		}
		entries = append(entries, RevocationEntry{sha, at, reason, sup})
	}
	d := digest(map[string]any{"object": l["object"], "version": l["version"], "generated_at": l["generated_at"], "entries": l["entries"]})
	if got, _ := str(l["list_sha256"]); got != d {
		return "invalid", "list digest does not match its entries", entries
	}
	if l["signature"] == nil {
		return "unsigned", fmt.Sprintf("unsigned list (%d entries): authenticity not checked", len(entries)), entries
	}
	sg, ok := obj(l["signature"])
	if !ok {
		return "invalid", "malformed list signature", entries
	}
	if ia, _ := str(sg["issued_at"]); ia != gen {
		return "invalid", "list signature time differs from generated_at", entries
	}
	kid, _ := str(sg["kid"])
	good, detail := checkSig(revocationListMessage(d, kid, gen), sg, keys)
	if !good {
		return "invalid", "list signature: " + detail, entries
	}
	return "valid", fmt.Sprintf("signed list of %d entries, %s", len(entries), detail), entries
}

// revocationCheck is the "revocation" check for a passport hash.
func revocationCheck(sha string, list any, keys []PinnedKey) (string, string) {
	status, detail, entries := VerifyRevocationList(list, keys)
	for _, e := range entries {
		if e.Sha == sha {
			sup := ""
			if e.SupersededBy != "" {
				sup = ", superseded by " + short(e.SupersededBy)
			}
			return "fail", fmt.Sprintf("revoked %s (%s%s); list %s", e.RevokedAt, e.Reason, sup, status)
		}
	}
	if status == "valid" {
		return "pass", "not revoked: " + detail
	}
	return "uncheckable", "revocation status not established: " + detail
}
