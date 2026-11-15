# 分类基准：沿用用户现有配置

用户确认当前正式配置及 GitHub 策略组没有问题。审查对象是 MagicRule 实验草稿，不是正式配置。

1. 国内、国外分别处理，但不能按覆盖比例或服务品牌统一判断出口。
2. 保留 AI-China -> DIRECT，AI-Global -> AI。
3. GitHub 策略组及现有 Github.list 归属保留；实验稿把 api.github.com 分到 AI 才是偏差。
4. PayPal 当前由 PayPal.list -> Select，按现有代理分流，不因金融属性改为 DIRECT。
5. AdGuard/广告隐私来源可按用户需求进入 Cleanup。不能仅因产品服务域名存在就直接判错，也不能把全部 AdGuard 品牌域名自动视为广告；核对具体规则用途。
6. 保留 Landing、SteamCN、Apple 等现有专用规则与例外优先级；国内服务也可能由 Landing 出口处理。
7. 实验稿与基准不同，记为待对齐差异；不得据此认定现有策略有错。
8. 未判定项独立保留，不自动整包 DIRECT、Select 或 Cleanup。规则类型和例外不应在转换时静默丢弃。

此约定不修改正式配置。此前审查报告中把策略差异或 AdGuard 归 Cleanup 一概称为错误的表述，以本约定为准。实验草稿的内容混杂与转换遗漏仍需修正。
