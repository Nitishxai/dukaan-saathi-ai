# Dukaan Saathi AI
© 2026 Nitish Pal. All rights reserved. Unauthorized copying, modification, distribution, or commercial use of this project is prohibited without prior written permission.

**A voice-assisted billing and inventory app for Indian grocery stores.** Ring up a sale, check stock by weight or piece, and see how much a customer owes. The local counter supports Hindi and mixed Hindi-English input.

[Quick start](#quick-start) · [Try a sale](#try-a-sale) · [Server pilot](#optional-server-pilot) · [Offline support](#ai-and-offline-behavior) · [Verification](#verification)

| At the counter | What the shopkeeper can do |
| --- | --- |
| Billing | Sell loose goods by weight or packaged goods by piece. In the pilot, search by Hindi name, SKU or barcode and calculate change for cash sales. |
| Inventory | Check the selling price and available quantity. Saving a bill deducts the items sold. |
| Customer credit | Record credit sales and repayments, then carry a customer's advance into their next bill. |
| Day-end review | See booked sales, cash collections and manually confirmed online payments separately. |

## Quick start

Use Node.js **24.14.x**. From the cloned repository directory, run:

```shell
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open [the local counter](http://127.0.0.1:3000). The demo and local text assistant work without an account or API key.

## Try a sale

1. On first setup, select the demo shop option near the top of the setup form. Practice bills stay in a separate demo shop in this browser.
2. In billing, select **Sugar M-30**, enter **0.5 kg** and choose cash. At the starting price of **₹44/kg**, the bill totals **₹22**.
3. Save the bill and open inventory. In a fresh demo, the sugar stock falls from **28 kg to 27.5 kg**. Open the dashboard to see the sale in today's summary.

## Choose a counter

| | Local counter | Server pilot |
| --- | --- | --- |
| Entry point | `/` | `/pilot` |
| Best fit | Trying the demo or working in one browser | An owner and cashiers sharing a shop |
| Records | Browser storage with JSON export | SQLite on the server with shop-scoped access |
| Setup | Start the app | Configure persistent storage and create the first user |

## Local-data safety

- Existing browser records are not uploaded automatically. Legacy data requires explicit recovery/import review.
- One tab holds a Web Lock for local writes. Other tabs are read-only until the writer leaves/closes. Supported secure context (HTTPS or localhost) and Web Locks are required for writes. Reload old app tabs before first use of this version.
- Revisions reject stale snapshots. Bill operation IDs are stored in invoices and survive reload/export/restore; an identical retry returns the existing bill, while ID reuse with a changed bill is rejected.
- Bill amounts are calculated from current inventory prices and validated quantities, with paise precision. Changed prices, mismatched units, fractional piece counts, invalid totals and non-finite values are rejected.
- Corrupt saved JSON is preserved, writes are blocked, and the recovery screen downloads original bytes. A validated backup can be imported into a **new** shop slot; damaged slots remain available for investigation.
- Restore/reset saves a recovery snapshot first and fails without replacement if that snapshot cannot be persisted. Local recovery records use `dukaan_recovery_` keys and are included in the original-data recovery download. Keep a normal JSON export outside the browser too.
- Local storage is not authentication, encryption, cross-device sync, or a durable server backup. Clearing browser data can remove it. Local audit history can be edited by someone controlling the browser.
- Manual UPI confirmation is bound to shop, cart revision, amount and payee. The placeholder payee was removed. Check the merchant app; a QR image alone is not proof of payment.
- `/api/payment/webhook` always returns 503. No generic signature or in-memory event cache is presented as a real provider integration.

## Optional server pilot

A single Next.js process with a local SQLite database is the default server architecture. No microservices or new npm runtime dependencies. **Use a persistent local disk outside OneDrive/network shares. Do not use ephemeral/serverless storage or run replicas with independent database files.**

Set these values in your own environment / `.env.local` (the checked-in `.env.example` intentionally has blank values). Do not overwrite an existing secrets file:

- `PILOT_ENABLED=true`
- `PILOT_DATABASE_PATH=C:\workspace\dukaan-private-data\pilot.sqlite` (or another protected persistent local path)
- `PILOT_ORIGIN=http://127.0.0.1:3000` for local use; use the exact HTTPS origin for a future private deployment.

Create the first owner locally. Password entry is hidden and never passed as a command-line argument. The setup command does not load `.env.local`, so set the database path in its shell explicitly:

```powershell
$env:PILOT_DATABASE_PATH = 'C:\workspace\dukaan-private-data\pilot.sqlite'
npm run pilot:create-user -- owner
```

Then sign in at `/pilot`. Export a local shop backup, select it in **Reviewed import / restore**, check counts and shop name, then choose **Confirm: import NEW shop**. Even an empty configured local shop can be imported. Imports are authenticated, preview-hash checked and retry-safe. They never delete or change browser data.

Cashier setup (administrative CLI, local server operator only):

```powershell
npm run pilot:create-user -- cashier
node scripts/add-cashier.ts owner SHOP_ID cashier
```

Find `SHOP_ID` in the selected shop's API response or database; it is not a secret. Owners can manage inventory, restore, reverse full bills and record refunds. Cashiers can bill, create customers and record credit/repayments. All server reads/writes check membership. Sessions expire after eight hours, are revocable, and use HttpOnly/SameSite cookies (Secure on HTTPS). Mutations validate Origin, body size and persisted request budgets.

SQLite uses `BEGIN IMMEDIATE`, WAL, FULL synchronous writes, foreign keys, revision checks, persistent operation deduplication and versioned migrations. Every financial mutation keeps an immutable-in-application audit snapshot. Schema version newer than the application is rejected. The pilot uses the SQLite migrations included in the application. The separate Supabase design is outside the pilot setup.

### Backup, restore and rollback

- In the pilot counter, open **Backup & audit** and download a JSON backup for the selected shop. Owner recovery downloads are available per audit row. Re-import into a new shop to inspect safely, or explicitly restore the current server shop after preview/confirmation.
- Full server backup, including users, sessions, memberships and audit history:

```powershell
npm run pilot:backup -- C:\workspace\dukaan-private-data\backup-2026-11-13.sqlite
```

This uses SQLite's consistent backup API, not a raw copy of a live WAL file. Use a new destination and protect the backup like the database. Copy it to a separate protected disk as part of operating the pilot.

- Full rollback: stop all application processes, retain the current database **and** its `-wal`/`-shm` files as a recovery set, restore a consistent backup to a **new path**, point `PILOT_DATABASE_PATH` to it, and start a compatible application version. Do not downgrade a database in place or delete the current data.
- Migration rollback: the original local shop remains untouched. If new server bills exist, export/reconcile those before resuming the old local copy. There is no automatic bidirectional sync or merge.

### How sales, credit and refunds are recorded

Sales booked, cash collections, manual online confirmations, unknown/pending online payments, failures and cancellations are separate. An online payment cannot be marked provider-verified by a local edit. Cash-in-drawer is an estimate from recorded cash movements, not a physical reconciliation. Ledger repayments currently mean **cash received**; do not use them to label a UPI repayment as cash.

An overpayment creates a customer advance. The next credit sale uses that advance before increasing the outstanding balance. Full returns retain the original bill and add stock/credit reversal records. Cash/UPI refunds require a separate explicit manual record; the app never sends money. Partial returns, split payments and partial-payment settlement are not implemented. Returns/recorded refunds/refund liabilities are separate summary amounts; no profit or tax-compliance claims are made.

### AI and offline behavior

| Feature | Local counter without internet | Server pilot |
| --- | --- | --- |
| Inventory, cash sales, customer credit, daily summaries | Works in an already-loaded page | Requires reachable server |
| JSON backup/restore | Works in loaded page | Requires server |
| Draft actions from typed requests | Works | Local counter UI only |
| Speech recognition | Browser/device dependent; often requires internet | Not yet wired in pilot UI |
| Online Gemini | Off by default | Authenticated API only; not wired into pilot UI |
| UPI deep links | Open app if configured; settlement requires payment network | Manual records only |
| Reload from offline cache / installable PWA | Not implemented | Not implemented |

Online AI remains disabled unless you explicitly set `AI_ENABLED=true`, a positive `AI_DAILY_REQUEST_LIMIT` (1–1000), `GEMINI_API_KEY` and an actually supported `GEMINI_MODEL`. It requires an authenticated server shop, uses current server records, limits input context/output tokens, and times out requests. Request-count limits are **not a rupee spending guarantee**; configure the provider's own account budgets before enabling. No provider calls were used for validation. AI output remains a draft; deterministic accounting commits the accepted action.

## Verification

Run the checks sequentially from the repository root:

```shell
npm test
npm run lint
npm run typecheck
npm run build
npm run start -- --hostname 127.0.0.1
```

On Windows, if OneDrive blocks build output, use a checkout outside the synced folder. To select a fresh output directory, set `$env:DUKAAN_BUILD_DIR = '.next-verified'` in PowerShell before both build and start.

See [reliability notes](RELIABILITY_NOTES.md) for regression coverage and recorded results. Mobile and keyboard journeys still need verification before using the pilot with real shop records.

## Pilot limits

UPI confirmation is manual. The pilot supports full returns. Partial returns, split payments, automatic backup scheduling and email account recovery are still open. GST filing and profit reporting are outside the current scope.
