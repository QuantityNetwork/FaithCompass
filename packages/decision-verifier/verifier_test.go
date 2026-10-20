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
