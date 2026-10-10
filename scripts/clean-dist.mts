import { rm } from 'node:fs/promises';
// Clear only this package's generated output before compiling ESM and declarations.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
