const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT ? Number(process.env.PORT) : 4173;
const root = __dirname;
const enableLiveReload = process.env.LIVERELOAD === '1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(filePath, res) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = types[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Live Reload opcional
let lrClients;
let reloadTimer;
function broadcastReload() {
  if (!enableLiveReload || !lrClients) return;
  for (const res of Array.from(lrClients)) {
    try { res.write(`data: reload\n\n`); } catch {}
  }
}
function scheduleReload() {
  if (!enableLiveReload) return;
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(broadcastReload, 300);
}
if (enableLiveReload) {
  lrClients = new Set();
  try {
    fs.watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      if (filename.includes('node_modules')) return;
      // Reduz gatilhos: apenas arquivos de conteúdo (evita imagens pesadas)
      if (/\.(html|css|js|mjs)$/i.test(filename)) {
        scheduleReload();
      }
    });
  } catch {}
}

const server = http.createServer((req, res) => {
  try {
    const url = decodeURI(req.url.split('?')[0]);
    // EndPoint de Live Reload (SSE)
    if (url === '/livereload') {
      if (!enableLiveReload) {
        return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      lrClients.add(res);
      req.on('close', () => { try { lrClients.delete(res); } catch {} });
      res.write(`data: connected\n\n`);
      return;
    }
    // API para listar emojis
    if (url === '/api/emojis') {
      const dir = path.join(root, 'assets', 'EMOJIS');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read emojis directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/EMOJIS/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    if (url === '/api/figurinhas') {
      const dir = path.join(root, 'assets', 'FIGURINHAS');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read figurinhas directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/FIGURINHAS/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    if (url === '/api/whatsapp') {
      const dir = path.join(root, 'assets', 'WHATSAPP');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read whatsapp directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/WHATSAPP/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    if (url === '/api/instagram') {
      const dir = path.join(root, 'assets', 'INSTAGRAM');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read instagram directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/INSTAGRAM/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    if (url === '/api/x') {
      const dir = path.join(root, 'assets', 'X');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read x directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/X/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    if (url === '/api/quadrinhos') {
      const dir = path.join(root, 'assets', 'QUADRINHOS');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read quadrinhos directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/QUADRINHOS/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    if (url === '/api/parceiros') {
      const dir = path.join(root, 'assets', 'PARCEIROS');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read parceiros directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/PARCEIROS/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    // API para listar signos
    if (url === '/api/signos') {
      const dir = path.join(root, 'assets', 'SIGNOS');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read signos directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/SIGNOS/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    if (url === '/api/frases') {
      const dir = path.join(root, 'assets', 'FRASES');
      fs.readdir(dir, (err, files) => {
        if (err) {
          return send(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Failed to read frases directory' }));
        }
        const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
        const list = files
          .filter(f => allowed.has(path.extname(f).toLowerCase()))
          .map(f => ({ name: f, url: `/assets/FRASES/${encodeURI(f)}` }));
        return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(list));
      });
      return;
    }
    let filePath = path.join(root, url);
    if (url === '/' || url === '') {
      filePath = path.join(root, 'index.html');
    }
    // evita directory traversal
    if (!filePath.startsWith(root)) {
      return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden');
    }
    // Para arquivos HTML, injeta script de Live Reload apenas se habilitado
    if (path.extname(filePath).toLowerCase() === '.html') {
      fs.readFile(filePath, 'utf-8', (err, html) => {
        if (err) {
          return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
        }
        if (!enableLiveReload) {
          return send(res, 200, { 'Content-Type': 'text/html; charset=utf-8' }, html);
        }
        const injection = '\n<script>try{var es=new EventSource(\'/livereload\');es.onmessage=function(){location.reload()};}catch(e){}</script>\n';
        const body = html.includes('/livereload') ? html : html.replace(/<\/body>/i, injection + '</body>');
        return send(res, 200, { 'Content-Type': 'text/html; charset=utf-8' }, body);
      });
    } else {
      serveFile(filePath, res);
    }
  } catch (e) {
    send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}/`);
});
