# 全量审查：未通过，勿整套启用

## 已验证
- 仓库 18 个规则文件与本地逐字节一致，合计 134,842 条。
- 基础格式/IP 家族/参数检查未发现错误；相同类型和值的精确重复为 0。这不是 Surge 核心完整解析验证。
- 完成 30 个代表域名的当前配置 match_rule 实测。草稿结果是按引用示例顺序在本地计算，不是新规则已经生效。

## 确定问题
|域名|实验草稿归组|当前实际策略|
|---|---|---|
|api.github.com|AI|GitHub|
|deepseek.com|AI|DIRECT|
|paypal.com|DIRECT|Select|
|api5-normal-c-hl.amemv.com|TikTok|Landing / PC|
|api.weibo.cn、api.zhihu.com|Social|Landing / PC|
|douyin.com|TikTok|DIRECT|
|steamcontent.com|Gaming|DIRECT|
|123av.com、1password.dev|AI|Select|
|20thcenturystudios.com|AI|Streaming|
|adguard.com|Cleanup|Select|

这些差异说明草稿不能作为现有策略的等价替代；不把当前策略视作所有服务的普适推荐。GlobalAI 原始聚合源包含无关域名，品牌名分类未审核内容。

## 覆盖与遗漏
- 发现 15,218 对跨组父子域名覆盖关系。此数字包含正常优先级覆盖，不能说是 15,218 个错误，但证明精确去重未消除冲突。
- 已标为合并的源中，转换丢失 USER-AGENT 154 行、PROCESS-NAME 163 行、URL-REGEX 15 行、IP-ASN 5,091 行；按原始行累计，未去重。
- 9 个无 DOMAIN 规则的源被整个忽略，但其中有有效 IP 规则：例如 BaiduCloud 的 141 条 IPv4/IPv6、360Cloud 的 30 条，以及 ChinaASN 的 5,076 条 ASN。该忽略方式不正确。
- 从 China 覆盖比例决定整个规则集 DIRECT，以及未覆盖就归 Select，均不能证明真实路由。
- 先前广告源高度重复、6源等说明未充分复核，不能作完整性保证。

## 状态
没有修改正式配置。上轮临时规则已移除。新增实验规则未证明在 Surge 核心成功加载/命中；当前不能宣称全套测试通过。需要先重建分类、保留原生类型和专用例外，再逐组核心验证。

report.json：全量统计与文件哈希；representative-routes.json：当前配置路由对照；suffix-conflicts.json：跨组父子覆盖；ignored-source-types.json：忽略源类型。
