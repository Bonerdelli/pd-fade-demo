# pd-fade Ansible provisioning

Bare-metal provisioning for a demo or small production VM: **build on the controller**, ship a release archive, install production deps on the target (native modules compiled for Linux), **systemd** for the Fastify server, **nginx** for the built client SPA and `/api` reverse proxy with SSE-friendly settings. No Docker and **no git** on the target host.

## Requirements

### Control machine (where you run `ansible-playbook`)

- Ansible 2.15+
- Node.js 20+ and pnpm 10+ (`corepack enable && corepack prepare pnpm@10.28.0 --activate`)
- The pd-fade repository checkout (build runs from `pd_fade_repo_root`)

### Target host

- Debian or Ubuntu
- SSH access as root (or a user with sudo)
- Node.js 20+ and pnpm 10+ (installed by the `nodejs` role — used for `pnpm install --prod` only)
- DNS `A` record for `root_domain` when TLS is enabled
- **No git required**

```bash
cd ansible
pip install ansible          # or your preferred venv / package manager
ansible-galaxy install -r requirements.yml
```

Collections install into `ansible/.collections` (see `ansible.cfg`).

## Deploy flow

1. **Controller:** `pnpm install --frozen-lockfile && pnpm build`, then pack `server/dist`, `shared/dist`, `client/dist`, workspace manifests into `pd-fade-<release-id>.tar.gz` (see `scripts/build-release-archive.sh`; Ansible invokes this automatically).
2. **Target:** upload archive → unpack under `{{ pd_fade_releases_dir }}/<release-id>` → `pnpm install --frozen-lockfile --prod --filter @pd-fade/server...` (rebuilds **better-sqlite3** for Linux) → atomically point `{{ pd_fade_current_link }}` symlink → restart systemd → probe `/health`.
3. **Idempotency:** if the archive SHA-256 matches `.release-checksum` in the current release, upload and restart are skipped.

### Why not ship `node_modules` from macOS?

`better-sqlite3` is a native addon. Binaries built on a macOS controller are not portable to Linux. The archive contains compiled **JavaScript** (`dist/`) and manifests only; the target runs `pnpm install --prod` so native modules compile on the host.

## Inventory

1. Copy or edit `environments/demo/inventory.yml` — set `ansible_host`, `ansible_user`, and SSH key if needed.
2. Edit `environments/demo/group_vars/all/vars.yml` — at minimum `root_domain` and `pd_fade_agent_driver`.
3. **Secrets (optional):** `vault.yml` is only required for `pd_fade_agent_driver: anthropic`. Mock-only stands skip vault and do not need `--ask-vault-pass`.

When you need secrets, copy `vault.yml.example` to `vault.yml`, fill values, then encrypt:

```bash
ansible-vault encrypt environments/demo/group_vars/all/vault.yml
```

Optional: create `ansible/.vault_pass` (mode `600`) and pass `--vault-password-file .vault_pass` instead of `--ask-vault-pass`.

## First provision

From the `ansible/` directory:

```bash
# Mock driver — no vault password needed
ansible-playbook environments/demo/provision.yml

# With vault.yml present
ansible-playbook environments/demo/provision.yml --ask-vault-pass
```

Runs: base → nodejs → **local build + release deploy** → nginx (+ optional Let's Encrypt).

### HTTP-only first bring-up, then TLS

`pd_fade_tls_enabled` defaults to **false**.

1. Provision with defaults, verify at `http://<root_domain>/`.
2. Point DNS at the host.
3. Set `pd_fade_tls_enabled: true` and re-run (full playbook or `--tags nginx`).

## Redeploy application

Rebuild on the controller and roll out a new release (skips upload when checksum unchanged):

```bash
ansible-playbook environments/demo/provision.yml --tags pd_fade
```

Manual build/pack (debugging):

```bash
./scripts/build-release-archive.sh .. .build
```

Tags: `base`, `nodejs`, `pd_fade`, `nginx`.

## Rollback

Releases are kept under `pd_fade_releases_dir` (default `/opt/pd-fade/releases/`); the live app is `pd_fade_current_link` (default `/opt/pd-fade/current`).

```bash
# On the target host (example)
sudo ln -sfn /opt/pd-fade/releases/<previous-release-id> /opt/pd-fade/current
sudo systemctl restart pd-fade
curl -sS http://127.0.0.1:3001/health
```

Or re-run Ansible with a previously built archive:

```bash
ansible-playbook environments/demo/provision.yml --tags pd_fade \
  -e pd_fade_skip_local_build=true \
  -e pd_fade_release_archive=/path/to/pd-fade-<id>.tar.gz \
  -e pd_fade_release_checksum=<sha256> \
  -e pd_fade_release_id=<id>
```

## What gets installed

| Component | Location / notes |
|-----------|------------------|
| Releases | `pd_fade_releases_dir` (default `/opt/pd-fade/releases/<id>/`) |
| Live app | `pd_fade_current_link` → active release |
| SQLite data | `pd_fade_data_dir` (default `/var/lib/pd-fade`) — **not** removed on redeploy |
| pnpm store | `pd_fade_pnpm_store_dir` (default `/var/cache/pd-fade/pnpm`) |
| Environment | `pd_fade_env_file` (default `/etc/pd-fade/env`) |
| systemd | `pd-fade.service` — `WorkingDirectory={{ pd_fade_current_link }}/server` |
| Static client | nginx serves `{{ pd_fade_current_link }}/client/dist` |
| API | nginx proxies `/api/*` → server port |

### Environment variables

| Variable | Source var | Notes |
|----------|------------|-------|
| `PORT` | `pd_fade_server_port` | localhost; nginx proxies |
| `DB_PATH` | `pd_fade_db_path` | under `pd_fade_data_dir` |
| `AGENT_DRIVER` | `pd_fade_agent_driver` | `mock` or `anthropic` |
| `ANTHROPIC_API_KEY` | `vault_anthropic_api_key` | vault; required for `anthropic` |
| `ANTHROPIC_MODEL` | `pd_fade_anthropic_model` | optional |
| `MOCK_DRIVER_POST_TOOL_START_DELAY_MS` | `pd_fade_mock_driver_post_tool_start_delay_ms` | optional |

### nginx / SSE

- `/api/` → upstream with `/api` stripped
- SSE: `proxy_buffering off`, `gzip off`, long read timeout
- TLS: certbot webroot; ACME path excluded from HTTPS redirect

## Syntax check

```bash
ansible-playbook environments/demo/provision.yml --syntax-check
```

## Reference patterns

- **pyro-platform/iac:** controller-side build, target-side prod install, health probes after restart
- **kjam-pomogu-org-iac:** inventory layout, nginx/TLS, vault examples

**Skipped:** target git checkout, shipping cross-platform `node_modules`, Docker, Postgres/Redis
