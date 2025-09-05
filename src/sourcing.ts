import * as semver from 'semver';
import { cache } from './cache.js';
const GH = 'https://api.github.com';
const NPM = 'https://registry.npmjs.org';
const PYPI = 'https://pypi.org/pypi';
const CRATES = 'https://crates.io/api/v1';
const OSV = 'https://api.osv.dev/v1/query';

function authHeaders(){ const h:Record<string,string>={ 'Accept':'application/vnd.github+json' }; if (process.env.GITHUB_TOKEN) h['Authorization']=`Bearer ${process.env.GITHUB_TOKEN}`; return h; }

export async function searchRegistries({ query, languages=['TypeScript'], ecosystems=['github','npm','pypi'] }:{query:string;languages?:string[];ecosystems?:string[]}){
  const items:any[]=[];
  if (ecosystems.includes('github')){
    const k=`gh:search:${query}`;
    let arr:any[] = cache.get<any[]>(k) || [];
    if (arr.length===0){
      const q=encodeURIComponent(query);
      const rsp=await fetch(`${GH}/search/repositories?q=${q}&sort=stars&order=desc&per_page=10`,{headers:authHeaders()});
      const data=await rsp.json();
      arr=(data.items||[]).map((r:any)=>({kind:'github',ref:r.full_name,url:r.html_url,stars:r.stargazers_count,license:r.license?.spdx_id,updated_at:r.updated_at,desc:r.description}));
      cache.set(k,arr,15*60*1000);
    }
    items.push(...arr);
  }
  if (ecosystems.includes('npm')){
    const k=`npm:search:${query}`;
    let arr:any[] = cache.get<any[]>(k) || [];
    if (arr.length===0){
      const rsp=await fetch(`${NPM}/-/v1/search?text=${encodeURIComponent(query)}&size=10`);
      const data=await rsp.json();
      arr=(data.objects||[]).map((p:any)=>({kind:'npm',ref:p.package.name,version:p.package.version,license:p.package.license,desc:p.package.description,updated_at:p.package.date,score:p.score?.final,url:p.package.links?.npm}));
      cache.set(k,arr,15*60*1000);
    }
    items.push(...arr);
  }
  if (ecosystems.includes('pypi')){
    const name=query.trim();
    const k=`pypi:meta:${name}`;
    let obj=cache.get<any>(k);
    if(!obj){
      const rsp=await fetch(`${PYPI}/${encodeURIComponent(name)}/json`);
      if(rsp.ok){
        const data=await rsp.json();
        obj={kind:'pypi',ref:data.info.name,version:data.info.version,license:data.info.license,summary:data.info.summary,url:data.info.project_url||data.info.package_url,updated_at:data.releases?.[data.info.version]?.[0]?.upload_time};
        cache.set(k,obj,15*60*1000);
      }
    }
    if(obj) items.push(obj);
  }
  return { total: items.length, items };
}

