/**
 * 网易云音乐自动签到 + VIP 成长值领取 + 听歌打卡 - Surge 脚本 v2.1
 * v2.1 修复：编辑器手动运行时空 $request 被误判为抓 Cookie、返回空 {} 像没反应
 *
 * 触发方式（由 .sgmodule 配置）：
 *  1) http-request：打开网易云 App 时抓 MUSIC_U Cookie 并保存
 *  2) cron argument="mode=sign_vip"：每天签到（移动端+网页端）+ 领取 VIP 成长值
 *  3) cron argument="mode=daka"：听歌打卡（上报播放日志冲听歌量）+ 顺带领取 VIP 成长值
 *  手动运行（无 argument）时三项全做。
 *
 * 说明：
 *  - 签到走明文接口 /api/point/dailyTask，其余任务走 /weapi 接口，
 *    weapi 需要两层 AES-128-CBC + RSA 加密（纯 JS 实现，无外部依赖）。
 *  - VIP 成长值部分只做「查询任务列表 + 领取已完成任务的成长值」，
 *    不会替你发布动态/分享/推歌。打卡产生的听歌进度本身会计入相关任务。
 *  - Cookie 只保存在 Surge 本机 $persistentStore，不经过任何第三方服务器。
 *
 * 风险提示：
 *  - 打卡是模拟播放日志上报，属于网易云明令禁止的刷量行为，可能触发 -460 风控，
 *    严重时可能影响账号。请自行评估，默认目标 300 首/天，可在下方调小。
 *  - 本脚本未在真实账号上实测（开发者没有你的 Cookie），首次请手动运行并看通知/日志核对。
 */

/* ================= 配置 ================= */
const CONFIG = {
  vipGrowth: true,        // 是否领取 VIP 成长值
  daka: true,             // 是否听歌打卡（mode=daka 或手动运行时）
  dakaTarget: 300,        // 打卡目标：每天最多计入 300 首
  dakaBatch: 50,          // 每批上报的歌曲数
  dakaTolerance: 10,      // 今天已打卡到「目标-容忍值」以上就不再打
};

const STORE_KEY_COOKIE = "netease_music_cookie";
const STORE_KEY_MUSIC_U = "netease_music_music_u";
const TITLE = "网易云音乐";

/* ================= 基础工具 ================= */
function notify(subtitle, body) {
  $notification.post(TITLE, subtitle || "", body || "");
}
function log(msg) { console.log(`[${TITLE}] ${msg}`); }

