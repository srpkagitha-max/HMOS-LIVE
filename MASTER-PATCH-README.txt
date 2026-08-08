HMOS MASTER CUMULATIVE PATCH — V4.5.23

This ZIP is a cumulative patch built against the uploaded HMOS-LIVE-main(6).zip baseline.
It includes every file that differs in the latest V4.5.23 build, so you do not need to apply
the smaller V4.5.20 / V4.5.21 / V4.5.22 / V4.5.23 patches one by one.

Included areas:
- Notifications fixes (student/admin, fee/complaint/entry-exit alerts, retry/error handling)
- Audit Logs / Recycle Bin / Backup & Restore stability
- Navigation and Android back-flow guard
- Same-session screen resume behavior
- PDF/receipt and earlier UI/data consistency fixes already present in the latest build
- Cache/version updates

How to use:
1. Extract this ZIP.
2. Upload/replace ALL files from this patch into the existing project, preserving folders.
3. Redeploy.
4. Clear site/PWA cache once if an older service worker is still active.
5. Test Admin + Resident navigation and Notifications first.

Do not mix older patch files after applying this master patch.
