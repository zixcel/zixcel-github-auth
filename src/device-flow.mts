import type { GitHubAuthDeclaration, GitHubDeviceAttempt, DeviceCodeInput, AcceptedDeviceInput, PollInput, AuthTransport, GitHubTokenCustody, GitHubPasskeyAuthorization, GitHubPasskeyAssertion, PendingResult, PollResult, ConnectedResult } from './types/contracts.mjs'
import { validateAuthorization, validateAssertion } from './authorization.mjs'
import { send, form, accepted, exactScopes, exactVerificationUri, validateAttempt } from './wire.mjs'
import { TOOL_ID, validateDeclaration } from './declaration.mjs'
import { bounded, freeze, identifier, integer, invalid, opaque } from './validation.mjs'

export const ATTEMPT_SCHEMA = 'zixcel://github/oauth-device-attempt/v1'
const deviceUrl = 'https://github.com/login/device/code'
const tokenUrl = 'https://github.com/login/oauth/access_token'

/** Request one bounded provider challenge; this module has no ambient network client. */
export async function requestGitHubDeviceCode(declaration: GitHubAuthDeclaration, input: DeviceCodeInput, transport: AuthTransport): Promise<GitHubDeviceAttempt> {
  validateDeclaration(declaration)
  const clientId = identifier(input?.clientId, 128, 'client-id')
  const nowUnixMs = integer(input?.nowUnixMs, 0, 'time')
  const response = await send(transport, deviceUrl, form({ client_id: clientId,
    scope: declaration.scopes.join(' ') }))
  return acceptGitHubDeviceCodeResponse(declaration, { clientId, nowUnixMs, response })
}

export function acceptGitHubDeviceCodeResponse(declaration: GitHubAuthDeclaration, input: AcceptedDeviceInput): GitHubDeviceAttempt {
  validateDeclaration(declaration)
  const clientId = identifier(input?.clientId, 128, 'client-id')
  const now = integer(input?.nowUnixMs, 0, 'time')
  const wire = accepted(input?.response, 'device-code')
  const expiresIn = integer(wire.expires_in, 60, 'expires-in')
  const interval = integer(wire.interval ?? 5, 1, 'interval')
  if (expiresIn > 900 || interval > 60) invalid('provider-bounds')
  const verificationUri = exactVerificationUri(wire.verification_uri)
  return freeze<GitHubDeviceAttempt>({ schema: ATTEMPT_SCHEMA, providerId: 'github', toolId: TOOL_ID,
    clientId, requestedScopes: [...declaration.scopes], deviceCode: opaque(wire.device_code, 16, 512, 'device-code'),
    userCode: bounded(wire.user_code, 4, 32, 'user-code'), verificationUri,
    expiresAtUnixMs: now + expiresIn * 1000,
    nextPollUnixMs: now + interval * 1000, intervalSeconds: interval })
}

/** Carry polling deadlines forward and transfer accepted tokens directly into custody. */
export async function pollGitHubDeviceAuthorization(attempt: GitHubDeviceAttempt, input: PollInput, transport: AuthTransport, custody: GitHubTokenCustody): Promise<PollResult> {
  validateAttempt(attempt)
  const now = integer(input?.nowUnixMs, 0, 'time')
  if (now >= attempt.expiresAtUnixMs) invalid('attempt-expired')
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
  return freeze<PollResult>({ status: 'user-verification-required', authorization })
}

/** Only the custody verification receipt establishes a connected public projection. */
export async function completeGitHubDeviceAuthorization(
  authorization: GitHubPasskeyAuthorization, assertion: GitHubPasskeyAssertion, custody: GitHubTokenCustody
): Promise<ConnectedResult> {
  const verified = validateAuthorization(authorization)
  const proof = validateAssertion(assertion)
  if (typeof custody?.completeGitHubTokenEnrollment !== 'function') invalid('custody')
  const receipt = await custody.completeGitHubTokenEnrollment({
    authorizationRef: verified.authorizationRef, assertion: proof
  })
  return freeze<ConnectedResult>({ status: 'connected', connectionRef:
    bounded(receipt?.connectionRef, 1, 256, 'connection-ref') })
}

function pending(attempt: GitHubDeviceAttempt, wire: Record<string, unknown>, now: number): PendingResult {
  if (wire.error === 'authorization_pending' || wire.error === 'slow_down') {
    const intervalSeconds = attempt.intervalSeconds + (wire.error === 'slow_down' ? 5 : 0)
    const nextPollUnixMs = now + intervalSeconds * 1000
    return freeze<PendingResult>({ status: 'pending', nextPollUnixMs,
      attempt: { ...attempt, intervalSeconds, nextPollUnixMs } })
  }
  if (typeof wire.error === 'string' && ['access_denied', 'expired_token', 'incorrect_device_code'].includes(wire.error)) {
    invalid(wire.error)
  }
  invalid('provider-response')
}
