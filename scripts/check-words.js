/**
 * Fast word-bank sanity check (no Jest needed).
 *   node scripts/check-words.js            # all category files
 *   node scripts/check-words.js food jobs  # only report these files (duplicates still checked globally)
 * Reports: global case-insensitive duplicates, missing difficulty/related, related == word,
 * per-file counts by difficulty. Exit code 1 if any problem is found.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'data', 'words', 'categories');
const only = process.argv.slice(2);
const key = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const seen = new Map();
let problems = 0;
const report = [];

for (const file of fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .sort()) {
  const id = file.replace(/\.ts$/, '');
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const counts = { easy: 0, medium: 0, hard: 0 };
  let n = 0;
  // Entries may be wrapped over several lines by Prettier, so match whole { word: ... } objects.
  for (const block of src.match(/\{\s*word:[\s\S]*?\}/g) || []) {
    const line = block.replace(/\s+/g, ' ');
    const m = line.match(/word:\s*(['"])(.+?)\1/);
    if (!m) continue;
    n++;
    const word = m[2];
    const k = key(word);
    const d = (line.match(/difficulty:\s*'(\w+)'/) || [])[1];
    const related = [...((line.match(/related:\s*\[([^\]]*)\]/) || [])[1] || '').matchAll(/(['"])(.+?)\1/g)].map((x) =>
      key(x[2]),
    );
    const show = only.length === 0 || only.includes(id);
    const fail = (msg) => {
      problems++;
      if (show || msg.startsWith('duplicate')) report.push(`${id}: ${msg} — "${word}"`);
    };
    if (!['easy', 'medium', 'hard'].includes(d)) fail('bad/missing difficulty');
    else counts[d]++;
    if (related.length === 0) fail('missing related');
    if (related.includes(k)) fail('related equals word');
    if (new Set(related).size !== related.length) fail('duplicate related');
    if (seen.has(k)) fail(`duplicate (also in ${seen.get(k)})`);
    else seen.set(k, id);
  }
  if (only.length === 0 || only.includes(id)) {
    report.push(
      `${id.padEnd(18)} ${String(n).padStart(4)}  easy ${counts.easy}  medium ${counts.medium}  hard ${counts.hard}`,
    );
  }
}

console.log(report.join('\n'));
console.log(`TOTAL ${seen.size} unique words, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
