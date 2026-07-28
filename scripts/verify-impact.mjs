// Offline verification of the Economic Impact engine's core logic (mirrors engine.ts).
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log("❌", n); } };
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

const CHAIN = {
  ai: ["gpu","hbm","advpkg","fabtool","optical","switch","cooling","power","dcreit","cyber"],
  defense: ["missiles","radar","drones","satellite","cyber"],
  energy: ["turbine","grid","battery","uranium","power"],
};
const CAT = { gpu:"compute", hbm:"memory", advpkg:"manufacturing", fabtool:"manufacturing",
  optical:"networking", switch:"networking", cooling:"infrastructure", power:"infrastructure",
  dcreit:"infrastructure", cyber:"software", missiles:"defense", radar:"defense", drones:"defense",
  satellite:"space", turbine:"energy", grid:"energy", battery:"energy", uranium:"energy" };
const CAPS = [
  ["NVDA","gpu","designs",95],["AMD","gpu","designs",88],["TSM","advpkg","manufactures",92],
  ["ASML","fabtool","manufactures",93],["AMAT","fabtool","manufactures",84],["MU","hbm","manufactures",87],
  ["GLW","optical","manufactures",80],["VRT","cooling","manufactures",82],["ETN","power","manufactures",80],
  ["DELL","gpu","manufactures",76],["EQIX","dcreit","operates",78],["CRWD","cyber","supplies",74],
  ["LMT","missiles","manufactures",88],["RTX","missiles","manufactures",86],["NOC","radar","manufactures",84],
  ["ESLT","drones","manufactures",80],["CCJ","uranium","supplies",82],
];
const ASSET = { NVDA:[3000,0.4],AMD:[260,0.45],TSM:[900,0.33],ASML:[380,0.34],AMAT:[170,0.36],MU:[130,0.5],
  GLW:[40,0.32],VRT:[40,0.55],ETN:[130,0.3],DELL:[90,0.42],EQIX:[80,0.28],CRWD:[80,0.5],
  LMT:[110,0.22],RTX:[150,0.24],NOC:[70,0.23],ESLT:[12,0.3],CCJ:[22,0.5] };
const COMPET = [["NVDA","AMD"],["LMT","RTX"]];
const STAGE_W = { hint:20,statement:40,plan:55,budget_approval:80,signed_contract:92 };
const STAGE_ORDER=["רמז","אמירה","כוונה","תוכנית","תקציב","רגולציה","מכרז","חוזה","הזמנה","ייצור","אספקה","הכנסה"];
const STAGE_MAP={hint:"רמז",statement:"אמירה",plan:"תוכנית",budget_approval:"תקציב",signed_contract:"חוזה"};
const ROLE_D={beneficiary_direct:1,component_supplier:0.8,equipment_manufacturer:0.72,infrastructure_provider:0.62,software_provider:0.55,beneficiary_indirect:0.55,competitor:0.4,possible_loser:0.38};

const techsFor = (sectors) => { const s=new Set(); sectors.forEach(x=>(CHAIN[x]||[]).forEach(t=>s.add(t))); return [...s]; };
const capsFor = (techIds) => { const s=new Set(techIds); return CAPS.filter(c=>s.has(c[1])); };
const roleForCap = (tech, capType) => { const cat=CAT[tech];
  if(capType==="designs")return"beneficiary_direct";
  if(cat==="manufacturing")return"equipment_manufacturer";
  if(cat==="memory"||cat==="networking")return"component_supplier";
  if(cat==="infrastructure"||cat==="energy")return"infrastructure_provider";
  if(cat==="software")return"software_provider";
  if(cat==="defense"||cat==="space")return"beneficiary_direct";
  if(capType==="manufactures")return"component_supplier"; return"beneficiary_indirect"; };
const dist = (stage) => { const heb=STAGE_MAP[stage]||"אמירה"; const idx=STAGE_ORDER.indexOf(heb);
  return idx>=8?"short":idx>=5?"medium":"long"; };
