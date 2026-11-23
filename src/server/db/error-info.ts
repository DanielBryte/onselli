export type DatabaseErrorInfo = { code: string; constraint: string; table: string; column: string };

export function getDatabaseErrorInfo(error: unknown): DatabaseErrorInfo {
  const info: DatabaseErrorInfo = { code: '', constraint: '', table: '', column: '' };
  const seen = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const value = current as Record<string, unknown>;
    if (!info.code && (typeof value.code === 'string' || typeof value.code === 'number')) info.code = String(value.code);
    if (!info.constraint && typeof value.constraint === 'string') info.constraint = value.constraint;
    if (!info.table && typeof value.table === 'string') info.table = value.table;
    if (!info.column && typeof value.column === 'string') info.column = value.column;
    current = value.cause;
  }

  return info;
}
