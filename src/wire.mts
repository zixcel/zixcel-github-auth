import type { AuthTransport, ProviderResponse, GitHubAuthDeclaration, GitHubDeviceAttempt } from './types/contracts.mjs'
import { bounded, identifier, integer, invalid, opaque, record, isRecord, sameStrings } from './validation.mjs'
import { TOOL_ID } from './declaration.mjs'
const ATTEMPT_SCHEMA = 'zixcel://github/oauth-device-attempt/v1'

export function validateAttempt(value: unknown): asserts value is GitHubDeviceAttempt {
  if (!isRecord(value) || value.schema !== ATTEMPT_SCHEMA || value.providerId !== 'github'
    || value.toolId !== TOOL_ID) invalid('attempt')
  if (!sameStrings(value.requestedScopes, ['repo', 'workflow', 'read:org']) && !sameStrings(value.requestedScopes, ['repo', 'workflow', 'read:org', 'delete_repo'])) invalid('attempt-scopes')
  identifier(value.clientId, 128, 'client-id'); opaque(value.deviceCode, 16, 512, 'device-code')
  bounded(value.userCode, 4, 32, 'user-code'); exactVerificationUri(value.verificationUri)
  integer(value.expiresAtUnixMs, 0, 'expires'); integer(value.nextPollUnixMs, 0, 'poll')
  integer(value.intervalSeconds, 1, 'interval')
}
/** The injected provider adapter must enforce the supplied response-byte limit. */
export async function send(transport: AuthTransport, url: string, body: string): Promise<ProviderResponse> {
  if (typeof transport?.send !== 'function') invalid('transport')
  return transport.send({ method: 'POST', url,
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body, maximumResponseBytes: 16_384 })
}
/** Bound UTF-8 bytes and accept only object-shaped provider JSON. */
export function accepted(response: ProviderResponse, code: string): Record<string, unknown> {
  if (response?.status !== 200 || typeof response.body !== 'string'
    || new TextEncoder().encode(response.body).byteLength > 16_384) invalid(code)
  try { const value: unknown = JSON.parse(response.body); return record(value, code) } catch { invalid(code) }
}
export function form(values: Record<string, string>): string { return new URLSearchParams(values).toString() }
export function exactVerificationUri(value: unknown): 'https://github.com/login/device' {
  if (value !== 'https://github.com/login/device') invalid('verification-uri')
  return value
}
export function exactScopes(value: unknown, expected: GitHubAuthDeclaration['scopes']): GitHubAuthDeclaration['scopes'] {
  const scopes = typeof value === 'string' ? value.split(/[ ,]+/u).filter(Boolean) : []
  if (scopes.length !== expected.length || new Set(scopes).size !== expected.length
    || expected.some(scope => !scopes.includes(scope))) invalid('scope')
  return expected
}
