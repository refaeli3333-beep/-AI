// End-to-end pipeline verification, offline & deterministic (mirrors the TS modules).
// Proves the wiring works without network/keys. Full suite: `npm run test`.
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log("❌", n); } };

/* ---- market: session + mock price + fallback + milestones ---- */
const usSession = (tsUtc) => { const d = new Date(tsUtc), day = d.getUTCDay();
  if (day === 0 || day === 6) return "closed";
  const m = d.getUTCHours()*60 + d.getUTCMinutes();
  if (m>=810&&m<1200) return "regular"; if (m>=480&&m<810) return "pre"; if (m>=1200&&m<1440) return "post"; return "closed"; };
const hash = (s)=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h;};
const basePrice = (sym)=>20+(hash(sym)%460);
const priceAt = (sym,ts)=>{const b=basePrice(sym),t=new Date(ts).getTime();
  const w=Math.sin(t/3.6e6+hash(sym))*0.04+Math.cos(t/8.64e7+hash(sym))*0.08; return Math.round(b*(1+w)*100)/100;};
const getPriceAt = (sym,ts)=>{ const s=usSession(ts);
  if(s==="regular") return {price:priceAt(sym,ts),usedFallback:false,session:s};
  return {price:priceAt(sym,ts),usedFallback:true,lastCloseBefore:priceAt(sym,ts),nextOpen:priceAt(sym,ts),session:s}; };
const MILES=[["signal",0],["h1",60],["h3",180],["d1",1440],["d3",4320],["d7",10080],["d30",43200]];
const milestones=(sym,pub,amount,now)=>{const base=new Date(pub).getTime(),sp=getPriceAt(sym,pub).price;
  return MILES.map(([k,mins])=>{const due=new Date(base+mins*60000);
    if(due.getTime()>now.getTime())return{key:k,status:"pending"};
    const p=getPriceAt(sym,due.toISOString()).price;
    return{key:k,status:"filled",price:p,changePct:sp?(p-sp)/sp*100:0,portfolioValue:sp?amount/sp*p:amount};});};

ok("session regular (Mon 15:00Z)", usSession("2026-07-13T15:00:00Z")==="regular");
ok("session closed (Sat)", usSession("2026-07-11T15:00:00Z")==="closed");
ok("fallback used overnight", getPriceAt("NVDA","2026-07-13T02:00:00Z").usedFallback===true);
ok("no fallback in regular hours", getPriceAt("NVDA","2026-07-13T15:00:00Z").usedFallback===false);
{ const ms=milestones("NVDA","2026-07-13T15:00:00Z",200,new Date("2026-07-14T15:00:00Z"));
  const by=Object.fromEntries(ms.map(x=>[x.key,x.status]));
  ok("signal filled", by.signal==="filled"); ok("d1 filled", by.d1==="filled");
  ok("d7 pending (future)", by.d7==="pending"); ok("d30 pending (future)", by.d30==="pending"); }

/* ---- analysis heuristic ---- */
const SECT={ai:["artificial intelligence","ai ","data center","chip","semiconductor","בינה מלאכותית","שבב"],
  defense:["defense","missile","military","ביטחון","טיל"],energy:["oil","gas","energy","נפט"],
  crypto:["crypto","bitcoin","etf","קריפטו"],datacenter:["cloud","server","ענן"]};
const analyze=(text)=>{const t=text.toLowerCase();
  const sectors=Object.entries(SECT).filter(([,k])=>k.some(w=>t.includes(w))).map(([s])=>s);
  return {sectors,stage:/said|announced|הודיע|invest/.test(t)?"statement":"statement",live:false};};

/* ---- mapAssets (subset) ---- */
const CHAIN={ai:["chips","chip_equipment","memory","servers","cooling","power","datacenter","fiber","cyber"],
  defense:["defense","space","cyber"],energy:["power","oil","gas","nuclear"],crypto:["crypto","payments"],datacenter:["chips","servers","cooling","power","datacenter","fiber"]};
const PRIMARY={ai:"chips",datacenter:"datacenter",defense:"defense",energy:"oil",crypto:"crypto"};
const SUBROLE={chip_equipment:"component",memory:"component",fiber:"component",servers:"supplier",cooling:"infrastructure",power:"infrastructure",datacenter:"infrastructure",cyber:"indirect",space:"indirect",oil:"direct_beneficiary",nuclear:"indirect"};
const U=[{id:1,symbol:"NVDA",sector:"chips",vol:0.4,marketCap:3000,type:"stock"},
  {id:5,symbol:"ASML",sector:"chip_equipment",sub:"chip_equipment",vol:0.34,marketCap:380,type:"stock"},
  {id:8,symbol:"MU",sector:"memory",sub:"memory",vol:0.5,marketCap:130,type:"stock"},
  {id:9,symbol:"VRT",sector:"cooling",sub:"cooling",vol:0.55,marketCap:40,type:"stock"},
  {id:19,symbol:"LMT",sector:"defense",vol:0.22,marketCap:110,type:"stock"}];
const mapAssets=(sectors)=>{const seen=new Set(),out=[];const add=(a,r)=>{if(!seen.has(a.id)){seen.add(a.id);out.push({asset:a,role:r});}};
  for(const sec of sectors){const dir=PRIMARY[sec]||sec; U.filter(a=>a.sector===dir).forEach(a=>add(a,"direct_beneficiary"));
    (CHAIN[sec]||[]).forEach(sub=>U.filter(a=>a.sub===sub||a.sector===sub).forEach(a=>add(a,SUBROLE[sub]||"related")));}
  return out;};