function getHeader(headers, name) {
  if (!headers) return "";
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k] || "";
  }
  return "";
}
function parseCookieValue(cookie, name) {
  if (!cookie) return "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1].trim() : "";
}
function httpRequest(req) {
  return new Promise((resolve) => {
    const method = (req.method || "POST").toLowerCase();
    $httpClient[method](req, (err, resp, data) => resolve({ err, resp, data }));
  });
}
function parseJSON(text) {
  try { return JSON.parse(text || "{}"); } catch (e) { return null; }
}
function formEncode(obj) {
  return Object.keys(obj)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`)
    .join("&");
}

/* ================= weapi 加密（纯 JS） =================
 * params    = base64(AES_CBC( base64(AES_CBC(明文JSON, 固定key)), 随机key ))
 * encSecKey = RSA(随机key 反序) mod n，hex 左补 0 到 256 位
 * 固定key = 0CoJUm6Qyw8W8jud，IV = 0102030405060708
 */
const WEAPI_NONCE = "0CoJUm6Qyw8W8jud";
const WEAPI_IV = "0102030405060708";
const WEAPI_PUBKEY = "010001";
const WEAPI_MODULUS =
  "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7" +
  "b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280" +
  "104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932" +
  "575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b" +
  "3ece0462db0a22b8e7";

function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const cp = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}
function bytesToBase64(bytes) {
  const tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += tbl[a >> 2] + tbl[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? tbl[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? tbl[c & 63] : "=";
  }
  return out;
}
// --- AES-128（仅加密）：S 盒由 GF(2^8) 求逆 + 仿射变换生成，避免手抄表出错 ---
const AES_SBOX = (() => {
  const exp = new Array(512), logt = new Array(256);
  // 以 3 为生成元逐个相乘，建 exp/log 表
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x; exp[i + 255] = x; logt[x] = i;
    // x = x * 3 in GF(2^8), poly 0x11b
    let h = x & 0x80 ? ((x << 1) ^ 0x11b) & 0xff : (x << 1) & 0xff;
    x = (h ^ x) & 0xff;
  }
  const rotl = (v, n) => ((v << n) | (v >> (8 - n))) & 0xff;
  const sbox = new Array(256);
  for (let i = 0; i < 256; i++) {
    const inv = i === 0 ? 0 : exp[255 - logt[i]];
    sbox[i] = (inv ^ rotl(inv, 1) ^ rotl(inv, 2) ^ rotl(inv, 3) ^ rotl(inv, 4) ^ 0x63) & 0xff;
  }
  return sbox;
})();
function aes128ExpandKey(keyBytes) {
  const rcon = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
  const w = keyBytes.slice();
  for (let i = 4; i < 44; i++) {
    let t = w.slice((i - 1) * 4, i * 4);
    if (i % 4 === 0) {
      t = [AES_SBOX[t[1]] ^ rcon[i / 4 - 1], AES_SBOX[t[2]], AES_SBOX[t[3]], AES_SBOX[t[0]]];
    }
    for (let j = 0; j < 4; j++) w.push(w[(i - 4) * 4 + j] ^ t[j]);
  }
  return w;
}
function xtime(a) { return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff; }
function aes128EncryptBlock(input, roundKeys) {
  let s = input.slice();
  const addKey = (round) => { for (let i = 0; i < 16; i++) s[i] ^= roundKeys[round * 16 + i]; };
  addKey(0);
  for (let round = 1; round <= 10; round++) {
    for (let i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
    // ShiftRows：state 按列优先 s[col*4+row]
    const t = s.slice();
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) s[c * 4 + r] = t[((c + r) % 4) * 4 + r];
    if (round < 10) {
      for (let c = 0; c < 4; c++) {
        const a0 = s[c * 4], a1 = s[c * 4 + 1], a2 = s[c * 4 + 2], a3 = s[c * 4 + 3];
        s[c * 4]     = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
        s[c * 4 + 1] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
        s[c * 4 + 2] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
        s[c * 4 + 3] = (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3);
      }
    }
    addKey(round);
  }
  return s;
}
function aesCbcEncryptToBase64(text, keyStr) {
  const data = utf8Bytes(text);
  const pad = 16 - (data.length % 16);
  for (let i = 0; i < pad; i++) data.push(pad);
  const roundKeys = aes128ExpandKey(utf8Bytes(keyStr));
  let prev = utf8Bytes(WEAPI_IV);
  const out = [];
  for (let off = 0; off < data.length; off += 16) {
    const block = data.slice(off, off + 16).map((b, i) => b ^ prev[i]);
    prev = aes128EncryptBlock(block, roundKeys);
    out.push(...prev);
  }
  return bytesToBase64(out);
}
function rsaEncryptReversed(text) {
  if (typeof BigInt === "undefined") throw new Error("当前脚本引擎不支持 BigInt，无法做 weapi RSA 加密");
  let m = 0n;
  const reversed = text.split("").reverse().join("");
  for (let i = 0; i < reversed.length; i++) m = m * 256n + BigInt(reversed.charCodeAt(i));
  const n = BigInt("0x" + WEAPI_MODULUS);
  const e = BigInt("0x" + WEAPI_PUBKEY);
  let result = 1n, base = m % n, exp = e;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % n;
    base = (base * base) % n;
    exp >>= 1n;
  }
  return result.toString(16).padStart(256, "0");
}
function weapiEncrypt(obj) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let secret = "";
  for (let i = 0; i < 16; i++) secret += charset[Math.floor(Math.random() * charset.length)];
  const params = aesCbcEncryptToBase64(aesCbcEncryptToBase64(JSON.stringify(obj), WEAPI_NONCE), secret);
  return { params, encSecKey: rsaEncryptReversed(secret) };
}

/* ================= 网易云请求 ================= */
function baseHeaders(cookie) {
  return {
    "Cookie": cookie,
    "Referer": "https://music.163.com/",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NeteaseMusic/9.0.0",
    "Content-Type": "application/x-www-form-urlencoded",
  };
}
async function weapiPost(cookie, path, obj) {
  const csrf = parseCookieValue(cookie, "__csrf");
  const payload = Object.assign({}, obj || {}, { csrf_token: csrf });
  const enc = weapiEncrypt(payload);
  const { err, data } = await httpRequest({
    url: `https://music.163.com${path}?csrf_token=${encodeURIComponent(csrf)}`,
    headers: baseHeaders(cookie),
    body: formEncode(enc),
  });
  if (err) throw new Error(`请求失败 ${path}: ${err}`);
  const json = parseJSON(data);
  if (!json) throw new Error(`响应非 JSON ${path}`);
  return json;
}

