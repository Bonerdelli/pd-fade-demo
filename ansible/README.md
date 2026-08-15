# pd-fade Ansible provisioning

Bare-metal provisioning for a demo or small production VM: **Node.js 20 + pnpm 10 (corepack)**, **systemd** for the Fastify server, **nginx** for the built client SPA and `/api` reverse proxy with SSE-friendly settings. No Docker on the target host.

## Requirements

- Ansible 2.15+ on the control machine
- Debian or Ubuntu on the target host
- SSH access as root (or a user with sudo)
- DNS `A` record for `root_domain` when TLS is enabled

```bash
cd ansible
pip install ansible          # or your preferred venv / package manager
ansible-galaxy install -r requirements.yml
```

Collections install into `ansible/.collections` (see `ansible.cfg`).

## Inventory

1. Copy or edit `environments/demo/inventory.yml` — set `ansible_host`, `ansible_user`, and SSH key if needed.
2. Edit `environments/demo/group_vars/all/vars.yml` — at minimum `pd_fade_repo_url`, `root_domain`, and `pd_fade_agent_driver`.
3. Secrets: copy `vault.yml.example` to `vault.yml`, set `vault_anthropic_api_key` when using `pd_fade_agent_driver: anthropic`, then encrypt:

```bash
ansible-vault encrypt environments/demo/group_vars/all/vault.yml
```

Optional: create `ansible/.vault_pass` (mode `600`) and pass `--vault-password-file .vault_pass` instead of `--ask-vault-pass`.

## First provision

From the `ansible/` directory:

```bash
ansible-playbook environments/demo/provision.yml --ask-vault-pass
```

This runs all roles: base packages and app user, Node.js + pnpm, application build and systemd unit, nginx (+ optional Let's Encrypt).

## Redeploy application only

After the host is provisioned, redeploy code without touching nginx or Node:

```bash
ansible-playbook environments/demo/provision.yml --tags pd_fade --ask-vault-pass
```

Tags: `base`, `nodejs`, `pd_fade`, `nginx`.

## What gets installed

| Component | Location / notes |
|-----------|------------------|
| App checkout | `pd_fade_root` (default `/opt/pd-fade`) |
| SQLite data | `pd_fade_data_dir` (default `/var/lib/pd-fade`) — **not** removed on redeploy |
| Environment | `pd_fade_env_file` (default `/etc/pd-fade/env`) — `PORT`, `DB_PATH`, `AGENT_DRIVER`, etc. |
| systemd unit | `pd-fade.service` — `Restart=on-failure`, runs `node dist/index.js` from `server/` |
| Static client | nginx serves `client/dist` |
| API | nginx proxies `/api/*` → server port, strips `/api` prefix (matches Vite dev proxy) |

### Node.js and pnpm

Node.js **20.x** is installed from the NodeSource APT repository. **pnpm 10** is activated via **corepack** (`corepack prepare pnpm@<version> --activate`). This matches the repo requirement of Node 20+ and pnpm 10+ without a separate install script.

### Environment variables

The server `start` script does not load `server/.env`; production config comes from the systemd `EnvironmentFile`:

| Variable | Source var | Notes |
|----------|------------|-------|
| `PORT` | `pd_fade_server_port` | Binds on localhost; nginx proxies |
| `DB_PATH` | `pd_fade_db_path` | Persistent path under `pd_fade_data_dir` |
| `AGENT_DRIVER` | `pd_fade_agent_driver` | `mock` or `anthropic` |
| `ANTHROPIC_API_KEY` | `vault_anthropic_api_key` | Vault; required for `anthropic` |
| `ANTHROPIC_MODEL` | `pd_fade_anthropic_model` | Optional override |
| `MOCK_DRIVER_POST_TOOL_START_DELAY_MS` | `pd_fade_mock_driver_post_tool_start_delay_ms` | Optional; omit when empty |

### nginx / SSE

- General API: `/api/` → upstream with `/api` stripped.
- SSE stream (`/api/session/*/events`): `proxy_buffering off`, `gzip off`, long `proxy_read_timeout`, HTTP/1.1 — aligned with server `X-Accel-Buffering: no`.
- TLS: certbot standalone when `pd_fade_tls_enabled: true` and no cert exists yet; HTTP redirects to HTTPS.

## Syntax check

```bash
ansible-playbook environments/demo/provision.yml --syntax-check
```

## Borrowed from kjam-pomogu-org-iac

- `ansible.cfg`, `requirements.yml` layout, `environments/<env>/` with `inventory.yml` + `group_vars/all/`
- Vault placeholder + example file pattern
- nginx role structure (certbot standalone, vhost templates, handlers)
- Tagged playbook with multiple roles

**Skipped:** Docker, Postgres, Redis, Authentik, devsec hardening, fail2ban, UFW, swap tuning, deploy-user sudo patterns not needed for this single-app host.
