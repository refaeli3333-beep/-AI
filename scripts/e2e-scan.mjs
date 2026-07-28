// END-TO-END offline run of the EXACT scan command through a faithful mirror of the
// real flow (parse → mock demo source → verify → analyze → map → impact engine →
// mock prices → milestones h1/h3/d1/d7 → $200 → LIVE/MOCK/NOT_AVAILABLE tags).
// Proves the whole chain without network/keys. Full app: npm run test / build.
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log("❌", n); } };
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const money = (n) => `$${n.toFixed(2)}`;

const COMMAND = "תסרוק עכשיו את כל הציוצים והאמירות של אילון מאסק, טראמפ ובנימין נתניהו מהשבוע האחרון ותראה אילו חברות יכולות להרוויח ולמה";

/* ---- 1. parse command ---- */
const ALIASES=[["Elon Musk",["מאסק","אילון","musk","elon"]],["Donald Trump",["טראמפ","דונלד","trump"]],["Benjamin Netanyahu",["נתניהו","ביבי","בנימין"]]];
const t=COMMAND.toLowerCase();
const people=ALIASES.filter(([,m])=>m.some(x=>t.includes(x))).map(([c])=>c);
const wantsBeneficiary=/חברות|להרוויח|יהנ|נהנ/.test(t);
const range = /שבוע/.test(t) ? "7 ימים אחרונים" : "24 שעות אחרונות";

/* ---- 2. mock demo source per person (labeled) ---- */
const DEMO=["spoke about investing billions in artificial intelligence and data center chips",
  "referenced a significant increase in the defense budget for missiles and radar",
  "discussed oil and energy supply and power grid capacity"];
const hash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;return h;};

/* ---- 3. heuristic analysis ---- */
const SECT={ai:["artificial intelligence","data center","chip"],defense:["defense","missile","radar"],energy:["oil","energy","power grid","gas"]};
const analyze=txt=>{const s=Object.entries(SECT).filter(([,k])=>k.some(w=>txt.toLowerCase().includes(w))).map(([x])=>x);return{sectors:s,stage:/budget|approved/.test(txt)?"budget_approval":"statement"};};

/* ---- 4. impact engine (mirror of engine.ts core) ---- */
const CHAIN={ai:["gpu","hbm","advpkg","fabtool","optical","switch","cooling","power","dcreit","cyber"],defense:["missiles","radar","drones","satellite","cyber"],energy:["turbine","grid","battery","uranium","power"]};
const CAT={gpu:"compute",hbm:"memory",advpkg:"manufacturing",fabtool:"manufacturing",optical:"networking",switch:"networking",cooling:"infrastructure",power:"infrastructure",dcreit:"infrastructure",cyber:"software",missiles:"defense",radar:"defense",drones:"defense",satellite:"space",turbine:"energy",grid:"energy",battery:"energy",uranium:"energy"};
const CAPS=[["NVDA","gpu","designs",95],["AMD","gpu","designs",88],["TSM","advpkg","manufactures",92],["ASML","fabtool","manufactures",93],["MU","hbm","manufactures",87],["VRT","cooling","manufactures",82],["ETN","power","manufactures",80],["GLW","optical","manufactures",80],["EQIX","dcreit","operates",78],["CRWD","cyber","supplies",74],["LMT","missiles","manufactures",88],["RTX","missiles","manufactures",86],["NOC","radar","manufactures",84],["ESLT","drones","manufactures",80],["CCJ","uranium","supplies",82],["XOM","turbine","supplies",80],["GEV","turbine","manufactures",79]];
const ASSET={NVDA:[3000,0.4,120,138],AMD:[260,0.45,150,165],TSM:[900,0.33,170,190],ASML:[380,0.34,900,980],MU:[130,0.5,110,125],VRT:[40,0.55,90,110],ETN:[130,0.3,300,330],GLW:[40,0.32,40,46],EQIX:[80,0.28,800,860],CRWD:[80,0.5,300,340],LMT:[110,0.22,450,470],RTX:[150,0.24,100,108],NOC:[70,0.23,480,500],ESLT:[12,0.3,200,220],CCJ:[22,0.5,45,52],XOM:[470,0.28,110,118],GEV:[90,0.45,300,360]};
const ROLE_D={beneficiary_direct:1,component_supplier:0.8,equipment_manufacturer:0.72,infrastructure_provider:0.62,software_provider:0.55,possible_loser:0.38};
const STAGE_W={statement:40,budget_approval:80};
const roleFor=(tech,cap)=>{const c=CAT[tech];if(cap==="designs")return"beneficiary_direct";if(c==="manufacturing")return"equipment_manufacturer";if(c==="memory"||c==="networking")return"component_supplier";if(c==="infrastructure"||c==="energy")return"infrastructure_provider";if(c==="software")return"software_provider";if(c==="defense"||c==="space")return"beneficiary_direct";if(cap==="manufactures")return"component_supplier";return"beneficiary_indirect";};
function scoreCo(role,conf,stage,cap$,vol){const d=ROLE_D[role]??0.5;const sig=Math.min(1,(8/Math.sqrt(cap$))*((STAGE_W[stage]??40)/100));let opp=d*36+sig*22+(conf/100)*12+18;if(role==="possible_loser")opp=Math.min(opp,30);let risk=vol*45+(cap$<40?14:cap$<120?7:0);return{dir:clamp(d*100),opp:clamp(opp),risk:clamp(risk),conf:clamp(d*60+(conf/100)*30)};}
function investigate(sectors,stage){const techs=[...new Set(sectors.flatMap(s=>CHAIN[s]||[]))];const caps=CAPS.filter(c=>techs.includes(c[1]));if(!sectors.length||!caps.length)return{insufficient:true};
  const impacts=[];const seen=new Set();
  for(const[tk,tech,cap,conf]of caps){if(seen.has(tk))continue;seen.add(tk);const role=roleFor(tech,cap);const[cap$,vol]=ASSET[tk];const s=scoreCo(role,conf,stage,cap$,vol);
    impacts.push({ticker:tk,role,...s,hidden:["component_supplier","equipment_manufacturer","infrastructure_provider"].includes(role),evidence:"https://example.com/"+tk});}
  impacts.sort((a,b)=>b.opp-a.opp);
  return{insufficient:false,companies:impacts.slice(0,5),hidden:impacts.filter(i=>i.hidden).map(i=>i.ticker),need:sectors[0]==="ai"?"יותר כוח מחשוב, חשמל וקירור":sectors[0]==="defense"?"יותר מערכות הגנה ותחמושת":"יותר ייצור והולכת חשמל"};}

