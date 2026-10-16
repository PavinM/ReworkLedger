import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefectFromFindingSchema } from '../src/validation/schemas.js';

test('accepts a finding-linked assignment with default debug instructions', () => {
  assert.equal(createDefectFromFindingSchema.safeParse({ cause: 'code_defect' }).success, true);
});

test('accepts bounded debug instructions and trims surrounding whitespace', () => {
  const result = createDefectFromFindingSchema.safeParse({
    cause: 'external_dependency',
    debugInstructions: '  Verify the package version  ',
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.debugInstructions, 'Verify the package version');
});

test('rejects empty or oversized debug instructions', () => {
  assert.equal(createDefectFromFindingSchema.safeParse({ cause: 'other', debugInstructions: '   ' }).success, false);
  assert.equal(createDefectFromFindingSchema.safeParse({ cause: 'other', debugInstructions: 'x'.repeat(4001) }).success, false);
});
