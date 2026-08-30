import express from "express";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import crypto from "crypto";
import { Rcon } from "rcon-client";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

const db = new Database("data.db");
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  user_id TEXT PRIMARY KEY,
  progress INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conversions(
  conversion_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS") return res.sendStatus(204);
  next();
});

const validUser = u => typeof u==="string" && /^[A-Za-z0-9_.-]{1,40}$/.test(u);

function ensureUser(u){
  db.prepare(`INSERT INTO users(user_id) VALUES(?) ON CONFLICT(user_id) DO NOTHING`).run(u);
}
function getUser(u){ return db.prepare("SELECT * FROM users WHERE user_id=?").get(u); }

function verifyLootably({userID, ip, revenue, currencyReward, hash}){
  const secret=process.env.LOOTABLY_POSTBACK_SECRET;
  if(!secret || !hash) return false;
  const raw=`${userID}${ip}${revenue}${currencyReward}${secret}`;
  const calc=crypto.createHash("sha256").update(raw).digest("hex");
  const a=Buffer.from(calc,"utf8"), b=Buffer.from(String(hash),"utf8");
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}

async function giveVip(userID){
  const rcon=await Rcon.connect({
    host: process.env.MC_RCON_HOST,
    port: Number(process.env.MC_RCON_PORT || 25575),
    password: process.env.MC_RCON_PASSWORD
  });
  try{
    const duration=process.env.VIP_DURATION || "1d";
    return await rcon.send(`lp user ${userID} parent addtemp vip ${duration}`);
  } finally { rcon.end(); }
}

app.get("/",(_,res)=>res.json({ok:true,service:"IDRARIUM-ANARCHY VIP backend"}));

app.get("/api/progress/:userId",(req,res)=>{
  const u=req.params.userId;
  if(!validUser(u)) return res.status(400).json({error:"Pseudo Minecraft invalide"});
  ensureUser(u);
  const row=getUser(u);
  res.json({userId:u,progress:row.progress,needed:5});
});

/*
  Lootably postback:
  https://YOUR-BACKEND.onrender.com/api/lootably/postback
    ?userID={userID}&ip={ip}&revenue={revenue}
    &currencyReward={currencyReward}&hash={hash}

  Passer le pseudo Minecraft comme userID.
*/
app.get("/api/lootably/postback", async (req,res)=>{
  const {userID, ip="", revenue="0", currencyReward="0", hash=""}=req.query;
  if(!validUser(userID)) return res.status(400).send("invalid userID");
  if(!verifyLootably({userID:String(userID),ip:String(ip),revenue:String(revenue),
    currencyReward:String(currencyReward),hash:String(hash)}))
    return res.status(401).send("invalid hash");

  const key=crypto.createHash("sha256")
    .update(`${userID}|${ip}|${revenue}|${currencyReward}|${hash}`).digest("hex");

  if(db.prepare("SELECT conversion_key FROM conversions WHERE conversion_key=?").get(key))
    return res.send("1");

  const tx=db.transaction(()=>{
    ensureUser(String(userID));
    db.prepare("INSERT INTO conversions(conversion_key,user_id) VALUES(?,?)")
      .run(key,String(userID));
    db.prepare("UPDATE users SET progress=progress+1,updated_at=CURRENT_TIMESTAMP WHERE user_id=?")
      .run(String(userID));
  });
  tx();

  const row=getUser(String(userID));
  if(row.progress>=5){
    try{
      await giveVip(String(userID));
      db.prepare("UPDATE users SET progress=progress-5,updated_at=CURRENT_TIMESTAMP WHERE user_id=?")
        .run(String(userID));
    }catch(e){
      console.error("RCON/VIP error:",e.message);
      return res.status(500).send("vip grant failed");
    }
  }
  return res.send("1");
});

app.listen(PORT,()=>console.log(`Backend running on port ${PORT}`));
