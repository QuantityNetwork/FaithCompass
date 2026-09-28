"use client";

import { cn } from "@/lib/cn";

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  const?: unknown;
  description?: string;
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

type Value = unknown;
type Obj = Record<string, Value>;

const inputClass =
  "h-8 w-full rounded-md border border-line-strong bg-canvas px-2.5 text-[13px] text-fg placeholder:text-subtle focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/15";

function enumOptions(schema: JsonSchema): unknown[] | null {
  if (schema.enum) return schema.enum;
  if (schema.anyOf?.every((s) => s.const !== undefined)) return schema.anyOf.map((s) => s.const);
  return null;
}

function typeOf(schema: JsonSchema): string {
  if (Array.isArray(schema.type)) return schema.type.find((t) => t !== "null") ?? "string";
  if (schema.type) return schema.type;
  if (schema.anyOf?.[0]) return typeOf(schema.anyOf[0]);
  return "string";
}

function defaultFor(schema: JsonSchema): Value {
  if (schema.default !== undefined) return schema.default;
  const t = typeOf(schema);
  if (t === "object") return {};
  if (t === "array") return [];
  return undefined;
}

function FieldLabel({ name, schema, required }: { name: string; schema: JsonSchema; required: boolean }) {
  return (
    <div className="mb-1 flex items-baseline gap-2">
      <span className="font-mono text-[12px] font-medium text-fg">{name}</span>
      {required ? <span className="text-[11px] text-execute">required</span> : <span className="text-[11px] text-subtle">optional</span>}
      <span className="text-[11px] text-subtle">{typeOf(schema)}</span>
    </div>
  );
}

function Scalar({ schema, value, onChange, id }: { schema: JsonSchema; value: Value; onChange: (v: Value) => void; id: string }) {
  const options = enumOptions(schema);
  const t = typeOf(schema);
  if (options) {
    return (
      <select id={id} className={inputClass} value={value === undefined ? "" : JSON.stringify(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : JSON.parse(e.target.value))}>
        <option value="">{schema.default !== undefined ? `— (default ${String(schema.default)})` : "—"}</option>
        {options.map((o) => (
          <option key={String(o)} value={JSON.stringify(o)}>
            {String(o)}
          </option>
        ))}
      </select>
    );
  }
  if (t === "boolean") {
    return (
      <select id={id} className={inputClass} value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "true")}>
        <option value="">{schema.default !== undefined ? `— (default ${String(schema.default)})` : "—"}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (t === "number" || t === "integer") {
    return (
      <input
        id={id}
        type="number"
        step={t === "integer" ? 1 : "any"}
        min={schema.minimum}
        max={schema.maximum}
        className={cn(inputClass, "tnum")}
        placeholder={schema.default !== undefined ? `default ${String(schema.default)}` : undefined}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    );
  }
  return (
    <input
      id={id}
      type={schema.format === "date" ? "date" : "text"}
      className={cn(inputClass, "font-mono text-[12.5px]")}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
    />
  );
}

function ArrayField({ schema, value, onChange, path }: { schema: JsonSchema; value: Value; onChange: (v: Value) => void; path: string }) {
  const items = Array.isArray(value) ? value : [];
  const itemSchema = schema.items ?? {};
  const options = enumOptions(itemSchema);
  if (options) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = items.includes(o);
          return (
            <button
              key={String(o)}
              type="button"
              onClick={() => {
                const next = on ? items.filter((i) => i !== o) : [...items, o];
                onChange(next.length ? next : undefined);
              }}
              className={cn("rounded-md border px-2 py-1 font-mono text-[11.5px]", on ? "border-brand bg-brand text-white" : "border-line text-body hover:bg-surface-2")}
            >
              {String(o)}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-line bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11.5px] text-muted">
              [{i}]
            </span>
            <button type="button" className="text-[12px] text-muted hover:text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
          <Field schema={itemSchema} value={item} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} path={`${path}.${i}`} />
        </div>
      ))}
      {(schema.maxItems === undefined || items.length < schema.maxItems) && (
        <button type="button" className="rounded-md border border-dashed border-line-strong px-3 py-1.5 text-[12.5px] text-muted hover:text-fg" onClick={() => onChange([...items, defaultFor(itemSchema)])}>
          + Add item
        </button>
      )}
    </div>
  );
}

function ObjectFields({ schema, value, onChange, path }: { schema: JsonSchema; value: Value; onChange: (v: Value) => void; path: string }) {
  const obj = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Obj;
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  const set = (key: string, v: Value) => {
    const next = { ...obj };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className="grid gap-4">
      {props.map(([key, s]) => {
        const id = `${path}.${key}`;
        const t = typeOf(s);
        return (
          <div key={key}>
            <label htmlFor={id}>
              <FieldLabel name={key} schema={s} required={required.has(key)} />
            </label>
            {t === "object" && !enumOptions(s) ? (
              <div className="rounded-md border border-line p-3">
                <ObjectFields schema={s} value={obj[key]} onChange={(v) => set(key, v)} path={id} />
              </div>
            ) : t === "array" ? (
              <ArrayField schema={s} value={obj[key]} onChange={(v) => set(key, v)} path={id} />
            ) : (
              <Scalar schema={s} value={obj[key]} onChange={(v) => set(key, v)} id={id} />
            )}
            {s.description && <p className="mt-1 text-[11.5px] leading-snug text-muted">{s.description}</p>}
          </div>
        );
      })}
      {props.length === 0 && <p className="text-[13px] text-muted">This tool takes no arguments.</p>}
    </div>
  );
}

function Field({ schema, value, onChange, path }: { schema: JsonSchema; value: Value; onChange: (v: Value) => void; path: string }) {
  const t = typeOf(schema);
  if (t === "object") return <ObjectFields schema={schema} value={value} onChange={onChange} path={path} />;
  if (t === "array") return <ArrayField schema={schema} value={value} onChange={onChange} path={path} />;
  return <Scalar schema={schema} value={value} onChange={onChange} id={path} />;
}

export function SchemaForm({ schema, value, onChange }: { schema: JsonSchema; value: Obj; onChange: (v: Obj) => void }) {
  return <ObjectFields schema={schema} value={value} onChange={(v) => onChange(v as Obj)} path="arguments" />;
}
