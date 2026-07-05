#!/usr/bin/env node
/**
 * Yerel HTML önizleme: .preview/ (kök) ve apps/web/public/docs (/docs/).
 * Cursor veya file:// ile açınca sayfa kod olarak görünür; http://localhost ile açın.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8765);

const MOUNTS = [
  { prefix: '/docs', dir: path.join(ROOT, 'apps/web/public/docs') },
  { prefix: '', dir: path.join(ROOT, '.preview') },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

function safePath(baseDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const abs = path.normalize(path.join(baseDir, rel));
  if (!abs.startsWith(baseDir)) return null;
  return abs;
}

function resolveFile(urlPath) {
  for (const { prefix, dir } of MOUNTS) {
    if (prefix === '') {
      const file = safePath(dir, urlPath === '/' ? '/index.html' : urlPath);
      if (!file) continue;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
      if (urlPath.endsWith('/') || urlPath === '/') {
        const idx = path.join(dir, 'index.html');
        if (fs.existsSync(idx)) return idx;
      }
      continue;
    }
    if (urlPath === prefix || urlPath.startsWith(prefix + '/')) {
      const sub = urlPath.slice(prefix.length) || '/';
      let file = safePath(dir, sub === '/' ? '/index.html' : sub);
      if (!file) continue;
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    }
  }
  return null;
}

function listDirHtml(baseUrl, dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const items = entries
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => `<li><a href="${baseUrl}/${encodeURIComponent(e.name)}">${e.name}</a></li>`)
    .join('\n');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><title>Önizleme</title></head><body><h1>${baseUrl || '/'} — dosyalar</h1><ul>${items}</ul></body></html>`;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/';
  if (urlPath === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(listDirHtml('', MOUNTS.find((m) => m.prefix === '').dir));
    return;
  }
  if (urlPath === '/docs' || urlPath === '/docs/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(listDirHtml('/docs', MOUNTS.find((m) => m.prefix === '/docs').dir));
    return;
  }

  const file = resolveFile(urlPath);
  if (!file) {
    const hint =
      urlPath.startsWith('/docs/') && MOUNTS.some((m) => m.prefix === '/docs')
        ? '\n\nİpucu: /docs/ yolu yalnızca birleşik sunucuda çalışır. Proje kökünde: pnpm preview:docs'
        : '';
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 — dosya bulunamadı: ${urlPath}${hint}`);
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} dolu. Mevcut sunucuyu durdurun veya PORT=8766 pnpm preview:docs deneyin.`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Meridyen HTML önizleme: http://localhost:${PORT}/`);
  console.log(`  Hoş geldin maili: http://localhost:${PORT}/welcome-email-insurance-company.html`);
  console.log(`  Kılavuz (.preview): http://localhost:${PORT}/02-sigorta-kilavuz-v2.html`);
  console.log(`  Kılavuz (public): http://localhost:${PORT}/docs/02-sigorta-portal-kilavuzu.html`);
});
