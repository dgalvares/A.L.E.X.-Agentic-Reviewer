import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDiff } from '../../dist/utils/diff_sanitizer.js';
import { isBlockedSensitivePath } from '../../dist/utils/sensitive_paths.js';

test('isBlockedSensitivePath is case-insensitive for sensitive basenames', () => {
  assert.equal(isBlockedSensitivePath('C:/repo/ID_RSA'), true);
  assert.equal(isBlockedSensitivePath('C:/repo/.NPMRC'), true);
  assert.equal(isBlockedSensitivePath('C:/repo/src/index.ts'), false);
});

test('sanitizeDiff redacts sensitive file hunks but keeps metadata', () => {
  const diff = `diff --git a/.env b/.env
index 111..222 100644
--- a/.env
+++ b/.env
@@ -1 +1 @@
-API_KEY=old
+API_KEY=new`;

  const sanitized = sanitizeDiff(diff);

  assert.match(sanitized, /diff --git a\/\.env b\/\.env/);
  assert.match(sanitized, /ALEX REDACTED/);
  assert.doesNotMatch(sanitized, /API_KEY=old/);
  assert.doesNotMatch(sanitized, /API_KEY=new/);
});

test('sanitizeDiff redacts likely secret values in regular files', () => {
  const diff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1 +1 @@
+const token = "abc123";`;

  const sanitized = sanitizeDiff(diff);

  assert.match(sanitized, /\+\[ALEX REDACTED\] possible secret value/);
  assert.doesNotMatch(sanitized, /abc123/);
});