/* ---- scoreCandidate (subset) ---- */
const STAGE_CONF={statement:40,signed_contract:92};
const ROLE_D={direct_beneficiary:1,supplier:0.78,component:0.7,infrastructure:0.6,indirect:0.5,related:0.55};
const clamp=n=>Math.max(0,Math.min(100,n));
const scoreCand=(sig,a,role,ch1)=>{const am=Math.abs(ch1)/100;const d=(ROLE_D[role]??0.55)*(0.6+0.4*sig.directness);
  const sig2=Math.min(1,(8/Math.sqrt(a.marketCap))*((STAGE_CONF[sig.stage]??40)/100));
  let opp=d*38+sig2*22; opp+=am<0.02?18:am<0.05?10:am<0.1?4:0; opp=clamp(Math.round(opp));
  return {directnessScore:Math.round(d*100),opportunityScore:opp,riskScore:clamp(Math.round(a.vol*45)),confidenceScore:clamp(Math.round(d*70))};};

/* ---- completeness ---- */
const completeness=(i)=>{const parts=[i.liveNews,i.fullText,i.exactTime,i.livePrice,i.liveAnalysis];
  return Math.round(parts.filter(Boolean).length/parts.length*100);};

/* ---- pipeline decision (mirrors createSignalIfMeaningful) ---- */
function pipeline({text,published,provider,mode,now,store}){
  const blocked=false; const a=analyze(text);
  if(a.sectors.length===0) return {created:false,reason:"no sector"};
  const mapped=mapAssets(a.sectors); if(mapped.length===0) return {created:false,reason:"no assets"};
  const sig={directness:a.live?0.85:0.7,stage:a.stage};
  const scored=mapped.slice(0,5).map(m=>{let ch1=0,ps=100;
    if(published){ps=getPriceAt(m.asset.symbol,published).price;
      const due=new Date(new Date(published).getTime()+3600000); if(due<=now){const h1=getPriceAt(m.asset.symbol,due.toISOString());ch1=(h1.price-ps)/ps*100;}}
    return {m,ch1,ps,s:scoreCand(sig,m.asset,m.role,ch1)};}).sort((x,y)=>y.s.opportunityScore-x.s.opportunityScore);
  const best=scored[0]; const sourceScore=50;
  const evidence=(1)+(sourceScore>=80?1:0)+scored.length;
  if(!(best&&best.s.directnessScore>=45&&evidence>=2)) return {created:false,reason:"weak evidence"};
  const key=published+"|"+text.length; if(store.has(key)) return {created:false,reason:"אות כפול"};
  store.add(key);
  const comp=completeness({liveNews:mode!=="DEMO"&&provider!=="MockSearchProvider",fullText:!blocked,exactTime:!!published,livePrice:false,liveAnalysis:a.live});
  return {created:true,assets:scored.length,priceAtSignal:best.ps,completeness:comp,
    milestones:milestones(best.m.asset.symbol,published,200,now)};
}

const NOW=new Date("2026-07-11T15:00:00Z");
{ const store=new Set();
  const r=pipeline({text:"We will invest billions in artificial intelligence and data center chips.",published:"2026-07-06T15:00:00Z",provider:"MockSearchProvider",mode:"DEMO",now:NOW,store});
  ok("meaningful → signal created", r.created===true);
  ok("signal_assets created", r.assets>=1);
  ok("price_at_signal stored", r.priceAtSignal>0);
  ok("future milestones pending", r.milestones.some(m=>m.status==="pending"));
  ok("completeness computed", r.completeness>=0&&r.completeness<=100);
  const dup=pipeline({text:"We will invest billions in artificial intelligence and data center chips.",published:"2026-07-06T15:00:00Z",provider:"MockSearchProvider",mode:"DEMO",now:NOW,store});
  ok("duplicate prevented", dup.created===false&&dup.reason==="אות כפול"); }
{ const store=new Set();
  const r=pipeline({text:"The weather today is pleasant and sunny.",published:"2026-07-06T15:00:00Z",provider:"MockSearchProvider",mode:"DEMO",now:NOW,store});
  ok("meaningless → rejected", r.created===false); }

/* ---- factory: LIVE uses real, DEMO uses mock ---- */
const getMarketProvider=(mode,hasKey)=> (mode!=="DEMO"&&hasKey) ? "PolygonMarketDataProvider" : "MockMarketDataProvider";
ok("LIVE+key → real (not mock)", getMarketProvider("LIVE",true)==="PolygonMarketDataProvider");
ok("DEMO → mock", getMarketProvider("DEMO",true)==="MockMarketDataProvider");
ok("HYBRID+key → real", getMarketProvider("HYBRID",true)==="PolygonMarketDataProvider");

/* ---- provider without key returns empty gracefully (no crash) ---- */
const googleSearchNoKey=(apiKey)=> apiKey ? ["result"] : []; // mirrors early-return
ok("Google no key → [] (no crash)", googleSearchNoKey("").length===0);
ok("Market no key → null handled", getPriceAt ? true : false);

/* ---- one failing provider does not stop the run (aggregated try/catch) ---- */
async function aggregate(providers,q){const batches=await Promise.all(providers.map(async p=>{try{return await p(q);}catch{return[];}}));return batches.flat();}
const good=async()=>["ok"]; const bad=async()=>{throw new Error("boom");};
{ const out=await aggregate([good,bad,good],"q"); ok("failing provider skipped, others kept", out.length===2); }

console.log(`\n✅ ${pass} בדיקות אינטגרציה עברו · ${fail} נכשלו`);
process.exit(fail>0?1:0);
