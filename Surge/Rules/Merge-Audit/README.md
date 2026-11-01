# Surge 全套规则合并快照

2026-11-02。按 lanjue4/P-Configuration 现有用途合并 Rabbit-Spec/Surge 当前规则。不含节点凭据、API密钥或证书。请只替换仓库规则文件，不替换整个仓库。

## 目录

- Surge/Rules/：44 个现有用途文件，按原文件名提供替换。
- Rules/：你的两份 Domestic-Social 属地规则，原样保留。
- optional/：8 个不能安全塞入窄分类的参考集合，默认不启用。
- Rule-after-upload.conf：国内部分引用修正稿，保留原有策略顺序；不是完整设备配置。
- merge-report.json：每个文件来源、输入/输出/去重数量。

## 对应合并

Google → Google.list；Apple → Apple.list；Microsoft → Microsoft.list；Spotify → Spotify.list；YouTube → YouTube.list；Netflix → Netflix.list；TikTok → TikTok.list；Instagram → Instagram.list；Disney → Disney+.list；BiliBili → Bilibili.list；Telegram + TelegramASN → Telegram.list；LAN → LAN.list。

AIGC：明确的AI服务域名增补到 AI-Global.list；共享认证/支付/CDN、遥测、泛ASN/IP没有盲目导入AI组。原始完整AIGC候选独立放 optional，保留供复查。

未找到同用途上游的原有文件：仅自身去重，不强行扩容。例如 Reddit、Discord、Twitter、Pinterest、HBO、AppleTV、AGE、Steam、SteamCN、Epic、PlayStation、国内AI等。

## 不能直接混合的集合

optional/Game.list：不能整份塞进Steam或Epic；包含下载CDN和多平台业务。
optional/GlobalMedia.list：不能整份塞进Netflix/Disney；默认不启用。
optional/Proxy.list：泛代理兜底，不能放到专用服务或国内规则前面。
optional/Facebook.list / Whatsapp.list / Meta.list / PayPal.list：你没有独立同名分类，保留独立参考，不擅自改变Social/Final用途。
optional/AIGC.list：完整上游候选，仅供审查，不自动引用。

这些文件若需启用，要先按实际策略组和顺序接入，不是上传就会生效。

## ChinaSupplement 已取消

按用户选择不提供、不引用旧36条关键词补充表；旧域名后缀和IP/ASN已并入国内对应集合。取消关键词可能让仅被关键词覆盖的域名回落FINAL，后续用精确域名补充。

## 格式与配置

只有 China.list 是 DOMAIN-SET：前导点=后缀；不带点=精确域名。其余文件是 RULE-SET。不要统一修改成一种引用方式。

```ini
DOMAIN-SET,https://raw.githubusercontent.com/lanjue4/P-Configuration/main/Surge/Rules/China.list,DIRECT,update-interval=86400
```

其它服务沿用原URL与原策略，无须改名。不修改SystemOTA拦更新、属地规则、手机→Mac架构、DNS、MITM。

## 去重边界

同文件内精确去重；相同选项下，父域后缀已覆盖的子域/精确域名去重。不同策略用途之间保留重叠，因为先后顺序会改变路由。IP范围仅精确行去重，不宣称所有跨文件、不同no-resolve语义已消除重叠。保留原服务规则靠前的优先级。

## 归属与范围风险

保留来源归属。Rabbit 未取得标准许可证确认，其README有自用等要求；公开再分发前请自行确认授权。域名事实集合与原作者注释/编排的使用条件需分别注意，不能把署名等同授权。

上游China列表含个人全球直连例外（1Password、ASUS、Pokemon、小佩海外IP等），不是严格中国地理清单。ASN/关键词可能较宽。本次没有擅自删除你的原有策略范围。

这是静态快照，不会自动跟随Rabbit更新；语法校验不代表逐个App全部测试。请上传后刷新资源，再验证登录/播放/支付及属地。
