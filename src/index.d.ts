export interface GitHubAuthDeclaration {
  schema: 'zixcel://github/oauth-device-declaration/v1'
  providerId: 'github'
  toolId: 'zixcel-github-auth/oauth-device-flow'
  method: 'oauth-device-flow'
  contextNamespace: 'github-connection'
  projectionSchema: 'hathq://hat-github-operator/connection/v1'
  secretPolicy: 'crowsi-custody-only'
  completionPolicy: 'verified-connection-only'
  scopes: ['repo', 'workflow', 'read:org'] | ['repo', 'workflow', 'read:org', 'delete_repo']
  publicInputs: []
  placements: [{ id: 'owner-local', kind: 'owner-local',
    requiredCapabilities: ['oauth-client-configuration', 'provider-network',
      'crowsi-token-custody'] }]
}
export interface GitHubDeviceAttempt {
  schema: 'zixcel://github/oauth-device-attempt/v1'
  providerId: 'github'
  toolId: 'zixcel-github-auth/oauth-device-flow'
  clientId: string
  requestedScopes: GitHubAuthDeclaration['scopes']
  deviceCode: string
  userCode: string
  verificationUri: 'https://github.com/login/device'
  expiresAtUnixMs: number
  nextPollUnixMs: number
  intervalSeconds: number
}
export interface AuthTransport {
  send(request: { method: 'POST', url: string, headers: Record<string, string>,
    body: string, maximumResponseBytes: number }): Promise<{ status: number, body: string }>
}
export interface GitHubTokenCustody {
  beginGitHubTokenEnrollment(value: { accessToken: string, scopes: string[],
    tokenType: 'bearer' }): Promise<GitHubPasskeyAuthorization>
  completeGitHubTokenEnrollment(value: { authorizationRef: string,
    assertion: GitHubPasskeyAssertion }): Promise<{ connectionRef: string }>
}
export interface GitHubPasskeyAuthorization {
  authorizationRef: string
  challenge: string
  rpId: 'localhost'
  origin: `http://localhost:${number}`
  credentialId: string
  timeout: number
  expiresAtUnixMs: number
}
export interface GitHubPasskeyAssertion {
  credentialId: string
  clientDataJSON: string
  authenticatorData: string
  signature: string
}
export function githubAuthDeclaration(options?: { allowRepositoryDeletion?: boolean }): GitHubAuthDeclaration
export function validateGitHubAuthDeclaration(value: unknown): boolean
export function selectGitHubAuthPlacement(declaration: GitHubAuthDeclaration,
  capabilities: Array<{ id: string, available: boolean }>): {
    placements: Array<GitHubAuthDeclaration['placements'][number] & { available: boolean }>,
    selectedPlacementId: string | null
  }
export function requestGitHubDeviceCode(declaration: GitHubAuthDeclaration,
  input: { clientId: string, nowUnixMs: number },
  transport: AuthTransport): Promise<GitHubDeviceAttempt>
export function acceptGitHubDeviceCodeResponse(declaration: GitHubAuthDeclaration,
  input: { clientId: string, nowUnixMs: number,
    response: { status: number, body: string } }): GitHubDeviceAttempt
export function pollGitHubDeviceAuthorization(attempt: GitHubDeviceAttempt,
  input: { nowUnixMs: number }, transport: AuthTransport,
  custody: GitHubTokenCustody): Promise<{ status: 'pending', nextPollUnixMs: number,
      attempt: GitHubDeviceAttempt }
    | { status: 'user-verification-required', authorization: GitHubPasskeyAuthorization }>
export function completeGitHubDeviceAuthorization(
  authorization: GitHubPasskeyAuthorization, assertion: GitHubPasskeyAssertion,
  custody: GitHubTokenCustody
): Promise<{ status: 'connected', connectionRef: string }>
export const DECLARATION_SCHEMA: string
export const ATTEMPT_SCHEMA: string
export const TOOL_ID: string