/* ================= 1) 抓 Cookie ================= */
function captureCookie() {
  const cookie = getHeader($request.headers, "Cookie");
  const musicU = parseCookieValue(cookie, "MUSIC_U");
  if (!musicU) { log("请求里没有 MUSIC_U，放行"); $done({}); return; }
  const old = $persistentStore.read(STORE_KEY_MUSIC_U);
  if (old === musicU) { log("Cookie 未变化，跳过"); $done({}); return; }
  log("已抓到并保存新的 MUSIC_U Cookie");
  $persistentStore.write(cookie, STORE_KEY_COOKIE);
  $persistentStore.write(musicU, STORE_KEY_MUSIC_U);
  notify("Cookie 获取成功 ✅", "登录态已保存，签到 / 成长值 / 打卡都会用它。失效时重新打开 App 即可刷新。");
  $done({});
}

/* ================= 2) 签到（明文接口） ================= */
async function signOne(type, cookie) {
  const label = type === 0 ? "移动端" : "网页端";
  const { err, resp, data } = await httpRequest({
    url: `https://music.163.com/api/point/dailyTask?type=${type}`,
    headers: baseHeaders(cookie),
    body: "",
  });
  if (err) return { label, ok: false, msg: `请求失败：${err}` };
  const obj = parseJSON(data);
  if (!obj || typeof obj.code === "undefined")
    return { label, ok: false, msg: `响应异常（HTTP ${resp ? resp.status : "?"}）` };
  if (obj.code === 200) return { label, ok: true, msg: `+${obj.point != null ? obj.point : "?"} 经验` };
  if (obj.code === -2) return { label, ok: true, msg: "今天已签到" };
  if (obj.code === 301) return { label, ok: false, expired: true, msg: "未登录，Cookie 已失效" };
  if (obj.code === -460) return { label, ok: false, msg: "被风控拦截（-460）" };
  return { label, ok: false, msg: `code ${obj.code}${obj.msg ? "：" + obj.msg : ""}` };
}
async function doSign(cookie) {
  const results = [];
  results.push(await signOne(0, cookie));
  results.push(await signOne(1, cookie));
  return results;
}

