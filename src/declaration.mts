import type { GitHubAuthDeclaration, DeclarationOptions, Capability, PlacementResult } from './types/contracts.mjs'
import { freeze, invalid, isRecord, sameStrings, exactKeys } from './validation.mjs'

export const DECLARATION_SCHEMA = 'zixcel://github/oauth-device-declaration/v1'
export const TOOL_ID = 'zixcel-github-auth/oauth-device-flow'

/** Repository-deletion scope is opt-in; default declarations cannot elevate it. */
export function githubAuthDeclaration(options: DeclarationOptions = {}): GitHubAuthDeclaration {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => key !== 'allowRepositoryDeletion')
    || (options.allowRepositoryDeletion !== undefined && typeof options.allowRepositoryDeletion !== 'boolean')) invalid('options')
  const scopes: GitHubAuthDeclaration['scopes'] = options.allowRepositoryDeletion === true
    ? ['repo', 'workflow', 'read:org', 'delete_repo'] : ['repo', 'workflow', 'read:org']
  return freeze<GitHubAuthDeclaration>({ schema: DECLARATION_SCHEMA, providerId: 'github', toolId: TOOL_ID,
    method: 'oauth-device-flow', contextNamespace: 'github-connection',
    projectionSchema: 'hathq://hat-github-operator/connection/v1',
    secretPolicy: 'crowsi-custody-only', completionPolicy: 'verified-connection-only',
    scopes, publicInputs: [], placements: [
      { id: 'owner-local', kind: 'owner-local',
        requiredCapabilities: ['oauth-client-configuration', 'provider-network',
          'crowsi-token-custody'] }
    ] })
}

/** Only a complete local provider/custody capability set can be selected. */
export function selectGitHubAuthPlacement(declaration: GitHubAuthDeclaration, capabilities: Capability[]): PlacementResult {
  validateDeclaration(declaration)
  if (!Array.isArray(capabilities) || capabilities.length > 16
    || capabilities.some(value => !isRecord(value) || typeof value.id !== 'string'
      || typeof value.available !== 'boolean')) invalid('capabilities')
  if (new Set(capabilities.map(value => value?.id)).size !== capabilities.length) {
    invalid('capabilities')
  }
  const states = new Map(capabilities.map(value => [value?.id, value?.available === true]))
  const placements = declaration.placements.map(value => ({ ...value,
    available: value.requiredCapabilities.every(id => states.get(id) === true) }))
  return freeze({ placements,
    selectedPlacementId: placements.find(value => value.available)?.id ?? null })
}

export function validateGitHubAuthDeclaration(value: unknown): value is GitHubAuthDeclaration {
  try { validateDeclaration(value); return true } catch { return false }
}

/** Assert the exact runtime tuple, not its potentially ambiguous joined string. */
export function validateDeclaration(value: unknown): asserts value is GitHubAuthDeclaration {
  const exact = isRecord(value) && exactKeys(value, ['schema', 'providerId', 'toolId', 'method',
    'contextNamespace', 'projectionSchema', 'secretPolicy', 'completionPolicy', 'scopes',
    'publicInputs', 'placements']) && value.schema === DECLARATION_SCHEMA
    && value.providerId === 'github' && value.toolId === TOOL_ID
    && value.method === 'oauth-device-flow' && value.contextNamespace === 'github-connection'
    && value.projectionSchema === 'hathq://hat-github-operator/connection/v1'
    && value.secretPolicy === 'crowsi-custody-only'
    && value.completionPolicy === 'verified-connection-only'
    && Array.isArray(value.publicInputs) && value.publicInputs.length === 0
    && (sameStrings(value.scopes, ['repo', 'workflow', 'read:org']) || sameStrings(value.scopes, ['repo', 'workflow', 'read:org', 'delete_repo']))
    && Array.isArray(value.placements) && value.placements.length === 1
    && exactPlacement(value.placements[0])
  if (!exact) invalid('declaration')
}

function exactPlacement(value: unknown): boolean {
  return isRecord(value) && exactKeys(value, ['id', 'kind', 'requiredCapabilities'])
    && value.id === 'owner-local' && value.kind === 'owner-local'
    && sameStrings(value.requiredCapabilities,
      ['oauth-client-configuration', 'provider-network', 'crowsi-token-custody'])
}
