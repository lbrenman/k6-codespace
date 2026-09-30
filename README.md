# k6 Codespace

A ready-to-go [k6](https://grafana.com/docs/k6/latest/) load-testing workspace for **GitHub Codespaces**. Open it, and k6 is installed, on your PATH, and ready to run. Your test scripts and results are kept in the repo, so they persist across Codespace stops, rebuilds and deletions.

## Quick start

1. Create a new GitHub repo from these files (or push them to an existing repo).
2. On GitHub: **Code → Codespaces → Create codespace on main**.
3. Wait for setup to finish (it installs k6, jq and k6 type definitions, and creates `.env`).
4. In the terminal:

```bash
k6run smoke
```

That runs a 30-second, 1-VU test against the public Grafana demo site (`https://quickpizza.grafana.com`). Edit `.env` to point at your own API.

## Repo layout

```
.devcontainer/
  devcontainer.json    Codespace definition (Ubuntu 24.04, Node LTS, port 5665, 4 CPUs)
  install-k6.sh        Installs k6 (latest, or pin with K6_VERSION) + jq
  post-create.sh       Runs on create/rebuild: install, npm install, create .env
  post-start.sh        Runs on every start: warns about unsaved/unpushed work
bin/                   Helper commands (on PATH automatically)
  k6run                Run a test and save results
  k6new                Scaffold a new test from the template
  k6results            Table of past runs with key metrics
  k6save               Commit + push scripts and results to GitHub
lib/
  config.js            Env-driven config: BASE_URL, auth headers, thresholds
  helpers.js           hit(), postJson(), think()
scripts/               Your tests (smoke, load, stress, spike, soak included)
templates/basic.js     Template used by k6new
results/               One folder per run (see "Results")
.env.example           Copy of the config keys; .env is git-ignored
Makefile               make shortcuts for the commands above
package.json           @types/k6 for editor IntelliSense only
```

## How persistence works

| Event | What survives |
|---|---|
| Codespace **stops** (idle timeout, you close it) | Everything |
| Codespace **rebuilds** (you change devcontainer.json) | Everything under `/workspaces` (the whole repo, including `.env` and results). k6 itself is reinstalled automatically by `post-create.sh`. |
| Codespace is **deleted** (manually, or automatically after the retention period, 30 days by default) | Only what you **pushed** to GitHub |

So the rule is: **run `k6save` when you've written or changed something you want to keep.** It commits `scripts/`, `lib/`, `templates/` and `results/` and pushes to GitHub. Every time the Codespace starts, you'll get a reminder if there's anything uncommitted or unpushed.

Your `.env` file is **not** committed (it may hold tokens). For secrets you want in every Codespace, use **Codespaces secrets** instead (GitHub → Settings → Codespaces → Secrets, scoped to this repo). They show up as environment variables, and `k6run` uses them in preference to `.env`.

## Running tests

```bash
k6run <name> [extra k6 args]
```

`<name>` is a file in `scripts/` (without `.js`), or a path to any script. Anything after the name is passed straight to `k6 run`.

```bash
k6run smoke
VUS=50 HOLD=10m k6run load
BASE_URL=https://staging.example.com k6run stress
k6run scripts/my-api.js --vus 10 --duration 2m
```

Or with make:

```bash
make smoke
make load VUS=50 HOLD=10m
make run T=my-api ARGS="--vus 10 --duration 2m"
```

### Built-in tests

All of them hit `BASE_URL + TARGET_PATH` with a 2xx check, and each is tunable via environment variables:

| Test | Shape | Knobs (defaults) |
|---|---|---|
| `smoke` | Constant, tiny | `VUS` (1), `DURATION` (30s) |
| `load` | Ramp up, hold, ramp down | `VUS` (20), `RAMP` (1m), `HOLD` (5m) |
| `stress` | 25/50/75/100% steps of max | `MAX_VUS` (100), `STEP` (2m). Aborts if errors exceed 10%. |
| `spike` | Baseline, sudden surge, recovery | `BASE_VUS` (5), `SPIKE_VUS` (200), `SPIKE_HOLD` (1m) |
| `soak` | Moderate load for a long time | `VUS` (10), `DURATION` (1h). See the idle timeout note below. |

### Configuration (`.env`)

| Variable | Purpose | Default |
|---|---|---|
| `BASE_URL` | Target host | `https://quickpizza.grafana.com` |
| `TARGET_PATH` | Path the built-in tests hit | `/` |
| `AUTH_TOKEN` | Sent as `Authorization: Bearer ...` | (none) |
| `API_KEY` / `API_KEY_HEADER` | Sent as `<header>: <key>` | (none) / `x-api-key` |
| `P95_MS` | Threshold: 95th percentile latency | `500` |
| `MAX_ERROR_RATE` | Threshold: failed request rate | `0.01` |
| `THINK_TIME` | Seconds between iterations (randomized 50-150%) | `1` |

Precedence: variables already in your shell (including Codespaces secrets) win over `.env`.

## Writing your own tests

```bash
k6new orders-api
```

This creates `scripts/orders-api.js` from the template and opens it. The template uses the shared helpers, so auth headers, thresholds and `BASE_URL` all come from `.env` automatically:

```javascript
import { group } from 'k6';
import { hit, postJson, think } from '../lib/helpers.js';
import { thresholds, num, str } from '../lib/config.js';

export const options = {
  vus: num('VUS', 5),
  duration: str('DURATION', '1m'),
  thresholds: thresholds(),
};

export default function () {
  group('main flow', () => {
    hit('/api/orders');
    postJson('/api/orders', { sku: 'ABC-123', qty: 1 });
  });
  think();
}
```

You can also write plain k6 scripts that don't use `lib/` at all; `k6run` works with any script. VS Code gives you autocomplete for the k6 APIs via `@types/k6`.

## Results

Each run writes to `results/<timestamp>_<test>/`:

| File | Contents | Committed by k6save? |
|---|---|---|
| `summary.json` | End-of-test metrics (`--summary-export`) | Yes |
| `report.html` | Full HTML report from the k6 web dashboard | Yes |
| `meta.json` | Test, target, args, k6 version, pass/fail | Yes |
| `run.log` | Console output | No (git-ignored) |

`results/latest` always points to the most recent run.

```bash
k6results        # last 15 runs
k6results 50     # last 50
```

```
RUN                              RESULT      REQS    AVG ms    P95 ms    ERR %
20260930-141502_load             PASS       24310     118.2     301.4     0.08
20260930-135010_smoke            PASS          29      95.1     140.9        0
```

To view an HTML report, right-click `report.html` in the Explorer and choose **Download**, then open it in your browser.

### Live dashboard

While a test is running, the k6 web dashboard is served on port **5665**. Codespaces forwards it automatically; open it from the **Ports** tab to watch metrics in real time. Set `DASHBOARD=0` to disable the dashboard and the HTML report.

## Codespace sizing and limits

- **CPU**: `devcontainer.json` requests 4 cores. A 4-core Codespace comfortably drives a few hundred VUs for simple HTTP tests. For more, choose a bigger machine type when creating the Codespace (up to 16 or 32 cores, depending on your plan), or lower `hostRequirements.cpus` to 2 to save Codespaces hours.
- **Idle timeout**: Codespaces stop after a period without *your* activity (30 minutes by default), even if k6 is running. For long soak tests, raise the timeout (GitHub → Settings → Codespaces → Default idle timeout, max 240 minutes), or run long tests somewhere else (see below).
- **Source of traffic**: Load comes from GitHub's Azure regions. If you need traffic from a specific region, run the same scripts elsewhere.

## Running the same scripts elsewhere

The scripts only depend on `k6` and environment variables, so they run anywhere k6 does:

```bash
# Any machine with k6 installed
BASE_URL=https://api.example.com k6 run scripts/load.js

# Docker
docker run --rm -v "$PWD:/work" -w /work -e BASE_URL=https://api.example.com \
  grafana/k6 run scripts/load.js

# A Fly.io machine (e.g. for long soaks or a specific region)
fly ssh sftp shell -a <app>      # put the repo files onto /data
fly ssh console -a <app> -C "k6 run /data/k6-codespace/scripts/soak.js"
```

## Pinning the k6 version

By default, the latest k6 release is installed on create/rebuild. To pin a version, edit `.devcontainer/devcontainer.json`:

```json
"containerEnv": { "K6_VERSION": "v1.2.0" }
```

Then rebuild (Command Palette → **Codespaces: Rebuild Container**). You can also reinstall at any time with `make install`.

## Troubleshooting

**`k6: command not found`** — Run `bash .devcontainer/install-k6.sh`, or rebuild the container. Check the creation log (Command Palette → **Codespaces: View Creation Log**) for errors.

**`k6run: command not found`** — `bin/` is added to PATH via `remoteEnv`. Open a new terminal, or run `./bin/k6run` directly.

**Thresholds fail on the demo site** — `quickpizza.grafana.com` is a shared public demo. Keep load there small (smoke-level), and point `BASE_URL` at your own service for real tests.

**`k6save` push fails** — The Codespace's token can push to the repo it was created from. If you created the Codespace from a template or someone else's repo, first publish it to your own repo (Source Control panel → **Publish Branch**).

**Only test systems you own or have permission to load test.**
