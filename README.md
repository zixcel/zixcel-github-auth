# @zixcel/github-auth

Provider-specific GitHub OAuth Device Flow plans separated from product UI, HTTP transport and credential custody. Users do not create an app; the distributor registers a public client ID once and enables Device Flow.

- Communicate only through injected transport; never open a browser.
- Require no client secret, app private key or callback server.
- Pass access tokens directly to the injected custody port, never to result objects.
- Crowsi Credential Agent issues and stores `connection_ref`.
- Callers own application-specific concepts and orchestration.
- Consumers measure declared placement instead of assuming availability.
- Start only when provider networking and Crowsi custody are available in the same local placement.

```js
import { githubAuthDeclaration, requestGitHubDeviceCode }
  from '@zixcel/github-auth'

const declaration = githubAuthDeclaration()
const attempt = await requestGitHubDeviceCode(declaration,
  { clientId: 'Iv23Public', nowUnixMs: Date.now() }, transport)
```

Request `delete_repo` only with `githubAuthDeclaration({ allowRepositoryDeletion: true })`. Requested scopes are bound to the attempt; unexpected additions and missing scopes are rejected before custody transfer. The default classic OAuth `repo` scope includes provider-side writes. Configure local read-only limits in `zixcel-github`; use a GitHub App or fine-grained token enrolled in Crowsi when provider-side least privilege is required. Deletion scope does not grant organization administration rights.

## License

Apache-2.0; see LICENSE and NOTICE. Earlier MIT attribution remains in LICENSE-MIT. Prior permissions and third-party terms remain effective. Private registration, credentials and runtime state are excluded. Generated `.tgz` archives are neither source-controlled nor included in package contents.

## Package integration

The package is an independently consumable unit. Callers reference its documented
interface through a versioned dependency and own application-specific composition
and integration.
