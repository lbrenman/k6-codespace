#!/usr/bin/env node
// Serves saved k6 results so you can view them after a test (and its live
// dashboard) has ended. Used by bin/k6report. No npm dependencies.
//
//   node tools/report-server.js                 latest run's report.html
//   node tools/report-server.js <match>         newest run whose folder contains <match>
//   node tools/report-server.js --all           index of all runs, with links
//   node tools/report-server.js --build-index   write results/index.html and exit
//
// Env: PORT (default 8080)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RESULTS = path.join(ROOT, 'results');
const PORT = parseInt(process.env.PORT || '8080', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function runDirs() {
  if (!fs.existsSync(RESULTS)) return [];
  return fs
    .readdirSync(RESULTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{8}-\d{6}_/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n, digits = 1) {
  return typeof n === 'number' && isFinite(n) ? n.toFixed(digits).replace(/\.0+$/, '') : '';
}

function runInfo(name) {
  const dir = path.join(RESULTS, name);
  const s = readJson(path.join(dir, 'summary.json')) || {};
  const m = readJson(path.join(dir, 'meta.json')) || {};
  const metrics = s.metrics || {};
  const dur = metrics.http_req_duration || {};
  const stamp = name.split('_')[0]; // YYYYMMDD-HHMMSS
  const when = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}`;
  return {
    name,
    test: m.test || name.split('_').slice(1).join('_'),
    when,
    target: m.base_url || '',
    passed: m.thresholds_passed,
    reqs: metrics.http_reqs ? metrics.http_reqs.count : undefined,
    avg: dur.avg,
    p95: dur['p(95)'],
    errPct: metrics.http_req_failed ? metrics.http_req_failed.value * 100 : undefined,
    limited: metrics.rate_limited_count ? metrics.rate_limited_count.count : undefined,
    hasReport: fs.existsSync(path.join(dir, 'report.html')),
    hasSummary: fs.existsSync(path.join(dir, 'summary.json')),
    hasLog: fs.existsSync(path.join(dir, 'run.log')),
  };
}

function buildIndex() {
  const rows = runDirs().map(runInfo);
  const body = rows.length
    ? rows
        .map((r) => {
          const status =
            r.passed === true ? '<span class="pass">PASS</span>' : r.passed === false ? '<span class="fail">FAIL</span>' : '?';
          const links = [
            r.hasReport ? `<a href="${esc(r.name)}/report.html">report</a>` : '',
            r.hasSummary ? `<a href="${esc(r.name)}/summary.json">summary</a>` : '',
            r.hasLog ? `<a href="${esc(r.name)}/run.log">log</a>` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          return `<tr>
  <td>${esc(r.when)}</td><td><strong>${esc(r.test)}</strong><div class="dim">${esc(r.target)}</div></td>
  <td>${status}</td><td class="num">${esc(r.reqs ?? '')}</td><td class="num">${fmt(r.avg)}</td>
  <td class="num">${fmt(r.p95)}</td><td class="num">${fmt(r.errPct, 2)}</td><td class="num">${esc(r.limited ?? '')}</td>
  <td>${links}</td></tr>`;
        })
        .join('\n')
    : '<tr><td colspan="9" class="dim">No runs yet. Run a test with k6run first.</td></tr>';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>k6 results</title>
<style>
  :root { --bg:#fff; --fg:#1d1d1f; --dim:#6b6b76; --line:#e4e4ea; --head:#f5f5f8; --pass:#1a7f37; --fail:#cf222e; --link:#7d64ff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#16161a; --fg:#ececf1; --dim:#9a9aa6; --line:#2c2c34; --head:#1f1f25; --pass:#3fb950; --fail:#f85149; --link:#a594ff; } }
  body { margin:0; padding:24px; background:var(--bg); color:var(--fg); font:14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; } p { margin:0 0 16px; color:var(--dim); }
  .wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
  table { border-collapse:collapse; width:100%; min-width:760px; }
  th, td { padding:8px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  th { background:var(--head); font-weight:600; white-space:nowrap; }
  tr:last-child td { border-bottom:0; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .dim { color:var(--dim); font-size:12px; word-break:break-all; }
  .pass { color:var(--pass); font-weight:600; } .fail { color:var(--fail); font-weight:600; }
  a { color:var(--link); text-decoration:none; } a:hover { text-decoration:underline; }
</style></head><body>
<h1>k6 results</h1>
<p>${rows.length} run(s) · newest first · generated ${esc(new Date().toISOString().replace('T', ' ').slice(0, 19))} UTC</p>
<div class="wrap"><table>
<thead><tr><th>When</th><th>Test / target</th><th>Result</th><th class="num">Requests</th><th class="num">Avg ms</th>
<th class="num">p95 ms</th><th class="num">Err %</th><th class="num">429s</th><th>Files</th></tr></thead>
<tbody>
${body}
</tbody></table></div>
</body></html>
`;
  fs.writeFileSync(path.join(RESULTS, 'index.html'), html);
  return rows.length;
}

function publicUrl(pathname) {
  const cs = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (cs && domain) return `https://${cs}-${PORT}.${domain}${pathname}`;
  return `http://localhost:${PORT}${pathname}`;
}

function serve(root, openPath) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other server or run: PORT=8081 k6report ...`);
    } else {
      console.error(e.message);
    }
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', () => {
    const url = publicUrl(openPath);
    console.log(`Serving ${path.relative(ROOT, root) || '.'} on port ${PORT}`);
    console.log(`Open: ${url}`);
    console.log('(Also available from the Ports tab.) Press Ctrl+C to stop.');
    // In Codespaces/VS Code, $BROWSER opens the URL in your local browser
    if (process.env.BROWSER && process.env.K6REPORT_NO_OPEN !== '1') {
      execFile(process.env.BROWSER, [url], () => {});
    }
  });
}

function main() {
  const arg = process.argv[2];

  if (arg === '-h' || arg === '--help') {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 11).join('\n').replace(/^\/\/ ?/gm, ''));
    return;
  }

  if (arg === '--build-index') {
    const n = buildIndex();
    console.log(`Wrote results/index.html (${n} runs)`);
    return;
  }

  if (arg === '--all') {
    buildIndex();
    serve(RESULTS, '/index.html');
    return;
  }

  const runs = runDirs();
  if (!runs.length) {
    console.error('No results yet. Run a test first, e.g.: k6run smoke');
    process.exit(1);
  }
  const name = arg ? runs.find((r) => r.includes(arg)) : runs[0];
  if (!name) {
    console.error(`No run matches "${arg}". Recent runs:`);
    runs.slice(0, 10).forEach((r) => console.error(`  ${r}`));
    process.exit(1);
  }
  const dir = path.join(RESULTS, name);
  if (!fs.existsSync(path.join(dir, 'report.html'))) {
    console.error(`${name} has no report.html (was it run with DASHBOARD=0?). Try: k6report --all`);
    process.exit(1);
  }
  console.log(`Run: ${name}`);
  serve(dir, '/report.html');
}

main();
