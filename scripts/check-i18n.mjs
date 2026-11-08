#!/usr/bin/env node
/**
 * i18n audit: scans apps/web/src for `t('some.key', ...)` usages and reports
 * keys that are missing from the English or Chinese dictionaries.
 *
 * Usage: node scripts/check-i18n.mjs [--strict]
 * Exit code 1 when missing keys are found (use --strict to fail the build).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const webSrc = path.join(root, 'apps', 'web', 'src');
const dictDir = path.join(webSrc, 'i18n');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function readDictKeys(file) {
  const text = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  const pattern = /['"]([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)['"]\s*:/g;
  let match;
  while ((match = pattern.exec(text)) !== null) keys.add(match[1]);
  return keys;
}

const en = readDictKeys(path.join(dictDir, 'dict.en.ts'));
const zh = readDictKeys(path.join(dictDir, 'dict.zh.ts'));

const used = new Map();
for (const file of walk(webSrc)) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const pattern = /\bt\(\s*['"]([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)['"]/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const key = match[1];
    if (!used.has(key)) used.set(key, new Set());
    used.get(key).add(path.relative(root, file));
  }
}

const missingEn = [...used.keys()].filter((key) => !en.has(key)).sort();
const missingZh = [...used.keys()].filter((key) => !zh.has(key)).sort();
const unusedEn = [...en].filter((key) => !used.has(key)).sort();

const printList = (title, list) => {
  if (list.length === 0) {
    console.log(`  ${title}: none`);
    return;
  }
  console.log(`  ${title} (${list.length}):`);
  for (const key of list) {
    const sources = used.get(key);
    const hint = sources && sources.size > 0 ? `  ← ${[...sources].slice(0, 2).join(', ')}` : '';
    console.log(`    - ${key}${hint}`);
  }
};

console.log('i18n audit');
console.log(`  used keys: ${used.size}`);
console.log(`  en keys:   ${en.size}`);
console.log(`  zh keys:   ${zh.size}`);
printList('missing in en', missingEn);
printList('missing in zh', missingZh);
printList('unused en keys', unusedEn);

const failed = missingEn.length > 0 || missingZh.length > 0;
if (failed && process.argv.includes('--strict')) process.exit(1);
