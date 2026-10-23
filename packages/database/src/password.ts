import { hash, verify } from '@node-rs/argon2';

import type { Options } from '@node-rs/argon2';

// Binding value 2 is Argon2id; the ambient const enum cannot be imported in ESM.
const options = { algorithm: 2, memoryCost: 19_456, parallelism: 1, timeCost: 2 } satisfies Options;

export const hashPassword = (password: string) => hash(password, options);
export const verifyPassword = (encoded: string, password: string) => verify(encoded, password);
