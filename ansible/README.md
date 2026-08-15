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
3. **Secrets (optional):** `vault.yml` is only required when you use encrypted secrets (Anthropic API key or a private git deploy key). Mock-only stands can skip vault entirely — vars use `default('')` fallbacks and you do not need `--ask-vault-pass`.

When you do need secrets, copy `vault.yml.example` to `vault.yml`, fill values, then encrypt:

```bash
ansible-vault encrypt environments/demo/group_vars/all/vault.yml
```

Optional: create `ansible/.vault_pass` (mode `600`) and pass `--vault-password-file .vault_pass` instead of `--ask-vault-pass`.

## First provision

From the `ansible/` directory:

```bash
# Mock driver, public repo — no vault password needed
ansible-playbook environments/demo/provision.yml

# With vault.yml present
ansible-playbook environments/demo/provision.yml --ask-vault-pass
```

This runs all roles: base packages and app user, Node.js + pnpm, application build and systemd unit, nginx (+ optional Let's Encrypt).

### HTTP-only first bring-up, then TLS

`pd_fade_tls_enabled` defaults to **false** so the first run serves the app over plain HTTP without needing a live certificate or DNS.

1. Provision with defaults (`pd_fade_tls_enabled: false`), verify the app at `http://<root_domain>/`.
2. Point DNS at the host.
3. Set `pd_fade_tls_enabled: true` in `vars.yml` and re-run (full playbook or `--tags nginx`).
4. nginx serves `/.well-known/acme-challenge/` on port 80 (not redirected), obtains the cert via **certbot webroot**, then enables HTTPS redirect for all other paths. Renewals use the same webroot authenticator while nginx stays up.

If certificate issuance fails, nginx remains on HTTP (no downtime from a stopped nginx).

## Redeploy application only

After the host is provisioned, redeploy code without touching nginx or Node:

```bash
ansible-playbook environments/demo/provision.yml --tags pd_fade
```

The service restarts only when the git checkout or environment file changes — unchanged redeploys skip a needless restart.

Tags: `base`, `nodejs`, `pd_fade`, `nginx`.

## Private git repositories

Public HTTPS repos work out of the box (`pd_fade_git_deploy_key_enabled: false`).

**Primary: SSH deploy key**

1. Generate a read-only deploy key and add the public half to your git host.
2. Set in `vars.yml`:
   - `pd_fade_git_deploy_key_enabled: true`
   - `pd_fade_repo_url: "git@github.com:ORG/pd-fade.git"` (SSH form)
3. Put the private key in vault as `vault_pd_fade_git_deploy_key` (see `vault.yml.example`).
4. Run with `--ask-vault-pass` (or `--vault-password-file`).

Ansible installs the key under `pd_fade_data_dir/.ssh/`, populates `known_hosts` for the git host, and sets `GIT_SSH_COMMAND` for the clone task.

**Alternative: HTTPS token URL**

Keep `pd_fade_git_deploy_key_enabled: false` and embed a token in the URL (store the token in vault, reference from `vars.yml`):

```yaml
pd_fade_repo_url: "https://x-access-token:{{ vault_pd_fade_git_token }}@github.com/ORG/pd-fade.git"
```

## What gets installed

| Component | Location / notes |
|-----------|------------------|
| App checkout | `pd_fade_root` (default `/opt/pd-fade`) |
| SQLite data | `pd_fade_data_dir` (default `/var/lib/pd-fade`) — **not** removed on redeploy |
| pnpm store | `pd_fade_pnpm_store_dir` (default `/var/cache/pd-fade/pnpm`) — separate from SQLite |
| Environment | `pd_fade_env_file` (default `/etc/pd-fade/env`) — `PORT`, `DB_PATH`, `AGENT_DRIVER`, etc. |
| systemd unit | `pd-fade.service` — `Restart=on-failure`, runs `node dist/index.js` from `server/` |
| Static client | nginx serves `client/dist` |
| API | nginx proxies `/api/*` → server port, strips `/api` prefix (matches Vite dev proxy) |

### Node.js and pnpm

Node.js **20.x** is installed from the NodeSource APT repository. **pnpm 10** is activated via **corepack** (`corepack prepare pnpm@<version> --activate`). The NodeSource setup script runs only when the APT source is not already present.

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
- TLS: certbot **webroot** (`certbot_webroot_path`, default `/var/www/certbot`); `/.well-known/acme-challenge/` is served on port 80 and excluded from the HTTPS redirect.

## Syntax check

```bash
ansible-playbook environments/demo/provision.yml --syntax-check
```

## Borrowed from kjam-pomogu-org-iac

- `ansible.cfg`, `requirements.yml` layout, `environments/<env>/` with `inventory.yml` + `group_vars/all/`
- Vault placeholder + example file pattern
- nginx role structure (certbot, vhost templates, handlers)
- Tagged playbook with multiple roles

**Skipped:** Docker, Postgres, Redis, Authentik, devsec hardening, fail2ban, UFW, swap tuning, deploy-user sudo patterns not needed for this single-app host.
