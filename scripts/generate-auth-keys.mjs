/**
 * Generates RS256 key pair for @convex-dev/auth.
 * Run once, then copy the printed commands into your terminal.
 *
 * Usage: node scripts/generate-auth-keys.mjs
 */

import { generateKeyPair, exportPKCS8, exportJWK } from "jose";

const { privateKey, publicKey } = await generateKeyPair("RS256");

const privatePem = await exportPKCS8(privateKey);
const publicJwk = await exportJWK(publicKey);

const jwks = JSON.stringify({ keys: [{ ...publicJwk, use: "sig", alg: "RS256" }] });
const privateKeyOneLine = privatePem.replace(/\n/g, "\\n");

console.log("\n✅ Auth keys generated. Run the following commands:\n");
console.log(`npx convex env set JWT_PRIVATE_KEY '${privateKeyOneLine}'`);
console.log(`\nnpx convex env set JWKS '${jwks}'`);
console.log("\nThen restart your Convex dev server.\n");
