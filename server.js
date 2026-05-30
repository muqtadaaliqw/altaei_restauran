/**
 * ═══════════════════════════════════════════════════════
 *  Menu Miraq Server — نظام إدارة المطاعم المتكامل
 * ═══════════════════════════════════════════════════════
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB = {
  restaurants: path.join(DATA_DIR, 'restaurants.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  tables: path.join(DATA_DIR, 'tables.json'),
  devConfig: path.join(DATA_DIR, 'dev-config.json'),
};

const DEV_PASS = process.env.DEV_PASS || 'dev@muqtada2025';

function initDB() {
  Object.values(DB).forEach(p => { if (!fs.existsSync(p)) fs.writeFileSync(p, '[]', 'utf8'); });
  if (!fs.existsSync(DB.devConfig)) fs.writeFileSync(DB.devConfig, JSON.stringify({ devPass: DEV_PASS }, null, 2));
}
initDB();

function readDB(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeDB(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

function genId() { return crypto.randomBytes(8).toString('hex').toUpperCase(); }
function genSlug(name) { return name.toLowerCase().replace(/[^a-z0-9\u0621-\u064A]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 30); }
function nowISO() { return new Date().toISOString(); }
function hash(pw) { return crypto.createHash('sha256').update(pw).digest('hex').substring(0, 16); }
function genToken() { return crypto.randomBytes(16).toString('hex'); }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dev-Pass');
}
function json(res, code, data) { cors(res); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
function body(req) {
  return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d)); } catch { r({}); } }); });
}
function authDev(req) { const cfg = JSON.parse(fs.readFileSync(DB.devConfig, 'utf8')); return req.headers['x-dev-pass'] === cfg.devPass; }
function authAdmin(req) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;
  const rests = readDB(DB.restaurants);
  return rests.find(r => r.adminToken === token && !r.disabled && new Date(r.expiry) > new Date()) || null;
}

const routes = {
  // ═══ DEV ═══
  'POST /api/dev/login': async (req, res) => {
    const b = await body(req);
    const cfg = JSON.parse(fs.readFileSync(DB.devConfig, 'utf8'));
    if (b.password !== cfg.devPass) return json(res, 401, { ok: false, msg: 'كلمة المرور غير صحيحة' });
    json(res, 200, { ok: true, token: 'dev-' + genToken() });
  },
  'GET /api/dev/stats': (req, res) => {
    if (!authDev(req)) return json(res, 401, { ok: false });
    const rests = readDB(DB.restaurants); const now = new Date();
    json(res, 200, { ok: true, total: rests.length, active: rests.filter(r => !r.disabled && new Date(r.expiry) > now).length, expired: rests.filter(r => !r.disabled && new Date(r.expiry) <= now).length, disabled: rests.filter(r => r.disabled).length });
  },
  'GET /api/dev/restaurants': (req, res) => {
    if (!authDev(req)) return json(res, 401, { ok: false });
    json(res, 200, { ok: true, data: readDB(DB.restaurants) });
  },
  'POST /api/dev/restaurant': async (req, res) => {
    if (!authDev(req)) return json(res, 401, { ok: false });
    const b = await body(req);
    if (!b.name || !b.username) return json(res, 400, { ok: false, msg: 'الاسم واسم المستخدم مطلوبان' });
    const rests = readDB(DB.restaurants);
    if (rests.find(r => r.username === b.username)) return json(res, 400, { ok: false, msg: 'اسم المستخدم مستخدم' });
    const slug = b.slug || genSlug(b.name);
    if (rests.find(r => r.slug === slug)) return json(res, 400, { ok: false, msg: 'الرابط مستخدم' });
    const expiryDays = { daily: 1, monthly: 30, '2months': 60, '3months': 90, '6months': 180, yearly: 365 }[b.plan || 'monthly'] || 30;
    const expiry = new Date(); expiry.setDate(expiry.getDate() + expiryDays);
    const adminPass = b.adminPassword || 'admin123';
    const rest = {
      id: genId(), name: b.name, username: b.username, slug: slug,
      passwordHash: hash(adminPass), adminToken: genToken(),
      phone: b.phone || '', whatsapp: b.whatsapp || '', address: b.address || '',
      logo: b.logo || '', colors: b.colors || { primary: '#10B981', secondary: '#1F2937', bg: '#FFFFFF' },
      plan: b.plan || 'monthly', expiry: expiry.toISOString(), disabled: false,
      created: nowISO(), categories: [], products: [],
      settings: { acceptOrders: true, soundAlert: true }
    };
    rests.push(rest); writeDB(DB.restaurants, rests);
    json(res, 200, { ok: true, restaurant: { ...rest, passwordHash: undefined }, adminPassword: adminPass });
  },
  'PUT /api/dev/restaurant/:id': async (req, res, q, params) => {
    if (!authDev(req)) return json(res, 401, { ok: false });
    const b = await body(req); const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === params.id);
    if (idx === -1) return json(res, 404, { ok: false });
    if (b.plan) { const days = { daily: 1, monthly: 30, '2months': 60, '3months': 90, '6months': 180, yearly: 365 }[b.plan] || 30; const exp = new Date(rests[idx].expiry); if (exp < new Date()) exp.setTime(Date.now()); exp.setDate(exp.getDate() + days); rests[idx].expiry = exp.toISOString(); rests[idx].plan = b.plan; }
    if (b.disabled !== undefined) rests[idx].disabled = b.disabled;
    if (b.name) rests[idx].name = b.name;
    writeDB(DB.restaurants, rests); json(res, 200, { ok: true });
  },
  'DELETE /api/dev/restaurant/:id': (req, res, q, params) => {
    if (!authDev(req)) return json(res, 401, { ok: false });
    writeDB(DB.restaurants, readDB(DB.restaurants).filter(r => r.id !== params.id));
    json(res, 200, { ok: true });
  },

  // ═══ ADMIN ═══
  'POST /api/admin/login': async (req, res) => {
    const b = await body(req); const rests = readDB(DB.restaurants);
    const rest = rests.find(r => r.username === b.username && r.passwordHash === hash(b.password));
    if (!rest) return json(res, 401, { ok: false, msg: 'بيانات الدخول غير صحيحة' });
    if (rest.disabled) return json(res, 403, { ok: false, msg: 'الحساب موقوف' });
    if (new Date(rest.expiry) < new Date()) return json(res, 403, { ok: false, msg: 'الاشتراك منتهي' });
    rest.adminToken = genToken(); writeDB(DB.restaurants, rests);
    json(res, 200, { ok: true, token: rest.adminToken, restaurant: { ...rest, passwordHash: undefined } });
  },
  'GET /api/admin/me': (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    json(res, 200, { ok: true, restaurant: { ...rest, passwordHash: undefined } });
  },
  'PUT /api/admin/profile': async (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    ['name', 'phone', 'whatsapp', 'address', 'logo', 'colors', 'settings'].forEach(f => { if (b[f] !== undefined) rests[idx][f] = b[f]; });
    writeDB(DB.restaurants, rests); json(res, 200, { ok: true, restaurant: { ...rests[idx], passwordHash: undefined } });
  },
  'PUT /api/admin/password': async (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    if (rests[idx].passwordHash !== hash(b.oldPassword)) return json(res, 400, { ok: false, msg: 'كلمة المرور الحالية غير صحيحة' });
    rests[idx].passwordHash = hash(b.newPassword); writeDB(DB.restaurants, rests); json(res, 200, { ok: true });
  },
  'GET /api/admin/categories': (req, res) => { const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false }); json(res, 200, { ok: true, categories: rest.categories || [] }); },
  'POST /api/admin/categories': async (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    const cats = rests[idx].categories || [];
    cats.push({ id: genId(), name: b.name, order: cats.length, emoji: b.emoji || '🍽️' });
    rests[idx].categories = cats; writeDB(DB.restaurants, rests);
    json(res, 200, { ok: true, categories: cats });
  },
  'PUT /api/admin/categories/:catId': async (req, res, q, params) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    const cat = rests[idx].categories.find(c => c.id === params.catId); if (!cat) return json(res, 404, { ok: false });
    if (b.name) cat.name = b.name; if (b.order !== undefined) cat.order = b.order; if (b.emoji) cat.emoji = b.emoji;
    writeDB(DB.restaurants, rests); json(res, 200, { ok: true });
  },
  'DELETE /api/admin/categories/:catId': (req, res, q, params) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    rests[idx].categories = rests[idx].categories.filter(c => c.id !== params.catId);
    rests[idx].products = rests[idx].products.filter(p => p.categoryId !== params.catId);
    writeDB(DB.restaurants, rests); json(res, 200, { ok: true });
  },
  'GET /api/admin/products': (req, res) => { const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false }); json(res, 200, { ok: true, products: rest.products || [] }); },
  'POST /api/admin/products': async (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    const prods = rests[idx].products || [];
    prods.push({ id: genId(), name: b.name, description: b.description || '', price: +b.price || 0, categoryId: b.categoryId, image: b.image || '', available: b.available !== false, order: prods.length, created: nowISO() });
    rests[idx].products = prods; writeDB(DB.restaurants, rests);
    json(res, 200, { ok: true, products: prods });
  },
  'PUT /api/admin/products/:pid': async (req, res, q, params) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    const p = rests[idx].products.find(x => x.id === params.pid); if (!p) return json(res, 404, { ok: false });
    ['name', 'description', 'price', 'categoryId', 'image', 'available', 'order'].forEach(f => { if (b[f] !== undefined) p[f] = b[f]; });
    writeDB(DB.restaurants, rests); json(res, 200, { ok: true });
  },
  'DELETE /api/admin/products/:pid': (req, res, q, params) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const rests = readDB(DB.restaurants); const idx = rests.findIndex(r => r.id === rest.id);
    rests[idx].products = rests[idx].products.filter(p => p.id !== params.pid);
    writeDB(DB.restaurants, rests); json(res, 200, { ok: true });
  },
  'GET /api/admin/tables': (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    json(res, 200, { ok: true, tables: readDB(DB.tables).filter(t => t.restaurantId === rest.id) });
  },
  'POST /api/admin/tables': async (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const tables = readDB(DB.tables);
    const num = b.number || tables.filter(t => t.restaurantId === rest.id).length + 1;
    const table = { id: genId(), restaurantId: rest.id, number: num, qrCode: `/table/${rest.slug}/${num}`, created: nowISO() };
    tables.push(table); writeDB(DB.tables, tables);
    json(res, 200, { ok: true, table });
  },
  'DELETE /api/admin/tables/:tid': (req, res, q, params) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    writeDB(DB.tables, readDB(DB.tables).filter(t => !(t.id === params.tid && t.restaurantId === rest.id)));
    json(res, 200, { ok: true });
  },
  'GET /api/admin/orders': (req, res) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const orders = readDB(DB.orders).filter(o => o.restaurantId === rest.id).sort((a, b) => new Date(b.created) - new Date(a.created));
    json(res, 200, { ok: true, orders });
  },
  'PUT /api/admin/orders/:oid': async (req, res, q, params) => {
    const rest = authAdmin(req); if (!rest) return json(res, 401, { ok: false });
    const b = await body(req); const orders = readDB(DB.orders);
    const o = orders.find(x => x.id === params.oid && x.restaurantId === rest.id); if (!o) return json(res, 404, { ok: false });
    if (b.status) o.status = b.status; if (b.estimatedTime) o.estimatedTime = b.estimatedTime;
    o.updated = nowISO(); writeDB(DB.orders, orders); json(res, 200, { ok: true, order: o });
  },

  // ═══ PUBLIC ═══
  'GET /api/menu/:slug': (req, res, q, params) => {
    const rests = readDB(DB.restaurants);
    const rest = rests.find(r => r.slug === params.slug && !r.disabled && new Date(r.expiry) > new Date());
    if (!rest) return json(res, 404, { ok: false, msg: 'المطعم غير موجود' });
    json(res, 200, { ok: true, restaurant: { id: rest.id, name: rest.name, slug: rest.slug, logo: rest.logo, colors: rest.colors, phone: rest.phone, whatsapp: rest.whatsapp, address: rest.address }, categories: rest.categories || [], products: (rest.products || []).filter(p => p.available) });
  },
  'POST /api/orders': async (req, res) => {
    const b = await body(req); const rests = readDB(DB.restaurants);
    const rest = rests.find(r => r.id === b.restaurantId && !r.disabled);
    if (!rest) return json(res, 404, { ok: false });
    if (!rest.settings?.acceptOrders) return json(res, 403, { ok: false, msg: 'الطلبات متوقفة' });
    const orders = readDB(DB.orders);
    const order = { id: 'ORD-' + Date.now().toString().slice(-6), restaurantId: rest.id, items: b.items || [], total: b.total || 0, customerName: b.customerName || '', customerPhone: b.customerPhone || '', tableNumber: b.tableNumber || null, note: b.note || '', status: 'pending', estimatedTime: 20, created: nowISO(), updated: nowISO() };
    orders.push(order); writeDB(DB.orders, orders);
    json(res, 200, { ok: true, order });
  },
  'GET /api/orders/track/:oid': (req, res, q, params) => {
    const o = readDB(DB.orders).find(x => x.id === params.oid);
    if (!o) return json(res, 404, { ok: false });
    json(res, 200, { ok: true, order: o });
  },
  'GET /api/table/:slug/:number': (req, res, q, params) => {
    const rest = readDB(DB.restaurants).find(r => r.slug === params.slug);
    if (!rest) return json(res, 404, { ok: false });
    json(res, 200, { ok: true, table: params.number, restaurant: { id: rest.id, name: rest.name, slug: rest.slug } });
  },
};

const MIME = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', ico: 'image/x-icon', webp: 'image/webp' };

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
  const parsed = url.parse(req.url, true); let pathname = parsed.pathname;
  let handler = null, routeParams = {};
  const routeKey = `${req.method} ${pathname}`;
  if (routes[routeKey]) handler = routes[routeKey];
  else {
    for (const [pattern, fn] of Object.entries(routes)) {
      const [pMethod, pPath] = pattern.split(' ');
      if (pMethod !== req.method) continue;
      const pParts = pPath.split('/').filter(Boolean);
      const rParts = pathname.split('/').filter(Boolean);
      if (pParts.length !== rParts.length) continue;
      let match = true; const params = {};
      for (let i = 0; i < pParts.length; i++) {
        if (pParts[i].startsWith(':')) params[pParts[i].substring(1)] = rParts[i];
        else if (pParts[i] !== rParts[i]) { match = false; break; }
      }
      if (match) { handler = fn; routeParams = params; break; }
    }
  }
  if (handler) { try { await handler(req, res, parsed.query, routeParams); } catch (e) { console.error(e); json(res, 500, { ok: false, msg: e.message }); } return; }
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    if (pathname.startsWith('/menu/') || pathname.startsWith('/table/') || pathname.startsWith('/track/') || pathname.startsWith('/qr/') || pathname.startsWith('/admin') || pathname.startsWith('/dev')) {
      const fallback = path.join(__dirname, 'index.html');
      if (fs.existsSync(fallback)) { cors(res); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); fs.createReadStream(fallback).pipe(res); return; }
    }
    return json(res, 404, { ok: false, msg: 'Not found' });
  }
  const ext = path.extname(fullPath).slice(1);
  cors(res); res.writeHead(200, { 'Content-Type': (MIME[ext] || 'text/plain') + '; charset=utf-8' });
  fs.createReadStream(fullPath).pipe(res);
}).listen(PORT, () => {
  console.log(`\n✅ السيرفر يعمل: http://localhost:${PORT}`);
  console.log(`🔧 لوحة المطوّر: http://localhost:${PORT}/dev`);
  console.log(`🏪 لوحة الأدمن: http://localhost:${PORT}/admin`);
});
