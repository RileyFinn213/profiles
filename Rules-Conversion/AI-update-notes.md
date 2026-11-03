# AI规则更新

来源：Haxhork/DeveloperBeta/main/Surge/Ruleset/AI.list + RileyFinn213/profiles 原AI-China/AI-Global。保留归属，第三方API规则收录不构成官方身份、可信性或安全背书。

## 分类原则

国内产品的官方接入端点直连，国际版/国际region入口归AI代理。不以公司国籍替代端点用途和region；不宣称全部主机物理位置已经核实。

新增国内精确端点：
- api.moonshot.cn
- api.siliconflow.cn
- api.minimax.cn
- dashscope.aliyuncs.com
- token-plan-cn.xiaomimimo.com

已核查来源：
https://platform.moonshot.cn/docs/intro
https://docs.siliconflow.cn/cn/userguide/quickstart
https://platform.minimaxi.com/docs/guides/quickstart
https://www.alibabacloud.com/help/en/model-studio/base-url
https://mimo.mi.com/docs/en-US/tokenplan/Token%20Plan/quick-access

小米官方区分cn中国、sgp新加坡、ams欧洲，不增加xiaomimimo.com整域国内规则。百炼国际/美国/香港入口不能与北京入口混为一谈，不整域匹配aliyuncs.com或maas.aliyuncs.com。

新源中的moonshot.ai、kimi.ai、minimax.io、siliconflow.com、stepfun.ai、z.ai等保留国际产品用途AI代理，不表示全部已核验物理机房地域。longcat.chat、developer.amd.com.cn以及未知第三方网关保留源表路由建议并列为待审，不能仅凭后缀或公司背景确认国内。未确认的旧MiniMax地址、stepfun.com和kimi.com整域不新增至国内。

## 保留既有行为

旧国内豆包/DeepSeek、字节共享域名/ASN及旧国际共享依赖（Auth0、Stripe、googleapis、azureedge等）继续保留，不擅自大规模改变用途；这些不代表AI专属，应另做精简审查。

## 转换

相同行和相同选项父域覆盖去重。新源3条AND组合条件保留Surge/Loon；QX没有生成未经确认的等价写法，不退化为整个Azure/run.app域名代理，详见AI-update-differences.json。QX逐条no-resolve仍属于有损转换。

仅更新三客户端AI-China.list/AI-Global.list及本次审计。现有文件名、设备节点、DNS、MITM、属地、系统更新拦截和策略组不变。
