import { freeze, invalid } from './validation.mjs'

export const DECLARATION_SCHEMA = 'zixcel://github/oauth-device-declaration/v1'
export const TOOL_ID = 'zixcel-github-auth/oauth-device-flow'

export function githubAuthDeclaration(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => key !== 'allowRepositoryDeletion')
    || (options.allowRepositoryDeletion !== undefined && typeof options.allowRepositoryDeletion !== 'boolean')) invalid('options')
  const scopes = ['repo', 'workflow', 'read:org']
  if (options.allowRepositoryDeletion === true) scopes.push('delete_repo')
  return freeze({ schema: DECLARATION_SCHEMA, providerId: 'github', toolId: TOOL_ID,
    method: 'oauth-device-flow', contextNamespace: 'github-connection',
    projectionSchema: 'hathq://hat-github-operator/connection/v1',
    secretPolicy: 'crowsi-custody-only', completionPolicy: 'verified-connection-only',
    scopes, publicInputs: [], placements: [
      { id: 'owner-local', kind: 'owner-local',
        requiredCapabilities: ['oauth-client-configuration', 'provider-network',
          'crowsi-token-custody'] }
    ] })
}

export function selectGitHubAuthPlacement(declaration, capabilities) {
  validateDeclaration(declaration)
  if (!Array.isArray(capabilities) || capabilities.length > 16) invalid('capabilities')
  if (new Set(capabilities.map(value => value?.id)).size !== capabilities.length) {
    invalid('capabilities')
  }
  const states = new Map(capabilities.map(value => [value?.id, value?.available === true]))
  const placements = declaration.placements.map(value => ({ ...value,
    available: value.requiredCapabilities.every(id => states.get(id) === true) }))
  return freeze({ placements,
    selectedPlacementId: placements.find(value => value.available)?.id ?? null })
}

export function validateGitHubAuthDeclaration(value) {
  try { validateDeclaration(value); return true } catch { return false }
}

export function validateDeclaration(value) {
  const exact = value && exactKeys(value, ['schema', 'providerId', 'toolId', 'method',
    'contextNamespace', 'projectionSchema', 'secretPolicy', 'completionPolicy', 'scopes',
    'publicInputs', 'placements']) && value.schema === DECLARATION_SCHEMA
    && value.providerId === 'github' && value.toolId === TOOL_ID
    && value.method === 'oauth-device-flow' && value.contextNamespace === 'github-connection'
    && value.projectionSchema === 'hathq://hat-github-operator/connection/v1'
    && value.secretPolicy === 'crowsi-custody-only'
    && value.completionPolicy === 'verified-connection-only'
    && Array.isArray(value.publicInputs) && value.publicInputs.length === 0
    && Array.isArray(value.scopes) && ['repo workflow read:org', 'repo workflow read:org delete_repo'].includes(value.scopes.join(' '))
    && Array.isArray(value.placements) && value.placements.length === 1
    && exactPlacement(value.placements[0])
  if (!exact) invalid('declaration')
}

function exactPlacement(value) {
  return value && exactKeys(value, ['id', 'kind', 'requiredCapabilities'])
    && value.id === 'owner-local' && value.kind === 'owner-local'
    && Array.isArray(value.requiredCapabilities)
    && value.requiredCapabilities.join(' ') ===
      'oauth-client-configuration provider-network crowsi-token-custody'
}
function exactKeys(value, keys) {
  return Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
}
