/**
 * QX 网速测试（单线程 / 多线程双模式） v1.2.2
 *
 * v1.2.2：长按（event-interaction）专项加固。官方 sample 注明 $task.fetch 默认超时 10s，
 * 长按面板等不起长流程：① 长按触发且没显式传 duration/upload 时，自动窗口 4s、关上传，
 * 整轮预算 25s 封顶（显式传参则按参数走）；② 每个 fetch 加自己的超时赛跑，不再干等；
 * ③ 长按模式下延迟采样改并行（慢/死节点不再 3 次串行各等 10s）。
 *
 * v1.2.1：真机「测试显示无有效内容」修复 — QX 手动测试/长按的结果面板只认 $done 回传的内容，
 * 之前 cron 路径以裸 $done() 结束、面板无内容可显示。现在所有出口（成功/失败/超时、cron/UI）
 * 都回传 {title, message/htmlMessage}；通知照常发。UI 识别也放宽：params 只要存在即按面板模式走。
 *
 * 计量方式按 Surge [Testing] 原样对齐（Surge 手册 Mac 6.4.4+）：
 *   download-concurrency = 4     多连接并发（单线程模式 = 1）
 *   download-duration-limit = 10s 定时间窗：持续下载满 10s，数总字节算速（不是定长文件跑完计时）
 *   upload-concurrency = 4 / upload-duration-limit = 10s / upload-size-limit = 1000000000（1GB 先到先停）
 * QX 的 $task.fetch 没有流式回调、也不能中途掐断一条请求，所以定窗用「分块循环」逼近：
 * 每条连接先下 1MB 探速，再按实测速率把后续块切成约 1.5s 一块，循环到窗口结束；
 * 误差只剩窗口末尾在途的那一小块，和 Surge 原生流式会有个位数百分比出入，口径一致。
 * 老的定长方式保留：#method=fixed 时按 size MB 定长计时（v1.1 行为）。
 *
 * 两种用法（同一个脚本，自动识别）：
 *   A. cron 任务：任务列表右滑手动跑 / 定时跑，测「当前分流出口」，结果走通知（见下方 task_local 例）
 *   B. event-interaction：在 QX 首页长按某个节点或策略组 → 选本脚本 → 专测那个节点/组，
 *      脚本从 $environment.params 拿到被长按的 tag 作为 policy，结果在弹窗面板里显示（不发通知）：
 *      event-interaction https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=both&duration=5&upload=0, tag=网速测试, img-url=gauge.with.dots.needle.67percent.system, enabled=true
 *      （长按版关掉上传、窗口 5s，面板约 10s 出结果；要测上传去掉 upload=0 即可，等待翻倍）
 *
 * 测速源：Cloudflare 官方 speed.cloudflare.com
 *   下载 https://speed.cloudflare.com/__down?bytes=N   （返回 N 个 ASCII "0"，文本安全）
 *   上传 https://speed.cloudflare.com/__up             （POST，Surge 口径默认开，upload=0 关）
 *   出口 https://speed.cloudflare.com/meta             （出口 IP / 城市 / Colo / ASN）
 *
 * 参数切换（QX 官方方式：写在脚本 URL 的 # 后面，脚本里用 $environment.variables 读取，
 * v1.5.6 build 918+；旧版自动回退解析 $environment.sourcePath）：
 *
 * [task_local]
 * 双模式（先单后多，一次出两个数，默认）：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=both&threads=4, tag=网速测试-双模式, enabled=false
 * 只测单线程：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=single, tag=网速测试-单线程, enabled=false
 * 只测多线程：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=multi&threads=4, tag=网速测试-多线程, enabled=false
 * 指定策略/节点测（policy 填策略组名、节点 tag 或 direct；指定后每条连接都重新握手，见官方 sample-fetch-opts-policy）：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=multi&policy=direct, tag=网速测试-直连, enabled=false
 *
 * 全部参数（不写就用默认值）：
 *   method   surge | fixed             默认 surge（Surge 式定窗）；fixed = 老定长方式
 *   mode     both | single | multi     默认 both
 *   threads  多线程并发数 1-8           默认 4（= Surge download/upload-concurrency）
 *   duration 定窗秒数 1-30              默认 10（= Surge download/upload-duration-limit）
 *   upload   0 | 1                     默认 1（Surge 测速含上下行；关掉只测下载省流量）
 *   size     每条连接下载 MB            默认 25，仅 method=fixed 时用
 *   usize    每条连接上传 MB            默认 5，仅 method=fixed 时用
 *   latency  0 | 1                     默认 1（测 3 次 bytes=0 取最小/平均；Surge 里延迟是另一套 HEAD 测试，这里只作附加信息）
 *   meta     0 | 1                     默认 1（显示出口信息，失败自动跳过）
 *   policy   策略组名 / 节点 tag / direct，留空 = 按现有分流规则走（测当前出口）
 *   url      自定义测速源（须支持 ?bytes=N 的 Cloudflare 风格接口才准），默认官方源
 *   timeout  整体超时秒数               默认 120，到点强制结束并通知
 *
 * 流量警告：定窗计量在快线上吃流量 = 速率 × 时间。500 Mbps 的线跑默认双模式
 * （单+多各 10s 下 + 10s 上）能吃掉 1GB 以上，流量卡先把 duration 改小或 upload=0。
 *
 * 已知限制（QX 本身，不是脚本问题）：
 *   1. $task.fetch 没有流式回调，定窗靠分块循环逼近（见文件头），与 Surge 原生流式有个位数百分比出入。
 *   2. 脚本用 opts.filter 让大响应体在 Network Extension 侧只回传字节数
 *      （官方 sample-fetch-opts-filter 的做法），避免大文本进 JS 内存；
 *      filter 不生效时自动回退用响应体/Content-Length 计量，结果一样、只是更吃内存。
 *   3. cron 模式测的是「测速域名在分流规则下命中的出口」；测单个节点用 event-interaction
 *      长按触发（最顺手）、或 cron 行里写 policy 参数、或先切好节点再跑。都不是批量逐个测。
 */

