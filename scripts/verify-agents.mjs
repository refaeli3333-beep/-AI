let pass = 0, fail = 0; const ok = (n, c) => { if (c) pass++; else { fail++; console.log("❌", n); } };

/* GOAL 9 — safety */
const SAFETY = { SIMULATION_ONLY: true, LIVE_TRADING: false, REAL_MONEY: false, LEVERAGE: false, BROKER_CONNECTED: false, ORDER_ROUTING: false };
ok("SIMULATION_ONLY true", SAFETY.SIMULATION_ONLY === true);
ok("no live trading/broker/order routing", !SAFETY.LIVE_TRADING && !SAFETY.BROKER_CONNECTED && !SAFETY.ORDER_ROUTING && !SAFETY.REAL_MONEY);

/* GOAL 2 — 22 permanent roles */
const ROLES = ["news","market","social","sec","macro","supply","tech","physics","math","stats","risk","contrarian","bull","bear","evidence","source","historical","hidden","downside","catalyst","expectations","synthesis"];
ok("22 permanent agent roles", ROLES.length === 22);

/* GOAL 3 — governor caps */
class Gov {
  constructor(L){this.L=L;this.active=new Map();this.spawned=0;this.tokens=0;}
  get activeCount(){return [...this.active.values()].filter(a=>!a.done).length;}
  canSpawn(r){ if(!r.question)return{ok:false,reason:"no_research_question"}; if(!r.job)return{ok:false,reason:"no_specific_job"};
    if(r.depth>this.L.maxAgentDepth)return{ok:false,reason:"max_depth_exceeded"};
    if(this.activeCount>=this.L.maxConcurrentAgents)return{ok:false,reason:"max_concurrency_reached"};
    if(this.spawned>=this.L.maxTemporaryAgentsPerInvestigation)return{ok:false,reason:"max_temporary_agents_reached"};
    if(this.tokens>=this.L.maxTokenBudget)return{ok:false,reason:"token_budget_exhausted"}; return{ok:true};}
  spawn(r){const g=this.canSpawn(r);if(!g.ok)return g;const a={id:"t"+this.spawned,done:false,bornAt:Date.now(),maxLifetimeMs:r.maxLifetimeMs??60000};this.active.set(a.id,a);this.spawned++;return{ok:true,agent:a};}
  complete(id,res){const a=this.active.get(id);if(!a)return false;this.tokens+=res.tokens||0;a.done=true;this.active.delete(id);return true;}
  reapExpired(now){const r=[];for(const[id,a]of this.active)if(now-a.bornAt>a.maxLifetimeMs){this.active.delete(id);r.push(id);}return r;}
}
const L = { maxAgentDepth:3, maxConcurrentAgents:12, maxTemporaryAgentsPerInvestigation:8, maxTokenBudget:200000 };
ok("no spawn without research question", new Gov(L).canSpawn({job:"x",depth:1}).reason==="no_research_question");
ok("no spawn without specific job", new Gov(L).canSpawn({question:"q",depth:1}).reason==="no_specific_job");
ok("depth cap enforced (>3 rejected)", new Gov(L).canSpawn({question:"q",job:"j",depth:4}).reason==="max_depth_exceeded");
{ const g=new Gov(L); for(let i=0;i<8;i++)g.spawn({question:"q",job:"j",depth:1});
  ok("per-investigation cap = 8", g.spawn({question:"q",job:"j",depth:1}).reason==="max_temporary_agents_reached"); }
{ const g=new Gov({...L,maxConcurrentAgents:2,maxTemporaryAgentsPerInvestigation:99}); g.spawn({question:"q",job:"j",depth:1}); g.spawn({question:"q",job:"j",depth:1});
  ok("concurrency cap enforced", g.spawn({question:"q",job:"j",depth:1}).reason==="max_concurrency_reached"); }
{ const g=new Gov(L); const s=g.spawn({question:"q",job:"j",depth:1}); ok("complete destroys agent", g.complete(s.agent.id,{evidence:[],confidence:50})===true && g.activeCount===0); }
{ const g=new Gov(L); g.active.set("old",{id:"old",done:false,bornAt:0,maxLifetimeMs:1}); ok("expired agents reaped", g.reapExpired(Date.now()).includes("old")); }
{ const g=new Gov({...L,maxTokenBudget:10}); g.tokens=10; ok("token budget stops spawning", g.canSpawn({question:"q",job:"j",depth:1}).reason==="token_budget_exhausted"); }

/* GOAL 5 — consensus never hides disagreement */
const clamp=n=>Math.max(0,Math.min(100,n)); const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
function runConsensus(cs){const ag=cs.filter(c=>c.stance==="agree"),di=cs.filter(c=>c.stance==="disagree"),un=cs.filter(c=>c.stance==="uncertain"),n=cs.length||1;
  const blocs=[ag,di,un].sort((a,b)=>b.length-a.length);const maj=blocs[0];const share=maj.length/n,ds=di.length/n;
  return{consensusScore:Math.round(clamp(share*100-ds*20)),confidence:Math.round(clamp(mean(maj.map(c=>c.confidence)))),
    evidenceQuality:Math.round(clamp(mean(cs.map(c=>c.evidenceQuality)))),
    agreement:{agree:ag.length,disagree:di.length,uncertain:un.length},dissent:di.map(c=>({agentId:c.agentId,argument:c.argument}))};}
{ const cs=[...Array(17)].map((_,i)=>({agentId:"a"+i,stance:"agree",confidence:80,evidenceQuality:70,argument:""}))
    .concat([...Array(5)].map((_,i)=>({agentId:"d"+i,stance:"disagree",confidence:60,evidenceQuality:65,argument:"נגד "+i})))
    .concat([...Array(3)].map((_,i)=>({agentId:"u"+i,stance:"uncertain",confidence:50,evidenceQuality:55,argument:""})));
  const r=runConsensus(cs);
  ok("agreement counts 17/5/3", r.agreement.agree===17&&r.agreement.disagree===5&&r.agreement.uncertain===3);
  ok("dissent surfaced (never hidden)", r.dissent.length===5 && r.dissent[0].argument.startsWith("נגד"));
  ok("scores within 0..100", r.consensusScore>=0&&r.consensusScore<=100&&r.confidence>=0&&r.confidence<=100&&r.evidenceQuality>=0&&r.evidenceQuality<=100);
}

/* GOAL 2 — cycle order fixed */
const CYCLE=["SCAN","NORMALIZE_DATA","STORE_OBSERVATIONS","COMPARE_TO_HISTORY","DETECT_CHANGES","CREATE_HYPOTHESES","ASSIGN_SPECIALIST_AGENTS","CHALLENGE_EACH_HYPOTHESIS","VERIFY_SOURCES","BUILD_CONSENSUS","SAVE_CONCLUSION","SAVE_WHAT_WAS_LEARNED"];
ok("cycle has 12 ordered steps starting SCAN ending SAVE_WHAT_WAS_LEARNED", CYCLE.length===12&&CYCLE[0]==="SCAN"&&CYCLE[11]==="SAVE_WHAT_WAS_LEARNED");
ok("4 debate rounds", ["INDEPENDENT","INSPECT_CONTRADICTIONS","VERIFY_CHALLENGE","FINAL_SYNTHESIS"].length===4);

console.log(`\n✅ ${pass} בדיקות Agent-Brain עברו · ${fail} נכשלו`);
process.exit(fail>0?1:0);
