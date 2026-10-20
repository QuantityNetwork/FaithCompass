package main

// Offline verifier for AbrahamMoses Decision Passport bundles (schema 1.0.0). Standard library only; no network.
// Implements docs/DECISION_PASSPORT_SPEC.md independently of the application (it never runs the passport builder).

import (
	"crypto/ed25519"
	"encoding/base64"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
)

const verifierName = "decision-verifier-go/1.0.0"

var supportedSchemas = []string{"1.0.0"}
var artifactNames = []string{"passport", "report_markdown", "state", "sources", "release", "review", "crypto"}
var hex64 = regexp.MustCompile(`^[0-9a-f]{64}$`)
var isoSecond = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`)
var b64url = regexp.MustCompile(`^[A-Za-z0-9_-]*$`)

type PinnedKey struct {
	Kid       string  `json:"kid"`
	X         string  `json:"x"`
	Status    string  `json:"status"`
	NotBefore *string `json:"not_before"`
	NotAfter  *string `json:"not_after"`
	RevokedAt *string `json:"revoked_at,omitempty"`
}

type PinnedEngine struct {
	Version string `json:"version"`
	Sha256  string `json:"sha256"`
}

type Options struct {
	Keys           []PinnedKey
	Engines        []PinnedEngine
	ExpectedSha256 string
}

type Check struct {
	ID     string `json:"id"`
	Status string `json:"status"` // pass | fail | uncheckable
	Detail string `json:"detail"`
}

type Report struct {
	Verifier       string   `json:"verifier"`
	SchemaVersion  *string  `json:"schema_version"`
	Result         string   `json:"result"`    // VALID | INVALID | UNSUPPORTED
	Signature      string   `json:"signature"` // valid | invalid | unsigned
	PassportSha256 *string  `json:"passport_sha256"`
	Checks         []Check  `json:"checks"`
	Failed         []string `json:"failed"`
	Uncheckable    []string `json:"uncheckable"`
}

func obj(v any) (map[string]any, bool) { m, ok := v.(map[string]any); return m, ok }
func arr(v any) ([]any, bool)          { a, ok := v.([]any); return a, ok }
func str(v any) (string, bool)         { s, ok := v.(string); return s, ok }

func short(s string) string {
	if len(s) > 12 {
		return s[:12] + "…"
	}
	return s
}

func decodeB64urlJSON(s string) (any, error) {
	if !b64url.MatchString(s) {
		return nil, fmt.Errorf("not base64url")
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(s, "="))
	if err != nil {
		return nil, err
	}
	return decodeJSON(raw)
}

func parseTime(s string) (time.Time, bool) {
	t, err := time.Parse(time.RFC3339Nano, s)
	return t, err == nil
}

func issuanceMessage(sha, kid, issuedAt string) string {
	return "AbrahamMoses Decision Passport issuance v2\n" + strings.ToLower(sha) + "\n" + kid + "\n" + issuedAt
}

// checkSig verifies an Ed25519 signature object against the pinned keys (kid, validity window, revocation).
func checkSig(message string, sigv any, keys []PinnedKey) (bool, string) {
	sig, ok := obj(sigv)
	if !ok {
		return false, "malformed signature"
	}
	alg, _ := str(sig["alg"])
	kid, ok1 := str(sig["kid"])
	value, ok2 := str(sig["value"])
	issuedAt, ok3 := str(sig["issued_at"])
	if alg != "Ed25519" || !ok1 || !ok2 || !ok3 {
		return false, "malformed signature"
	}
	var key *PinnedKey
	for i := range keys {
		if keys[i].Kid == kid {
			key = &keys[i]
			break
		}
	}
	if key == nil {
		return false, "unknown key " + kid + " (not pinned)"
	}
	if key.Status == "revoked" {
		at := ""
		if key.RevokedAt != nil {
			at = " (" + *key.RevokedAt + ")"
		}
		return false, "key " + kid + " is revoked" + at
	}
	t, okT := parseTime(issuedAt)
	if !isoSecond.MatchString(issuedAt) || !okT {
		return false, "invalid issued_at"
	}
	if key.NotBefore != nil {
		if nb, ok := parseTime(*key.NotBefore); ok && t.Before(nb) {
			return false, "issued before key " + kid + " was valid"
		}
	}
	if key.NotAfter != nil {
		if na, ok := parseTime(*key.NotAfter); ok && t.After(na) {
			return false, "issued after key " + kid + " was retired"
		}
	}
	pub, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(key.X, "="))
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return false, "pinned key " + kid + " is malformed"
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(value, "="))
	if err != nil || len(sigBytes) != ed25519.SignatureSize {
		return false, "Ed25519 signature does not match"
	}
	if !ed25519.Verify(ed25519.PublicKey(pub), []byte(message), sigBytes) {
		return false, "Ed25519 signature does not match"
	}
	return true, fmt.Sprintf("Ed25519 valid, key %s (%s), issued %s", kid, key.Status, issuedAt)
}

func Verify(bundle any, opts Options) Report {
	r := Report{Verifier: verifierName, Signature: "unsigned", Checks: []Check{}}
	unsupported := false
	add := func(id, status, detail string) { r.Checks = append(r.Checks, Check{id, status, detail}) }
	pass := func(ok bool) string {
		if ok {
			return "pass"
		}
		return "fail"
	}
	finish := func() Report {
		r.Failed, r.Uncheckable = []string{}, []string{}
		for _, c := range r.Checks {
			if c.Status == "fail" {
				r.Failed = append(r.Failed, c.ID)
			} else if c.Status == "uncheckable" {
				r.Uncheckable = append(r.Uncheckable, c.ID)
			}
		}
		sort.Strings(r.Failed)
		sort.Strings(r.Uncheckable)
		switch {
		case unsupported:
			r.Result = "UNSUPPORTED"
		case len(r.Failed) > 0:
			r.Result = "INVALID"
		default:
			r.Result = "VALID"
		}
		return r
	}

	// 1. Schema
	b, ok := obj(bundle)
	if kind, _ := str(b["bundle"]); !ok || kind != "abrahammoses-decision-passport-bundle" {
		add("schema", "fail", "not a decision passport bundle")
		unsupported = true
		return finish()
	}
	schema, ok := str(b["schema_version"])
	supported := false
	for _, s := range supportedSchemas {
		supported = supported || s == schema
	}
	if ok {
		r.SchemaVersion = &schema
	}
	if !supported {
		add("schema", "fail", fmt.Sprintf("unsupported schema_version %v (supported: %s)", b["schema_version"], strings.Join(supportedSchemas, ", ")))
		unsupported = true
		return finish()
	}
	a, okA := obj(b["artifacts"])
	integ, okI := obj(b["integrity"])
	passportID, okP := str(b["passport_id"])
	_, okR := b["redacted"].(bool)
	shape := okA && okI && okP && okR
	var manifest map[string]any
	var declared string
	var passport, state, sources, release, review, cryptoA map[string]any
	var inventory, attestations []any
	if shape {
		alg, _ := str(integ["algorithm"])
		declared, _ = str(integ["passport_sha256"])
		manifest, ok = obj(integ["artifacts"])
		shape = alg == "SHA-256" && hex64.MatchString(declared) && ok && len(manifest) == len(artifactNames)
		for _, n := range artifactNames {
			_, has := a[n]
			_, isStr := str(manifest[n])
			shape = shape && has && isStr
		}
		_, mdOK := str(a["report_markdown"])
		var o1, o2, o3, o4, o5, o6, a1, a2 bool
		passport, o1 = obj(a["passport"])
		state, o2 = obj(a["state"])
		sources, o3 = obj(a["sources"])
		release, o4 = obj(a["release"])
		review, o5 = obj(a["review"])
		cryptoA, o6 = obj(a["crypto"])
		if o3 {
			inventory, a1 = arr(sources["inventory"])
			_, docsArr := arr(sources["documents"])
			a1 = a1 && (sources["documents"] == nil || docsArr)
		}
		if o5 {
			attestations, a2 = arr(review["attestations"])
		}
		shape = shape && mdOK && o1 && o2 && o3 && o4 && o5 && o6 && a1 && a2
	}
	if !shape {
		add("schema", "fail", "required fields missing or of the wrong type")
		return finish()
	}
	add("schema", "pass", "schema "+schema)

	// 2. Hashes
	sha := digest(passport)
	r.PassportSha256 = &sha
	if sha == declared {
		add("passport_hash", "pass", sha)
	} else {
		add("passport_hash", "fail", fmt.Sprintf("recomputed %s, manifest says %s", short(sha), short(declared)))
	}
	if opts.ExpectedSha256 != "" {
		add("expected_hash", pass(sha == strings.ToLower(opts.ExpectedSha256)), fmt.Sprintf("expected %s, recomputed %s", short(opts.ExpectedSha256), short(sha)))
	}
	for _, n := range artifactNames {
		d := digest(a[n])
		m, _ := str(manifest[n])
		if d == m {
			add("artifact_hash:"+n, "pass", d)
		} else {
			add("artifact_hash:"+n, "fail", fmt.Sprintf("recomputed %s, manifest says %s", short(d), short(m)))
		}
	}

	// 3. References between artifacts
	base, sigPart, signedID := strings.Cut(passportID, ".S-")
	var idState any
	if strings.HasPrefix(base, "DP1-") {
		if v, err := decodeB64urlJSON(base[4:]); err == nil {
			idState = v
		}
	}
	switch {
	case idState == nil:
		add("ref:id_state", "fail", "passport_id does not decode")
	case same(idState, state):
		add("ref:id_state", "pass", "passport_id encodes the state")
	default:
		add("ref:id_state", "fail", "passport_id and state differ")
	}
	pid, _ := str(passport["id"])
	add("ref:passport_id", pass(pid == base), "passport.id compared with the ID")
	assumed := map[string]any{}
	if m, ok := obj(passport["assumptions"]); ok {
		for k, v := range m {
			if k != "defaults" {
				assumed[k] = v
			}
		}
	}
	gen, _ := str(passport["generated_at"])
	t, _ := str(state["t"])
	add("ref:state_assumptions", pass(same(assumed, state["a"]) && gen == t && gen != ""), "passport assumptions and time compared with the state")
	add("ref:sources", pass(same(passport["sources"], inventory)), fmt.Sprintf("%d sources compared", len(inventory)))
	if sources["documents"] == nil {
		add("source_documents", "uncheckable", "redacted export: source documents not included, their hashes cannot be recomputed")
	} else {
		docs, _ := arr(sources["documents"])
		var bad []string
		for _, sv := range inventory {
			s, _ := obj(sv)
			id, _ := str(s["id"])
			want, _ := str(s["sha256"])
			found := false
			for _, dv := range docs {
				if d, ok := obj(dv); ok {
					if did, _ := str(d["id"]); did == id {
						found = digest(d) == want
						break
					}
				}
			}
			if !found {
				bad = append(bad, id)
			}
		}
		if len(bad) > 0 {
			add("source_documents", "fail", "hash mismatch or missing: "+strings.Join(bad, ", "))
		} else {
			add("source_documents", "pass", fmt.Sprintf("%d documents recomputed", len(inventory)))
		}
	}
	var problems []string
	versions, _ := obj(passport["versions"])
	caseObj, _ := obj(passport["case"])
	if !same(versions["ruleset"], release["ruleset"]) {
		problems = append(problems, "ruleset")
	}
	if !same(caseObj["version"], release["case_version"]) || !same(caseObj["id"], release["case_id"]) {
		problems = append(problems, "case version")
	}
	if cs, has := caseObj["content_sha256"]; has && !same(cs, release["case_archive_sha256"]) {
		problems = append(problems, "case archive hash")
	}
	if e, has := passport["engine"]; has && !same(e, release["engine"]) {
		problems = append(problems, "engine")
	}
	if len(problems) > 0 {
		add("ref:release", "fail", "passport and release manifest differ: "+strings.Join(problems, ", "))
	} else {
		add("ref:release", "pass", "ruleset, case and engine match")
	}
	eng, okE := obj(release["engine"])
	if !okE || eng["sha256"] == nil {
		add("engine_known", "uncheckable", "passport predates engine versioning (no engine digest)")
	} else {
		ev, _ := str(eng["version"])
		es, _ := str(eng["sha256"])
		known := false
		for _, p := range opts.Engines {
			known = known || (p.Version == ev && p.Sha256 == es)
		}
		if !known {
			unsupported = true
			add("engine_known", "fail", fmt.Sprintf("%s %s is not a pinned release", ev, short(es)))
		} else {
			add("engine_known", "pass", ev+" matches a pinned release")
		}
	}
	add("ref:review", pass(same(review["status"], passport["status"]) && same(review["reviewer"], passport["reviewer"])), fmt.Sprintf("status and reviewer compared (%d attestations)", len(attestations)))
	for i, av := range attestations {
		id := fmt.Sprintf("attestation:%d", i)
		at, ok := obj(av)
		sg, okS := obj(at["signature"])
		_, okSt := obj(at["statement"])
		if !ok || !okS || !okSt {
			add(id, "fail", "attestation is not signed")
			continue
		}
		kid, _ := str(sg["kid"])
		ia, _ := str(sg["issued_at"])
		good, detail := checkSig("AbrahamMoses attestation v1\n"+digest(at["statement"])+"\n"+kid+"\n"+ia, sg, opts.Keys)
		add(id, pass(good), detail)
	}

	// 4. Issuance signature
	sig := cryptoA["signature"]
	var idSig any
	if signedID {
		if v, err := decodeB64urlJSON(sigPart); err == nil {
			idSig = v
		}
	}
	sigObj, isObj := obj(sig)
	switch {
	case sig == nil && !signedID:
		add("signature", "pass", "unsigned: integrity hash only (no issuer authentication)")
	case !isObj || !same(sig, idSig):
		r.Signature = "invalid"
		add("signature", "fail", "signature in the bundle and in the passport ID differ")
	default:
		kid, _ := str(sigObj["kid"])
		ia, _ := str(sigObj["issued_at"])
		good, detail := checkSig(issuanceMessage(sha, kid, ia), sigObj, opts.Keys)
		if good && ia != t {
			r.Signature = "invalid"
			add("signature", "fail", "issued_at differs from the passport time")
		} else {
			if good {
				r.Signature = "valid"
			} else {
				r.Signature = "invalid"
			}
			add("signature", pass(good), detail)
		}
	}
	return finish()
}
