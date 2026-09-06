
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { pool, initDb } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ADMIN_KEY = process.env.MOTOBOARD_ADMIN_KEY || "change-me";
const TOKEN_SECRET = process.env.MOTOBOARD_TOKEN_SECRET || "change-me-too";

app.use(cors());
app.use(express.json({limit:"2mb"}));

function admin(req,res,next){
  const key = req.headers["x-admin-key"] || req.query.key;
  if(key !== ADMIN_KEY) return res.status(401).json({error:"Unauthorized"});
  next();
}

function signToken(user){
  const p=Buffer.from(JSON.stringify({id:user.id,username:user.username,exp:Date.now()+2592000000})).toString("base64url");
  const s=crypto.createHmac("sha256",TOKEN_SECRET).update(p).digest("base64url");
  return p+"."+s;
}
function readToken(token){
  try{
    const [p,s]=String(token||"").split(".");
    const e=crypto.createHmac("sha256",TOKEN_SECRET).update(p).digest("base64url");
    if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e))) return null;
    const o=JSON.parse(Buffer.from(p,"base64url").toString("utf8"));
    return o.exp>Date.now()?o:null;
  }catch{return null}
}
function auth(req,res,next){
  const u=readToken(String(req.headers.authorization||"").replace(/^Bearer\s+/i,""));
  if(!u)return res.status(401).json({error:"Unauthorized"});
  req.user=u; next();
}

