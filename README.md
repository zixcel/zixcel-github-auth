# @zixcel/github-auth

Add GitHub Device Flow to an application using an explicit public client registration.

## What you can do

- Present the device authorization steps.
- Track polling, expiry and authorization results.

## Current scope

The application owns client registration, presentation and credential custody. This package does not retain a user token as repository content.

Package distribution is not activated by this documentation. Use the checked-in source and the declared dependency versions; published availability must be verified separately.

## Getting started

Use `pnpm@10.29.3` and the Node.js version declared in `engines` in `package.json`. Run from this repository:

```sh
pnpm install --frozen-lockfile
pnpm test
```

## Integration example

```js
import { githubAuthDeclaration, requestGitHubDeviceCode }
  from '@zixcel/github-auth'

const declaration = githubAuthDeclaration()
const attempt = await requestGitHubDeviceCode(declaration,
  { clientId: 'Iv23Public', nowUnixMs: Date.now() }, transport)
```

## Documentation and source

[Interface reference](docs/interface-reference.md)

[Usage guide](docs/getting-started.md)

[Schemas](schemas) · [Implementation and public interfaces](src) · [Verification cases](test) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [License](LICENSE) · [Attribution notices](NOTICE)
