import type { GitHubTokenCustody, AuthTransport } from '../src/types/contracts.mjs'
export const unusedCustody: GitHubTokenCustody = {
  async beginGitHubTokenEnrollment() { throw new Error('unexpected custody') },
  async completeGitHubTokenEnrollment() { throw new Error('unexpected custody') },
}
export const unusedTransport: AuthTransport = {
  async send() { throw new Error('unexpected provider request') },
}
export const deviceWire = JSON.stringify({ device_code: 'd'.repeat(32), user_code: 'ABCD-EFGH',
  verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 })
