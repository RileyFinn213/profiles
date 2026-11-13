# Surge rules synchronization

57 source lists synchronized to Loon, Stash classical-text, Quantumult X native filters and Egern YAML (normal plus no-resolve). Source relative names and Optional subdirectory retained. Target-only files are preserved, not automatically removed.

Quantumult X uses portable third-column proxy and requires force-policy at import, including direct/reject when needed. Unsupported process, URL-regex and logical conditions are commented and accounted for in Surge-sync-report.json. Per-rule no-resolve is unavailable in QX and not retained. Loon retains process conditions, ignored on iOS/tvOS. Egern excludes process conditions and converts the three domain-only AND conditions to equivalent anchored domain regex. Egern no-resolve IP conditions remain in separate companion lists; import both companions to retain coverage. Stash output uses behavior classical, format text.

Rex/Emby/Reading-Direct match current Surge sources. Emby 28.ai is preserved exactly; no unrelated spelling repair. YAML parsing and rule accounting passed; no actual client runtime/import claimed. Old conversion reports describe historical runs; this report describes this synchronization.
