import { TOOL_ID, validateDeclaration } from './declaration.mjs'
import { bounded, freeze, identifier, integer, invalid, opaque } from './validation.mjs'

export const ATTEMPT_SCHEMA = 'zixcel://github/oauth-device-attempt/v1'
const deviceUrl = 'https://github.com/login/device/code'
const tokenUrl = 'https://github.com/login/oauth/access_token'

export async function requestGitHubDeviceCode(declaration, input, transport) {
  validateDeclaration(declaration)
  const clientId = identifier(input?.clientId, 128, 'client-id')
  const nowUnixMs = integer(input?.nowUnixMs, 0, 'time')
  const response = await send(transport, deviceUrl, form({ client_id: clientId,
    scope: declaration.scopes.join(' ') }))
  return acceptGitHubDeviceCodeResponse(declaration, { clientId, nowUnixMs, response })
}

export function acceptGitHubDeviceCodeResponse(declaration, input) {
  validateDeclaration(declaration)
  const clientId = identifier(input?.clientId, 128, 'client-id')
  const now = integer(input?.nowUnixMs, 0, 'time')
  const wire = accepted(input?.response, 'device-code')
  const expiresIn = integer(wire.expires_in, 60, 'expires-in')
  const interval = integer(wire.interval ?? 5, 1, 'interval')
  if (expiresIn > 900 || interval > 60) invalid('provider-bounds')
  const verificationUri = exactVerificationUri(wire.verification_uri)
  return freeze({ schema: ATTEMPT_SCHEMA, providerId: 'github', toolId: TOOL_ID,
    clientId, requestedScopes: [...declaration.scopes], deviceCode: opaque(wire.device_code, 16, 512, 'device-code'),
    userCode: bounded(wire.user_code, 4, 32, 'user-code'), verificationUri,
    expiresAtUnixMs: now + expiresIn * 1000,
    nextPollUnixMs: now + interval * 1000, intervalSeconds: interval })
}

export async function pollGitHubDeviceAuthorization(attempt, input, transport, custody) {
  validateAttempt(attempt)
  const now = integer(input?.nowUnixMs, 0, 'time')
  if (now > attempt.expiresAtUnixMs) invalid('attempt-expired')
  if (now < attempt.nextPollUnixMs) invalid('poll-early')
  const response = await send(transport, tokenUrl, form({ client_id: attempt.clientId,
    device_code: attempt.deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }))
  const wire = accepted(response, 'token')
  if (wire.error) return pending(attempt, wire, now)
  const token = opaque(wire.access_token, 16, 4096, 'access-token')
  if (wire.token_type !== 'bearer'
    || typeof custody?.beginGitHubTokenEnrollment !== 'function') {
    invalid('custody')
  }
  const authorization = validateAuthorization(
    await custody.beginGitHubTokenEnrollment({ accessToken: token,
    scopes: exactScopes(wire.scope, attempt.requestedScopes), tokenType: 'bearer' })
  )
  return freeze({ status: 'user-verification-required', authorization })
}

export async function completeGitHubDeviceAuthorization(
  authorization, assertion, custody
) {
  const verified = validateAuthorization(authorization)
  const proof = validateAssertion(assertion)
  if (typeof custody?.completeGitHubTokenEnrollment !== 'function') invalid('custody')
  const receipt = await custody.completeGitHubTokenEnrollment({
    authorizationRef: verified.authorizationRef, assertion: proof
  })
  return freeze({ status: 'connected', connectionRef:
    bounded(receipt?.connectionRef, 1, 256, 'connection-ref') })
}

function pending(attempt, wire, now) {
  if (wire.error === 'authorization_pending') return freeze({ status: 'pending',
    nextPollUnixMs: now + attempt.intervalSeconds * 1000 })
  if (wire.error === 'slow_down') return freeze({ status: 'pending',
    nextPollUnixMs: now + (attempt.intervalSeconds + 5) * 1000 })
  if (['access_denied', 'expired_token', 'incorrect_device_code'].includes(wire.error)) {
    invalid(wire.error)
  }
  invalid('provider-response')
}
function validateAttempt(value) {
  if (!value || value.schema !== ATTEMPT_SCHEMA || value.providerId !== 'github'
    || value.toolId !== TOOL_ID) invalid('attempt')
  if (!Array.isArray(value.requestedScopes) || !['repo workflow read:org', 'repo workflow read:org delete_repo'].includes(value.requestedScopes.join(' '))) invalid('attempt-scopes')
  identifier(value.clientId, 128, 'client-id'); opaque(value.deviceCode, 16, 512, 'device-code')
  bounded(value.userCode, 4, 32, 'user-code'); exactVerificationUri(value.verificationUri)
  integer(value.expiresAtUnixMs, 0, 'expires'); integer(value.nextPollUnixMs, 0, 'poll')
  integer(value.intervalSeconds, 1, 'interval')
}
async function send(transport, url, body) {
  if (typeof transport?.send !== 'function') invalid('transport')
  return transport.send({ method: 'POST', url,
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body, maximumResponseBytes: 16_384 })
}
function accepted(response, code) {
  if (response?.status !== 200 || typeof response.body !== 'string'
    || response.body.length > 16_384) invalid(code)
  try { return JSON.parse(response.body) } catch { invalid(code) }
}
function form(values) { return new URLSearchParams(values).toString() }
function exactVerificationUri(value) {
  if (value !== 'https://github.com/login/device') invalid('verification-uri')
  return value
}
function exactScopes(value, expected) {
  const scopes = typeof value === 'string' ? value.split(/[ ,]+/u).filter(Boolean) : []
  if (scopes.length !== expected.length || new Set(scopes).size !== expected.length
    || expected.some(scope => !scopes.includes(scope))) invalid('scope')
  return expected
}

function validateAuthorization(value) {
  if (!value || Object.keys(value).sort().join('\n') !== [
    'authorizationRef', 'challenge', 'credentialId', 'expiresAtUnixMs',
    'origin', 'rpId', 'timeout'
  ].sort().join('\n')) invalid('authorization')
  const authorizationRef = bounded(value.authorizationRef, 1, 256, 'authorization-ref')
  const challenge = opaque(value.challenge, 16, 512, 'challenge')
  const credentialId = opaque(value.credentialId, 1, 512, 'credential-id')
  if (value.rpId !== 'localhost' || !/^http:\/\/localhost:[1-9][0-9]{0,4}$/u.test(value.origin)) {
    invalid('origin')
  }
  const port = Number(new URL(value.origin).port)
  if (!Number.isInteger(port) || port > 65_535) invalid('origin')
  return freeze({ authorizationRef, challenge, rpId: value.rpId,
    origin: value.origin, credentialId,
    timeout: integer(value.timeout, 1, 'timeout'),
    expiresAtUnixMs: integer(value.expiresAtUnixMs, 1, 'expires') })
}

function validateAssertion(value) {
  if (!value || Object.keys(value).sort().join('\n') !== [
    'authenticatorData', 'clientDataJSON', 'credentialId', 'signature'
  ].sort().join('\n')) invalid('assertion')
  return freeze({ credentialId: opaque(value.credentialId, 1, 512, 'credential-id'),
    clientDataJSON: opaque(value.clientDataJSON, 1, 131_072, 'client-data'),
    authenticatorData: opaque(value.authenticatorData, 1, 131_072, 'authenticator-data'),
    signature: opaque(value.signature, 1, 131_072, 'signature') })
}
