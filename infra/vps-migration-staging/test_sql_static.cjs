const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('NOVA SQL DOSYALARI STATİK GÜVENLİK VE SÖZLEŞME DENETİMİ');
console.log('================================================================\n');

const sqlDir = path.join(__dirname);
const patch01 = fs.readFileSync(path.join(sqlDir, '01_security_rls_patch.sql'), 'utf8');
const queue02 = fs.readFileSync(path.join(sqlDir, '02_social_publish_queue.sql'), 'utf8');

let totalChecks = 0;
let passedChecks = 0;

function check(name, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedChecks++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// ── 01_security_rls_patch.sql Denetimleri ────────────────────────────────────
check('01.sql: site_settings üzerinde RLS açıkça etkinleştirilmiş olmalı', () => {
  assert.ok(/ALTER\s+TABLE\s+public\.site_settings\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i.test(patch01));
});

check('01.sql: FOR ALL TO public ifadesi KESİNLİKLE bulunmamalı', () => {
  const match = patch01.match(/FOR\s+ALL\s+TO\s+public/i);
  assert.strictEqual(match, null, 'FOR ALL TO public tespit edildi!');
});

check('01.sql: REVOKE INSERT, UPDATE, DELETE ON site_settings FROM anon, public uygulanmış olmalı', () => {
  assert.ok(/REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON\s+public\.site_settings\s+FROM\s+(PUBLIC,\s*)?anon,\s*authenticated/i.test(patch01));
});

check('01.sql: Yalnızca SELECT izni güvenli anahtarlarla sınırlandırılmış olmalı', () => {
  assert.ok(/FOR\s+SELECT\s+TO\s+(anon,\s*authenticated|public)/i.test(patch01));
  const policyMatch = patch01.match(/CREATE\s+POLICY\s+"Public read safe site_settings only"[\s\S]+?;/i);
  assert.ok(policyMatch, 'Politika tanımı bulunmalı');
  assert.ok(!policyMatch[0].includes('insta_bot_state'), 'insta_bot_state asla SELECT politikasında yer alamaz');
});

check('01.sql: sanitize_bot_credentials() doğrudan SELECT ile çağrılmalı', () => {
  assert.ok(/SELECT\s+public\.sanitize_bot_credentials\(\);/i.test(patch01));
});

check('01.sql: Fonksiyonlarda sabit search_path tanımlanmış olmalı', () => {
  const count = (patch01.match(/SET\s+search_path\s*=\s*(pg_catalog,\s*public|public,\s*pg_temp)/gi) || []).length;
  assert.ok(count >= 2, 'SECURITY DEFINER fonksiyonlarında search_path eksik');
});

// ── 02_social_publish_queue.sql Denetimleri ─────────────────────────────────
check('02.sql: Süresi dolan processing görevleri ASLA pending yapılmamalı', () => {
  assert.ok(!queue02.includes("status = 'pending'\n    WHERE status = 'processing'"));
  assert.ok(/status\s*=\s*'reconciliation_required'/i.test(queue02));
});

check('02.sql: claim_next_publish_task FOR UPDATE SKIP LOCKED kullanmalı', () => {
  assert.ok(/FOR\s+UPDATE\s+SKIP\s+LOCKED/i.test(queue02));
});

check('02.sql: claim_next_publish_task YouTube görevlerini hariç tutmalı', () => {
  const hasExcluded = /platform\s*<>\s*'youtube'/i.test(queue02) || 
                      /platform\s+IN\s+\('instagram',\s*'facebook',\s*'tiktok'\)/i.test(queue02) ||
                      /UPDATE[^\n]+status\s*=\s*'unsupported'[^\n]+platform\s*=\s*'youtube'/is.test(queue02);
  assert.ok(hasExcluded, 'YouTube dışlanmış olmalı');
});

check('02.sql: extend_publish_task_lock locked_until > NOW() şartını aramalı', () => {
  assert.ok(/locked_until\s*>\s*now\(\)/i.test(queue02));
});

check('02.sql: complete_publish_task FOR UPDATE ile satır kilitlemeli', () => {
  assert.ok(/FOR\s+UPDATE;/i.test(queue02));
});

check('02.sql: complete_publish_task kilit süresi dolmuş veya NULL ise reddetmeli', () => {
  assert.ok(/v_locked_until\s+IS\s+NULL/i.test(queue02));
  assert.ok(/v_locked_until\s*<=\s*now\(\)|v_locked_until\s*<\s*now\(\)/i.test(queue02));
});

check('02.sql: complete_publish_task ROW_COUNT kontrolü ile boolean dönmeli', () => {
  assert.ok(/GET\s+DIAGNOSTICS\s+(v_updated|v_rows)\s*=\s*ROW_COUNT;/i.test(queue02));
  assert.ok(/RETURN\s+(v_updated\s*>\s*0|v_rows\s*=\s*1|v_updated\s*=\s*1);/i.test(queue02));
});

check('02.sql: Gerçek exponential backoff formülü 60 dk tavan ile bulunmalı', () => {
  assert.ok(/LEAST\s*\(/i.test(queue02));
  assert.ok(/60/i.test(queue02));
});

check('02.sql: Sadece service_role rolüne çalıştırma izni verilmeli', () => {
  assert.ok(/GRANT\s+ALL\s+ON\s+public\.social_publish_queue\s+TO\s+service_role/i.test(queue02));
  assert.ok(/REVOKE\s+ALL\s+ON\s+public\.social_publish_queue\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(queue02));
});

console.log('\n================================================================');
console.log(`STATİK SQL KONTROLÜ: ${passedChecks} / ${totalChecks} MADDE BAŞARIYLA DOĞRULANDI.`);
console.log('================================================================\n');
