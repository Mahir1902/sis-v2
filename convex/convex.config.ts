/**
 * Convex app configuration.
 *
 * Registers Convex components used by this deployment. Each `app.use(...)`
 * call installs a component and exposes its API under `components.<name>` in
 * generated code.
 *
 * Currently installed:
 *   - `@convex-dev/migrations` — batched, resumable data migrations. Used by
 *     `convex/migrations.ts` to backfill new schema fields and rename invoice
 *     status values during the widen-migrate-narrow rollout.
 */

import migrations from "@convex-dev/migrations/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(migrations);
export default app;
