import unzipper from 'unzipper';

const MAX_FILES = 500;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

export type SourceFile = { path: string; content: string };
export type FindingInput = {
  ruleId: string;
  tool: string;
  title: string;
  description: string;
  filePath: string;
  line: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  suggestion: string;
};

function extension(path: string): string {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index).toLowerCase();
}

function lineNumber(content: string, offset: number): number {
  return content.slice(0, offset).split('\n').length;
}

function addFinding(findings: FindingInput[], file: SourceFile, match: RegExpExecArray, finding: Omit<FindingInput, 'filePath' | 'line' | 'evidence'>): void {
  const line = lineNumber(file.content, match.index);
  const evidence = file.content.split('\n')[line - 1]?.trim().slice(0, 300) ?? '';
  findings.push({ ...finding, filePath: file.path, line, evidence });
}

export async function readZipSource(buffer: Buffer): Promise<SourceFile[]> {
  const directory = await unzipper.Open.buffer(buffer);
  if (directory.files.length > MAX_FILES) throw new Error(`ZIP contains too many files (maximum ${MAX_FILES})`);
  const sourceFiles: SourceFile[] = [];
  let totalBytes = 0;
  for (const entry of directory.files) {
    const normalized = entry.path.replaceAll('\\', '/');
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
      throw new Error('ZIP contains an unsafe path or symbolic link');
    }
    if (entry.type !== 'File' || !sourceExtensions.has(extension(normalized))) continue;
    if (entry.uncompressedSize > MAX_UNCOMPRESSED_BYTES || totalBytes + entry.uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('ZIP source content exceeds the 25 MB safety limit');
    }
    const content = (await entry.buffer()).toString('utf8');
    totalBytes += Buffer.byteLength(content);
    sourceFiles.push({ path: normalized, content });
  }
  return sourceFiles;
}

export function analyzeSource(files: SourceFile[]): FindingInput[] {
  const findings: FindingInput[] = [];
  for (const file of files) {
    const checks: Array<{ pattern: RegExp; finding: Omit<FindingInput, 'filePath' | 'line' | 'evidence'> }> = [
      {
        pattern: /\beval\s*\(/g,
        finding: { ruleId: 'unsafe-eval', tool: 'static-pattern', title: 'Dynamic code execution', description: 'The source uses eval, which can execute input as code and makes behavior difficult to verify.', severity: 'high', suggestion: 'Replace eval with explicit parsing or a constrained map of allowed operations.' },
      },
      {
        pattern: /(?:innerHTML|outerHTML)\s*=/g,
        finding: { ruleId: 'unsafe-html-sink', tool: 'static-pattern', title: 'Unsanitized HTML assignment', description: 'An HTML sink may introduce cross-site scripting if the assigned value contains untrusted input.', severity: 'high', suggestion: 'Prefer textContent or sanitize and validate the value before assigning HTML.' },
      },
      {
        pattern: /@ts-ignore|@ts-nocheck/g,
        finding: { ruleId: 'typescript-check-disabled', tool: 'static-pattern', title: 'TypeScript checking disabled', description: 'A TypeScript suppression hides compiler errors in this area and needs human review.', severity: 'medium', suggestion: 'Remove the suppression and resolve the underlying type error.' },
      },
      {
        pattern: /\bTODO\b|\bFIXME\b/g,
        finding: { ruleId: 'unfinished-code-marker', tool: 'static-pattern', title: 'Unfinished-code marker', description: 'The source contains a TODO or FIXME marker that may indicate incomplete behavior.', severity: 'low', suggestion: 'Confirm whether the marker represents required work and track it if it affects acceptance criteria.' },
      },
      {
        pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
        finding: { ruleId: 'empty-error-handler', tool: 'static-pattern', title: 'Empty error handler', description: 'An exception is caught and ignored, which can hide failures from users and operators.', severity: 'medium', suggestion: 'Handle the error explicitly or document why it is intentionally ignored.' },
      },
    ];
    for (const check of checks) {
      let match: RegExpExecArray | null;
      while ((match = check.pattern.exec(file.content)) !== null) addFinding(findings, file, match, check.finding);
    }
  }
  return findings;
}
