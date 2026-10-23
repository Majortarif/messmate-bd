// Generates src/types/database.ts from the migrations, in the same shape as
// `supabase gen types typescript`, without Docker or a linked project:
// it applies every migration to PGlite and introspects the catalog.
//
//   npm run db:types        (from the project root)
//
// Once a real project is linked you can switch to the official generator:
//   npx supabase gen types typescript --project-id <id> --schema public > src/types/database.ts
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const supabaseDir = resolve(here, '..', '..');
const outFile = resolve(supabaseDir, '..', 'src', 'types', 'database.ts');

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(readFileSync(join(here, 'supabase-shim.sql'), 'utf8'));
await db.exec('create extension pgcrypto with schema extensions');
for (const f of readdirSync(join(supabaseDir, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  let sql = readFileSync(join(supabaseDir, 'migrations', f), 'utf8');
  if (f.includes('_cron')) sql = sql.replace(/create extension if not exists pg_cron[^;]*;/i, '');
  await db.exec(sql);
}

const q = async (sql) => (await db.query(sql)).rows;

const enums = await q(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' group by t.typname order by t.typname`);
const enumNames = new Set(enums.map((e) => e.name));

const columns = await q(`
  select c.relname as table, c.relkind as kind, a.attname as name, a.attnum as pos,
         t.typname as type, t.typcategory as category, et.typname as elem_type,
         not a.attnotnull as nullable, a.atthasdef as has_default,
         a.attidentity as identity, a.attgenerated as generated
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  join pg_type t on t.oid = a.atttypid
  left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
  where n.nspname = 'public' and c.relkind in ('r', 'v')
  order by c.relname, a.attnum`);

const fks = await q(`
  select con.conname as name, src.relname as table, dst.relname as ref_table,
         (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columns,
         (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as ref_columns,
         exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique
                   and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x)
                       = (select array_agg(x order by x) from unnest(con.conkey) x)) as one_to_one
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class dst on dst.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  join pg_namespace dn on dn.oid = dst.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and dn.nspname = 'public'
  order by src.relname, con.conname`);

const functions = await q(`
  select p.proname as name, p.proretset as returns_set,
         rt.typname as return_type, rt.typcategory as return_category, ret.typname as return_elem,
         coalesce(p.proargnames, '{}') as arg_names,
         coalesce(p.proargmodes::text[], '{}') as arg_modes,
         coalesce((select array_agg(t.typname order by o.ord)
                     from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality o(oid, ord)
                     join pg_type t on t.oid = o.oid), '{}') as arg_types,
         coalesce((select array_agg(t.typcategory::text order by o.ord)
                     from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality o(oid, ord)
                     join pg_type t on t.oid = o.oid), '{}') as arg_categories,
         coalesce((select array_agg(coalesce(et.typname, '') order by o.ord)
                     from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality o(oid, ord)
                     join pg_type t on t.oid = o.oid left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'), '{}') as arg_elems,
         p.pronargs as n_in, p.pronargdefaults as n_defaults
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  left join pg_type ret on ret.oid = rt.typelem and rt.typcategory = 'A'
  where n.nspname = 'public' and rt.typname <> 'trigger' and p.prokind = 'f'
  order by p.proname`);

function scalar(type) {
  if (enumNames.has(type)) return `Database["public"]["Enums"]["${type}"]`;
  switch (type) {
    case 'int2': case 'int4': case 'int8': case 'float4': case 'float8': case 'numeric': return 'number';
    case 'bool': return 'boolean';
    case 'json': case 'jsonb': return 'Json';
    case 'void': return 'undefined';
    default: return 'string';
  }
}
const tsType = (type, category, elem) => (category === 'A' ? `${scalar(elem)}[]` : scalar(type));

const ind = (n) => '  '.repeat(n);
const key = (k) => (/^[a-z_][a-z0-9_]*$/i.test(k) ? k : JSON.stringify(k));

const byTable = new Map();
for (const c of columns) {
  if (!byTable.has(c.table)) byTable.set(c.table, { kind: c.kind, cols: [] });
  byTable.get(c.table).cols.push(c);
}

function relationships(table, depth) {
  const rels = fks.filter((f) => f.table === table);
  if (rels.length === 0) return '[]';
  const items = rels.map((f) => [
    `${ind(depth + 1)}{`,
    `${ind(depth + 2)}foreignKeyName: ${JSON.stringify(f.name)}`,
    `${ind(depth + 2)}columns: ${JSON.stringify(f.columns)}`,
    `${ind(depth + 2)}isOneToOne: ${f.one_to_one}`,
    `${ind(depth + 2)}referencedRelation: ${JSON.stringify(f.ref_table)}`,
    `${ind(depth + 2)}referencedColumns: ${JSON.stringify(f.ref_columns)}`,
    `${ind(depth + 1)}},`,
  ].join('\n'));
  return `[\n${items.join('\n')}\n${ind(depth)}]`;
}

function tableBlock(name, { kind, cols }) {
  const d = 3;
  const row = cols.map((c) => `${ind(d + 2)}${key(c.name)}: ${tsType(c.type, c.category, c.elem_type)}${c.nullable ? ' | null' : ''}`);
  const out = [`${ind(d)}${key(name)}: {`, `${ind(d + 1)}Row: {`, ...row, `${ind(d + 1)}}`];
  if (kind === 'r') {
    const insert = cols.map((c) => {
      const t = tsType(c.type, c.category, c.elem_type) + (c.nullable ? ' | null' : '');
      if (c.identity === 'a' || c.generated === 's') return `${ind(d + 2)}${key(c.name)}?: never`;
      const optional = c.nullable || c.has_default || c.identity === 'd';
      return `${ind(d + 2)}${key(c.name)}${optional ? '?' : ''}: ${t}`;
    });
    const update = cols.map((c) => {
      const t = tsType(c.type, c.category, c.elem_type) + (c.nullable ? ' | null' : '');
      if (c.identity === 'a' || c.generated === 's') return `${ind(d + 2)}${key(c.name)}?: never`;
      return `${ind(d + 2)}${key(c.name)}?: ${t}`;
    });
    out.push(`${ind(d + 1)}Insert: {`, ...insert, `${ind(d + 1)}}`, `${ind(d + 1)}Update: {`, ...update, `${ind(d + 1)}}`);
  }
  out.push(`${ind(d + 1)}Relationships: ${relationships(name, d + 1)}`, `${ind(d)}}`);
  return out.join('\n');
}

function functionBlock(f) {
  const d = 3;
  const names = f.arg_names;
  const modes = f.arg_modes.length ? f.arg_modes : f.arg_types.map(() => 'i');
  const ins = [];
  const outs = [];
  modes.forEach((m, i) => {
    const entry = { name: names[i], type: tsType(f.arg_types[i], f.arg_categories[i], f.arg_elems[i]) };
    if (m === 'i' || m === 'b') ins.push(entry);
    if (m === 'o' || m === 't' || m === 'b') outs.push(entry);
  });
  const firstDefault = f.n_in - f.n_defaults;
  const args = ins.length === 0
    ? 'never'
    : `{\n${ins.map((a, i) => `${ind(d + 2)}${key(a.name)}${i >= firstDefault ? '?' : ''}: ${a.type}`).join('\n')}\n${ind(d + 1)}}`;
  let ret;
  if (modes.includes('t')) {
    ret = `{\n${outs.map((o) => `${ind(d + 2)}${key(o.name)}: ${o.type}`).join('\n')}\n${ind(d + 1)}}[]`;
  } else {
    ret = tsType(f.return_type, f.return_category, f.return_elem) + (f.returns_set ? '[]' : '');
  }
  return [`${ind(d)}${key(f.name)}: {`, `${ind(d + 1)}Args: ${args}`, `${ind(d + 1)}Returns: ${ret}`, `${ind(d)}}`].join('\n');
}

const tables = [...byTable].filter(([, v]) => v.kind === 'r');
const views = [...byTable].filter(([, v]) => v.kind === 'v');

const out = `// GENERATED by supabase/tests/pglite/gen-types.mjs — do not edit by hand.
// Regenerate after changing a migration: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
${tables.map(([n, v]) => tableBlock(n, v)).join('\n')}
    }
    Views: {
${views.map(([n, v]) => tableBlock(n, v)).join('\n')}
    }
    Functions: {
${functions.map(functionBlock).join('\n')}
    }
    Enums: {
${enums.map((e) => `${ind(3)}${key(e.name)}: ${e.labels.map((l) => JSON.stringify(l)).join(' | ')}`).join('\n')}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"] | keyof PublicSchema["Views"]> =
  T extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][T]["Row"]
    : T extends keyof PublicSchema["Views"]
      ? PublicSchema["Views"][T]["Row"]
      : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]

export const Constants = {
  public: {
    Enums: {
${enums.map((e) => `${ind(3)}${key(e.name)}: [${e.labels.map((l) => JSON.stringify(l)).join(', ')}],`).join('\n')}
    },
  },
} as const
`;

writeFileSync(outFile, out);
await db.close();
console.log(`wrote ${outFile}: ${tables.length} tables, ${views.length} views, ${functions.length} functions, ${enums.length} enums`);
