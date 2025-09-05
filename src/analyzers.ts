export function guessComplexity(code: string): string | undefined {
  const loops = (code.match(/for\s*\(|while\s*\(/g) || []).length;
  const nested = /(for\s*\(|while\s*\().*[\n\r\s]*.*(for\s*\(|while\s*\()/s.test(code);
  if (nested) return '~ O(n^2)? justify or replace';
  if (loops >= 1 && /sort\(/.test(code)) return '~ O(n log n)';
  if (/map\(|reduce\(|filter\(/.test(code) && loops===0) return '~ O(n)';
  return undefined;
}

export function spotAntiPatterns(code: string): string[] {
  const issues: string[] = [];
  if (/new Array\([^)]*\)\.fill\(.+\)\.map\(/.test(code)) issues.push('large copies in hot path');
  if (/JSON\.parse\(JSON\.stringify\(/.test(code)) issues.push('heavy deep copy');
  if (/for\s*\([^;]*;[^;]*;[^)]*\)\s*\{[^}]*length\s*\}/s.test(code)) issues.push('array.length in loop body');
  return issues;
}
