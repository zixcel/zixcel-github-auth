import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptGitHubDeviceCodeResponse, githubAuthDeclaration,
  selectGitHubAuthPlacement, validateGitHubAuthDeclaration } from '../dist/index.mjs'
import { deviceWire } from './fixtures.mts'
const declaration = githubAuthDeclaration()

test('scope and capability tuples cannot be replaced by space-joined single elements', () => {
  assert.equal(validateGitHubAuthDeclaration({ ...declaration, scopes: ['repo workflow read:org'] }), false)
  assert.equal(validateGitHubAuthDeclaration({ ...declaration, placements: [{ ...declaration.placements[0],
    requiredCapabilities: ['oauth-client-configuration provider-network crowsi-token-custody'] }] }), false)
  assert.equal(validateGitHubAuthDeclaration({ ...declaration, scopes: ['repo', 'workflow', 'read:org', 1] }), false)
  // @ts-expect-error Runtime callers can send malformed capability availability.
  assert.throws(() => selectGitHubAuthPlacement(declaration, [{ id: 'provider-network', available: 1 }]), /capabilities-invalid/u)
})

test('provider JSON must be an object and stay within the UTF-8 byte budget', () => {
  for (const body of ['null', '[]', 'true', '{', deviceWire.slice(0, -1) + ',"padding":"' + '\u3042'.repeat(6000) + '"}']) {
    assert.throws(() => acceptGitHubDeviceCodeResponse(declaration, {
      clientId: 'Iv23Public', nowUnixMs: 1_000, response: { status: 200, body },
    }), /device-code-invalid/u)
  }
})