/* ================= 3) VIP 成长值：查列表 + 领取 ================= */
function collectVipItems(resp) {
  const items = [];
  const lists = (resp && resp.data && resp.data.taskList) || [];
  for (const list of lists) {
    for (const entry of list.taskItems || []) {
      if (entry.currentInfo) items.push(entry.currentInfo);
      for (const sub of entry.subList || []) if (sub) items.push(sub);
    }
  }
  return items;
}
async function doVipGrowth(cookie) {
  // 返回 {lines:[], claimed:number|null, note}
  let listResp;
  try {
    listResp = await weapiPost(cookie, "/weapi/vipnewcenter/app/level/task/newlist", {});
  } catch (e) {
    return { lines: [`成长值：${e.message}`], claimed: null };
  }
  if (!listResp || listResp.code !== 200) {
    const code = listResp && listResp.code;
    return {
      lines: [`成长值：任务列表获取失败（code ${code}）${code === 301 ? "，Cookie 可能已失效" : "，非黑胶 VIP 或接口有变化时会出现"}`],
      claimed: null,
    };
  }
  const unGetAll = (listResp.data && listResp.data.unGetAllScore) || 0;
  if (!unGetAll) return { lines: ["成长值：暂无可领取"], claimed: 0 };

  const items = collectVipItems(listResp);
  const detail = items
    .filter((it) => it.totalUngetScore > 0)
    .map((it) => `${it.action || "任务"} +${it.totalUngetScore}`);

  let claimResp;
  try {
    claimResp = await weapiPost(cookie, "/weapi/vipnewcenter/app/level/task/reward/getall", {});
  } catch (e) {
    return { lines: [`成长值：领取请求失败：${e.message}`], claimed: null };
  }
  if (!claimResp || claimResp.code !== 200) {
    return { lines: [`成长值：领取失败（code ${claimResp && claimResp.code}）`], claimed: null };
  }
  const lines = [`成长值：已领取 +${unGetAll}`];
  if (detail.length) lines.push(detail.join("；"));
  return { lines, claimed: unGetAll };
}

/* ================= 4) 听歌打卡 ================= */
async function doDaka(cookie) {
  const lines = [];
  // 4.1 当前等级/听歌数
  let levelResp, uid;
  try {
    levelResp = await weapiPost(cookie, "/weapi/user/level", {});
  } catch (e) {
    return { lines: [`打卡：获取等级失败：${e.message}`], done: 0 };
  }
  if (!levelResp || levelResp.code !== 200 || !levelResp.data) {
    return { lines: [`打卡：获取等级失败（code ${levelResp && levelResp.code}）`], done: 0 };
  }
  uid = levelResp.data.userId;
  if (levelResp.full) {
    return { lines: ["打卡：等级已满，无需打卡"], done: 0 };
  }
  let before = null;
  try {
    const detail = await weapiPost(cookie, `/weapi/v1/user/detail/${uid}`, {});
    if (detail && detail.code === 200) before = detail.listenSongs;
  } catch (e) { /* 拿不到也不阻断打卡 */ }

  // 4.2 收集歌曲：推荐歌单 -> 歌单详情
  let playlists;
  try {
    const rec = await weapiPost(cookie, "/weapi/personalized/playlist", { limit: 30 });
    playlists = (rec && rec.result) || [];
  } catch (e) {
    return { lines: [`打卡：获取推荐歌单失败：${e.message}`], done: 0 };
  }
  if (!playlists.length) return { lines: ["打卡：没有拿到推荐歌单"], done: 0 };

  const seen = new Set();
  const songDatas = [];
  for (const pl of playlists) {
    if (songDatas.length >= CONFIG.dakaTarget) break;
    let detail;
    try {
      detail = await weapiPost(cookie, "/weapi/v3/playlist/detail", {
        id: pl.id, total: "true", limit: 1000, n: 1000, offset: 0,
      });
    } catch (e) { continue; }
    const tracks = (detail && detail.playlist && detail.playlist.tracks) || [];
    for (const song of tracks) {
      if (songDatas.length >= CONFIG.dakaTarget) break;
      if (seen.has(song.id)) continue;
      seen.add(song.id);
      songDatas.push({
        type: "song", wifi: 0, download: 0, id: song.id,
        time: song.dt ? Math.ceil(song.dt / 1000) : 240,
        end: "playend", source: "list", sourceId: pl.id,
      });
    }
  }
  if (!songDatas.length) return { lines: ["打卡：歌单里没收集到歌曲"], done: 0 };

  // 4.3 分批上报播放日志
  let uploaded = 0;
  for (let i = 0; i < songDatas.length; i += CONFIG.dakaBatch) {
    const batch = songDatas.slice(i, i + CONFIG.dakaBatch);
    const logs = batch.map((s) => ({ action: "play", json: s }));
    let resp;
    try {
      resp = await weapiPost(cookie, "/weapi/feedback/weblog", { logs: JSON.stringify(logs) });
    } catch (e) {
      lines.push(`打卡：上报中断（已提交 ${uploaded} 首）：${e.message}`);
      return { lines, done: uploaded };
    }
    if (!resp || resp.code !== 200) {
      lines.push(`打卡：上报返回 code ${resp && resp.code}${resp && resp.code === -460 ? "（被风控），已停止" : ""}，已提交 ${uploaded} 首`);
      return { lines, done: uploaded };
    }
    uploaded += batch.length;
  }

  // 4.4 核对有效听歌数（网易云数据更新有延时，仅供参考）
  if (before !== null && uid) {
    try {
      const detail2 = await weapiPost(cookie, `/weapi/v1/user/detail/${uid}`, {});
      if (detail2 && detail2.code === 200 && typeof detail2.listenSongs === "number") {
        const delta = detail2.listenSongs - before;
        lines.push(`打卡：已上报 ${uploaded} 首，听歌总数 ${before} → ${detail2.listenSongs}（本次有效 +${delta}，数据可能延时）`);
        return { lines, done: uploaded };
      }
    } catch (e) { /* 忽略核对失败 */ }
  }
  lines.push(`打卡：已上报 ${uploaded} 首（听歌数更新有延时，稍后再看等级页核对）`);
  return { lines, done: uploaded };
}

