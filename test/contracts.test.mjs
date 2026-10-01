import assert from 'node:assert/strict'
import test from 'node:test'
import { completeGitHubDeviceAuthorization, githubAuthDeclaration,
  pollGitHubDeviceAuthorization,
  requestGitHubDeviceCode, selectGitHubAuthPlacement,
  validateGitHubAuthDeclaration } from '../src/index.mjs'

const declaration = githubAuthDeclaration()
const deviceWire = JSON.stringify({ device_code: 'd'.repeat(32), user_code: 'ABCD-EFGH',
  verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 })

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
  const requests = []
  const transport = { async send(request) {
    requests.push(request)
    return requests.length === 1 ? { status: 200, body: deviceWire }
      : { status: 200, body: JSON.stringify({ access_token: 't'.repeat(40),
        token_type: 'bearer', scope: 'read:org,repo workflow' }) }
  } }
  const attempt = await requestGitHubDeviceCode(declaration,
    { clientId: 'Iv23Public', nowUnixMs: 1_000 }, transport)
  let transferred
  const custody = { async beginGitHubTokenEnrollment(value) {
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
    } }, {})
  assert.equal(pending.status, 'pending')
  assert.equal(pending.nextPollUnixMs, 11_000)
  assert.equal(pending.attempt.nextPollUnixMs, 11_000)
  await assert.rejects(() => requestGitHubDeviceCode(declaration,
    { clientId: '../unsafe', nowUnixMs: 1 }, {}), /client-id-invalid/u)
})

test('deletion scope is explicit and unexpected scope elevation never enters custody', async () => {
  assert.equal(githubAuthDeclaration().scopes.includes('delete_repo'), false)
  const administration = githubAuthDeclaration({ allowRepositoryDeletion: true })
  assert.equal(validateGitHubAuthDeclaration(administration), true)
  const makeAttempt = declaration => requestGitHubDeviceCode(declaration,
    { clientId: 'Iv23Public', nowUnixMs: 1_000 }, {
      async send(request) {
        assert.equal(new URLSearchParams(request.body).get('scope'), declaration.scopes.join(' '))
        return { status: 200, body: deviceWire }
      }
    })
  let entered = 0
  const custody = { async beginGitHubTokenEnrollment() { entered++; throw new Error('unexpected custody') } }
  for (const [declaration, scope] of [[githubAuthDeclaration(), 'repo workflow read:org delete_repo'],
    [administration, 'repo workflow read:org']]) {
    const attempt = await makeAttempt(declaration)
    await assert.rejects(() => pollGitHubDeviceAuthorization(attempt,
      { nowUnixMs: 6_000 }, { async send() { return { status: 200, body: JSON.stringify({
        access_token: 't'.repeat(40), token_type: 'bearer', scope
      }) } } }, custody), /scope-invalid/u)
  }
  assert.equal(entered, 0)
})

test('carries cumulative slow-down and pending deadlines into subsequent polls', async () => {
  let attempt = await requestGitHubDeviceCode(declaration,
    { clientId: 'Iv23Public', nowUnixMs: 1_000 }, {
      async send() { return { status: 200, body: deviceWire } }
    })
  let calls = 0
  const responses = ['slow_down', 'slow_down', 'authorization_pending']
  const transport = { async send() {
    calls++
    return { status: 200, body: JSON.stringify({ error: responses.shift() }) }
  } }
  for (const [now, interval, next] of [
    [6_000, 10, 16_000], [16_000, 15, 31_000], [31_000, 15, 46_000]
  ]) {
    const result = await pollGitHubDeviceAuthorization(attempt,
      { nowUnixMs: now }, transport, {})
    assert.equal(result.attempt.intervalSeconds, interval)
    assert.equal(result.attempt.nextPollUnixMs, next)
    assert.equal(Object.isFrozen(result.attempt), true)
    attempt = result.attempt
    const count = calls
    await assert.rejects(() => pollGitHubDeviceAuthorization(attempt,
      { nowUnixMs: next - 1 }, transport, {}), /poll-early/u)
    assert.equal(calls, count)
  }
  const count = calls
  await assert.rejects(() => pollGitHubDeviceAuthorization(attempt,
    { nowUnixMs: attempt.expiresAtUnixMs }, transport, {}), /attempt-expired/u)
  assert.equal(calls, count)
})
