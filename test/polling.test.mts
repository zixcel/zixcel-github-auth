import type { GitHubAuthDeclaration, GitHubTokenCustody, AuthTransport } from '../src/types/contracts.mjs'
import { unusedCustody, unusedTransport, deviceWire } from './fixtures.mts'
import assert from 'node:assert/strict'
import test from 'node:test'
import { completeGitHubDeviceAuthorization, githubAuthDeclaration,
  pollGitHubDeviceAuthorization,
  requestGitHubDeviceCode, selectGitHubAuthPlacement,
  validateGitHubAuthDeclaration } from '../dist/index.mjs'

const declaration = githubAuthDeclaration()
test('deletion scope is explicit and unexpected scope elevation never enters custody', async () => {
  assert.equal(Array.from<string>(githubAuthDeclaration().scopes).includes('delete_repo'), false)
  const administration = githubAuthDeclaration({ allowRepositoryDeletion: true })
  assert.equal(validateGitHubAuthDeclaration(administration), true)
  const makeAttempt = (declaration: GitHubAuthDeclaration) => requestGitHubDeviceCode(declaration,
    { clientId: 'Iv23Public', nowUnixMs: 1_000 }, {
      async send(request) {
        assert.equal(new URLSearchParams(request.body).get('scope'), declaration.scopes.join(' '))
        return { status: 200, body: deviceWire }
      }
    })
  let entered = 0
  const custody: GitHubTokenCustody = { ...unusedCustody, async beginGitHubTokenEnrollment() { entered++; throw new Error('unexpected custody') } }
  const cases: Array<[GitHubAuthDeclaration, string]> = [[githubAuthDeclaration(), 'repo workflow read:org delete_repo'],
    [administration, 'repo workflow read:org']]
  for (const [declaration, scope] of cases) {
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
  const transport: AuthTransport = { async send() {
    calls++
    return { status: 200, body: JSON.stringify({ error: responses.shift() }) }
  } }
  for (const [now, interval, next] of [
    [6_000, 10, 16_000], [16_000, 15, 31_000], [31_000, 15, 46_000]
  ]) {
    const result = await pollGitHubDeviceAuthorization(attempt,
      { nowUnixMs: now }, transport, unusedCustody)
    if (result.status !== 'pending') throw new Error('unexpected completion')
    assert.equal(result.attempt.intervalSeconds, interval)
    assert.equal(result.attempt.nextPollUnixMs, next)
    assert.equal(Object.isFrozen(result.attempt), true)
    attempt = result.attempt
    const count = calls
    await assert.rejects(() => pollGitHubDeviceAuthorization(attempt,
      { nowUnixMs: next - 1 }, transport, unusedCustody), /poll-early/u)
    assert.equal(calls, count)
  }
  const count = calls
  await assert.rejects(() => pollGitHubDeviceAuthorization(attempt,
    { nowUnixMs: attempt.expiresAtUnixMs }, transport, unusedCustody), /attempt-expired/u)
  assert.equal(calls, count)
})
