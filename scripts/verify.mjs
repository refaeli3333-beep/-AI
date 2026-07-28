// Offline verification of core pure logic (mirrors the TS modules 1:1).
// Runs with plain node — no dependencies. `npm run test` runs the full Vitest suite.
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log("❌", n); } };

/* ---- dedupe ---- */
const normalizeUrl = (raw) => { try { const u = new URL(raw); u.hash = "";
  ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","ref"].forEach(k=>u.searchParams.delete(k));
  u.hostname = u.hostname.replace(/^www\./,"").toLowerCase(); let s=u.toString(); if(s.endsWith("/"))s=s.slice(0,-1); return s;
} catch { return raw.trim(); } };
const contentHash = (title,snippet) => { const t=`${title}\n${snippet}`.toLowerCase().replace(/\s+/g," ").trim();
  let h=5381; for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))>>>0; return h.toString(16); };
const dedupe = (res, U=new Set(), H=new Set()) => { const out=[]; for(const r of res){ const n=normalizeUrl(r.url), h=contentHash(r.title,r.snippet);
  if(!n||U.has(n)||H.has(h))continue; U.add(n);H.add(h);out.push({...r,url:n}); } return out; };

ok("url normalize strips trackers/www/slash", normalizeUrl("https://www.Example.com/a/?utm_source=x#h")==="https://example.com/a");
ok("hash equal for same content", contentHash("A","B")===contentHash("a","b"));
ok("hash differs for different content", contentHash("A","B")!==contentHash("A","C"));
{ const o=dedupe([{url:"https://x.com/1",title:"a",snippet:"1"},{url:"https://x.com/1/",title:"b",snippet:"2"},{url:"https://x.com/2",title:"c",snippet:"3"}]); ok("dup url removed",o.length===2); }
{ const o=dedupe([{url:"https://a.com/x",title:"same",snippet:"b"},{url:"https://b.com/y",title:"same",snippet:"b"}]); ok("dup content removed",o.length===1); }
{ const U=new Set(),H=new Set(); dedupe([{url:"https://x.com/1",title:"t",snippet:"s"}],U,H);
  ok("idempotent across runs", dedupe([{url:"https://x.com/1",title:"t",snippet:"s"}],U,H).length===0); }

/* ---- sourceScore ---- */
const KIND={official_site:100,exchange_filing:95,verified_account:90,news_agency:80,financial_paper:70,secondary_news:50,blog:30,anonymous:10};
const isGov=(d)=>d.endsWith(".gov")||d.endsWith(".mil")||d.includes(".gov.")||d.startsWith("gov.")||d.includes("gov.il")||d.includes("gov.uk")||d.includes("europa.eu")||d.includes("whitehouse.gov");
const classify=(d)=>{d=d.toLowerCase();
  if(["sec.gov","sedar","investor."].some(f=>d.includes(f)))return"exchange_filing";
  if(isGov(d))return"official_site";
  if(["reuters.com","apnews.com","bloomberg.com"].some(a=>d.includes(a)))return"news_agency";
  if(["ft.com","wsj.com","cnbc.com","marketwatch.com","calcalist","globes"].some(f=>d.includes(f)))return"financial_paper";
  if(d.includes("blog")||d.includes("medium.com")||d.includes("substack"))return"blog";
  if(!d)return"anonymous"; return"secondary_news";};
const scoreSource=(d)=>KIND[classify(d)];
const independent=(ds)=>new Set(ds.map(d=>d.toLowerCase())).size;
ok("gov.il = 100", scoreSource("gov.il")===100);
ok("sec.gov = 95", scoreSource("sec.gov")===95);
ok("agency > secondary", scoreSource("reuters.com")>scoreSource("x.net"));
ok("secondary > blog", scoreSource("x.net")>scoreSource("a.medium.com"));
ok("copies count as one independent source", independent(["a.com","a.com","b.com"])===2);

/* ---- query budget ---- */
const BUDGET={high:5,medium:2,low:1};
const buildQueries=(p)=>{ const name=`"${p.full_name}"`; const b=BUDGET[p.scan_priority||"medium"];
  const out=[]; ["latest statement","announcement","interview"].forEach(s=>out.push({text:`${name} ${s}`,kind:"fresh"}));
  ["investment","contract","sanctions"].forEach(s=>out.push({text:`${name} ${s}`,kind:"financial"}));
  (p.official_domains||[]).slice(0,2).forEach(d=>out.push({text:`site:${d} ${name}`,kind:"official"}));
  out.push({text:`site:gov ${name}`,kind:"official"});
  if((p.search_languages||[]).includes("he")||p.name_in_original_language){const h=`"${p.name_in_original_language||p.full_name}"`;
    ["הודיע","אמר"].forEach(s=>out.push({text:`${h} ${s}`,kind:"language"}));}
  const order=["fresh","financial","official","language"]; out.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
  const seen=new Set(); return out.filter(q=>{const k=q.text.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;}).slice(0,b); };
ok("high budget = 5", buildQueries({full_name:"X",scan_priority:"high",official_domains:["gov.il"],search_languages:["he"],name_in_original_language:"איקס"}).length===5);
ok("low budget = 1", buildQueries({full_name:"X",scan_priority:"low"}).length===1);
ok("queries use only passed name", buildQueries({full_name:"Some Person",scan_priority:"medium"}).every(q=>q.text.includes("Some Person")));

/* ---- quota ---- */
class Quota{constructor(q){this.q=q;this.u=0;this.rl=false;}inc(n=1,rl=false){this.u+=n;if(rl)this.rl=true;}
  st(){const r=Math.max(0,this.q-this.u);return{used:this.u,remaining:r,exhausted:r<=0,dailyQuota:this.q};}low(){return this.st().remaining/this.q<0.2;}}
{ const q=new Quota(3); ok("quota starts full",q.st().remaining===3); q.inc(3); ok("quota exhausts",q.st().exhausted===true); }
{ const q=new Quota(10); q.inc(9); ok("quota low<20%",q.low()===true); }

/* ---- simulate ---- */
const simulate=(a,e,c)=>{if(!e||e<=0)throw new Error("entry>0");const u=a/e;const v=u*c;return{units:u,currentValue:v,profitLoss:v-a,profitLossPercent:(v-a)/a*100};};
ok("units 200/125=1.6", Math.abs(simulate(200,125,125).units-1.6)<1e-9);
ok("profit +40", Math.abs(simulate(200,100,120).profitLoss-40)<1e-9);
ok("pct +20", Math.abs(simulate(200,100,120).profitLossPercent-20)<1e-9);
let threw=false; try{simulate(200,0,100);}catch{threw=true;} ok("zero entry throws",threw);

console.log(`\n✅ ${pass} בדיקות ליבה עברו · ${fail} נכשלו`);
process.exit(fail>0?1:0);
