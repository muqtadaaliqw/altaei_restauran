/**
 * ══════════════════════════════════════════════
 *  سيرفر نظام الاشتراكات — مطعم الطائي
 *  تشغيل: node server.js
 *  المنفذ: 5000
 * ══════════════════════════════════════════════
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT     = process.env.PORT || 5000;  // Railway يعطي PORT تلقائياً
const DB_FILE  = path.join(__dirname, 'licenses.json');
const DEV_PASS = 'dev@muqtada2025'; // ← غيّرها

/* ── قراءة/كتابة DB ── */
function readDB(){
  try{ return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
  catch{ return []; }
}
function writeDB(data){
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/* ── توليد مفتاح ── */
function genKey(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const s=()=>Array.from({length:4},()=>c[Math.floor(Math.random()*c.length)]).join('');
  return `${s()}-${s()}-${s()}-${s()}`;
}
function calcExpiry(type){
  const map={daily:1,monthly:30,'2months':60,'3months':90,'6months':180,yearly:365};
  const d=new Date();
  d.setDate(d.getDate()+(map[type]||30));
  return d.toISOString();
}

/* ── CORS + JSON ── */
function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Dev-Pass');
}
function json(res, code, data){
  cors(res);
  res.writeHead(code,{'Content-Type':'application/json;charset=utf-8'});
  res.end(JSON.stringify(data));
}

/* ── قراءة body ── */
function body(req){
  return new Promise(resolve=>{
    let d='';
    req.on('data',c=>d+=c);
    req.on('end',()=>{ try{resolve(JSON.parse(d))}catch{resolve({})} });
  });
}

/* ══════════════════════════════
   ROUTES
══════════════════════════════ */
const routes = {

  /* ─ الموقع يتحقق من مفتاحه ─ */
  'GET /api/check': (req,res,q)=>{
    const key=(q.key||'').toUpperCase().trim();
    if(!key) return json(res,400,{ok:false,msg:'مفتاح مفقود'});
    const db=readDB();
    const rec=db.find(r=>r.key===key);
    if(!rec) return json(res,404,{ok:false,msg:'المفتاح غير مسجّل'});
    if(rec.disabled) return json(res,403,{ok:false,msg:'الموقع موقوف مؤقتاً'});
    if(new Date(rec.expiry)<new Date()) return json(res,403,{ok:false,msg:'انتهى الاشتراك'});
    const days=Math.ceil((new Date(rec.expiry)-new Date())/864e5);
    json(res,200,{ok:true,client:rec.client,type:rec.type,expiry:rec.expiry,daysLeft:days});
  },

  /* ─ لوحة المطوّر: قراءة كل المفاتيح ─ */
  'GET /api/licenses': (req,res,q,auth)=>{
    if(!auth) return json(res,401,{ok:false,msg:'غير مصرّح'});
    json(res,200,{ok:true,data:readDB()});
  },

  /* ─ توليد مفتاح جديد ─ */
  'POST /api/generate': async(req,res,q,auth)=>{
    if(!auth) return json(res,401,{ok:false,msg:'غير مصرّح'});
    const b=await body(req);
    if(!b.client) return json(res,400,{ok:false,msg:'اسم الزبون مطلوب'});
    const key=genKey();
    const rec={
      key, client:b.client, phone:b.phone||'',
      type:b.type||'monthly', note:b.note||'',
      expiry:calcExpiry(b.type||'monthly'),
      created:new Date().toISOString(), disabled:false
    };
    const db=readDB(); db.push(rec); writeDB(db);
    json(res,200,{ok:true,rec});
  },

  /* ─ تفعيل / إيقاف ─ */
  'POST /api/toggle': async(req,res,q,auth)=>{
    if(!auth) return json(res,401,{ok:false,msg:'غير مصرّح'});
    const b=await body(req);
    const db=readDB();
    const rec=db.find(r=>r.key===b.key);
    if(!rec) return json(res,404,{ok:false,msg:'المفتاح غير موجود'});
    rec.disabled=!rec.disabled;
    writeDB(db);
    json(res,200,{ok:true,disabled:rec.disabled,client:rec.client});
  },

  /* ─ تجديد الاشتراك ─ */
  'POST /api/renew': async(req,res,q,auth)=>{
    if(!auth) return json(res,401,{ok:false,msg:'غير مصرّح'});
    const b=await body(req);
    const db=readDB();
    const rec=db.find(r=>r.key===b.key);
    if(!rec) return json(res,404,{ok:false,msg:'غير موجود'});
    const base=new Date(rec.expiry)>new Date()?new Date(rec.expiry):new Date();
    const map={daily:1,monthly:30,'2months':60,'3months':90,'6months':180,yearly:365};
    const type=b.type||rec.type;
    base.setDate(base.getDate()+(map[type]||30));
    rec.type=type; rec.expiry=base.toISOString(); rec.disabled=false;
    rec.renewedAt=new Date().toISOString();
    writeDB(db);
    json(res,200,{ok:true,rec});
  },

  /* ─ حذف مفتاح ─ */
  'POST /api/delete': async(req,res,q,auth)=>{
    if(!auth) return json(res,401,{ok:false,msg:'غير مصرّح'});
    const b=await body(req);
    const db=readDB().filter(r=>r.key!==b.key);
    writeDB(db);
    json(res,200,{ok:true});
  },

  /* ─ إحصائيات ─ */
  'GET /api/stats': (req,res,q,auth)=>{
    if(!auth) return json(res,401,{ok:false,msg:'غير مصرّح'});
    const db=readDB(), now=new Date();
    const active=db.filter(r=>!r.disabled&&new Date(r.expiry)>now).length;
    const expiring=db.filter(r=>!r.disabled&&new Date(r.expiry)>now&&Math.ceil((new Date(r.expiry)-now)/864e5)<=7).length;
    const disabled=db.filter(r=>r.disabled).length;
    const expired=db.filter(r=>!r.disabled&&new Date(r.expiry)<=now).length;
    json(res,200,{ok:true,total:db.length,active,expiring,disabled,expired});
  }
};

/* ══════════════════════════════
   SERVER
══════════════════════════════ */
const server = http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){cors(res);res.writeHead(204);res.end();return;}

  const parsed = url.parse(req.url,true);
  const route  = `${req.method} ${parsed.pathname}`;
  const auth   = req.headers['x-dev-pass']===DEV_PASS;

  const handler = routes[route];
  if(handler){
    try{ await handler(req,res,parsed.query,auth); }
    catch(e){ json(res,500,{ok:false,msg:'خطأ داخلي: '+e.message}); }
  } else {
    /* تقديم الملفات الثابتة */
    let filePath = path.join(__dirname, parsed.pathname==='/'?'index.html':parsed.pathname);
    if(!fs.existsSync(filePath)) return json(res,404,{ok:false,msg:'غير موجود'});
    const ext=path.extname(filePath);
    const mime={'html':'text/html','js':'application/javascript','css':'text/css','json':'application/json','svg':'image/svg+xml','png':'image/png','jpg':'image/jpeg','ico':'image/x-icon'}[ext.slice(1)]||'text/plain';
    cors(res);
    res.writeHead(200,{'Content-Type':mime+';charset=utf-8'});
    fs.createReadStream(filePath).pipe(res);
  }
});

server.listen(PORT,()=>{
  console.log(`\n✅ السيرفر يعمل على: http://localhost:${PORT}`);
  console.log(`🔑 كلمة سر المطوّر: ${DEV_PASS}`);
  console.log(`📋 لوحة المطوّر:  http://localhost:${PORT}/developer.html`);
  console.log(`🏪 موقع المطعم:   http://localhost:${PORT}/index.html\n`);
});
