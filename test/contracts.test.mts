import type { GitHubAuthDeclaration, GitHubTokenCustody, AuthTransport } from '../src/types/contracts.mjs'
import { unusedCustody, unusedTransport, deviceWire } from './fixtures.mts'
import assert from 'node:assert/strict'
import test from 'node:test'
import { completeGitHubDeviceAuthorization, githubAuthDeclaration,
  pollGitHubDeviceAuthorization,
  requestGitHubDeviceCode, selectGitHubAuthPlacement,
  validateGitHubAuthDeclaration } from '../dist/index.mjs'

const declaration = githubAuthDeclaration()
test('selects only a fully local provider and custody placement', () => {
  const unavailable = selectGitHubAuthPlacement(declaration,
    [{ id: 'provider-network', available: true }])
  assert.equal(unavailable.selectedPlacementId, null)
  const available = selectGitHubAuthPlacement(declaration, [
    { id: 'oauth-client-configuration', available: true },
    { id: 'provider-network', available: true },
    { id: 'crowsi-token-custody', available: true }
  ])
  assert.equal(available.selectedPlacementId, 'owner-local')
  assert.deepEqual(declaration.publicInputs, [])
  assert.equal(Object.isFrozen(declaration.placements[0].requiredCapabilities), true)
  assert.equal(validateGitHubAuthDeclaration({ ...declaration,
    placements: [{ id: 'owner-local', kind: 'owner-local', requiredCapabilities: [] }] }), false)
  assert.throws(() => selectGitHubAuthPlacement(declaration, [
    { id: 'provider-network', available: false },
    { id: 'provider-network', available: true }
  ]), /capabilities-invalid/u)
})

test('requires Crowsi user verification after the provider grants a token', async () => {
  const requests: Parameters<AuthTransport['send']>[0][] = []
  const transport: AuthTransport = { async send(request) {
    requests.push(request)
    return requests.length === 1 ? { status: 200, body: deviceWire }
      : { status: 200, body: JSON.stringify({ access_token: 't'.repeat(40),
        token_type: 'bearer', scope: 'read:org,repo workflow' }) }
  } }
  const attempt = await requestGitHubDeviceCode(declaration,
    { clientId: 'Iv23Public', nowUnixMs: 1_000 }, transport)
  let transferred: Parameters<GitHubTokenCustody['beginGitHubTokenEnrollment']>[0] | undefined
  const custody: GitHubTokenCustody = { async beginGitHubTokenEnrollment(value) {
    transferred = value
    return { authorizationRef: 'authorization:github:one',
      challenge: 'c'.repeat(43), rpId: 'localhost',
      origin: 'http://localhost:4213', credentialId: 'k'.repeat(22),
      timeout: 180_000, expiresAtUnixMs: 186_000 }
  }, async completeGitHubTokenEnrollment(value) {
    assert.equal(value.authorizationRef, 'authorization:github:one')
    assert.equal(value.assertion.credentialId, 'k'.repeat(22))
    return { connectionRef: 'connection:github:owner' }
  } }
  const result = await pollGitHubDeviceAuthorization(attempt,
    { nowUnixMs: 6_000 }, transport, custody)
  assert.equal(result.status, 'user-verification-required')
  if (result.status !== 'user-verification-required') throw new Error('unexpected result')
  assert.ok(transferred)
  assert.equal(result.authorization.authorizationRef, 'authorization:github:one')
  assert.equal(transferred.accessToken, 't'.repeat(40))
  assert.doesNotMatch(JSON.stringify(result), /tttt/u)
  const completed = await completeGitHubDeviceAuthorization(result.authorization,
    { credentialId: 'k'.repeat(22), clientDataJSON: 'a'.repeat(8),
      authenticatorData: 'b'.repeat(8), signature: 's'.repeat(8) }, custody)
  assert.deepEqual(completed,
    { status: 'connected', connectionRef: 'connection:github:owner' })
  assert.equal(new URL(requests[0].url).host, 'github.com')
})

test('keeps pending responses bounded and rejects provider substitution', async () => {
  const attempt = await requestGitHubDeviceCode(declaration,
    { clientId: 'Iv23Public', nowUnixMs: 1_000 }, {
      async send() { return { status: 200, body: deviceWire } }
    })
  const pending = await pollGitHubDeviceAuthorization(attempt,
    { nowUnixMs: 6_000 }, { async send(request) {
      assert.equal(request.url, 'https://github.com/login/oauth/access_token')
      return { status: 200, body: JSON.stringify({ error: 'authorization_pending' }) }
    } }, unusedCustody)
  assert.equal(pending.status, 'pending')
  if (pending.status !== 'pending') throw new Error('unexpected completion')
  assert.equal(pending.nextPollUnixMs, 11_000)
  assert.equal(pending.attempt.nextPollUnixMs, 11_000)
  await assert.rejects(() => requestGitHubDeviceCode(declaration,
    { clientId: '../unsafe', nowUnixMs: 1 }, unusedTransport), /client-id-invalid/u)
})