/* ================= 入口 ================= */
function parseMode() {
  if (typeof $argument === "string" && $argument) {
    const m = $argument.match(/mode=([a-z_]+)/);
    if (m) return m[1];
  }
  return "all";
}

async function mainCron() {
  const cookie = $persistentStore.read(STORE_KEY_COOKIE);
  if (!cookie || !parseCookieValue(cookie, "MUSIC_U")) {
    log("还没有 Cookie，请先打开网易云音乐 App 触发抓取");
    notify("还没有 Cookie ⚠️", "请先打开网易云音乐 App（保持登录），点进「我的」页面触发抓取后再运行。");
    $done();
    return;
  }
  const mode = parseMode();
  const lines = [];
  let expired = false;

  if (mode === "sign_vip" || mode === "all") {
    const signResults = await doSign(cookie);
    expired = signResults.some((r) => r.expired);
    lines.push(...signResults.map((r) => `${r.label}签到：${r.msg}`));
    if (CONFIG.vipGrowth) {
      const vip = await doVipGrowth(cookie);
      lines.push(...vip.lines);
    }
  }

  if ((mode === "daka" || mode === "all") && CONFIG.daka) {
    const daka = await doDaka(cookie);
    lines.push(...daka.lines);
    if (mode === "daka" && CONFIG.vipGrowth) {
      // 打卡可能刚完成 VIP 听歌类任务，顺手领一次
      const vip = await doVipGrowth(cookie);
      lines.push(...vip.lines);
    }
  }

  const title =
    mode === "daka" ? "打卡完成 🎧" : mode === "sign_vip" ? "签到完成 ✅" : "全部任务完成 ✅";
  if (expired) {
    notify("Cookie 已失效 ❌", lines.join("\n") + "\n请重新打开网易云音乐 App 刷新登录态。");
  } else {
    notify(title, lines.join("\n"));
  }
  log(lines.join(" | "));
  $done();
}

// 注意：Surge 编辑器里点「运行」时也会给一个空的 $request（没有 url），
// 若只判断 $request 是否存在，手动运行会被误判成抓 Cookie，直接 $done({}) 返回空对象，看起来像“没反应”。
// 因此只有带真实 url 的请求才走抓 Cookie，其余一律走任务流程。
const IS_REAL_REQUEST =
  typeof $request !== "undefined" &&
  $request &&
  typeof $request.url === "string" &&
  $request.url.indexOf("163.com") !== -1;

if (IS_REAL_REQUEST) {
  captureCookie();
} else {
  mainCron();
}