// ---------- 参数 ----------
function getParams() {
  let p = {};
  try {
    if (typeof $environment !== "undefined" && $environment.variables) {
      p = Object.assign({}, $environment.variables);
    }
  } catch (e) {}
  if (!p || Object.keys(p).length === 0) {
    try {
      const sp = (typeof $environment !== "undefined" && $environment.sourcePath) || "";
      const hash = sp.split("#")[1] || "";
      hash.split("&").forEach(kv => {
        const i = kv.indexOf("=");
        if (i > 0) {
          const k = decodeURIComponent(kv.slice(0, i));
          const v = decodeURIComponent(kv.slice(i + 1));
          p[k] = v;
        }
      });
    } catch (e) {}
  }
  return p;
}

const P = getParams();
const MODE = /^(single|multi|both)$/.test(String(P.mode || "").toLowerCase())
  ? String(P.mode).toLowerCase() : "both";
const THREADS = Math.min(8, Math.max(1, parseInt(P.threads, 10) || 4));
const SIZE_MB = Math.min(200, Math.max(1, parseFloat(P.size) || 25));
const METHOD = String(P.method || "surge").toLowerCase() === "fixed" ? "fixed" : "surge";
const DURATION_EXPLICIT = P.duration != null && String(P.duration) !== "";
const UPLOAD_EXPLICIT = P.upload != null && String(P.upload) !== "";
let DURATION = Math.min(30, Math.max(1, parseFloat(P.duration) || 10));
let UPLOAD = String(P.upload || "1") !== "0";
const USIZE_MB = Math.min(50, Math.max(1, parseFloat(P.usize) || 5));
const DO_LATENCY = String(P.latency || "1") !== "0";
const DO_META = String(P.meta || "1") !== "0";
// event-interaction 触发时 $environment.params 是被长按的节点/策略组 tag，优先于 #policy 参数；
// params 只要存在（哪怕不是字符串）就按面板模式走，保证 $done 必回内容、面板不空
const RAW_PARAMS = (typeof $environment !== "undefined") ? $environment.params : undefined;
const UI_TARGET = (typeof RAW_PARAMS === "string") ? RAW_PARAMS.trim() : "";
const IS_UI = RAW_PARAMS != null && String(RAW_PARAMS).trim().length > 0;
const POLICY = UI_TARGET || (P.policy || "").trim();
// 长按面板等不起默认全程（4 窗口 × 10s + 串行采样，慢节点能拖到 1 分钟）：
// 没显式传参时长按自动缩短 — 窗口封顶 4s、关上传；cron 不受影响
if (IS_UI) {
  if (!DURATION_EXPLICIT) DURATION = Math.min(DURATION, 4);
  if (!UPLOAD_EXPLICIT) UPLOAD = false;
}
let MAIN_START = 0; // 主流程启动时刻，长按模式用它算 25s 总预算
const UI_BUDGET_MS = 25000;
const BASE = (P.url || "https://speed.cloudflare.com").replace(/\/+$/, "");
const TIMEOUT_S = Math.min(600, Math.max(20, parseInt(P.timeout, 10) || 120));