export async function osvQuery({ecosystem,name,version}:{ecosystem:string;name:string;version:string}){
  const k=`osv:${ecosystem}:${name}:${version}`; let res=cache.get<any>(k); if(res) return res;
  const body={ package:{ecosystem,name}, version };
  const rsp=await fetch(OSV,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await rsp.json(); res={ vulns:data.vulns||[], queried:{ecosystem,name,version} }; cache.set(k,res,5*60*1000); return res;
}

async function npmPkg(name:string){ const k=`npm:pkg:${name}`; let data=cache.get<any>(k); if(!data){ const rsp=await fetch(`${NPM}/${encodeURIComponent(name)}`); data=await rsp.json(); cache.set(k,data,60*60*1000);} return data; }
async function npmVersionMeta(name:string,version:string){ const pkg=await npmPkg(name); return pkg.versions?.[version]; }

export async function npmDepsGraph(name:string, version:string, maxDepth=3){
  const k=`npm:graph:${name}@${version}:${maxDepth}`; let graph=cache.get<any>(k); if(graph) return graph;
  const visited=new Set<string>(); const edges:[string,string][]= [];
  async function walk(nm:string, ver:string, depth:number){ const id=`${nm}@${ver}`; if(visited.has(id)||depth>maxDepth) return; visited.add(id);
    const meta=await npmVersionMeta(nm,ver); const deps=Object.entries(meta?.dependencies||{});
    for (const [d,req] of deps){ const depPkg=await npmPkg(d); const all=Object.keys(depPkg.versions||{}).filter(semver.valid).sort(semver.rcompare); const pick=all.find(v=>semver.satisfies(v,String(req)))||all[0]; if (pick){ edges.push([id,`${d}@${pick}`]); await walk(d,pick,depth+1);} }
  }
  await walk(name,version,0);
  const nodes=Array.from(new Set(edges.flatMap(e=>e))).concat(`${name}@${version}`);
  graph={ nodes, edges, count:nodes.length, root:`${name}@${version}` };
  cache.set(k,graph,10*60*1000); return graph;
}

export async function pypiRequires(name:string,version?:string){
  const k=`pypi:req:${name}:${version||'latest'}`; let res=cache.get<any>(k); if(res) return res;
  const url=version? `${PYPI}/${encodeURIComponent(name)}/${version}/json` : `${PYPI}/${encodeURIComponent(name)}/json`;
  const rsp=await fetch(url); if(!rsp.ok) return { requires:[] as string[] };
  const data=await rsp.json(); const req=(data.info?.requires_dist||[]) as string[];
  res={ requires:req }; cache.set(k,res,60*60*1000); return res;
}

export async function suggestSafeVersion(ecosystem:'npm'|'PyPI', name:string){
  if (ecosystem==='npm'){
    const meta=await npmPkg(name); const versions=Object.keys(meta.versions||{}).filter(semver.valid).sort(semver.rcompare);
    for (const v of versions){ const osv=await osvQuery({ecosystem:'npm',name,version:v}); if (osv.vulns.length===0) return {ecosystem,name,version:v,reason:'OSV clean'}; }
    return { ecosystem,name,version:null,reason:'No OSV‑clean version found' };
  }
  if (ecosystem==='PyPI'){
    const rsp=await fetch(`${PYPI}/${encodeURIComponent(name)}/json`); if(!rsp.ok) return { ecosystem,name,version:null,reason:'Package not found' };
    const data=await rsp.json(); const versions=Object.keys(data.releases||{}).filter(semver.valid).sort(semver.rcompare);
    for (const v of versions){ const osv=await osvQuery({ecosystem:'PyPI',name,version:v}); if (osv.vulns.length===0) return {ecosystem,name,version:v,reason:'OSV clean'}; }
    return { ecosystem,name,version:null,reason:'No OSV‑clean version' };
  }
  return { ecosystem,name,version:null,reason:'Unsupported' };
}

export function trustScore(inp:{ source:'github'|'npm'|'pypi'; stars?:number; daysSinceUpdate?:number; issues?:number; license?:string; cveCount?:number; deps?:number; }){
  const { stars=0, daysSinceUpdate=365, issues=0, license='UNKNOWN', cveCount=0, deps=0 } = inp;
  const licOk=['MIT','Apache-2.0','BSD-3-Clause','BSD-2-Clause','ISC'].includes(license)?1:0.5;
  const s=Math.log10(1+stars); const fresh=Math.max(0,1-daysSinceUpdate/365); const issuesHealth=Math.max(0,1-Math.log10(1+issues)/3); const cvePenalty=cveCount>0?0:1; const depsPenalty=deps>200?0.2:deps>100?0.5:1;
  const score=100*(0.35*s+0.25*fresh+0.15*issuesHealth+0.15*licOk+0.10*cvePenalty)*depsPenalty; return Math.round(Math.max(0,Math.min(100,score)));
}
