/** Runtime guards never convert arbitrary input into a credential or identifier. */
export function invalid(code: string): never { throw new Error(`zixcel-github-auth-${code}-invalid`) }
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function record(value: unknown, code: string): Record<string, unknown> {
  if (!isRecord(value)) invalid(code)
  return value
}
export function sameStrings(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) && value.length === expected.length
    && value.every((item: unknown, index: number) => item === expected[index])
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
}
export function identifier(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max
    || value.trim() !== value || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)) invalid(code)
  return value
}
export function opaque(value: unknown, min: number, max: number, code: string): string {
  if (typeof value !== 'string' || value.length < min || value.length > max
    || !/^[A-Za-z0-9_-]+$/u.test(value)) invalid(code)
  return value
}
export function bounded(value: unknown, min: number, max: number, code: string): string {
  if (typeof value !== 'string' || value.length < min || value.length > max
    || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) invalid(code)
  return value
}
export function integer(value: unknown, minimum: number, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) invalid(code)
  return value
}
/** Clone and freeze deeply without changing the verified public type contract. */
export function freeze<T>(value: T): T {
  const copy = structuredClone(value)
  deepFreeze(copy)
  return copy
}
function deepFreeze(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return
  const children: unknown[] = Object.values(value)
  for (const child of children) deepFreeze(child)
  Object.freeze(value)
}