const MB = 1000000; // 十进制 MB，与 Mbps 口径一致（网络速率通用口径）
// Cloudflare /meta 对无浏览器 UA 的请求只回 {}，所有请求统一带浏览器 UA
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

// ---------- 工具 ----------
let doneCalled = false;
function finish(obj) {
  if (!doneCalled) { doneCalled = true; $done(obj); }
}
const WATCHDOG_S = IS_UI ? Math.min(TIMEOUT_S, 30) : TIMEOUT_S; // 长按 30s 必回内容，抢在面板放弃之前
const watchdog = setTimeout(() => {
  console.log("⏱ 整体超时 " + WATCHDOG_S + "s，强制结束");
  const msg = "⏱ 超过 " + WATCHDOG_S + "s 未完成，已强制结束\n（慢线可调大 timeout，或调小 duration/size）";
  if (!IS_UI) { try { $notify("📶 QX 测速", "", msg); } catch (e) {} }
  finish({ title: "📶 QX 测速", message: msg });
}, WATCHDOG_S * 1000);
if (watchdog && typeof watchdog.unref === "function") watchdog.unref();

function fmt(n, d) { return Number(n).toFixed(d === undefined ? 1 : d); }
function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function headerCI(headers, name) {
  if (!headers) return null;
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === name.toLowerCase()) return headers[keys[i]];
  }
  return null;
}

// 从一次 fetch 响应里取出真实字节数：Content-Length > filter 回传的数字 > bodyBytes > body 长度
function respBytes(resp, expected) {
  const cl = parseInt(headerCI(resp.headers, "Content-Length"), 10);
  if (!isNaN(cl) && cl > 0) return cl;
  if (resp.bodyBytes && typeof resp.bodyBytes.byteLength === "number" && resp.bodyBytes.byteLength > 0) {
    return resp.bodyBytes.byteLength;
  }
  const body = typeof resp.body === "string" ? resp.body : "";
  // filter 生效时 body 是 "25000000" 这样的纯数字短串
  if (body.length > 0 && body.length <= 15 && /^\d+$/.test(body.trim())) {
    const n = parseInt(body.trim(), 10);
    if (n > 0) return n;
  }
  if (body.length > 0) return body.length;
  return expected || 0;
}

// QX 的 fetch 默认超时 10s 且掐不断，这里只做「不等它」：到点先判失败，底层请求由 QX 自己收尾
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("等待响应超时")), ms))]);
}

function fetchOnce(req, timeoutMs) {
  const r = Object.assign({}, req);
  if (POLICY) r.opts = Object.assign({}, r.opts || {}, { policy: POLICY });
  return withTimeout($task.fetch(r), timeoutMs || 15000);
}

// 单条下载：filter 只回传字节数，避免大 body 进 JS 内存；失败/不生效时 respBytes 自动回退
function downloadOnce(bytes, idx) {
  const url = BASE + "/__down?bytes=" + bytes + "&r=" + Date.now() + "-" + idx + "-" + Math.floor(Math.random() * 1e6);
  return fetchOnce({
    url: url,
    method: "GET",
    headers: { "User-Agent": UA, "Accept-Encoding": "identity", "Cache-Control": "no-cache" },
    opts: { filter: "return String(body.length);" }
  }).then(resp => {
    if (resp.statusCode !== 200) throw new Error("HTTP " + resp.statusCode);
    return respBytes(resp, bytes);
  });
}

function uploadOnce(bytes) {
  return fetchOnce({
    url: BASE + "/__up",
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "text/plain;charset=UTF-8", "Accept-Encoding": "identity" },
    body: "0".repeat(bytes)
  }).then(resp => {
    if (resp.statusCode !== 200) throw new Error("HTTP " + resp.statusCode);
    return bytes; // 上传量以请求体为准
  });
}

