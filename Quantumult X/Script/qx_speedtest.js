/**
 * QX 网速测试（单线程 / 多线程双模式） v1.0.0
 *
 * 类 Surge [Testing] 吞吐测试的 Quantumult X 任务脚本版：
 * Surge 默认 download-concurrency=4、duration-limit=10s，本脚本多线程默认同样 4 并发。
 *
 * 测速源：Cloudflare 官方 speed.cloudflare.com
 *   下载 https://speed.cloudflare.com/__down?bytes=N   （返回 N 个 ASCII "0"，文本安全）
 *   上传 https://speed.cloudflare.com/__up             （POST，默认关，upload=1 开启）
 *   出口 https://speed.cloudflare.com/meta             （出口 IP / 城市 / Colo / ASN）
 *
 * 参数切换（QX 官方方式：写在脚本 URL 的 # 后面，脚本里用 $environment.variables 读取，
 * v1.5.6 build 918+；旧版自动回退解析 $environment.sourcePath）：
 *
 * [task_local]
 * 双模式（先单后多，一次出两个数，默认）：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=both&threads=4&size=25, tag=网速测试-双模式, enabled=false
 * 只测单线程：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=single, tag=网速测试-单线程, enabled=false
 * 只测多线程：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=multi&threads=4, tag=网速测试-多线程, enabled=false
 * 指定策略/节点测（policy 填策略组名、节点 tag 或 direct；指定后每条连接都重新握手，见官方 sample-fetch-opts-policy）：
 * * * * * * https://raw.githubusercontent.com/RileyFinn213/profiles/refs/heads/main/Quantumult%20X/Script/qx_speedtest.js#mode=multi&policy=direct, tag=网速测试-直连, enabled=false
 *
 * 全部参数（不写就用默认值）：
 *   mode     both | single | multi     默认 both
 *   threads  多线程并发数 1-8           默认 4（与 Surge 默认一致）
 *   size     每条连接下载 MB（十进制）   默认 25；流量敏感改 10，慢线改 50 更准
 *   upload   0 | 1                     默认 0（开启后下载测完接着测上传）
 *   usize    每条连接上传 MB            默认 5
 *   latency  0 | 1                     默认 1（测 3 次 bytes=0 取最小/平均）
 *   meta     0 | 1                     默认 1（显示出口信息，失败自动跳过）
 *   policy   策略组名 / 节点 tag / direct，留空 = 按现有分流规则走（测当前出口）
 *   url      自定义下载地址（须支持 ?bytes=N 的 Cloudflare 风格接口才准），默认官方源
 *   timeout  整体超时秒数               默认 120，到点强制结束并通知
 *
 * 已知限制（QX 本身，不是脚本问题）：
 *   1. $task.fetch 只能拿到完整响应体、没有流式回调，所以是「定长下载计时」，
 *      不是 Surge 那种「定时间窗流式计量」，慢启动阶段会拉低一点结果。
 *   2. 脚本用 opts.filter 让大响应体在 Network Extension 侧只回传字节数
 *      （官方 sample-fetch-opts-filter 的做法），避免几十 MB 文本进 JS 内存；
 *      filter 不生效时自动回退用响应体/Content-Length 计量，结果一样、只是更吃内存。
 *   3. 测的是「测速域名在你分流规则下命中的那个出口」，不是逐个节点批量测速。
 *      想测某个节点：把 policy 参数填成那个策略组/节点，或先在 QX 里切好节点再跑。
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
const UPLOAD = String(P.upload || "0") === "1";
const USIZE_MB = Math.min(50, Math.max(1, parseFloat(P.usize) || 5));
const DO_LATENCY = String(P.latency || "1") !== "0";
const DO_META = String(P.meta || "1") !== "0";
const POLICY = (P.policy || "").trim();
const BASE = (P.url || "https://speed.cloudflare.com").replace(/\/+$/, "");
const TIMEOUT_S = Math.min(600, Math.max(20, parseInt(P.timeout, 10) || 120));

const MB = 1000000; // 十进制 MB，与 Mbps 口径一致（网络速率通用口径）
// Cloudflare /meta 对无浏览器 UA 的请求只回 {}，所有请求统一带浏览器 UA
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

// ---------- 工具 ----------
let doneCalled = false;
function finish() {
  if (!doneCalled) { doneCalled = true; $done(); }
}
const watchdog = setTimeout(() => {
  console.log("⏱ 整体超时 " + TIMEOUT_S + "s，强制结束");
  try { $notify("📶 QX 测速", "", "⏱ 超过 " + TIMEOUT_S + "s 未完成，已强制结束\n（慢线可调大 timeout，或调小 size）"); } catch (e) {}
  finish();
}, TIMEOUT_S * 1000);
if (watchdog && typeof watchdog.unref === "function") watchdog.unref();

function fmt(n, d) { return Number(n).toFixed(d === undefined ? 1 : d); }
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

function fetchOnce(req) {
  const r = Object.assign({}, req);
  if (POLICY) r.opts = Object.assign({}, r.opts || {}, { policy: POLICY });
  return $task.fetch(r);
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

async function runLatency() {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    try {
      await fetchOnce({ url: BASE + "/__down?bytes=0&r=" + Date.now() + "-" + i, method: "GET", headers: { "User-Agent": UA } });
      samples.push(Date.now() - t);
    } catch (e) { /* 单次失败忽略 */ }
  }
  if (!samples.length) return null;
  return {
    min: Math.min.apply(null, samples),
    avg: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
  };
}

