# Stash / Egern 远程配置与原生规则

2026-11-06 从Mac Surge P.conf派生，不改任何设备配置。

目录与现有工具一致：Stash/Rules/*.list，Egern/Rules/*.yaml。主配置含私人Sub-Store地址，只私下交付，不在公开仓库发布。

## 动态节点

Stash使用proxy-providers uui，Sub-Store target=Stash；Egern使用policy_groups内urls，target=Egern。两端私有端点实测返回proxies YAML，各88节点。节点更新86400秒；地区筛选不固定节点名。

DR/NV改为动态选择同VPS订阅节点的策略组，不复制Mac Snell6密钥。Egern官方不支持Snell6，不把版本伪改为4/5。近期Stash支持Snell6，但当前输出仍使用订阅内兼容协议。smart近似为Stash url-test/Egern auto_test，不宣称相同算法。

## 动态规则

主配置引用本仓库远程规则，客户端每86400秒刷新；没有将全量规则内嵌。58份源生成58份Stash规则、Egern各普通/no-resolve两份规则，公共来源映射在client-sources.json。

这些是可远程更新的托管文件，但并不意味着自动跟随原Surge源变化。tools/convert-stash-egern.py可重新生成：

```sh
python3 -m pip install pyyaml
python3 tools/convert-stash-egern.py .
```

脚本有网络请求、错误即失败；生成完成后检查git diff再提交。当前没有安装GitHub Actions自动任务。自有源修改后需运行该脚本并提交，客户端才能拉到新的派生内容。原始上游作者归属与使用要求继续适用。

## 差异

Stash规则兼容USER-AGENT、URL-REGEX、AND/OR/NOT、ASN；移除Surge专属pre-matching/extended-matching标记，不宣称阶段相同。原源有多余策略列时清理为集合条件。China纯域名集合转换为DOMAIN/DOMAIN-SUFFIX，保留根域语义。

Egern原生字段为domain_set/domain_suffix_set/asn_set等。普通IP与no-resolve IP拆成两份远程文件；顶层集合no_resolve仅作用对应IP，主配置原有集合级no-resolve继续保留。域名逻辑组合转等价domain_regex集合（当前输入仅域名条件；遇UA等组合不臆测逻辑集合schema，列审计差异）。Egern没有已确认的进程条件，已剔除28条，详见client-conversion-report.json。

UA/URL需HTTP可见性，HTTPS可能依赖MITM。没有复制CA私钥、安装证书或移植Surge脚本面板；因此不能宣称去广告模块完整等价。没有全局封QUIC。

Home/DEVICE Ponte及相关Home本地路由移除。保持SystemOTA阻止更新、Domestic-Social原用途、现有AppleTV规则目标按Mac当前配置原样继承，自定义cdn直连等原意不改。

## 验证范围

YAML可解析、策略引用、远程源下载、节点输出结构和当前筛选数量已检查。没有Stash/Egern实机与专用内核校验器，不冒充已完成App导入测试。DNS仍为192.168.1.120，订阅仍为私网服务；离家访问必须自行保证私网可达，不能依靠公开规则URL解决。

## 官方依据

https://stash.wiki/proxy-protocols/proxy-providers
https://stash.wiki/rules/rule-set
https://stash.wiki/rules/rule-types
https://egernapp.com/docs/configuration/policy_groups
https://egernapp.com/docs/configuration/rules
https://egernapp.com/docs/configuration/dns
https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/producers/index.js