const adminHtml = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MotoBoard Admin</title><style>
body{font-family:system-ui;margin:0;background:#0b1117;color:#eef4f7}.w{max-width:1000px;margin:auto;padding:18px}
.p{background:#121c24;border:1px solid #273742;border-radius:14px;padding:14px;margin:12px 0}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}input,select{padding:11px;border-radius:9px;border:1px solid #334550;background:#0a1117;color:white;width:100%;box-sizing:border-box}
button{padding:10px 13px;border:0;border-radius:9px;font-weight:700}.ok{background:#7dff68}.sec{background:#26343d;color:white}.bad{background:#51272b;color:#ffb5b1}
.row{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #273742}
@media(max-width:700px){.row{grid-template-columns:1fr}.g{grid-template-columns:1fr}}</style></head>
<body><div class="w"><h1>MotoBoard Admin</h1>
<div class="p"><input id="key" type="password" placeholder="Admin key"><button class="sec" id="login">Загрузить объявления</button></div>
<div class="p"><h3>Новое объявление</h3><div class="g">
<input id="title" placeholder="Название"><input id="price" type="number" placeholder="Цена"><input id="city" placeholder="Город">
<select id="type"><option>Эндуро</option><option>Питбайк</option><option>Кросс</option></select>
<input id="year" type="number" placeholder="Год"><input id="cc" type="number" placeholder="Кубатура"><input id="hours" type="number" placeholder="Моточасы"><input id="source" placeholder="Источник">
<input id="url" placeholder="Ссылка"><input id="image" placeholder="URL изображения">
</div><button class="ok" id="add">Добавить</button></div>
<div class="p"><h3>Объявления</h3><div id="list"></div></div></div>
<script>
const q=id=>document.getElementById(id), key=()=>q('key').value;
async function req(url,opt={}){opt.headers={...(opt.headers||{}),'content-type':'application/json','x-admin-key':key()};const r=await fetch(url,opt);const d=await r.json();if(!r.ok)throw Error(d.error||r.status);return d}
async function load(){try{const d=await req('/api/admin/listings');q('list').innerHTML=d.items.map(x=>'<div class="row"><b>'+esc(x.title)+'</b><span>'+esc(x.type)+'</span><input id="p_'+x.id+'" type="number" value="'+Number(x.price||0)+'"><span><button class="sec" onclick="price(\\''+x.id+'\\')">Цена</button> <button class="bad" onclick="delx(\\''+x.id+'\\')">Удалить</button></span></div>').join('')}catch(e){alert(e.message)}}
async function price(id){await req('/api/admin/listings/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({price:+q('p_'+id).value})});load()}
async function delx(id){if(confirm('Удалить?')){await req('/api/admin/listings/'+encodeURIComponent(id),{method:'DELETE'});load()}}
q('login').onclick=load;q('add').onclick=async()=>{const b={title:q('title').value,price:+q('price').value,city:q('city').value,type:q('type').value,year:+q('year').value,cc:+q('cc').value,hours:+q('hours').value,source:q('source').value,url:q('url').value,image:q('image').value};await req('/api/admin/listings',{method:'POST',body:JSON.stringify(b)});load()}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
</script></body></html>`;

app.get("/", (req,res)=>res.send("MotoBoard API is running"));
app.get("/health",(req,res)=>res.json({ok:true}));

app.get("/api/listings",async(req,res)=>{
  const {rows}=await pool.query("select id,source,title,price::float,city,year,cc,hours,type,url,image from listings order by created_at desc");
  res.json({items:rows});
});
app.get("/admin/",(req,res)=>res.type("html").send(adminHtml));

app.get("/api/admin/listings",admin,async(req,res)=>{
  const {rows}=await pool.query("select id,source,title,price::float,city,year,cc,hours,type,url,image from listings order by created_at desc");
  res.json({items:rows});
});
app.post("/api/admin/listings",admin,async(req,res)=>{
  const x=req.body||{}, id=crypto.randomUUID();
  await pool.query(`insert into listings(id,source,title,price,city,year,cc,hours,type,url,image) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id,String(x.source||"MotoBoard Admin"),String(x.title||"Мотоцикл"),Number(x.price||0),String(x.city||""),Number(x.year||0),Number(x.cc||0),Number(x.hours||0),["Питбайк","Эндуро","Кросс"].includes(x.type)?x.type:"Эндуро",String(x.url||""),String(x.image||"")]);
  res.json({ok:true,id});
});
app.put("/api/admin/listings/:id",admin,async(req,res)=>{
  const cur=(await pool.query("select * from listings where id=$1",[req.params.id])).rows[0];
  if(!cur)return res.status(404).json({error:"Not found"});
  const x={...cur,...req.body};
  await pool.query(`update listings set source=$2,title=$3,price=$4,city=$5,year=$6,cc=$7,hours=$8,type=$9,url=$10,image=$11,updated_at=now() where id=$1`,
  [req.params.id,x.source,x.title,Number(x.price),x.city,Number(x.year||0),Number(x.cc||0),Number(x.hours||0),x.type,x.url,x.image]);
  res.json({ok:true});
});
app.delete("/api/admin/listings/:id",admin,async(req,res)=>{
  await pool.query("delete from listings where id=$1",[req.params.id]);res.json({ok:true});
});

app.post("/api/auth/register",async(req,res)=>{
  try{
    const username=String(req.body.username||"").trim().toLowerCase(),password=String(req.body.password||"");
    if(username.length<3||password.length<6)return res.status(400).json({error:"Слишком короткий логин или пароль"});
    const exists=(await pool.query("select 1 from users where username=$1",[username])).rowCount;
    if(exists)return res.status(400).json({error:"Такой пользователь уже есть"});
    const salt=crypto.randomBytes(16).toString("hex"),hash=crypto.scryptSync(password,salt,64).toString("hex"),id=crypto.randomUUID();
    await pool.query("insert into users(id,username,salt,hash) values($1,$2,$3,$4)",[id,username,salt,hash]);
    const user={id,username};res.json({token:signToken(user),user});
  }catch(e){res.status(500).json({error:"Ошибка сервера"})}
});
app.post("/api/auth/login",async(req,res)=>{
  const username=String(req.body.username||"").trim().toLowerCase(),password=String(req.body.password||"");
  const u=(await pool.query("select * from users where username=$1",[username])).rows[0];
  if(!u)return res.status(401).json({error:"Неверный логин или пароль"});
  const h=crypto.scryptSync(password,u.salt,64).toString("hex");
  if(!crypto.timingSafeEqual(Buffer.from(h,"hex"),Buffer.from(u.hash,"hex")))return res.status(401).json({error:"Неверный логин или пароль"});
  const user={id:u.id,username:u.username};res.json({token:signToken(user),user});
});
app.get("/api/save",auth,async(req,res)=>{
  const s=(await pool.query('select state,updated_at as "updatedAt" from saves where user_id=$1',[req.user.id])).rows[0]||null;
  res.json({save:s});
});
app.put("/api/save",auth,async(req,res)=>{
  const {rows}=await pool.query(`insert into saves(user_id,state) values($1,$2) on conflict(user_id) do update set state=excluded.state,updated_at=now() returning state,updated_at as "updatedAt"`,[req.user.id,req.body.state]);
  res.json({save:rows[0]});
});

await initDb();
app.listen(PORT,()=>console.log("MotoBoard running on port "+PORT));
