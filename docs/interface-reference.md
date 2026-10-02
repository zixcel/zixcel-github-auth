# zixcel-github-auth interface reference

Use the [usage guide](getting-started.md) for the first steps. This reference preserves the current interface details and operational limits. Run command examples from the repository root, after preparing the exact declared dependencies and registered configuration.

## Continuing device authorization

When polling returns `status: 'pending'`, replace the previous attempt with
`result.attempt` and wait until `result.nextPollUnixMs` before polling again.
The updated attempt preserves the cumulative five-second increase for each
`slow_down` response. Attempts contain a device code: keep them local and do
not log, publish, or include them in public reports. Serialize polling for each
attempt; this stateless package cannot prevent reuse of an older attempt.
