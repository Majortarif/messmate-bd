// Fails if messages/bn.json and messages/en.json don't have exactly the same keys.
import { readFileSync } from "node:fs";

const load = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const bn = new Set(flatten(load("bn")));
const en = new Set(flatten(load("en")));
const onlyBn = [...bn].filter((k) => !en.has(k));
const onlyEn = [...en].filter((k) => !bn.has(k));

if (onlyBn.length || onlyEn.length) {
  if (onlyBn.length) console.error("Missing in en.json:\n  " + onlyBn.join("\n  "));
  if (onlyEn.length) console.error("Missing in bn.json:\n  " + onlyEn.join("\n  "));
  process.exit(1);
}
console.log(`messages OK: ${bn.size} keys in both bn and en`);
