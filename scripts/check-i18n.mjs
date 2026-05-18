// i18n parity checker — run with: node scripts/check-i18n.mjs
//
// Enforces the translation contract for the whole web app:
//  1. src/i18n/locales.ts  — every key in `en` exists, non-empty, in fr/ar/pt/sw
//     (and no language has extra keys).
//  2. CMS layer — every key in the CMS registry (src/cms/registry.ts) has a
//     non-empty fr/ar/pt/sw translation in src/i18n/cms-locales.ts, and that
//     file has no keys that are absent from the registry.
//
// The web build uses rolldown/esbuild (no tsc step), so this script is the
// source of truth for "no error in any language file".

import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const NON_EN = ['fr', 'ar', 'pt', 'sw'];
const dir = mkdtempSync(join(tmpdir(), 'i18n-'));
let failed = false;
const fail = (msg) => { failed = true; console.error('  ✗ ' + msg); };

async function load(entry, externalStub) {
  const out = join(dir, entry.replace(/[\\/]/g, '_') + '.mjs');
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    logLevel: 'silent',
    plugins: externalStub
      ? [{
          name: 'stub',
          setup(b) {
            b.onResolve({ filter: /^@\/services\/content$/ }, () => ({ path: 'stub', namespace: 'stub' }));
            b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const x=0;' }));
          },
        }]
      : [],
  });
  return import(pathToFileURL(out).href);
}

try {
  // ── 1. Static i18n catalog ──────────────────────────────────────────────
  console.log('locales.ts (static UI catalog):');
  const { TRANSLATIONS, LANGUAGES } = await load('src/i18n/locales.ts');
  const enKeys = Object.keys(TRANSLATIONS.en);
  console.log(`  en: ${enKeys.length} keys`);
  for (const lang of NON_EN) {
    const keys = Object.keys(TRANSLATIONS[lang] ?? {});
    const missing = enKeys.filter((k) => !(k in TRANSLATIONS[lang]));
    const extra = keys.filter((k) => !(k in TRANSLATIONS.en));
    const empty = keys.filter((k) => !String(TRANSLATIONS[lang][k]).trim());
    if (missing.length || extra.length || empty.length) {
      fail(`${lang}: missing=${missing.length} extra=${extra.length} empty=${empty.length}`);
      if (missing.length) console.error('    missing: ' + missing.slice(0, 25).join(', '));
      if (extra.length) console.error('    extra: ' + extra.slice(0, 25).join(', '));
    } else {
      console.log(`  ✓ ${lang}: ${keys.length} keys, full parity`);
    }
  }
  if (LANGUAGES.length !== 5) fail(`LANGUAGES should list 5 languages, found ${LANGUAGES.length}`);

  // ── 2. CMS layer parity ─────────────────────────────────────────────────
  console.log('\nCMS layer (registry vs cms-locales.ts):');
  const { cmsRegistry } = await load('src/cms/registry.ts', true);
  const { CMS_TRANSLATIONS } = await load('src/i18n/cms-locales.ts');
  const regKeys = [...new Set(cmsRegistry.map((e) => e.key))];
  console.log(`  registry: ${regKeys.length} keys`);

  const perPage = {};
  for (const e of cmsRegistry) {
    perPage[e.page] ??= { total: 0, done: 0 };
    perPage[e.page].total++;
    const ok = NON_EN.every((l) => {
      const v = CMS_TRANSLATIONS[l]?.[e.key];
      return v && String(v).trim();
    });
    if (ok) perPage[e.page].done++;
  }

  for (const lang of NON_EN) {
    const tbl = CMS_TRANSLATIONS[lang] ?? {};
    const missing = regKeys.filter((k) => !(tbl[k] && String(tbl[k]).trim()));
    const extra = Object.keys(tbl).filter((k) => !regKeys.includes(k));
    if (missing.length || extra.length) {
      fail(`${lang}: ${regKeys.length - missing.length}/${regKeys.length} translated, missing=${missing.length} extra=${extra.length}`);
      if (extra.length) console.error('    extra: ' + extra.slice(0, 25).join(', '));
    } else {
      console.log(`  ✓ ${lang}: all ${regKeys.length} CMS keys translated`);
    }
  }

  console.log('\n  Per-page CMS coverage (all 4 non-en langs):');
  for (const [page, s] of Object.entries(perPage).sort()) {
    const mark = s.done === s.total ? '✓' : ' ';
    console.log(`   ${mark} ${page.padEnd(16)} ${s.done}/${s.total}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('\n' + (failed ? 'RESULT: INCOMPLETE (see ✗ above)' : 'RESULT: ALL PARITY CHECKS PASS'));
process.exit(failed ? 1 : 0);
