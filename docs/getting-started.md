# Using @zixcel/github-auth

Add GitHub Device Flow to an application using an explicit public client registration.

## Before you start

The application owns client registration, presentation and credential custody. This package does not retain a user token as repository content.

## First steps

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test
```

## How to assess the result

- Present the device authorization steps.
- Track polling, expiry and authorization results.

A passing source-level check establishes only what that check observes. Keep missing configuration, unavailable services and unverified deployment paths visible.

## Continue reading

[Repository overview](../README.md)
