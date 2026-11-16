# 保留原分类的合并测试草稿

保留55个原规则文件的全部行和原始前缀，仅追加V2分类支持的候选域名。新增12990条（按各目标文件统计，非全局唯一新增覆盖数），大部分来自China与Proxy补充。去重仅限同一目标文件精确及后缀覆盖。

原有AI-China/AI-Global、Github、SteamCN、PayPal、各社交/流媒体等分类保留；另加Social-Supplement.list。新增广告表、待定IP/ASN/进程/正则不在本轮合并中。

Merged-Rule-Section.conf为[Rule]片段，不是独立主配置。其移除当前V2分层引用，在原引用位置换成合并路径，保留当前手动规则和策略名。尚未在新配置实测跨文件覆盖，不要宣称与V2行为完全等价。应在Mac复制配置后测试，不自动修改任何配置或正式规则。

summary.json列各文件增量。additions-assignment.csv.gz逐条记录目标归属。当前Rex引用策略以读取时配置为准，本次未更改。
