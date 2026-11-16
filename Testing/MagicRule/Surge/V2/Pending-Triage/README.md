# 待定规则二次拆分

56,114条原始规则全部保留，未启用，未修改主配置。

- Candidate-China-IP：17,661条完整网段被独立Firefly CN-IP覆盖，DIRECT候选；这不是实际路由或可用性保证。
- Candidate-Cleanup：552条位于明确广告/隐私源，仍需误伤检查。
- Candidate-Service：47条有服务专属清单线索，包含共享遥测/实验平台，不可整包启用。
- Review-Domain：16,639条继续查独立归属；未知不自动等于海外。
- Review-Shared-IP：15,872条共享IP/地域未确认，不整包代理。
- Review-ASN：5,101条大范围ASN，不因源文件名认定全网段直连。
- Context-HTTP：140条User-Agent/URL正则，需要请求上下文测试。
- Platform-Process：102条进程规则，需按平台及实际进程归属配置。

triage.csv.gz逐条保留全部来源、候选策略和原因。拆分文件只是审阅材料，不能直接整套引用。原Pending/all-unassigned.list保持不变。
