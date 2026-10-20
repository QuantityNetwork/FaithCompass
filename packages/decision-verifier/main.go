// Command decision-verifier checks an AbrahamMoses Decision Passport bundle offline and prints a JSON report.
//
//	decision-verifier --keys keys.json --engines engines.json [--expected-sha256 HEX] bundle.json
//	decision-verifier --conformance DIR      (runs DIR/fixtures against DIR/expected.json)
//
// Exit codes: 0 VALID (or all conformance fixtures as expected), 1 INVALID, 2 UNSUPPORTED, 3 usage or I/O error,
// 4 conformance mismatch.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"time"
)

func loadJSON(path string, into any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, into)
}

func loadBundle(path string) (any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return decodeJSON(data)
}

func emit(v any) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func fail(format string, a ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", a...)
	os.Exit(3)
}

type expectation struct {
	Name        string   `json:"name"`
	Result      string   `json:"result"`
	Signature   string   `json:"signature"`
	Failed      []string `json:"failed"`
	Uncheckable []string `json:"uncheckable"`
}

func conformance(dir string) int {
	var keys struct{ Keys []PinnedKey }
	var engines struct{ Engines []PinnedEngine }
	var exp struct{ Fixtures []expectation }
	for p, into := range map[string]any{"keys.json": &keys, "engines.json": &engines, "expected.json": &exp} {
		if err := loadJSON(filepath.Join(dir, p), into); err != nil {
			fail("cannot read %s: %v", p, err)
		}
	}
	type row struct {
		Name     string      `json:"name"`
		Pass     bool        `json:"pass"`
		Got      expectation `json:"got"`
		Micros   int64       `json:"micros"`
		Expected expectation `json:"expected"`
	}
	rows := []row{}
	passed := 0
	for _, e := range exp.Fixtures {
		b, err := loadBundle(filepath.Join(dir, "fixtures", e.Name+".json"))
		if err != nil {
			fail("cannot read fixture %s: %v", e.Name, err)
		}
		start := time.Now()
		r := Verify(b, Options{Keys: keys.Keys, Engines: engines.Engines})
		us := time.Since(start).Microseconds()
		got := expectation{Name: e.Name, Result: r.Result, Signature: r.Signature, Failed: r.Failed, Uncheckable: r.Uncheckable}
		ok := reflect.DeepEqual(got, e)
		if ok {
			passed++
		}
		rows = append(rows, row{e.Name, ok, got, us, e})
	}
	emit(map[string]any{"verifier": verifierName, "fixtures": len(rows), "passed": passed, "results": rows})
	if passed != len(rows) {
		return 4
	}
	return 0
}

func main() {
	keysPath := flag.String("keys", "", "pinned public keys (JSON {keys:[...]})")
	enginesPath := flag.String("engines", "", "pinned engine releases (JSON {engines:[...]})")
	expected := flag.String("expected-sha256", "", "passport hash obtained independently of the bundle")
	conf := flag.String("conformance", "", "run the conformance fixtures in this directory")
	flag.Parse()
	if *conf != "" {
		os.Exit(conformance(*conf))
	}
	if flag.NArg() != 1 || *keysPath == "" || *enginesPath == "" {
		fail("usage: decision-verifier --keys keys.json --engines engines.json [--expected-sha256 HEX] bundle.json")
	}
	var keys struct{ Keys []PinnedKey }
	var engines struct{ Engines []PinnedEngine }
	if err := loadJSON(*keysPath, &keys); err != nil {
		fail("cannot read keys: %v", err)
	}
	if err := loadJSON(*enginesPath, &engines); err != nil {
		fail("cannot read engines: %v", err)
	}
	b, err := loadBundle(flag.Arg(0))
	if err != nil {
		fail("cannot read bundle: %v", err)
	}
	r := Verify(b, Options{Keys: keys.Keys, Engines: engines.Engines, ExpectedSha256: *expected})
	emit(r)
	switch r.Result {
	case "VALID":
		os.Exit(0)
	case "INVALID":
		os.Exit(1)
	default:
		os.Exit(2)
	}
}
