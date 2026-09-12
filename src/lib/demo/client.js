// A drop-in stand-in for the Supabase browser client, backed by the in-memory
// fixtures in ./generate.js.
//
// It implements only the surface this app actually uses: the PostgREST query
// builder (select/filter/order/limit/range/single/ilike/or), the auth calls AuthContext
// depends on, and no-op realtime channels. Writes mutate the in-memory tables
// and are lost on reload — which is the point. Nothing here can reach the
// network, so demo mode cannot read or corrupt production.

import { getTables, getDemoProfile, DEMO_USER_ID } from "./generate";

const clone = (rows) => rows.map((r) => ({ ...r }));

// ------------------------------------------------------------- embedded joins

// Turns `profiles!shifts_employee_id_fkey(full_name)` into an instruction to
// attach TABLES.profiles[row.employee_id] as row.profiles, projected to
// { full_name }.
function parseEmbeds(selectStr, sourceTable) {
  const embeds = [];
  const re = /(\w+)\s*(?:!(\w+))?\s*\(([^()]*)\)/g;
  let m;
  while ((m = re.exec(selectStr))) {
    const [, relation, constraint, fieldStr] = m;
    if (!getTables()[relation]) continue;
    let fkColumn;
    if (constraint) {
      // "<source>_<column>_fkey" → "<column>"
      fkColumn = constraint
        .replace(new RegExp(`^${sourceTable}_`), "")
        .replace(/_fkey$/, "");
    } else {
      fkColumn = `${relation.replace(/s$/, "")}_id`;
    }
    embeds.push({
      relation,
      fkColumn,
      fields: fieldStr.split(",").map((f) => f.trim()).filter(Boolean),
    });
  }
  return embeds;
}

function applyEmbeds(rows, embeds) {
  if (!embeds.length) return rows;
  return rows.map((row) => {
    const out = { ...row };
    for (const { relation, fkColumn, fields } of embeds) {
      const target = (getTables()[relation] || []).find((r) => r.id === row[fkColumn]);
      out[relation] = target
        ? Object.fromEntries(fields.map((f) => [f, target[f]]))
        : null;
    }
    return out;
  });
}

// ------------------------------------------------------------- query builder

/** PostgREST's `%` wildcards, as a regex. `_` matches a single character. */
const likeRe = (pattern, flags) =>
  new RegExp(
    `^${String(pattern)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".")}$`,
    flags
  );

const OPS = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  in: (a, b) => b.includes(a),
  is: (a, b) => a === b,
  like: (a, b) => a != null && likeRe(b, "").test(String(a)),
  ilike: (a, b) => a != null && likeRe(b, "i").test(String(a)),
};

/**
 * `.or("a.ilike.%x%,b.ilike.%x%")` — one filter that passes if any of its
 * comma-separated `column.op.value` terms does. Commas inside the value (as in
 * `in.(a,b)`) are not supported; nothing in this app needs them.
 */
