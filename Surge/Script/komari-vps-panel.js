// Display adapted from xiao-vvv/surge-dstatus-panel (MIT); see komari-vps-LICENSE.txt.
const a = Object.fromEntries(String($argument || '').split('&').map(x => {const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const key='komari-vps-v2:'+a.url, now=Date.now();
const colors={good:'#34C759',alert:'#FF9500',error:'#FF3B30',info:'#8E8E93'};
function out(title,lines,state,icon){$done({title,content:lines.join('\n'),icon,'icon-color':colors[state]});}
function read(){try{return JSON.parse($persistentStore.read(key)||'null');}catch(_){return null;}}
function pct(x){return Number.isFinite(x)?`${Math.round(x)}%`:'--';}
function speed(x){if(!Number.isFinite(x))return '--';let i=0;while(x>=1024&&i<3){x/=1024;i++;}return `${x.toFixed(i?1:0)} ${['B','KiB','MiB','GiB'][i]}/s`;}
function draw(rows,stale){
 const fresh=r=>r.ts>0&&now-r.ts<=300000;
 const ratio=r=>Number.isFinite(r.used)&&r.limit>0?100*r.used/r.limit:null;
 const high=r=>ratio(r)!==null&&ratio(r)>=Number(a.warn||80);
 const hot=r=>fresh(r)&&[r.cpu,r.mem,r.disk].some(v=>Number.isFinite(v)&&v>=90);
 const remaining=r=>r.expiry?(Date.parse(r.expiry+'T00:00:00Z')-Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate()))/86400000:Infinity;
 const tail=stale?['缓存 · 刷新失败']:[];
 if(a.node==='overview'){
  const off=rows.filter(r=>!fresh(r)),lines=[];
  for(const [label,items] of [['离线',off],['资源 ≥90%',rows.filter(hot)],['流量告警',rows.filter(high)],['到期提醒',rows.filter(r=>remaining(r)<=14)]])if(items.length)lines.push(label+'：'+items.map(r=>r.name).join(' · '));
  if(!lines.length)lines.push(rows.some(r=>[r.cpu,r.mem,r.disk].some(x=>!Number.isFinite(x)))?'部分资源未上报':'全部正常');
  const warn=lines[0]!=='全部正常';const t=new Date(Math.max(...rows.map(r=>r.ts||0)));lines.push('更新于 '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'));
  return out(`VPS ${rows.length-off.length}/${rows.length} 在线`,lines.concat(tail),off.length?'error':warn||stale?'alert':'good','globe.asia.australia.fill');
 }
 const r=rows.find(x=>x.name===a.node);if(!r)return out(a.node,['未找到节点'],'info','tray');
 const lines=[],div=r.name==='DR'?1e9:2**30,unit=r.name==='DR'?'GB':'GiB',pr=ratio(r);
 if(!fresh(r))lines.push('最近 5 分钟无上报');
 lines.push((pr===null?'流量未上报':`流量 ${(r.used/div).toFixed(2)} / ${r.limit/div} ${unit} (${pr.toFixed(1)}%)`)+(r.resetDay?` · ${r.resetDay}日重置`:''));
 lines.push(`CPU ${pct(r.cpu)} · 内存 ${pct(r.mem)} · 磁盘 ${pct(r.disk)}`,`↑ ${speed(r.up)}  ↓ ${speed(r.down)}`);
 const billing=[];if(r.expiry)billing.push(`${r.expiry} 到期`);if(Number.isFinite(r.price))billing.push(`${r.currency||''}${r.price}${r.cycle===365?'/年':r.cycle>0?'/'+r.cycle+'天':''}`);if(billing.length)lines.push(billing.join(' · '));
 const flag={AWS:'🇸🇬',PC:'🇩🇪',DR:'🇺🇸'}[r.name]||'';const warn=hot(r)||high(r)||remaining(r)<=14||stale;
 out(flag+' '+r.name,lines.concat(tail),!fresh(r)?'error':warn?'alert':'good',!fresh(r)?'xmark.circle.fill':warn?'chart.bar.fill':'checkmark.seal.fill');}
function run(){if(!/^https:\/\//i.test(a.url)||a.url.includes('example.invalid'))return out('VPS状态',['请设置模块参数「快照地址」'],'info','gearshape.fill');const hit=read();if(hit&&now-hit.at<90000)return draw(hit.rows,false);$httpClient.get({url:a.url,timeout:10},(err,res,body)=>{try{if(err||!res||Number(res.status)!==200)throw Error(err?'私网连接失败':'HTTP '+(res&&res.status));const rows=JSON.parse(body);if(!Array.isArray(rows)||!rows.length||!rows.every(r=>r&&typeof r.name==='string'))throw Error('快照格式不符');$persistentStore.write(JSON.stringify({at:Date.now(),rows}),key);return draw(rows,false);}catch(e){const cached=read();if(cached)return draw(cached.rows,true);return out('VPS状态',[String(e.message||e)],'error','exclamationmark.triangle.fill');}});}
run();
