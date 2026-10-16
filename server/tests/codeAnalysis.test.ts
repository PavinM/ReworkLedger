import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSource, analyzeSourceWithLocalAi } from '../src/services/codeAnalysis.js';

test('reports potential static issues with evidence and locations', () => {
  const findings = analyzeSource([{
    path: 'src/login.ts',
    content: 'export function login(input: string) {\n  eval(input)\n  // TODO: validate the session\n}\n',
  }]);

  assert.equal(findings.length, 2);
  assert.equal(findings[0]?.filePath, 'src/login.ts');
  assert.equal(findings[0]?.line, 2);
  assert.equal(findings[0]?.ruleId, 'unsafe-eval');
  assert.equal(findings[0]?.suggestedCause, 'code_defect');
  assert.match(findings[0]?.evidence ?? '', /eval/);
  assert.equal(findings[1]?.ruleId, 'unfinished-code-marker');
  assert.equal(findings[1]?.line, 3);
});

test('local AI findings are tied to real file lines and verified evidence', async () => {
  const source = { path: 'src/login.ts', content: 'function login(input: string) {\n  eval(input)\n}\n' };
  const fetcher: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { model: string; stream: boolean; format: string };
    assert.equal(request.model, process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b');
    assert.equal(request.stream, false);
    assert.equal(request.format, 'json');
    return new Response(JSON.stringify({
      message: {
        content: JSON.stringify({
          findings: [{
            line: 2,
            title: 'Dynamic evaluation',
            description: 'This evaluates a provided string as code.',
            severity: 'high',
            evidence: 'eval(input)',
            suggestion: 'Replace evaluation with explicit parsing.',
            confidence: 8,
            suggestedCause: 'code_defect',
          }],
        }),
      },
    }), { status: 200 });
  };

  const result = await analyzeSourceWithLocalAi([source], fetcher);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.source, 'local_ai');
  assert.equal(result.findings[0]?.filePath, source.path);
  assert.equal(result.findings[0]?.line, 2);
  assert.equal(result.findings[0]?.evidence, 'eval(input)');
  assert.equal(result.findings[0]?.confidence, 8);
  assert.equal(result.findings[0]?.suggestedCause, 'code_defect');
  assert.equal(result.filesReviewed, 1);
  assert.equal(result.filesSkipped, 0);
});

test('discards AI findings with invalid lines or fabricated evidence', async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    message: {
      content: JSON.stringify({
        findings: [
          { line: 99, title: 'Wrong line', description: 'Invalid line.', severity: 'high', evidence: 'eval(input)', suggestion: 'Fix it.', confidence: 7, suggestedCause: 'code_defect' },
          { line: 2, title: 'Wrong evidence', description: 'Fabricated evidence.', severity: 'medium', evidence: 'unsafeCall()', suggestion: 'Fix it.', confidence: 6, suggestedCause: 'external_dependency' },
        ],
      }),
    },
  }), { status: 200 });
  const result = await analyzeSourceWithLocalAi([{ path: 'src/login.ts', content: 'function login() {\n  eval(input)\n}' }], fetcher);
  assert.equal(result.findings.length, 0);
  assert.equal(result.rejectedFindings, 2);
});

test('local AI refuses non-local Ollama endpoints', async () => {
  const previousBaseUrl = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'https://example.com';
  try {
    await assert.rejects(
      analyzeSourceWithLocalAi([{ path: 'src/app.ts', content: 'export {}' }]),
      /must use a local HTTP endpoint/,
    );
  } finally {
    if (previousBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = previousBaseUrl;
  }
});

test('local AI analysis caps model requests and reports files outside its review budget', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ findings: [] }) } }), { status: 200 });
  };
  const files = Array.from({ length: 20 }, (_, index) => ({
    path: `src/file-${index}.ts`,
    content: 'export const value = 1;',
  }));
  const result = await analyzeSourceWithLocalAi(files, fetcher);
  assert.equal(requests, 12);
  assert.equal(result.filesReviewed, 12);
  assert.equal(result.filesSkipped, 8);
});