async function runMeta() {
  try {
    const resp = await fetchOnce({ url: BASE + "/meta", method: "GET", headers: { "User-Agent": UA, "Referer": "https://speed.cloudflare.com/" } });
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
  const lines = [];
  const sizeBytes = Math.round(SIZE_MB * MB);
  const usizeBytes = Math.round(USIZE_MB * MB);
  console.log("📶 QX 测速开始 mode=" + MODE + " threads=" + THREADS + " size=" + SIZE_MB + "MB upload=" + UPLOAD + (POLICY ? " policy=" + POLICY : ""));

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
      const r = await runRound("down", n, sizeBytes);
      lines.push(label + "： " + fmt(r.mbps) + " Mbps（" + fmt(r.totalBytes / MB) + " MB / " + fmt(r.sec, 2) + "s" +
        (n > 1 ? "，单连接均 " + fmt(r.mbpsPerConn) + " Mbps" : "") + "）");
      console.log(label + " " + JSON.stringify(r));
    } catch (e) {
      lines.push(label + "： ❌ 失败（" + (e && e.error ? e.error : e) + "）");
    }
    if (UPLOAD) {
      const ulabel = m === "single" ? "⬆️ 单线程" : "⬆️ 多线程 ×" + n;
      try {
        const r = await runRound("up", n, usizeBytes);
        lines.push(ulabel + "： " + fmt(r.mbps) + " Mbps（" + fmt(r.totalBytes / MB) + " MB / " + fmt(r.sec, 2) + "s）");
        console.log(ulabel + " " + JSON.stringify(r));
      } catch (e) {
        lines.push(ulabel + "： ❌ 失败（" + (e && e.error ? e.error : e) + "）");
      }
    }
  }

  lines.push("源： Cloudflare" + (POLICY ? " · 策略 " + POLICY : " · 当前分流出口") + " · 每连接 " + SIZE_MB + " MB");
  const title = "📶 QX 测速 · " + (MODE === "both" ? "双模式" : MODE === "single" ? "单线程" : "多线程");
  console.log(lines.join("\n"));
  $notify(title, meta ? "出口 " + meta : "", lines.join("\n"));
  clearTimeout(watchdog);
  finish();
})().catch(e => {
  console.log("❌ 测速异常 " + (e && e.error ? e.error : e));
  try { $notify("📶 QX 测速", "", "❌ 测速异常：" + (e && e.error ? e.error : e)); } catch (_) {}
  clearTimeout(watchdog);
  finish();
});