function parseOr(expression) {
  return String(expression)
    .split(",")
    .map((term) => {
      const [column, op, ...rest] = term.split(".");
      return { column, op, value: rest.join(".") };
    })
    .filter((t) => OPS[t.op]);
}

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orders = [];
    this.embeds = [];
    this.limitN = null;
    this.rangeVals = null;
    this.mode = "select";
    this.payload = null;
    this.returnRows = false;
    this.singleMode = null;
  }

  select(cols = "*") {
    if (this.mode === "select") {
      this.embeds = parseEmbeds(String(cols), this.table);
    } else {
      this.returnRows = true;
    }
    return this;
  }

  insert(payload) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }
  update(payload) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  upsert(payload) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  order(column, opts = {}) {
    this.orders.push({ column, ascending: opts.ascending !== false });
    return this;
  }
  limit(n) {
    this.limitN = n;
    return this;
  }
  range(from, to) {
    this.rangeVals = [from, to];
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this._run())
      .then(resolve, reject);
  }

  or(expression) {
    this.filters.push({ op: "or", terms: parseOr(expression) });
    return this;
  }

  _match(row) {
    return this.filters.every((filter) => {
      if (filter.op === "or") {
        return filter.terms.some((t) => OPS[t.op](row[t.column], t.value));
      }
      return OPS[filter.op](row[filter.column], filter.value);
    });
  }

  _run() {
    const store = getTables()[this.table];
    if (!store) {
      return { data: null, error: { message: `demo: unknown table "${this.table}"` } };
    }

    if (this.mode === "insert") {
      const added = this.payload.map((p, i) => ({
        id: p.id ?? `demo-${this.table}-new-${store.length + i + 1}`,
        ...p,
      }));
      store.push(...added);
      return { data: this.returnRows ? clone(added) : null, error: null };
    }

    if (this.mode === "update") {
      const hits = store.filter((r) => this._match(r));
      hits.forEach((r) => Object.assign(r, this.payload));
      return { data: this.returnRows ? clone(hits) : null, error: null };
    }

    if (this.mode === "delete") {
      const keep = store.filter((r) => !this._match(r));
      const removed = store.filter((r) => this._match(r));
      store.length = 0;
      store.push(...keep);
      return { data: this.returnRows ? clone(removed) : null, error: null };
    }

    let rows = store.filter((r) => this._match(r));

    for (let i = this.orders.length - 1; i >= 0; i--) {
      const { column, ascending } = this.orders[i];
      rows = [...rows].sort((a, b) => {
        const x = a[column];
        const y = b[column];
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x < y ? -1 : 1) * (ascending ? 1 : -1);
      });
    }

    if (this.rangeVals) {
      const [from, to] = this.rangeVals;
      rows = rows.slice(from, to + 1);
    } else if (this.limitN !== null) {
      rows = rows.slice(0, this.limitN);
    }

    rows = applyEmbeds(clone(rows), this.embeds);

    if (this.singleMode === "maybe") {
      return { data: rows[0] ?? null, error: null };
    }
    if (this.singleMode === "one") {
      if (!rows.length) {
        return {
          data: null,
          error: { code: "PGRST116", message: "No rows found", details: null },
        };
      }
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }
}

for (const op of Object.keys(OPS)) {
  Query.prototype[op] = function (column, value) {
    this.filters.push({ op, column, value });
    return this;
  };
}

// ------------------------------------------------------------- auth

let sessionCache = null;
const demoSession = () => {
  if (!sessionCache) {
    const profile = getDemoProfile();
    sessionCache = {
      access_token: "demo-access-token",
      refresh_token: "demo-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      user: {
        id: DEMO_USER_ID,
        email: profile.email,
        user_metadata: { full_name: profile.full_name },
      },
    };
  }
  return sessionCache;
};

const listeners = new Set();
const emit = (event) => {
  for (const cb of listeners) cb(event, demoSession());
};

const auth = {
  onAuthStateChange(callback) {
    listeners.add(callback);
    // The real client emits asynchronously; match that so AuthContext's
    // effect ordering behaves identically.
    setTimeout(() => callback("INITIAL_SESSION", demoSession()), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    };
  },
  async getSession() {
    return { data: { session: demoSession() }, error: null };
  },
  async getUser() {
    return { data: { user: demoSession().user }, error: null };
  },
  async signInWithPassword() {
    setTimeout(() => emit("SIGNED_IN"), 0);
    return {
      data: { session: demoSession(), user: demoSession().user },
      error: null,
    };
  },
  async signOut() {
    // Demo mode has no logged-out state to show. Re-emit the session so the
    // app bounces straight back into the dashboard instead of stranding a
    // screenshot on the login screen.
    setTimeout(() => emit("SIGNED_IN"), 0);
    return { error: null };
  },
  async updateUser() {
    return { data: { user: demoSession().user }, error: null };
  },
};

// ------------------------------------------------------------- realtime

const channelStub = {
  on() {
    return this;
  },
  subscribe() {
    return this;
  },
  unsubscribe() {
    return Promise.resolve("ok");
  },
};

export const demoClient = {
  isDemo: true,
  from: (table) => new Query(table),
  auth,
  channel: () => channelStub,
  removeChannel: () => Promise.resolve("ok"),
  storage: {
    from: () => ({
      getPublicUrl: (path) => ({ data: { publicUrl: path } }),
      upload: async () => ({ data: null, error: { message: "demo mode is read-only" } }),
    }),
  },
  functions: {
    invoke: async () => ({ data: null, error: { message: "demo mode is read-only" } }),
  },
};
