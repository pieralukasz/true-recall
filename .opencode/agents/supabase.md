---
description: "Supabase management for True Recall. Covers Edge Functions, database migrations, RLS policies, auth integration, and MCP tool usage. Use when working with Supabase tables, Edge Functions, RLS policies, auth, or any Supabase infrastructure."
mode: subagent
---

# Supabase Management for True Recall

## Project Context

- **Supabase Project:** `webogcxwvgbwdcjibbno`
- **Project URL:** `https://webogcxwvgbwdcjibbno.supabase.co`
- **Region:** EU (used with Supabase MCP tools)

### Current Schema (public)

| Table | RLS | Purpose |
|-------|-----|---------|
| `user_subscriptions` | Yes | Pro subscription status, LiteLLM keys, Polar integration |
| `auth_codes` | Yes | Device auth flow for plugin login |
| `waitlist_entries` | No | Beta waitlist (legacy) |

### Current Edge Functions

| Function | JWT Required | Purpose |
|----------|-------------|---------|
| `get-subscription-status` | Yes | Returns plan/status/litellmKey for authenticated user |
| `polar-webhook` | No | Handles Polar.sh subscription lifecycle events (signature-verified) |
| `admin-create-user` | No | Admin-only user + subscription creation (ADMIN_SECRET auth) |

### Environment Variables (Edge Functions)

Available automatically:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`

Must be set in Dashboard (Settings > Edge Functions > Secrets):
- `LITELLM_URL` - LiteLLM proxy URL (e.g., `https://ai.truerecall.app`)
- `LITELLM_MASTER_KEY` - LiteLLM admin key
- `LITELLM_TEAM_ID` - LiteLLM team ID for Pro users
- `POLAR_WEBHOOK_SECRET` - Polar.sh webhook signing secret (format: `whsec_...`)
- `ADMIN_SECRET` - Secret for admin-create-user endpoint

---

## MCP Tools Reference

All Supabase operations use MCP tools (prefixed `mcp__supabase__`). Never use raw SQL via Bash.

### Schema & Tables

```
mcp__supabase__list_tables        # List tables (schemas, verbose for columns)
mcp__supabase__apply_migration    # DDL changes (CREATE TABLE, ALTER, etc.)
mcp__supabase__execute_sql        # DML queries (SELECT, INSERT, UPDATE)
mcp__supabase__list_migrations    # List applied migrations
mcp__supabase__list_extensions    # List Postgres extensions
```

**Rules:**
- Use `apply_migration` for ALL DDL (schema changes). Name in `snake_case`.
- Use `execute_sql` for queries/DML only.
- Always check `list_tables` before creating to avoid duplicates.
- Run `get_advisors` after DDL changes to catch security issues.

### Edge Functions

```
mcp__supabase__deploy_edge_function   # Deploy or update a function
mcp__supabase__list_edge_functions    # List all functions
mcp__supabase__get_edge_function      # Get function source code
```

**Deployment params:**
```typescript
{
  name: "function-name",
  entrypoint_path: "index.ts",    // Always "index.ts"
  verify_jwt: true,               // Default true; false only for webhooks/admin
  files: [{ name: "index.ts", content: "..." }]
}
```

### Security & Monitoring

```
mcp__supabase__get_advisors       # Security/performance lints (run after DDL!)
mcp__supabase__get_logs           # Logs by service (api, edge-function, postgres, auth)
mcp__supabase__get_project_url    # Get project API URL
mcp__supabase__get_publishable_keys  # Get anon/publishable keys
```

### Branches (Development)

```
mcp__supabase__create_branch      # Create dev branch (fresh DB from migrations)
mcp__supabase__list_branches      # List branches + status
mcp__supabase__merge_branch       # Merge branch to production
mcp__supabase__rebase_branch      # Sync branch with production
mcp__supabase__reset_branch       # Reset branch migrations
mcp__supabase__delete_branch      # Delete branch
```

### TypeScript Types

```
mcp__supabase__generate_typescript_types  # Generate types from schema
```

### Documentation

```
mcp__supabase__search_docs        # GraphQL search of Supabase docs
```

Example query:
```graphql
{ searchDocs(query: "edge functions auth", limit: 3) { nodes { title href content } } }
```

---

## Edge Function Patterns

### Authenticated Endpoint (user-facing)

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Client with user's auth context (respects RLS)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token!);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Queries here respect RLS (user can only see their own rows)
  const { data } = await supabase.from("table").select("*");

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

### Admin/Service Role Endpoint (bypasses RLS)

```typescript
// Service role client — bypasses RLS, use for admin operations
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);
```

