package main

// Canonical JSON (canonical-json/1): object keys sorted by UTF-16 code units, no whitespace, strings and numbers
// serialised as ECMAScript JSON.stringify does. Equivalent to RFC 8785 (JCS) for the values a bundle contains.
// Written independently of the TypeScript implementation; the shared conformance fixtures check they agree.

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
)

// decodeJSON parses JSON keeping numbers as their literal text.
func decodeJSON(data []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	if dec.More() {
		return nil, fmt.Errorf("trailing data after JSON value")
	}
	return v, nil
}

func lessUTF16(a, b string) bool {
	ua, ub := utf16.Encode([]rune(a)), utf16.Encode([]rune(b))
	for i := 0; i < len(ua) && i < len(ub); i++ {
		if ua[i] != ub[i] {
			return ua[i] < ub[i]
		}
	}
	return len(ua) < len(ub)
}

// esNumber formats a float64 as ECMAScript Number::toString does (the form JSON.stringify emits).
func esNumber(x float64) (string, error) {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return "", fmt.Errorf("non-finite number")
	}
	if x == 0 {
		return "0", nil
	}
	sign := ""
	if x < 0 {
		sign = "-"
		x = -x
	}
	e := strconv.FormatFloat(x, 'e', -1, 64) // d.ddde±XX, shortest round-trip digits
	mant, expPart, _ := strings.Cut(e, "e")
	digits := strings.Replace(mant, ".", "", 1)
	exp, err := strconv.Atoi(expPart)
	if err != nil {
		return "", err
	}
	k, n := len(digits), exp+1
	var out string
	switch {
	case k <= n && n <= 21:
		out = digits + strings.Repeat("0", n-k)
	case 0 < n && n <= 21:
		out = digits[:n] + "." + digits[n:]
	case -6 < n && n <= 0:
		out = "0." + strings.Repeat("0", -n) + digits
	default:
		ee := n - 1
		es := "+"
		if ee < 0 {
			es = "-"
			ee = -ee
		}
		if k == 1 {
			out = digits + "e" + es + strconv.Itoa(ee)
		} else {
			out = digits[:1] + "." + digits[1:] + "e" + es + strconv.Itoa(ee)
		}
	}
	return sign + out, nil
}

func writeString(b *strings.Builder, s string) {
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
}

func writeCanonical(b *strings.Builder, v any) error {
	switch t := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		if t {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case json.Number:
		f, err := strconv.ParseFloat(string(t), 64)
		if err != nil {
			return err
		}
		s, err := esNumber(f)
		if err != nil {
			return err
		}
		b.WriteString(s)
	case float64:
		s, err := esNumber(t)
		if err != nil {
			return err
		}
		b.WriteString(s)
	case string:
		writeString(b, t)
	case []any:
		b.WriteByte('[')
		for i, x := range t {
			if i > 0 {
				b.WriteByte(',')
			}
			if err := writeCanonical(b, x); err != nil {
				return err
			}
		}
		b.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(t))
		for k := range t {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool { return lessUTF16(keys[i], keys[j]) })
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteByte(',')
			}
			writeString(b, k)
			b.WriteByte(':')
			if err := writeCanonical(b, t[k]); err != nil {
				return err
			}
		}
		b.WriteByte('}')
	default:
		return fmt.Errorf("unsupported JSON value %T", v)
	}
	return nil
}

func canonical(v any) (string, error) {
	var b strings.Builder
	err := writeCanonical(&b, v)
	return b.String(), err
}

func digest(v any) string {
	s, err := canonical(v)
	if err != nil {
		return "invalid:" + err.Error()
	}
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func same(a, b any) bool {
	x, err1 := canonical(a)
	y, err2 := canonical(b)
	return err1 == nil && err2 == nil && x == y
}
