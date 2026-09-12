import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const sources={yodoe:395,nawakawa:393,daikoku:390,ishiwaki:387};
const plain=s=>s.replace(/<[^>]*>/g,'').trim();
export function parseForecast(html) {
 const base=html.match(/datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
 if(!base) throw Error('Missing dated forecast');
 let day=null;const rows=[];
 for(const m of html.matchAll(/<tr\b[^>]*class="wave_tr[^\"]*"[^>]*>([\s\S]*?)<\/tr>/g)) {
  const row=m[1];const date=row.match(/class="dey[^\"]*">(\d+)月(\d+)日/);
  if(date){const candidates=[-1,0,1].map(n=>`${Number(base.slice(0,4))+n}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}`);day=candidates.sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(base))-Math.abs(Date.parse(b)-Date.parse(base)))[0];continue;}
  if(!day)continue;
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);
  if(cells.length!==15)throw Error('Forecast table layout changed');
  const hour=Number(plain(cells[0]));const wave=plain(cells[7]).match(/^([\d.]+) m \/ ([\d.]+) s$/);
  const wind=Number(plain(cells[5]));
  if(!wave||!Number.isInteger(hour)||hour<0||hour>23||!Number.isFinite(wind))throw Error('Invalid forecast values');
  const windType=cells[6].match(/class="offtext">([^<]+)</)?.[1]??'';
  rows.push({time:`${day}T${String(hour).padStart(2,'0')}:00`,wave:Number(wave[1]),period:Number(wave[2]),wind,windType});
 }
 if(rows.length<24||new Set(rows.map(x=>x.time)).size!==rows.length)throw Error('Incomplete or duplicate forecast');
 return rows;
}
async function main(){
 const points={};let failures=0;
 for(const [id,spot] of Object.entries(sources)){
  const url=`https://www.surf-life.blue/surf/spots/${encodeURIComponent('鳥取県')}/${spot}/`;
  try{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`HTTP ${r.status}`);
   const rows=parseForecast(await r.text());points[id]={url,fetchedAt:new Date().toISOString(),rows};console.log(id,rows.length);
  }catch(e){failures++;points[id]={url,error:'取得失敗',rows:[]};console.error(id,e.message);}
 }
 const dir=new URL('../data/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('surf-reference.json',dir),JSON.stringify({version:1,generatedAt:new Date().toISOString(),points})+'\n');
 if(failures)process.exitCode=1;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
