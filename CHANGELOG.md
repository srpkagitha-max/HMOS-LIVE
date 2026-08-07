# HMOS V4.5.8 — Outside / Returned Tap Fix

- Outside Now and Returned cards now open a dedicated resident-list bottom sheet.
- Uses one delegated click handler for more reliable Android/mobile tapping.
- Resident name tap opens full movement details.
- Existing View Location, Call Resident, Call Parent and Mark Entry actions are preserved.

# HMOS V4.5.7 — Entry / Exit V2

- Resident: Reason, Where, Leaving Date/Time and Expected Return Date/Time.
- Single “Share Location + Submit” action requests current GPS and stores coordinates.
- Admin: Outside and Returned cards are tappable and show resident name lists.
- Tap a resident to open full movement details.
- Admin detail includes View Location, Call Resident and Call Parent.
- Outside resident detail includes Mark Entry; returned records show actual return time.
- Older movement records without GPS remain readable and are clearly marked as having no shared location.

# HMOS V4.5.6 — Complaint Detail View

- Admin complaint cards are now tappable.
- Opens a mobile-friendly full complaint detail sheet.
- Shows resident, category, submitted time (when available), full complaint text and current status.
- Admin can update and save complaint status inside the detail view.

# HMOS V4.5.5 — Bed Allotment Sync Patch

- Adds a conservative room/bed reconciliation when Admin opens Beds.
- Active resident Room/Bed data repairs stale Reserved/Vacant bed cards to Occupied.
- Does not overwrite a bed already occupied by another resident.
- Does not overwrite a reserved bed when its resident name belongs to somebody else.
- Recalculates occupied bed count after repair.

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
