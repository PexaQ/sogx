import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.cwd());
const distRoot = join(root, 'viewer', 'dist');
const publicRoot = join(root, 'viewer', 'public');
const resultsRoot = join(root, 'benchmarks', 'results');
const port = Number(process.env.PORT || 4173);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      handleHealth(req, res);
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/api/results' || url.pathname === '/api/save-run')) {
      await handleResultPost(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end('Method not allowed');
      return;
    }

    await handleStatic(req, res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(error.message);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`LowEndGS viewer server listening on http://localhost:${port}`);
});

async function handleResultPost(req, res) {
  const body = await readBody(req, 50 * 1024 * 1024);
  const result = JSON.parse(body);
  const runId = sanitize(result.runId || result.summary?.runId || new Date().toISOString());
  const summary = makeSummaryDocument(result, runId);

  await mkdir(resultsRoot, { recursive: true });

  const files = {
    summary: `${runId}_summary.json`,
    frames: `${runId}_frames.csv`
  };

  if (result.visualSanity?.screenshotDataUrl) {
    const screenshot = decodeDataUrl(result.visualSanity.screenshotDataUrl);
    if (screenshot?.mime === 'image/png') {
      files.screenshot = `${runId}_screenshot.png`;
      await writeFile(join(resultsRoot, files.screenshot), screenshot.buffer);
      summary.visualSanity = {
        ...summary.visualSanity,
        screenshotFile: files.screenshot,
        screenshotDataUrl: undefined
      };
    }
  }

  await writeFile(join(resultsRoot, files.summary), JSON.stringify(summary, null, 2));
  await writeFile(join(resultsRoot, files.frames), toCsv(result.samples ?? []));

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, runId, files }));
}

function handleHealth(req, res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify({
    ok: true,
    service: 'lowendgs-viewer',
    cwd: root,
    distReady: isFile(join(distRoot, 'index.html')),
    time: new Date().toISOString()
  }));
}

async function handleStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const publicFile = safeJoin(publicRoot, pathname);
  const distFile = safeJoin(distRoot, pathname === '/' ? '/index.html' : pathname);
  const fallback = join(distRoot, 'index.html');
  const file = isFile(publicFile) ? publicFile : isFile(distFile) ? distFile : fallback;

  res.writeHead(200, { 'Content-Type': contentType(file) });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

function safeJoin(base, pathname) {
  const file = resolve(join(base, pathname));
  if (!file.startsWith(base)) {
    return join(base, 'index.html');
  }
  return file;
}

function isFile(file) {
  try {
    return existsSync(file) && statSync(file).isFile();
  } catch {
    return false;
  }
}

function readBody(req, maxBytes) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolveBody(body));
    req.on('error', reject);
  });
}

function toCsv(rows) {
  if (!rows.length) {
    return '';
  }
  const columns = Object.keys(rows[0]);
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))
  ].join('\n');
}

function makeSummaryDocument(result, runId) {
  const visualSanity = result.visualSanity ? { ...result.visualSanity } : null;
  if (visualSanity) {
    delete visualSanity.screenshotDataUrl;
  }
  const resultSummary = result.summary ? { ...result.summary } : null;
  if (resultSummary?.visualSanity) {
    resultSummary.visualSanity = { ...resultSummary.visualSanity };
    delete resultSummary.visualSanity.screenshotDataUrl;
  }

  return {
    resultType: 'lowendgs-summary',
    runId,
    createdAt: new Date().toISOString(),
    config: result.config ?? null,
    device: result.device ?? null,
    playcanvasVersion: result.playcanvasVersion ?? null,
    controllerEnabled: result.controllerEnabled ?? null,
    summary: resultSummary,
    visualSanity,
    exportStatus: result.exportStatus ?? null,
    validationStatus: result.validationStatus ?? { status: 'unvalidated' },
    finishDetail: result.finishDetail ?? null,
    sampleCount: Array.isArray(result.samples) ? result.samples.length : null
  };
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl));
  if (!match) {
    return null;
  }
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const text = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function sanitize(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160);
}

function contentType(file) {
  switch (extname(file)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.sog':
      return 'application/zip';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
