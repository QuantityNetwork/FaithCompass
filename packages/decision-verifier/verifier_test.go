package main

import (
	"encoding/json"
	"os"
	"testing"
)

func TestCanonicalVectors(t *testing.T) {
	var v struct {
		Vectors []struct{ Input, Canonical string }
	}
	data, err := os.ReadFile("conformance/canonical-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &v); err != nil {
		t.Fatal(err)
	}
	for _, x := range v.Vectors {
		val, err := decodeJSON([]byte(x.Input))
		if err != nil {
			t.Fatalf("%s: %v", x.Input, err)
		}
		got, err := canonical(val)
		if err != nil || got != x.Canonical {
			t.Errorf("%s: got %q, want %q (%v)", x.Input, got, x.Canonical, err)
		}
	}
	if len(v.Vectors) < 20 {
		t.Fatalf("only %d vectors", len(v.Vectors))
	}
}

func TestConformanceFixtures(t *testing.T) {
	if code := conformanceQuiet("conformance"); code != 0 {
		t.Fatalf("conformance exit %d", code)
	}
}

// conformanceQuiet runs the conformance suite with stdout discarded.
func conformanceQuiet(dir string) int {
	stdout := os.Stdout
	devnull, _ := os.Open(os.DevNull)
	os.Stdout = devnull
	defer func() { os.Stdout = stdout }()
	return conformance(dir)
}

func TestRevocationCases(t *testing.T) {
	var keys struct{ Keys []PinnedKey }
	var engines struct{ Engines []PinnedEngine }
	var rc struct {
		Cases []struct{ Fixture, List, Revocation, Result string }
	}
	for p, into := range map[string]any{"conformance/keys.json": &keys, "conformance/engines.json": &engines, "conformance/revocations.json": &rc} {
		data, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(data, into); err != nil {
			t.Fatal(err)
		}
	}
	if len(rc.Cases) < 4 {
		t.Fatalf("only %d revocation cases", len(rc.Cases))
	}
	for _, c := range rc.Cases {
		b, err := loadBundle("conformance/fixtures/" + c.Fixture + ".json")
		if err != nil {
			t.Fatal(err)
		}
		l, err := loadBundle("conformance/revocations/" + c.List + ".json")
		if err != nil {
			t.Fatal(err)
		}
		r := Verify(b, Options{Keys: keys.Keys, Engines: engines.Engines, Revocations: l, HasRevocations: true})
		got := ""
		for _, ch := range r.Checks {
			if ch.ID == "revocation" {
				got = ch.Status
			}
		}
		if got != c.Revocation || r.Result != c.Result {
			t.Errorf("%s with %s: revocation %q result %s, want %q %s", c.Fixture, c.List, got, r.Result, c.Revocation, c.Result)
		}
		without := Verify(b, Options{Keys: keys.Keys, Engines: engines.Engines})
		for _, ch := range without.Checks {
			if ch.ID == "revocation" {
				t.Errorf("revocation check present without a list")
			}
		}
	}
}