// 跑一轮：concurrency 条连接同时发，汇总字节 / 总耗时
async function runRound(kind, concurrency, bytesPerConn) {
  const fn = kind === "up" ? uploadOnce : downloadOnce;
  const start = Date.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) => fn(bytesPerConn, i))
  );
  const sec = (Date.now() - start) / 1000;
  const totalBytes = results.reduce((a, b) => a + b, 0);
  const mbps = totalBytes * 8 / sec / 1e6;
  return { concurrency, totalBytes, sec, mbps, mbpsPerConn: mbps / concurrency };
}

// ---- Surge 式定窗计量：窗口内分块循环，数总字节 / 实际耗时 ----
const UPLOAD_SIZE_LIMIT = 1000000000; // = Surge upload-size-limit 1GB

async function surgeWorker(kind, deadline, idx, capBytes) {
  const fn = kind === "up" ? uploadOnce : downloadOnce;
  const cap = kind === "up" ? 10 * MB : 25 * MB; // 单块上限：上传块受请求体内存约束更严
  let total = 0;
  let rate = 0; // 本连接实测字节/秒
  let chunk = 1 * MB; // 首块探速
  while (true) {
    const remain = (deadline - Date.now()) / 1000;
    if (remain <= 0.3) break;
    if (capBytes && total >= capBytes) break;
    if (rate > 0) {
      chunk = Math.round(rate * Math.min(1.5, remain));
      chunk = Math.min(cap, Math.max(Math.round(0.25 * MB), chunk));
      if (capBytes) chunk = Math.min(chunk, capBytes - total);
    }
    const t0 = Date.now();
    try {
      const n = await fn(chunk, idx);
      total += n;
      const dt = (Date.now() - t0) / 1000;
      if (dt > 0 && n > 0) rate = n / dt;
    } catch (e) {
      break; // 中途失败保留已完成字节；total=0 时整轮判失败
    }
  }
  return total;
}

async function runRoundSurge(kind, concurrency) {
  const start = Date.now();
  let deadline = start + DURATION * 1000;
  if (IS_UI && MAIN_START) deadline = Math.min(deadline, MAIN_START + UI_BUDGET_MS); // 长按总预算封顶
  const perCap = kind === "up" ? Math.floor(UPLOAD_SIZE_LIMIT / concurrency) : 0;
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) => surgeWorker(kind, deadline, i, perCap))
  );
  const sec = (Date.now() - start) / 1000;
  const totalBytes = results.reduce((a, b) => a + b, 0);
  if (totalBytes <= 0) throw new Error("无数据返回");
  const mbps = totalBytes * 8 / sec / 1e6;
  return { concurrency, totalBytes, sec, mbps, mbpsPerConn: mbps / concurrency };
}

// 统一入口：surge = 定窗，fixed = 定长（v1.1 行为）
function runTest(kind, concurrency, fixedBytes) {
  return METHOD === "surge" ? runRoundSurge(kind, concurrency) : runRound(kind, concurrency, fixedBytes);
}

async function runLatency() {
  const one = async i => {
    const t = Date.now();
    await fetchOnce({ url: BASE + "/__down?bytes=0&r=" + Date.now() + "-" + i, method: "GET", headers: { "User-Agent": UA } }, 6000);
    return Date.now() - t;
  };
  let samples = [];
  if (IS_UI) {
    // 长按模式并行采样：被测节点慢/死时串行 3 次最坏要等 30s，面板等不起
    samples = (await Promise.all([0, 1, 2].map(i => one(i).catch(() => null)))).filter(x => x != null);
  } else {
    for (let i = 0; i < 3; i++) {
      try { samples.push(await one(i)); } catch (e) { /* 单次失败忽略 */ }
    }
  }
  if (!samples.length) return null;
  return {
    min: Math.min.apply(null, samples),
    avg: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
  };
}

async function runMeta() {
  try {
    const resp = await fetchOnce({ url: BASE + "/meta", method: "GET", headers: { "User-Agent": UA, "Referer": "https://speed.cloudflare.com/" } }, 6000);
    const m = JSON.parse(resp.body);
    if (!m || !m.clientIp) return null; // 无 UA 时 Cloudflare 只回 {}，拿到空数据就不显示
    const loc = [m.city, m.country].filter(Boolean).join(", ");
    const coloStr = typeof m.colo === "string" ? m.colo : (m.colo && m.colo.iata) || ""; // 新版 colo 是对象 {iata,...}
    const colo = coloStr ? " · " + coloStr : "";
    const asn = m.asOrganization ? " · " + m.asOrganization : (m.asn ? " · AS" + m.asn : "");
    return m.clientIp + (loc ? " · " + loc : "") + colo + asn;
  } catch (e) { return null; }
}

