import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSource } from '../src/services/codeAnalysis.js';

test('reports potential static issues with evidence and locations', () => {
  const findings = analyzeSource([{
    path: 'src/login.ts',
    content: 'export function login(input: string) {\n  eval(input)\n  // TODO: validate the session\n}\n',
  }]);

  assert.equal(findings.length, 2);
  assert.equal(findings[0]?.filePath, 'src/login.ts');
  assert.equal(findings[0]?.line, 2);
  assert.equal(findings[0]?.ruleId, 'unsafe-eval');
  assert.match(findings[0]?.evidence ?? '', /eval/);
  assert.equal(findings[1]?.ruleId, 'unfinished-code-marker');
  assert.equal(findings[1]?.line, 3);
});
