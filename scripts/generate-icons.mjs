// Renders the PWA / favicon / social images from the logo SVG with sharp.
//   npm run icons
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });

const MINT = "#2DD4A7";
const INK = "#04201A";
const BG = "#0B0F14";

const house = `<path d="M10.5 22.2 22.6 11.9a2.2 2.2 0 0 1 2.8 0L37.5 22.2v13.3a2.5 2.5 0 0 1-2.5 2.5H13a2.5 2.5 0 0 1-2.5-2.5Z" fill="${INK}"/>
<path d="M24 34.5s-6.5-3.9-6.5-8.1c0-2.1 1.6-3.6 3.5-3.6 1.3 0 2.4.7 3 1.8.6-1.1 1.7-1.8 3-1.8 1.9 0 3.5 1.5 3.5 3.6 0 4.2-6.5 8.1-6.5 8.1Z" fill="${MINT}"/>`;

// Rounded app icon (favicon, standard PWA icon).
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="${MINT}"/>${house}</svg>`;
// Full-bleed square for maskable icons and iOS (the OS applies its own mask), artwork inside the safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="${MINT}"/><g transform="translate(7.2 7.2) scale(0.7)">${house}</g></svg>`;

writeFileSync(new URL("icon.svg", out), rounded);

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 1024 }).resize(size, size).png().toFile(new URL(file, out).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

await png(rounded, 32, "favicon-32.png");
await png(rounded, 192, "icon-192.png");
await png(rounded, 512, "icon-512.png");
await png(maskable, 512, "maskable-512.png");
await png(maskable, 180, "apple-touch-icon.png");

// Open Graph card (1200×630).
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g" cx="15%" cy="0%" r="80%"><stop offset="0" stop-color="${MINT}" stop-opacity=".28"/><stop offset="1" stop-color="${BG}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(96 150) scale(4.2)"><rect width="48" height="48" rx="13" fill="${MINT}"/>${house}</g>
  <text x="96" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="78" font-weight="700" fill="#E8EDF3">MessMate <tspan fill="${MINT}">BD</tspan></text>
  <text x="96" y="500" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#8B97A8">Meals · Wallet · Bills · Housing · Care — for bachelors in Dhaka</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(new URL("og.png", out).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

console.log("icons written to public/icons/");
