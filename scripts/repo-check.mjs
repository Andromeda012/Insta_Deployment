import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];
let jsonCount = 0;
let jsCount = 0;
let migrationCount = 0;

for (const file of tracked) {
  const base = path.basename(file);
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) failures.push(`Gerçek ortam dosyası Git tarafından izleniyor: ${file}`);
  if (file.endsWith('.json')) {
    jsonCount++;
    try { JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { failures.push(`Geçersiz JSON: ${file} — ${error.message}`); }
  }
  if (file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs')) {
    jsCount++;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) failures.push(`JavaScript sözdizimi hatası: ${file}\n${result.stderr || result.stdout}`);
  }
  if (file.startsWith('supabase/migrations/') && file.endsWith('.sql')) {
    migrationCount++;
    if (!/^\d{12}(?:\d{2})?_[a-z0-9_]+\.sql$/.test(base)) failures.push(`Migration adı sıralama standardına uymuyor: ${file}`);
  }
}

const migrations = tracked.filter(file => file.startsWith('supabase/migrations/') && file.endsWith('.sql')).map(file => path.basename(file)).sort();
for (let i = 1; i < migrations.length; i++) if (migrations[i] === migrations[i - 1]) failures.push(`Tekrarlanan migration adı: ${migrations[i]}`);

console.log(`Depo kontrolü: ${tracked.length} izlenen dosya, ${jsonCount} JSON, ${jsCount} JS/CJS, ${migrationCount} migration.`);
if (failures.length) {
  console.error('\nKontrol başarısız:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Tüm statik depo kontrolleri başarılı.');