**Rules:**
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the browser
- Only use service role in Edge Functions for admin operations
- Set `verify_jwt: false` only when function implements its own auth (webhooks, admin secret)

### Webhook Endpoint (external caller)

```typescript
// verify_jwt: false — webhook authenticates via signature
Deno.serve(async (req: Request) => {
  // Verify signature from external service
  const signature = req.headers.get("webhook-signature");
  if (!verifySignature(await req.text(), signature)) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Use service role client for DB operations
  // ...
});
```

---

## RLS Patterns

### Basic user-owns-row

```sql
-- User can only read their own rows
CREATE POLICY "users_read_own" ON my_table
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- User can insert rows for themselves
CREATE POLICY "users_insert_own" ON my_table
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- User can update their own rows
CREATE POLICY "users_update_own" ON my_table
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

### Performance Tips

1. **Always wrap auth functions in `(select ...)`** for caching:
   ```sql
   -- Good: cached per-statement
   USING ((select auth.uid()) = user_id)
   -- Bad: called per-row
   USING (auth.uid() = user_id)
   ```

2. **Always specify role with `TO`**:
   ```sql
   -- Good: skips evaluation for anon
   TO authenticated USING (...)
   -- Bad: evaluates for all roles
   USING (...)
   ```

3. **Add indexes on RLS columns** (if not primary key):
   ```sql
   CREATE INDEX idx_my_table_user_id ON my_table USING btree (user_id);
   ```

4. **Always add explicit filters in queries** even if RLS handles it:
   ```typescript
   // Good: Postgres can optimize the query plan
   supabase.from("table").select("*").eq("user_id", userId)
   // Bad: relies entirely on RLS implicit WHERE
   supabase.from("table").select("*")
   ```

---

## Migration Patterns

### Creating Tables

```sql
-- Always include: PK, timestamps, RLS
CREATE TABLE public.my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- ... columns ...
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON public.my_table
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
```

### Auto-update `updated_at`

```sql
-- Function with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_my_table_timestamp
  BEFORE UPDATE ON public.my_table
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### Naming Conventions

- Migration names: `snake_case` (e.g., `create_user_subscriptions`, `add_sync_grace_end`)
- Table names: `snake_case`, plural (e.g., `user_subscriptions`, `auth_codes`)
- Column names: `snake_case` (e.g., `user_id`, `created_at`)
- Policy names: descriptive, quoted (e.g., `"users_read_own"`)

---

## Security Checklist

Run after every DDL change:

```
mcp__supabase__get_advisors  type: "security"
```

Common issues and fixes:

| Advisory | Fix |
|----------|-----|
| `rls_disabled_in_public` | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` |
| `rls_enabled_no_policy` | Add at least one RLS policy |
| `function_search_path_mutable` | Add `SET search_path = ''` to function |
| `auth_leaked_password_protection` | Enable in Dashboard > Auth > Settings |

---

## Calling Edge Functions from Plugin

```typescript
// In Obsidian plugin (uses Supabase JS client)
const { data, error } = await supabaseClient.functions.invoke("get-subscription-status", {
  headers: { Authorization: `Bearer ${session.access_token}` },
});
```

Or with `requestUrl` (Obsidian's fetch):
```typescript
const response = await requestUrl({
  url: `${SUPABASE_URL}/functions/v1/get-subscription-status`,
  method: "GET",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_ANON_KEY,
  },
});
```

---

## Debugging

### View Edge Function Logs

```
mcp__supabase__get_logs  service: "edge-function"
```

### View Auth Logs

```
mcp__supabase__get_logs  service: "auth"
```

### View Postgres Logs

```
mcp__supabase__get_logs  service: "postgres"
```

### Test RLS Policies

```sql
-- Simulate authenticated user
SET request.jwt.claims = '{"sub": "user-uuid", "role": "authenticated"}';
SELECT * FROM user_subscriptions;
RESET request.jwt.claims;
```

---

## Common Gotchas

1. **Service role client replaces auth context**: If you call `signUp()` or other auth methods on a service role client, the returned session will override the service role. Use separate clients for admin ops and auth ops.

2. **Edge Function cold starts**: First invocation after idle period takes ~200-500ms. Subsequent calls are fast.

3. **CORS in Edge Functions**: Always handle OPTIONS preflight and include `corsHeaders` in all responses.

4. **`maybeSingle()` vs `single()`**: Use `maybeSingle()` when the row might not exist (returns null). Use `single()` only when exactly one row is expected (throws on 0 or 2+ rows).

5. **Webhook JWT verification**: Set `verify_jwt: false` for webhook endpoints but implement your own signature verification. Never leave endpoints unprotected.

6. **Migration idempotency**: Use `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` to make migrations safe to re-run.
