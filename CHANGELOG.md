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
