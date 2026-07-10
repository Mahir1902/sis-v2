---
name: migrations-component-customRange-needs-schema
description: When using @convex-dev/migrations customRange with withIndex, pass schema to the Migrations constructor; dropping explicit DataModel generic
metadata:
  type: reference
---

When the `@convex-dev/migrations` component uses `customRange: (q) => q.withIndex(...)`, the `Migrations` client must be constructed with `{ schema }`. Without it, `customRange` throws at runtime: `Error: You must provide your schema to use a custom range.`

**Why:** The component uses the schema to resolve index types for the custom range query. Without it, only full-table scans work.

**How to apply:** In `convex/migrations.ts`:

```ts
import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import schema from "./schema";

// Do NOT pass an explicit <DataModel> generic together with schema — the
// schema generic supersedes and the two conflict (TS error TS2322:
// "is not assignable to type 'void'").
export const migrations = new Migrations(components.migrations, { schema });
```

`DataModel` is inferred from the schema generic. Passing `Migrations<DataModel>` AND `{ schema }` produces a type conflict because the second class generic infers the DataModel from the schema, leaving the first overload's `Schema` slot empty.
