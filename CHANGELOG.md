# HMOS V4.6.0 — Operations Reliability Fix

- Fixed resident Attendance page crash by adding meal windows.
- Entry / Exit V2: required GPS share, clickable Outside/Returned lists, resident detail, map, Call Resident, Call Parent, actual return history.
- Fixed dashboard live counters for pending admissions and open complaints; metric cards now navigate.
- Added automatic bed-assignment reconciliation from active resident records.
- Safer backup restore now skips newer live records instead of overwriting them.
- Rebuilt all Admin PDF reports with a premium preview and Print / Save as PDF.
- Complaints now open full detail view; status changes notify residents and write audit logs.
- Fee accounts hide payment entry when fully paid and show payment history.
- Expanded audit logging for admissions, fees, complaints, entry/exit, settings and admin credential changes.
- Removed default admin password from Settings UI and masked WhatsApp credential field.
- Fixed admission notification recipient type for student/resident notifications.

# HMOS Changelog

## 4.5.4 – Backup & Recovery V2
- Added verified same-institute backup recovery.
- Added automatic pre-restore JSON safety download and pre-restore snapshot.
- Added RESTORE confirmation gate and safe merge recovery mode.
- Recovery preserves newer live records instead of deleting them.
- Restore actions are written to Audit Logs.

## 4.5.3 – Backup & Recovery V1
- Added real downloadable institute JSON backup.
- Added backup-file verification before recovery.
- Kept daily snapshot history and health status.
- Automatic scheduled Firestore exports remain a backend/Google Cloud feature.
- No automatic destructive restore is enabled in V1.

## V4.5.1 - Payment UX
- Added clear 2-method admission payment instructions.
- Fixed Copy UPI ID with clipboard fallback.
- QR code is tappable and opens a UPI payment intent with amount.
- Removed the separate Open UPI App button.
- Transaction field renamed to Transaction ID / UTR Number.

# HMOS Production V5.1.0

- Prevents reuse of the same UPI transaction ID.
- Normalizes UPI transaction IDs before saving.
- Rich pending-admission verification card with fee, phone, bed and transaction details.
- Copy transaction ID action.
- Approval confirmation before resident creation.
- Rejection reason is saved and shown in admission tracking.
- Creates resident/admin notifications after approval.
- PWA cache version updated.

## V5.1.1 Production Clean Recovery
- Added .nojekyll for direct static hosting.
- Removed dependency on custom Firebase Hosting workflow from this package.
- Added clean deployment/recovery guide.

## V4.5.2 — Uniform UI + Mobile Payment Polish
- Fixed admission form inputs/cards overflowing outside the main card on narrow phones.
- Made Institute, Admin and Student login forms visually uniform with the Admission form.
- Improved input, label, password and button sizing across mobile/tablet/desktop.
- Kept the two-method payment flow: Copy UPI ID or tap QR to open UPI payment.
- Fixed QR/payment instruction wrapping and mobile card overflow.
- Improved Total Fee / Paying Now / Balance layout and small-screen stacking.
- Bumped browser/service-worker cache version for reliable deployment updates.
