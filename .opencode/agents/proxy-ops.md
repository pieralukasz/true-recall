---
description: "Deploy the True Recall proxy to ZimaBlade, check logs/analytics, and verify status. Use when the user says 'deploy proxy', 'proxy logs', 'proxy status', 'check proxy', or 'proxy analytics'."
mode: subagent
---

# Proxy Operations

Manage the True Recall LiteLLM proxy running on ZimaBlade.

## Prerequisites

**Always start by verifying SSH connectivity:**

```bash
ssh -o ConnectTimeout=5 zimablade echo ok
```

If this fails, tell the user immediately. Do not retry in a loop or search local files.

## Actions

Ask the user which action they want, or infer from context:

### Deploy

Deploy local proxy changes to ZimaBlade. The proxy on ZimaBlade is **NOT a git repo** — files are copied manually via scp.

1. **Check what changed:**
   ```bash
   cd /Users/lukaszpiera/Projects/true-recall-proxy && git diff --name-only
   ```

2. **Copy changed files:**
   ```bash
   scp Dockerfile custom_callbacks.py init.sql litellm_config.yaml analytics.sql logs.sh \
     zimablade:/home/lucas/docker/true-recall-proxy/
   ```
   Only scp files that actually changed. Key deployable files:
   - `Dockerfile` — container build
   - `custom_callbacks.py` — LiteLLM callbacks
   - `init.sql` — database init
   - `litellm_config.yaml` — proxy configuration
   - `analytics.sql` — analytics views
   - `logs.sh` — log query script
   - `scripts/*` — management scripts

3. **Rebuild and restart:**
   ```bash
   ssh zimablade "cd /home/lucas/docker/true-recall-proxy && docker compose build proxy && docker compose up -d proxy"
   ```

4. **Verify health** (wait ~60s for container to become healthy):
   ```bash
   ssh zimablade "docker ps --filter name=true-recall-proxy-proxy-1 --format '{{.Status}}'"
   ```
   Should show: `Up X seconds (healthy)`

5. **Check for errors:**
   ```bash
   ssh zimablade "docker logs true-recall-proxy-proxy-1 --tail 20 --since 2m"
   ```

### Logs

View proxy analytics. Commands map to `logs.sh` on ZimaBlade:

| Command | What it shows |
|---------|--------------|
| `activity` | Last 30 requests (default) |
| `daily` | Daily per-user summary |
| `users` | All-time user stats |
| `live` | Last 5 minutes |

```bash
ssh zimablade "bash /home/lucas/docker/true-recall-proxy/logs.sh <command>"
```

### Status

Check proxy health and container state:

```bash
ssh zimablade "docker ps --filter name=true-recall-proxy --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

Check recent errors:
```bash
ssh zimablade "docker logs true-recall-proxy-proxy-1 --tail 30 2>&1 | grep -i -E 'error|exception|traceback|fail'"
```

### Restart

Restart without rebuilding:

```bash
ssh zimablade "cd /home/lucas/docker/true-recall-proxy && docker compose restart proxy"
```

## Remote Paths

- Proxy directory: `/home/lucas/docker/true-recall-proxy/`
- Docker compose: `docker compose` (in that directory)
- Container name: `true-recall-proxy-proxy-1`
- DB container: `true-recall-proxy-db-1`
- Cloudflare tunnel: `true-recall-proxy-cloudflared-1`
- User: `lucas`, SSH alias: `zimablade`
