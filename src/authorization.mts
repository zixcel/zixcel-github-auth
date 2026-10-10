import type { GitHubPasskeyAuthorization, GitHubPasskeyAssertion } from './types/contracts.mjs'
import { bounded, freeze, integer, invalid, opaque, isRecord } from './validation.mjs'

/** Validate custody challenges and user proof; provider tokens never enter a public result. */
export function validateAuthorization(value: unknown): GitHubPasskeyAuthorization {
  if (!isRecord(value) || Object.keys(value).sort().join('\n') !== [
    'authorizationRef', 'challenge', 'credentialId', 'expiresAtUnixMs',
    'origin', 'rpId', 'timeout'
  ].sort().join('\n')) invalid('authorization')
  const authorizationRef = bounded(value.authorizationRef, 1, 256, 'authorization-ref')
  const challenge = opaque(value.challenge, 16, 512, 'challenge')
  const credentialId = opaque(value.credentialId, 1, 512, 'credential-id')
  const match = typeof value.origin === 'string'
    ? /^http:\/\/localhost:([1-9][0-9]{0,4})$/u.exec(value.origin) : null
  if (value.rpId !== 'localhost' || !match) invalid('origin')
  const port = Number(match[1])
  if (!Number.isInteger(port) || port < 1 || port > 65_535) invalid('origin')
  return freeze<GitHubPasskeyAuthorization>({ authorizationRef, challenge, rpId: 'localhost',
    origin: `http://localhost:${port}`, credentialId,
    timeout: integer(value.timeout, 1, 'timeout'),
    expiresAtUnixMs: integer(value.expiresAtUnixMs, 1, 'expires') })
}

export function validateAssertion(value: unknown): GitHubPasskeyAssertion {
  if (!isRecord(value) || Object.keys(value).sort().join('\n') !== [
    'authenticatorData', 'clientDataJSON', 'credentialId', 'signature'
  ].sort().join('\n')) invalid('assertion')
  return freeze<GitHubPasskeyAssertion>({ credentialId: opaque(value.credentialId, 1, 512, 'credential-id'),
    clientDataJSON: opaque(value.clientDataJSON, 1, 131_072, 'client-data'),
    authenticatorData: opaque(value.authenticatorData, 1, 131_072, 'authenticator-data'),
    signature: opaque(value.signature, 1, 131_072, 'signature') })
}
