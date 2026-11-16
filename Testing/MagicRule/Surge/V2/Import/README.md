# MagicRule V2 域名分流测试片段

这是用于用户导入测试的候选配置，不是已完成所有域名可用性测试的成品。

## 如何使用
1. 先在 Mac Surge 复制/备份现有主配置。
2. 打开 MagicRule-V2-Rule-Section.conf，将其中 [Rule] 段合并替换到测试配置的同名段。它不是完整配置，不可作为独立主配置安装。
3. 原节点、策略组、证书、模块及其他配置段保持原样。手机继续使用Mac主配置的分离同步，不重复写入。
4. 也可只将 MagicRule-V2-References.conf 的引用行插入原 [Rule] 的 Rex 引用后、AI-China前。
5. 保存后观察规则集下载和配置警告，再在请求详情确认 matched rule-set URL包含 Testing/MagicRule/Surge/V2/Ordered/，然后测试常用服务。
6. 回退时恢复备份，或删除 BEGIN/END 标记之间新增行。

## 本轮范围
只接入有候选分类依据的域名规则，保留当前手动规则、安全/OTA、Landing、Emby/Rex先行优先级。现有Cleanup保持原样；不新增实验Cleanup大表，不接入待确认IP/ASN/进程/正则。

## 验证边界
- 逐文件下载比对、基础格式、策略名称及原有规则顺序检查通过。
- validation.json列出实际Surge临时单条规则的命中结果，这只验证抽样行及目标策略可用。
- 临时RULE-SET调用未证明新远程规则集核心加载成功，故不宣称整套远程加载或全部域名连通性通过。
- 服务归属来自独立上游；先行例外保留，不能把所有国内域名等同于DIRECT或所有境外都等同Select。
