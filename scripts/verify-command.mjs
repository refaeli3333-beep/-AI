// Offline verification of the NL command parser (mirrors nlCommand.ts).
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log("❌", n); } };

const PEOPLE=[["Elon Musk",["elon","musk","מאסק","אילון"]],["Donald Trump",["trump","טראמפ","דונלד"]],
  ["Benjamin Netanyahu",["netanyahu","נתניהו","ביבי","בנימין"]],["Jensen Huang",["jensen","huang","אנבידיה"]]];
const COMPANIES=[["NVDA",["nvidia","nvda"]],["AAPL",["apple","aapl"]],["TSLA",["tesla","tsla"]]];
const resolveCompany=t=>{t=t.toLowerCase();for(const[tk,m]of COMPANIES)if(m.some(x=>t.includes(x)))return tk;return undefined;};
const TOPIC={ai:["ai","בינה מלאכותית","בינה"],datacenter:["מרכזי נתונים","ענן"],defense:["ביטחון","בטחון","צבא","מלחמה","טילים"],
  energy:["אנרגיה","נפט","גז","חשמל"],crypto:["קריפטו","ביטקוין","מטבע"]};
const CHIP=["שבב","שבבים","chip"];
const resolvePeople=(t)=>{t=t.toLowerCase();const p=[];for(const [c,m] of PEOPLE){if(m.some(x=>t.includes(x)))p.push(c);}return p;};
const resolveTopics=(t)=>{t=t.toLowerCase();const s=new Set();for(const[k,kw]of Object.entries(TOPIC))if(kw.some(x=>t.includes(x)))s.add(k);if(CHIP.some(x=>t.includes(x)))s.add("ai");return[...s];};
const DAY=86400000;
function resolveDateRange(text,now,tz){const t=text.toLowerCase();const local=new Date(now.getTime()+tz*60000);
  const startLocal=()=>{const d=new Date(local);d.setUTCHours(0,0,0,0);return new Date(d.getTime()-tz*60000);};
  const minus=ms=>new Date(now.getTime()-ms);
  if(/היום|מהבוקר|today/.test(t))return{from:startLocal(),fromLabel:"מתחילת היום"};
  if(/24 השעות|24 שעות|ב-?24|last 24|24 hours/.test(t))return{from:minus(DAY),fromLabel:"24 שעות אחרונות"};
  if(/השבוע האחרון|7 הימים|7 ימים|last 7 days|last week|this week|שבוע/.test(t))return{from:minus(7*DAY),fromLabel:"7 ימים אחרונים"};
  if(/החודש|30 ימים|30 הימים|this month|last month|last 30 days|חודש/.test(t))return{from:minus(30*DAY),fromLabel:"30 ימים אחרונים"};
  return{from:minus(DAY),fromLabel:"24 שעות אחרונות"};}
function parse(text,now,tz){const people=resolvePeople(text);const company=resolveCompany(text);const topics=resolveTopics(text);const dr=resolveDateRange(text,now,tz);
  const t=text.toLowerCase();const analyzeVerb=/\banalyze\b|לנתח|ניתוח/.test(t);
  const commandType=(company&&(analyzeVerb||people.length===0))?"analyze_company":"scan_people";
  return {people,company:commandType==="analyze_company"?company:undefined,commandType,topics,dateRange:dr,includeBeneficiaryCompanies:/מ[נ]?יות|מניה|חבר|להרוויח|להשפיע|שוק/.test(t)||/יהנ|נהנ/.test(t),
    onlyNotReacted:/לא הגיב|עדיין לא/.test(t),onlyMovedStocks:/תנועה|זזו|יצרו תנועה/.test(t)&&!/לא הגיב/.test(t),
    sourceTypes:/ציוץ|ציוצים|tweet|פוסט/.test(t)?["x_posts"]:["x_posts","official_statements","news"]};}

const NOW=new Date("2026-07-11T09:00:00Z"),TZ=180;
{ const c=parse("תמצא לי את כל הציוצים של אילון מאסק מהשבוע האחרון",NOW,TZ);
  ok("person Elon Musk",c.people.includes("Elon Musk"));
  ok("tweets source",c.sourceTypes.includes("x_posts"));
  ok("last-week range",c.dateRange.fromLabel==="7 ימים אחרונים"); }
{ const r=resolveDateRange("מה טראמפ אמר היום",NOW,TZ);
  ok("today = start of local day",r.fromLabel==="מתחילת היום" && r.from.getTime()<NOW.getTime()); }
{ const r=resolveDateRange("ב-24 השעות האחרונות",NOW,TZ);
  ok("24h exact",NOW.getTime()-r.from.getTime()===DAY); }
{ const c=parse("מה נתניהו וטראמפ אמרו השבוע על ביטחון",NOW,TZ);
  ok("two people",c.people.includes("Benjamin Netanyahu")&&c.people.includes("Donald Trump"));
  ok("defense topic",c.topics.includes("defense")); }
{ const c=parse("מה ביבי אמר היום על שבבים ואיזה מניות יכולות להרוויח",NOW,TZ);
  ok("chips → ai",c.topics.includes("ai"));
  ok("beneficiary companies flagged",c.includeBeneficiaryCompanies===true); }
{ ok("not-reacted intent",parse("אילו מניות עדיין לא הגיבו לציוצים מהשבוע",NOW,TZ).onlyNotReacted===true);
  ok("moved intent",parse("אילו ציוצים מהיום יצרו תנועה בשוק",NOW,TZ).onlyMovedStocks===true); }
{ const c=parse("תסרוק את כל האנשים החשובים",NOW,TZ); ok("no person named → empty list",c.people.length===0); }

// English commands
{ const c=parse("Scan Elon Musk last 7 days",NOW,TZ);
  ok("EN person Elon Musk",c.people.includes("Elon Musk"));
  ok("EN last 7 days",c.dateRange.fromLabel==="7 ימים אחרונים");
  ok("EN scan_people",c.commandType==="scan_people"); }
{ const c=parse("Analyze Trump today",NOW,TZ);
  ok("EN Trump today",c.people.includes("Donald Trump")&&c.dateRange.fromLabel==="מתחילת היום"); }
{ const c=parse("Scan Netanyahu this month",NOW,TZ);
  ok("EN Netanyahu this month",c.people.includes("Benjamin Netanyahu")&&c.dateRange.fromLabel==="30 ימים אחרונים"); }
{ const c=parse("Analyze NVIDIA",NOW,TZ);
  ok("EN Analyze NVIDIA → analyze_company NVDA",c.commandType==="analyze_company"&&c.company==="NVDA"); }

console.log(`\n✅ ${pass} בדיקות פקודה עברו · ${fail} נכשלו`);
process.exit(fail>0?1:0);
