/**
 * A minimal in-memory stand-in for the Supabase client.
 *
 * Covers only the query surface SupabaseEvidenceStore actually uses. The point
 * is to exercise the store's own logic — row shaping, re-validation on read,
 * the claim_ids lookup, error propagation — without a network or a database.
 */

export interface FakeRow {
  [key: string]: unknown;
}

interface Result<T> {
  data: T;
  error: { message: string } | null;
}

class QueryBuilder {
  private rows: FakeRow[];
  private readonly table: FakeTable;
  private limitN: number | null = null;

  constructor(table: FakeTable) {
    this.table = table;
    this.rows = [...table.rows];
  }

  select(_cols: string) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((r) => r[column] === value);
    return this;
  }

  /** Supports the `a.eq.x,b.eq.y` form the store uses for slug/resource lookup. */
  or(expr: string) {
    const clauses = expr.split(',').map((c) => {
      const [column, op, ...rest] = c.split('.');
      return { column, op, value: rest.join('.') };
    });
    this.rows = this.rows.filter((r) =>
      clauses.some((c) => c.op === 'eq' && String(r[c.column]) === c.value),
    );
    return this;
  }

  contains(column: string, values: unknown[]) {
    this.rows = this.rows.filter((r) => {
      const arr = r[column];
      return Array.isArray(arr) && values.every((v) => arr.includes(v));
    });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? -1 : 1;
    this.rows = [...this.rows].sort((a, b) =>
      String(a[column]) < String(b[column]) ? -dir : String(a[column]) > String(b[column]) ? dir : 0,
    );
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  async maybeSingle(): Promise<Result<FakeRow | null>> {
    if (this.table.failWith) return { data: null, error: { message: this.table.failWith } };
    const rows = this.limitN === null ? this.rows : this.rows.slice(0, this.limitN);
    return { data: rows[0] ?? null, error: null };
  }

  // Awaiting the builder directly resolves the list form.
  then<TResult1 = Result<FakeRow[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<FakeRow[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result: Result<FakeRow[]> = this.table.failWith
      ? { data: [], error: { message: this.table.failWith } }
      : { data: this.limitN === null ? this.rows : this.rows.slice(0, this.limitN), error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

class FakeTable {
  rows: FakeRow[] = [];
  failWith: string | null = null;

  select(_cols: string) {
    return new QueryBuilder(this).select(_cols);
  }

  async upsert(row: FakeRow, opts?: { onConflict?: string }) {
    if (this.failWith) return { data: null, error: { message: this.failWith } };
    const key = opts?.onConflict ?? 'id';
    const existing = this.rows.findIndex((r) => r[key] === row[key]);
    if (existing === -1) this.rows.push(row);
    else this.rows[existing] = row;
    return { data: null, error: null };
  }

  async insert(row: FakeRow) {
    if (this.failWith) return { data: null, error: { message: this.failWith } };
    if (this.rows.some((r) => r.id === row.id)) {
      return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
    }
    this.rows.push(row);
    return { data: null, error: null };
  }
}

export class FakeSupabaseClient {
  readonly tables = new Map<string, FakeTable>();

  from(name: string): FakeTable {
    let t = this.tables.get(name);
    if (!t) {
      t = new FakeTable();
      this.tables.set(name, t);
    }
    return t;
  }

  /** Force the next operations on a table to return a database error. */
  breakTable(name: string, message: string) {
    this.from(name).failWith = message;
  }

  rowsIn(name: string): FakeRow[] {
    return this.from(name).rows;
  }
}
