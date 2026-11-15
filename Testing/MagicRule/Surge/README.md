> **测试结论：分类审查未通过，请勿整套启用。** Surge 已连接，但临时 RULE-SET 未证明命中新文件，原规则仍在生效。AI.list 混入 GlobalAI 源中的无关域名。详见 runtime-review.json。

# MagicRule / Surge 实验规则

基于用户上传的 MagicRule规则库.zip 整理，按现有策略组生成的启发式分类草稿。

## 使用
- Rules/：18 个实验规则集；summary.csv：实际条数；classification.csv：源规则集映射。
- rules-example.conf 仅为引用示例，须选择需要的行添加到现有 [Rule] 段，不能作为完整配置导入。
- 未修改正式规则、主配置或手机配置，也未自动启用。建议先测试一个专项服务。

## 验证范围与限制
- validation.json 记录格式、IP 网段、精确重复检查及文件 SHA-256。
- 当前 Surge MCP 连接拒绝，尚未在 Surge 核心完成加载和 match_rule 实测。
- DIRECT/Select 是分类建议，不是实测出口。70% China 覆盖率不证明全组直连；未覆盖也不证明应代理。
- 国内云、金融及其他类别尚需逐项复核。应保留已有 Landing、国内社交、AI-China、SteamCN 等专用规则优先级，不能直接用本草稿覆盖。
- 同类型同值去重不等于消除父子域名、关键字、IP 覆盖冲突；顺序会改变结果。
- 转换阶段只保留 DOMAIN、DOMAIN-SUFFIX、DOMAIN-KEYWORD、IP-CIDR、IP-CIDR6，其他类型未合并。
- Cleanup 草稿没有包含完整 Advertising/AdvertisingLite，不能作为现有广告规则的完整替代品。先前高重复判断没有完成逐源验证。
- 来源与条款见原压缩包各 manifest 及 classification.csv 的上游列；版权归原作者。