// ---------- 主流程 ----------
(async () => {
  MAIN_START = Date.now();
  const lines = [];
  const sizeBytes = Math.round(SIZE_MB * MB);
  const usizeBytes = Math.round(USIZE_MB * MB);
  console.log("📶 QX 测速开始 method=" + METHOD + " mode=" + MODE + " threads=" + THREADS + " duration=" + DURATION + "s size=" + SIZE_MB + "MB upload=" + UPLOAD + (IS_UI ? " ui-target=" + UI_TARGET : "") + (POLICY ? " policy=" + POLICY : ""));

  const meta = DO_META ? await runMeta() : null;

  if (DO_LATENCY) {
    const lat = await runLatency();
    if (lat) lines.push("延迟： " + lat.min + " ms（min） / " + lat.avg + " ms（avg，3 次）");
  }

  const modes = MODE === "both" ? ["single", "multi"] : [MODE];
  for (const m of modes) {
    const n = m === "single" ? 1 : THREADS;
    const label = m === "single" ? "⬇️ 单线程" : "⬇️ 多线程 ×" + n;
    try {
      const r = await runTest("down", n, sizeBytes);
      lines.push(label + "： " + fmt(r.mbps) + " Mbps（" + fmt(r.totalBytes / MB) + " MB / " + fmt(r.sec, 2) + "s" +
        (n > 1 ? "，单连接均 " + fmt(r.mbpsPerConn) + " Mbps" : "") + "）");
      console.log(label + " " + JSON.stringify(r));
    } catch (e) {
      lines.push(label + "： ❌ 失败（" + (e && e.error ? e.error : e) + "）");
    }
    if (UPLOAD) {
      const ulabel = m === "single" ? "⬆️ 单线程" : "⬆️ 多线程 ×" + n;
      try {
        const r = await runTest("up", n, usizeBytes);
        lines.push(ulabel + "： " + fmt(r.mbps) + " Mbps（" + fmt(r.totalBytes / MB) + " MB / " + fmt(r.sec, 2) + "s）");
        console.log(ulabel + " " + JSON.stringify(r));
      } catch (e) {
        lines.push(ulabel + "： ❌ 失败（" + (e && e.error ? e.error : e) + "）");
      }
    }
  }

  lines.push("源： Cloudflare" + (POLICY ? " · 策略 " + POLICY : " · 当前分流出口") +
    (METHOD === "surge" ? " · Surge 式定窗 " + DURATION + "s" : " · 定长每连接 " + SIZE_MB + " MB"));
  const title = "📶 QX 测速 · " + (MODE === "both" ? "双模式" : MODE === "single" ? "单线程" : "多线程") +
    (IS_UI ? " · " + UI_TARGET : "");
  console.log(lines.join("\n"));
  clearTimeout(watchdog);
  if (IS_UI) {
    // event-interaction：结果显示在长按弹窗面板里，不发通知
    const html = '<p style="text-align: center; font-family: -apple-system; font-size: medium">' +
      (meta ? "出口 " + escHtml(meta) + "<br/>" : "") +
      lines.map(escHtml).join("<br/>") + "</p>";
    finish({ title: title, htmlMessage: html });
  } else {
    // cron：通知照发，同时把结果回给 $done — 手动测试的结果面板靠它显示内容，裸 $done() 会显示「无有效内容」
    $notify(title, meta ? "出口 " + meta : "", lines.join("\n"));
    finish({ title: title, message: (meta ? "出口 " + meta + "\n" : "") + lines.join("\n") });
  }
})().catch(e => {
  console.log("❌ 测速异常 " + (e && e.error ? e.error : e));
  clearTimeout(watchdog);
  const emsg = "❌ 测速异常：" + (e && e.error ? e.error : e);
  if (!IS_UI) { try { $notify("📶 QX 测速", "", emsg); } catch (_) {} }
  finish({ title: "📶 QX 测速", message: emsg });
});
