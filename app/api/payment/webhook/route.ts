// Disabled until a provider contract, trusted orders and durable event ledger exist.
// Never acknowledge an event as processed without committing its reconciliation.
export async function POST() {
  return Response.json({ success: false, error: 'PAYMENT_INTEGRATION_DISABLED', message: 'Automatic payment verification is not configured.' }, { status: 503 });
}
