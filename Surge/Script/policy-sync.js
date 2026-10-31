/* Shareable Surge home automation v3. No embedded credentials. */
const parts = (typeof $argument === 'string' ? $argument : '').split('|');
const system = $environment.system;
const role = parts[0];
if (system === 'macOS' && role === 'sync' && $script.type === 'cron') {
/* Surge Mac only. One instance. Prototype: test with dry_run=true first.
 * Auto-discovers local select groups; probes same-name phone select groups.
 * No traffic routing or SSID detection. Use trusted private LAN only.
 */
const args = parts.slice(1);
const C = {
  url: (args[0] || '').trim().replace(/\/$/, ''),
  key: (args[1] || '').trim(),
  mode: ({'双向':'both','手机优先':'phone_to_mac','电脑优先':'mac_to_phone'}[(args[2] || '').trim()] || (args[2] || 'phone_to_mac').trim()),
  dry: (args[3] || 'true').trim() !== 'false',
  exclude: (args[4] || 'Home;Mac').split(';').map(x => x.trim()).filter(Boolean),
  batch: 8
};
const storeKey = 'policy-sync-universal-v2';
const start = Date.now();
const leaseKey='home-universal-sync-lease';
const lease=Number($persistentStore.read(leaseKey)||0);
const syncLocked = lease && start-lease<14000;
if(!syncLocked)$persistentStore.write(String(start),leaseKey);
let ended = false;
function log(s) { console.log('[policy-sync] ' + s); }
function finish() { if (!ended) { ended = true; if(!syncLocked && $persistentStore.read(leaseKey)===String(start))$persistentStore.write('',leaseKey); $done(); } }
setTimeout(() => { log('run deadline reached; pending writes may still have applied'); finish(); }, 10500);
function guard() { if (ended || Date.now() - start > 8500) throw new Error('run deadline'); }
function details() {
  const d = $surge.selectGroupDetails();
  if (!d || !d.groups || !d.decisions) throw new Error('invalid local select-group data');
  return d;
}
function local(name) {
  const d = details();
  if (!Array.isArray(d.groups[name]) || typeof d.decisions[name] !== 'string') throw new Error('local select group unavailable');
  return { value: d.decisions[name], members: d.groups[name] };
}
function request(method, path, body) {
  guard();
  return new Promise((resolve, reject) => {
    const opts = {
      url: C.url + path, headers: { 'X-Key': C.key, 'Content-Type': 'application/json' },
      timeout: 2, policy: 'DIRECT', 'auto-redirect': false
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    $httpClient[method](opts, (err, res, data) => {
      if (ended) return reject(new Error('run ended'));
      if (err) return reject(new Error('phone API unreachable'));
      const code = Number(res && res.status);
      if (!(code >= 200 && code < 300)) return reject(new Error('phone API HTTP ' + code));
      try { resolve(JSON.parse(data)); } catch (_) { reject(new Error('invalid phone API JSON')); }
    });
  });
}
async function phone(name) {
  const r = await request('get', '/v1/policy_groups/select?group_name=' + encodeURIComponent(name));
  if (!r || typeof r.policy !== 'string' || !r.policy) throw new Error('no readable same-name phone select group');
  return r.policy;
}
async function sync(name, state) {
  const l = local(name), m = l.value, p = await phone(name);
  guard();
  const prev = state[name];
  // Large configurations are visited in rotating batches, so allow enough time for a complete pass.
  const reconnectMs = Math.max(60000, Math.ceil(Object.keys(details().groups).length / C.batch) * 45000);
  let target, reason;
  if (C.mode === 'phone_to_mac') { target = p; reason = 'phone is master'; }
  else if (C.mode === 'mac_to_phone') { target = m; reason = 'Mac is master'; }
  else if (p === m) { target = p; reason = 'equal'; }
  else if (!prev || Date.now() - prev.seen > reconnectMs) { target = p; reason = 'initial/reconnect: phone wins'; }
  else {
    const pc = p !== prev.phone, mc = m !== prev.mac;
    if (pc && !mc) { target = p; reason = 'phone changed'; }
    else if (mc && !pc) { target = m; reason = 'Mac changed'; }
    else if (pc && mc) { target = p; reason = 'conflict: phone wins'; }
    else { log(name + ': inconsistent baseline; skipped'); return; }
  }
  if (p !== m) {
    if (!l.members.includes(target)) throw new Error('selected option absent on Mac; skipped: ' + target);
    log(name + ': phone=' + p + ', Mac=' + m + ' -> ' + target + ' (' + reason + ')' + (C.dry ? ' [PREVIEW]' : ''));
    if (C.dry) return;
    // Best-effort race protection; API has no compare-and-swap operation.
    if (local(name).value !== m || await phone(name) !== p) { log(name + ': changed while checking; skipped'); return; }
    guard();
    if (target !== m) {
      if (!$surge.setSelectGroupPolicy(name, target)) throw new Error('Mac rejected option');
    } else {
      // Phone API validates that the option belongs to this group. Never create missing options.
      await request('post', '/v1/policy_groups/select', { group_name: name, policy: target });
    }
    if (local(name).value !== target || await phone(name) !== target) throw new Error('write not confirmed; baseline unchanged');
  }
  if (!C.dry) state[name] = { phone: target, mac: target, seen: Date.now() };
}
(async () => {
  if(syncLocked){ log('another sync run active'); return; }
  if (!['phone_to_mac', 'mac_to_phone', 'both'].includes(C.mode)) throw new Error('mode must be phone_to_mac, mac_to_phone or both');
  if (!/^https?:\/\//.test(C.url) || !C.key || C.key === 'REPLACE_ME') throw new Error('configure phone_url and phone_key');
  // Endpoint, mode and dry-run changes reset the comparison baseline.
  const identity = C.url + '|' + C.mode + '|' + C.dry;
  let saved;
  try { saved = JSON.parse($persistentStore.read(storeKey) || '{}'); } catch (_) { saved = {}; }
  if (!saved || saved.identity !== identity || !saved.state) saved = { identity, cursor: 0, state: {} };
  const d = details();
  const names = Object.keys(d.groups).filter(n => Array.isArray(d.groups[n]) && typeof d.decisions[n] === 'string' && !C.exclude.includes(n)).sort();
  if (!names.length) { log('no eligible local select groups'); return; }
  let cursor = Number(saved.cursor) || 0;
  const chosen = [];
  for (let i = 0; i < Math.min(C.batch, names.length); i++) chosen.push(names[(cursor + i) % names.length]);
  // Max 4 concurrent API requests; stop starting new work near the deadline.
  for (let i = 0; i < chosen.length; i += 4) {
    guard();
    await Promise.all(chosen.slice(i, i + 4).map(async name => {
      try { await sync(name, saved.state); }
      catch (e) { log(name + ': ' + e.message); }
    }));
    guard();
    saved.cursor = (cursor + Math.min(i + 4, chosen.length)) % names.length;
    if (!$persistentStore.write(JSON.stringify(saved), storeKey)) throw new Error('cannot save state; disable and investigate');
  }
  log((C.dry ? 'preview' : 'sync') + ': checked ' + chosen.length + '/' + names.length + ' groups; next batch on next tick');
})().catch(e => log(e.message)).finally(finish);

} else if (system === 'iOS' && role === 'phone') {
const cfg = { ssid: parts[1] || '', policy: parts[2] || 'Mac',
  dry: parts[3] === 'true', probe: parts[4] || 'http://www.gstatic.com/generate_204',
  failures: Math.max(1, Math.min(5, Number(parts[5]) || 2)), recover: parts[6] !== 'false' };
const KEY = 'home-universal-phone-v3', LOCK = KEY + '-lock';
let ended = false, token = String(Date.now()) + Math.random(), locked = false;
function log(s) { console.log('[home-wifi] ' + s); }
function finish() {
 if (ended) return; ended = true;
 if (locked) { try { const l=JSON.parse($persistentStore.read(LOCK)||'null'); if(l && l.token===token) $persistentStore.write('',LOCK); } catch (_) {} }
 $done();
}
setTimeout(() => { log('deadline; recovery state retained'); finish(); }, 11000);
function guard(){if(ended)throw Error('run ended');}
function save(s) { guard(); if (!$persistentStore.write(JSON.stringify(s), KEY)) throw Error('cannot persist recovery state'); }
function api(method,path,body) {
 guard(); return new Promise((resolve,reject)=> {
 $httpAPI(method,path,body||{},r=> { if(ended)return reject(Error('run ended')); if(!r||r.error)return reject(Error('API failed '+path)); resolve(r); });
 });
}
async function status(){const a=await api('GET','/v1/outbound'),b=await api('GET','/v1/outbound/global');
 if(!['rule','proxy','direct'].includes(a.mode)||typeof b.policy!=='string')throw Error('unexpected API response');return {mode:a.mode,policy:b.policy};}
async function setMode(mode){await api('POST','/v1/outbound',{mode});}
async function setPolicy(policy){await api('POST','/v1/outbound/global',{policy});}
function probe(){
 guard();return new Promise(resolve=>{
 let settled=false;const done=v=>{if(!settled){settled=true;resolve(v);}};
 setTimeout(()=>done(false),3500);
 $httpClient.get({url:cfg.probe,policy:cfg.policy,timeout:3,'auto-redirect':false},(e,r)=>done(!ended&&!e&&Number(r&&r.status)===204));
 });
}
async function restore(s,why){
 const current=await status();
 if(!s.before||!['rule','direct','proxy'].includes(s.before.mode)||typeof s.before.policy!=='string')throw Error('invalid recovery state');
 if(s.before.mode==='proxy' && s.before.policy===s.target){s.before={mode:'rule',policy:s.before.policy};}
 const own=current.mode==='proxy'&&current.policy===s.target;
 const partial=current.mode===s.before.mode && (current.policy===s.target||current.policy===s.before.policy);
 if(!own&&!partial){log('manual override; not changing outbound');s.active=false;s.paused=true;save(s);return;}
 log(why+': restore '+s.before.mode+(cfg.dry?' [PREVIEW]':'')); if(cfg.dry)return;
 // Persist partial recovery before writes so interruption is recoverable.
 s.restoring=true;save(s);
 await setMode(s.before.mode);await setPolicy(s.before.policy);
 const c=await status();if(c.mode!==s.before.mode||c.policy!==s.before.policy)throw Error('restore readback failed');
 s.active=false;s.restoring=false;s.failures=0;s.offline=why==='Mac unavailable';save(s);
}
(async()=>{
 if(!cfg.ssid||cfg.ssid==='YOUR_HOME_WIFI')throw Error('set HomeSSID in module parameters');
 if(!/^https?:\/\//.test(cfg.probe))throw Error('invalid probe URL');
 let lease;try{lease=JSON.parse($persistentStore.read(LOCK)||'null');}catch(_){}
 if(lease&&Date.now()-lease.time<14000){log('another phone run active');return;}
 if(!$persistentStore.write(JSON.stringify({token,time:Date.now()}),LOCK))throw Error('lock save failed');locked=true;
 let s;try{s=JSON.parse($persistentStore.read(KEY)||'null');}catch(_){throw Error('invalid recovery JSON');}
 s=s||{active:false,failures:0};
 const ssid=($network.wifi||{}).ssid||'';
 const iface=($network.v4||{}).primaryInterface||($network.v6||{}).primaryInterface||'';
 if(!ssid&&!/^pdp_ip/.test(iface)){log('SSID unreadable; preserve state and check permissions');return;}
 const home=ssid===cfg.ssid;
 if(!home){if(s.active)await restore(s,'left home');if(!cfg.dry&&!s.active)save(null);return;}
 if(s.restoring){await restore(s,'complete pending restore');return;}
 const current=await status();
 if(s.active&&(current.mode!=='proxy'||current.policy!==s.target)){
  // If a partial activation was interrupted, roll back; otherwise honor manual changes.
  if(s.activating){await restore(s,'complete interrupted activation');return;}
  s.active=false;s.paused=true;save(s);log('manual override; paused until leaving home');return;
 }
 if(s.paused){log('paused until leaving home');return;}
 if(s.offline&&!cfg.recover){log('automatic recovery disabled; leave/rejoin home to reset');return;}
 const ok=await probe();guard();
 if(!ok){
  if(s.active){s.failures=(s.failures||0)+1;if(!cfg.dry)save(s);if(s.failures>=cfg.failures)await restore(s,'Mac unavailable');else log('probe failed '+s.failures+'/'+cfg.failures);}
  else log('Mac path unavailable; retain phone routing');return;
 }
 if(s.active){s.failures=0;if(!cfg.dry)save(s);log('Mac healthy');return;}
 // Only take over a rule-mode phone. Never hijack a user-selected global/direct mode.
 if(current.mode!=='rule'){log('entry requires rule mode; not overriding manual outbound');return;}
 log('home: proxy/'+cfg.policy+(cfg.dry?' [PREVIEW]':''));if(cfg.dry)return;
 s={active:true,before:current,target:cfg.policy,failures:0,activating:true};save(s);
 try{
  await setPolicy(cfg.policy);await setMode('proxy');const c=await status();
  if(c.mode!=='proxy'||c.policy!==cfg.policy)throw Error('switch readback failed');
  s.activating=false;save(s);
 }catch(e){await restore(s,'activation failed');throw e;}
})().catch(e=>log(e.message)).finally(finish);
} else { $done(); }
