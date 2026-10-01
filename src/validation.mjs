export function identifier(value, max, code) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max
    || value.trim() !== value || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)) invalid(code)
  return value
}
export function opaque(value, min, max, code) {
  if (typeof value !== 'string' || value.length < min || value.length > max
    || !/^[A-Za-z0-9_-]+$/u.test(value)) invalid(code)
  return value
}
export function bounded(value, min, max, code) {
  if (typeof value !== 'string' || value.length < min || value.length > max
    || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) invalid(code)
  return value
}
export function integer(value, minimum, code) {
  if (!Number.isSafeInteger(value) || value < minimum) invalid(code)
  return value
}
export function freeze(value) { return deepFreeze(structuredClone(value)) }
export function invalid(code) { throw new Error(`zixcel-github-auth-${code}-invalid`) }

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
