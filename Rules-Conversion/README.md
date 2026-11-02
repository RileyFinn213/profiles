# Surge → Quantumult X / Loon 规则转换

源：lanjue4/P-Configuration main 的已合并 Surge/Rules/。保持来源归属及上游使用要求。转换不会启用Optional集合，不修改Surge或运行中的设备配置。

## 文件和目录

Quantumult X/Rule/ 与 Loon/Rules/ 各47份主文件：44份与Surge同名规则、ChinaDIRECT兼容聚合、2份属地规则；各有8份Optional参考集合。旧文件名继续可用。

ChinaDIRECT.list 是 China + ChinaMedia + ChinaCIDR + ChinaASN 的兼容聚合。旧配置只引用ChinaDIRECT的可继续使用。不要再同时启用四份分集，避免重复。保留广告拦截、SystemOTA和属地规则优先级；不要把国内聚合放到它们前面。

## Quantumult X

官方来源：https://raw.githubusercontent.com/crossutility/Quantumult-X/master/sample.conf

DOMAIN→host；DOMAIN-SUFFIX→host-suffix；DOMAIN-KEYWORD→host-keyword；IP-CIDR→ip-cidr；IP-CIDR6→ip6-cidr；IP-ASN→ip-asn；USER-AGENT→user-agent。

每条必须含策略。国内/LAN/SteamCN/AI-China默认direct，其余proxy；这只是默认标签，不等同你自建策略组。推荐通过force-policy明确绑定：

```ini
[filter_remote]
https://raw.githubusercontent.com/lanjue4/P-Configuration/main/Quantumult%20X/Rule/ChinaDIRECT.list, tag=国内直连, force-policy=direct, enabled=true
https://raw.githubusercontent.com/lanjue4/P-Configuration/main/Quantumult%20X/Rule/Telegram.list, tag=Telegram, force-policy=Telegram, enabled=true
https://raw.githubusercontent.com/lanjue4/P-Configuration/main/Quantumult%20X/Rule/Domestic-Social-Domain.list, tag=属地, force-policy=Landing, enabled=true
```

Telegram、Landing等组名必须已在你的QX配置存在，按实际名字替换。属地规则必须放在国内聚合之前。

限制：官方sample未确认PROCESS-NAME或Surge的逐条no-resolve参数。进程规则不写入活动QX文件；no-resolve等逐条选项转换时移除，并逐条记录到differences.json。因此IP规则的DNS解析/匹配时机会与Surge有区别，不宣称跨客户端完全等价。QX iOS本身也无法照搬Mac进程分流。

## Loon

官方来源：https://nsloon.app/docs/Rule/domain_rule 、ip_rule、http_rule、process_rule。

域名/IP/ASN/UA原生类型保留，Surge DOMAIN-SET正文转换为DOMAIN/DOMAIN-SUFFIX，不把裸域名文件误作RULE-SET。保留no-resolve选项。PROCESS-NAME保留，但官方说明仅macOS生效，iOS/tvOS忽略。

```ini
[Remote Rule]
https://raw.githubusercontent.com/lanjue4/P-Configuration/main/Loon/Rules/ChinaDIRECT.list, policy=DIRECT, tag=国内直连, enabled=true
https://raw.githubusercontent.com/lanjue4/P-Configuration/main/Loon/Rules/Telegram.list, policy=Telegram, tag=Telegram, enabled=true
https://raw.githubusercontent.com/lanjue4/P-Configuration/main/Loon/Rules/Domestic-Social-Domain.list, policy=Landing, tag=属地, enabled=true
```

Optional/GlobalMedia内的一条URL-REGEX未自动转换，记入differences.json。不影响默认主集合。

## 核验范围

完成类型白名单、策略字段、去重和源文件对应校验。未在真实Quantumult X或Loon实例做导入/运行测试。规则更新不会同时部署去广告脚本或MITM证书；模块/重写仍需客户端独立配置。

审计记录包含重复转换（例如ChinaDIRECT聚合复用IP分集）产生的差异记录，条数不等同独立故障数。
