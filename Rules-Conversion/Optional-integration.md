# Optional supplement integration

The eight former Optional rule files now live at each client Rules/Rule root. Existing root libraries are unchanged. Supplements contain only incremental domain conditions; exact duplicates, known suffix coverage, existing keyword matches and new parent suffixes that would capture existing children were removed. New keyword/IP/ASN/process/URL/user-agent conditions are quarantined in Optional-integration.json. This deliberately favors existing routing over maximum supplemental coverage.

Place supplements after existing personal, dedicated and domestic rule libraries, before GEOIP and FINAL/default. AIGC→AI, Whatsapp/Facebook/Meta→Social, Game→Gaming, GlobalMedia→Streaming, PayPal/Proxy→Select. New files are not activated automatically. Existing keyword rules and changing DNS/IP resolution can still overlap conceptually; no runtime or full semantic-disjointness guarantee is made. IP/ASN overlap cannot be excluded by hostname-only checks.

Old Optional URLs are removed; update old references to the root paths. Egern no-resolve companion files are removed because these supplements now contain domain conditions only. Per-client output differences: none in retained domain coverage; QX uses proxy placeholder and explicit force-policy.

## AI consolidation follow-up

AIGC is no longer active. Its two retained endpoints gateway.ai.cloudflare.com and api.together.xyz are merged into AI-Global for every client. Remove AIGC references; use existing AI-Global with policy AI. Initial counts are historical; seven supplemental libraries remain.
