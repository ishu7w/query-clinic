import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const routes = new Map([
  ['/', ['index.html', 'text/html']],
  ['/barlow.woff2', ['barlow.woff2', 'font/woff2']],
  ['/report-data.js', ['report-data.js', 'text/javascript']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
  ['/data.json', ['data.json', 'application/json']]
]);

createServer(async (request, response) => {
  const route = routes.get(request.url ?? '');
  response.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' || !route) {
    response.writeHead(request.method === 'GET' ? 404 : 405).end('Report route unavailable.');
    return;
  }
  const [file, type] = route;
  try {
    const body = await readFile(new URL(`../report/${file}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': type === 'font/woff2' ? type : `${type}; charset=utf-8` }).end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Report file unavailable.');
  }
}).listen(4173, '127.0.0.1', () => console.log('Query Clinic · http://127.0.0.1:4173'));
