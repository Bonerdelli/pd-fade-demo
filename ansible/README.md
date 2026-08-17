# pd-fade Ansible provisioning

Bare-metal provisioning for a demo or small production VM: **build on the controller**, ship a release archive, install production deps on the target (native modules compiled for Linux), **systemd** for the Fastify server, **nginx** for the built client SPA and `/api` reverse proxy with SSE-friendly settings. Origin is **HTTP-only**; HTTPS is terminated at Cloudflare. No Docker, no git, and no Let's Encrypt on the target host.

## Requirements

### Control machine (where you run `ansible-playbook`)

- Ansible 2.15+
- Node.js 20+ and pnpm 10+ (`corepack enable && corepack prepare pnpm@10.28.0 --activate`)
- `rsync` (used by `scripts/build-release-archive.sh` to pack `dist/` trees)
- The pd-fade repository checkout (controller `pnpm build` packs the release archive)

### Target host

- Debian or Ubuntu, **>=1GB RAM recommended** (compiling `better-sqlite3` OOMs on 512MB without swap)
- SSH access as root (or a user with sudo)
- Node.js 20+ and pnpm 10+ (installed by the `nodejs` role — used for `pnpm install --prod` only)
- DNS for `root_domain` pointed at Cloudflare (orange-cloud proxy); origin nginx listens on port 80
- **No git required**

```bash
cd ansible
pip install ansible          # or your preferred venv / package manager
ansible-galaxy install -r requirements.yml
```

Collections install into `ansible/.collections` (see `ansible.cfg`).

## Deploy flow

1. **Controller:** `pnpm install --frozen-lockfile && pnpm build`, then pack `server/dist`, `shared/dist`, `client/dist`, workspace manifests into `pd-fade-<release-id>.tar.gz` (see `scripts/build-release-archive.sh`; Ansible invokes this automatically).
2. **Target:** upload archive → unpack under `{{ pd_fade_releases_dir }}/<release-id>` → `pnpm install --frozen-lockfile --prod --filter @pd-fade/server...` as root with `JOBS=1` (compiles **better-sqlite3** for Linux) → `chown` the release → atomically point `{{ pd_fade_current_link }}` symlink → restart systemd → probe `/health`. A failed install prints stdout/stderr plus dmesg OOM traces and deletes the broken release tree so the next run retries cleanly.
3. **Idempotency:** if the archive SHA-256 matches `.release-checksum` in the current release, upload and restart are skipped.

### Why not ship `node_modules` from macOS?

`better-sqlite3` is a native addon. Binaries built on a macOS controller are not portable to Linux. The archive contains compiled **JavaScript** (`dist/`) and manifests only; the target runs `pnpm install --prod` so native modules compile on the host.

## Inventory

1. Edit `environments/demo/inventory.yml` — `ansible_host`, `ansible_user`, and SSH key if needed.
2. Edit `environments/demo/group_vars/all/vars.yml` — `root_domain` and `pd_fade_agent_driver`. Paths, users, and ports come from role defaults.
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

Runs: base → nodejs → **local build + release deploy** → nginx (HTTP origin).

### HTTPS via Cloudflare

nginx serves HTTP on port 80. Point the Cloudflare DNS record at the origin and keep the proxy (orange cloud) on. Use **Flexible** SSL/TLS mode so Cloudflare talks HTTP to the origin (no certificate on the VM). Visitors still get HTTPS at the edge.

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
| Swap | `/swapfile` (2G), activated with `swapon` (not just fstab) — needed to compile `better-sqlite3` |

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
- HTTP origin only; `X-Forwarded-Proto` is passed through from Cloudflare

## Syntax check

```bash
ansible-playbook environments/demo/provision.yml --syntax-check
```

## Reference patterns

- **pyro-platform/iac:** controller-side build, target-side prod install, health probes after restart
- **kjam-pomogu-org-iac:** inventory layout, nginx vhost, vault examples

**Skipped:** target git checkout, shipping cross-platform `node_modules`, Docker, Postgres/Redis