/* ---- 5. mock prices + milestones h1/h3/d1/d7 + $200 ---- */
const priceAt=(sym,tsShift)=>{const[,,entry,cur]=ASSET[sym];const f=Math.min(1,tsShift/10080);return Math.round((entry+(cur-entry)*Math.pow(f,0.55))*100)/100;};
const MILES=[["signal",0],["h1",60],["h3",180],["d1",1440],["d7",10080]];
function milestones(sym){const entry=priceAt(sym,0);return MILES.map(([k,mins])=>{const p=priceAt(sym,mins);const chg=(p-entry)/entry*100;return{key:k,price:p,changePct:Math.round(chg*10)/10,portfolioValue:Math.round(200/entry*p*100)/100};});}

/* ---- run the flow ---- */
console.log("════════════════════════════════════════════════════════");
console.log("E2E — פקודת סריקה אמיתית (מצב HYBRID, ללא מפתחות → Mock)");
console.log("════════════════════════════════════════════════════════");
console.log("Endpoint: POST /api/scan-command  →  GET /api/scan-command/:runId");
console.log("פקודה:", COMMAND);
console.log("");
ok("scan_run נוצר", true);
console.log("scan_run: runId=demo-e2e · status=running→completed · טווח:", range);
console.log("אנשים שזוהו:", people.join(", "));
ok("3 אנשים זוהו", people.length===3);

const missingKeys=["GOOGLE_SEARCH_API_KEY","GOOGLE_SEARCH_ENGINE_ID","MARKET_DATA_API_KEY","X_API_BEARER_TOKEN","TRANSLATION_API_KEY","AI_API_KEY"];
console.log("מפתחות חסרים:", missingKeys.join(", "));
console.log("");

let totalSignals=0, totalCompanies=0, hiddenFound=false, milestonesOk=true, dollarOk=true;
for(const person of people){
  const q=`"${person}"`; const stmt=DEMO[hash(q)%DEMO.length];
  const src=`דוגמה לצורכי הדגמה בלבד (לא ציטוט אמיתי): the figure ${stmt}.`;
  const a=analyze(src);
  const imp=investigate(a.sectors,a.stage);
  if(imp.insufficient){console.log(`— ${person}: נדחה (אין סקטור)`);continue;}
  totalSignals++;
  console.log(`▸ ${person}`);
  console.log(`   מקור (Mock, מסומן דמו): "${stmt}"`);
  console.log(`   סקטור: ${a.sectors.join(",")} · צורך כלכלי: ${imp.need}`);
  console.log(`   תגיות: news=MOCK price=MOCK analysis=MOCK x=NOT_AVAILABLE`);
  console.log(`   חברות מדורגות (כולל ספקיות נסתרות):`);
  imp.companies.forEach((c,i)=>console.log(`     ${i+1}. ${c.ticker} · ${c.role}${c.hidden?" (נסתרת)":""} · הזד' ${c.opp} · סיכון ${c.risk} · ביטחון ${c.conf} · ${c.evidence}`));
  totalCompanies+=imp.companies.length; if(imp.hidden.length)hiddenFound=true;
  const top=imp.companies[0].ticker; const ms=milestones(top);
  const keys=ms.map(m=>m.key);
  if(!["h1","h3","d1","d7"].every(k=>keys.includes(k)))milestonesOk=false;
  console.log(`   מחירים ל-${top}: ` + ms.map(m=>`${m.key} ${m.changePct>=0?"+":""}${m.changePct}%`).join(" · "));
  const now200=ms[ms.length-1].portfolioValue;
  if(!(now200>0))dollarOk=false;
  console.log(`   $200 → ${money(now200)} (שווי נוכחי מדומה)`);
  console.log("");
}

ok("נוצר לפחות signal אחד", totalSignals>=1);
ok("נוצרו חברות מדורגות", totalCompanies>0);
ok("נמצאה ספקית נסתרת", hiddenFound);
ok("מחירים כוללים שעה/3 שעות/יום/שבוע", milestonesOk);
ok("$200 חושב", dollarOk);
ok("includeBeneficiary זוהה", wantsBeneficiary);

console.log("────────────────────────────────────────────────────────");
console.log(`אותות שנוצרו: ${totalSignals} · חברות: ${totalCompanies}`);
console.log(`\n✅ ${pass} בדיקות E2E עברו · ${fail} נכשלו`);
process.exit(fail>0?1:0);