function scoreCompany(role, conf, stage, movedPct, cap$, vol){
  const d=ROLE_D[role]??0.5; const sig=Math.min(1,(8/Math.sqrt(cap$||100))*((STAGE_W[stage]??40)/100));
  const am=Math.abs(movedPct)/100; let opp=d*36+sig*22+(conf/100)*12;
  opp+=am<0.02?18:am<0.05?10:am<0.1?4:0; if(role==="competitor"||role==="possible_loser")opp=Math.min(opp,30);
  let risk=vol*45+(cap$<40?14:cap$<120?7:0)+(am>0.12?14:am>0.06?7:0);
  return {directnessScore:clamp(d*100),opportunityScore:clamp(opp),riskScore:clamp(risk),alreadyPricedInScore:clamp(am*100),confidenceScore:clamp(d*60+(conf/100)*30)};
}
function investigate({sectors,stage,priceChange={}}){
  const techIds=techsFor(sectors); const caps=capsFor(techIds);
  if(!sectors.length||!caps.length) return {insufficient:true,note:"אין כרגע מספיק ראיות"};
  const impacts=[]; const seen=new Set();
  for(const [tk,tech,capType,conf] of caps){ if(seen.has(tk))continue; seen.add(tk);
    const role=roleForCap(tech,capType); const [cap$,vol]=ASSET[tk]||[100,0.4];
    const pc=priceChange[tk]; const s=scoreCompany(role,conf,stage,pc?.changeH1Pct??0,cap$,vol);
    let cat = (role==="possible_loser"||role==="competitor")?"עלולה להיפגע":
      (s.directnessScore>=70 ? (pc? (pc.reacted?"קשר חזק והמחיר כבר הגיב":"קשר חזק והמחיר עדיין לא הגיב"):"קשר חזק") : "קשר עקיף");
    impacts.push({ticker:tk,role,...s,reactionCategory:cat,distanceToRevenue:dist(stage),evidence:[{sourceUrl:"https://example.com/"+tk}]});
  }
  // competitors as possible losers
  const direct=impacts.filter(i=>i.role==="beneficiary_direct").map(i=>i.ticker);
  for(const [a,b] of COMPET){ let loser=null; if(direct.includes(a)&&!seen.has(b))loser=b; if(direct.includes(b)&&!seen.has(a))loser=a;
    if(loser){seen.add(loser); const [cap$,vol]=ASSET[loser]||[100,0.4]; const s=scoreCompany("possible_loser",60,stage,0,cap$,vol);
      impacts.push({ticker:loser,role:"possible_loser",...s,reactionCategory:"עלולה להיפגע",distanceToRevenue:dist(stage),evidence:[]});}}
  impacts.sort((x,y)=>y.opportunityScore-x.opportunityScore);
  // pick five archetypes
  const out=[]; const used=new Set();
  const take=(pred)=>{const c=impacts.find(x=>!used.has(x.ticker)&&pred(x)); if(c){used.add(c.ticker);out.push(c);}};
  take(c=>c.role==="beneficiary_direct"); take(c=>c.role==="component_supplier");
  take(c=>["equipment_manufacturer","infrastructure_provider"].includes(c.role));
  take(c=>c.reactionCategory==="קשר חזק והמחיר עדיין לא הגיב"); take(c=>c.role==="possible_loser");
  for(const c of impacts){ if(out.length>=5)break; if(!used.has(c.ticker)){used.add(c.ticker);out.push(c);} }
  return {insufficient:false, companies:out.slice(0,5), directBeneficiaries:impacts.filter(i=>i.role==="beneficiary_direct").map(i=>i.ticker),
    hiddenSuppliers:impacts.filter(i=>["component_supplier","equipment_manufacturer","infrastructure_provider"].includes(i.role)).map(i=>i.ticker),
    requiredTechnologies:techIds, requiredComponents:techIds.filter(t=>["hbm","fabtool","optical","cooling","power","missiles","radar"].includes(t))};
}

// --- assertions (mirror the vitest expectations) ---
{ const r=investigate({sectors:["ai"],stage:"plan"});
  ok("AI: not insufficient", !r.insufficient);
  ok("AI: technologies detected", r.requiredTechnologies.length>3);
  ok("AI: components detected", r.requiredComponents.length>0);
  ok("AI: companies present", r.companies.length>0);
  ok("AI: <=5 companies", r.companies.length<=5);
  ok("AI: NVDA is direct beneficiary", r.directBeneficiaries.includes("NVDA"));
  ok("AI: hidden suppliers present (not only NVDA)", r.hiddenSuppliers.length>0);
  const c=r.companies[0];
  ok("scores in 0..100", [c.opportunityScore,c.riskScore,c.alreadyPricedInScore,c.confidenceScore].every(v=>v>=0&&v<=100)); }
{ const r=investigate({sectors:["defense"],stage:"budget_approval"});
  ok("defense: LMT direct beneficiary", r.directBeneficiaries.includes("LMT"));
  ok("defense: every capability company has evidence url", r.companies.filter(c=>c.evidence.length).every(c=>/^https?:\/\//.test(c.evidence[0].sourceUrl))); }
{ const r=investigate({sectors:[],stage:"statement"});
  ok("no sector → insufficient", r.insufficient===true && r.note.includes("אין כרגע מספיק ראיות")); }
{ const hint=investigate({sectors:["ai"],stage:"hint"}); const con=investigate({sectors:["ai"],stage:"signed_contract"});
  ok("hint far from revenue", hint.companies[0].distanceToRevenue==="long");
  ok("contract closer to revenue", ["short","medium"].includes(con.companies[0].distanceToRevenue)); }
{ const r=investigate({sectors:["ai"],stage:"budget_approval",priceChange:{NVDA:{changeH1Pct:0.1,changeNowPct:0.2,reacted:false}}});
  const nvda=r.companies.find(c=>c.ticker==="NVDA");
  ok("strong connection, price not reacted flagged", nvda && nvda.reactionCategory.includes("עדיין לא הגיב")); }

console.log(`\n✅ ${pass} בדיקות מנוע השפעה עברו · ${fail} נכשלו`);
process.exit(fail>0?1:0);
