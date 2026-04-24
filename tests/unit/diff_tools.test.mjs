import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCodeMetadata } from '../../dist/tools/diff_tools.js';

test('extractCodeMetadata detects files from git diff headers', () => {
  const metadata = extractCodeMetadata(`--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-old
+new
--- a/api/UserController.cs
+++ b/api/UserController.cs`);

  assert.equal(metadata.filesCount, 2);
  assert.deepEqual(metadata.files, ['src/a.ts', 'api/UserController.cs']);
  assert.equal(metadata.detectedStack, 'TypeScript/React');
});

test('extractCodeMetadata detects sourceCode file markers', () => {
  const metadata = extractCodeMetadata(`=== File: src/app.tsx ===
export const App = () => null;`);

  assert.equal(metadata.filesCount, 1);
  assert.deepEqual(metadata.extensions.sort(), ['tsx']);
  assert.equal(metadata.detectedStack, 'TypeScript/React');
});

test('extractCodeMetadata returns unknown for content without file markers', () => {
  const metadata = extractCodeMetadata('const value = 1;');

  assert.equal(metadata.filesCount, 0);
  assert.equal(metadata.detectedStack, 'unknown');
});
