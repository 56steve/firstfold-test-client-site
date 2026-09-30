/** Test helper: a shallow copy of `record` with `key` removed, for building a body that's missing one field. */
export function without<T extends Record<string, unknown>>(record: T, key: keyof T | string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record };
  delete copy[key as string];
  return copy;
}
