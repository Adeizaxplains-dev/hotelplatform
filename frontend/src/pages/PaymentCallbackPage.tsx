import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert } from "@/components/feedback/Alert";
import { publicApi, type PaymentVerification } from "@/services/publicApi";

export default function PaymentCallbackPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const [result, setResult] = useState<PaymentVerification | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!reference) { setError("No payment reference was supplied. Please return to the hotel and check your reservation."); setLoading(false); return; }
    publicApi.verifyPayment(reference).then((value) => { if (active) setResult(value); }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "We could not verify this payment."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reference]);
  return <main className="mx-auto max-w-2xl px-5 py-20"><p className="text-sm font-semibold uppercase tracking-wide text-brand">Payment status</p><h1 className="mt-3 text-4xl font-bold">Verify your payment</h1>
    {loading && <p className="mt-5 text-muted" role="status">Checking payment status securely with the payment provider…</p>}
    {error && <div className="mt-6"><Alert tone="danger" title="Payment not verified">{error}</Alert></div>}
    {result && <div className="mt-6"><Alert tone={result.status === "SUCCESS" ? "success" : "warning"} title={result.status === "SUCCESS" ? "Payment successful" : "Payment pending"}>{result.message}</Alert><dl className="mt-5 grid gap-3 rounded-xl border border-line p-5"><div><dt className="text-sm text-muted">Booking reference</dt><dd className="font-semibold">{result.reservationReference}</dd></div><div><dt className="text-sm text-muted">Payment reference</dt><dd className="break-all font-semibold">{result.reference}</dd></div></dl></div>}
    <Link to="/" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-lagoon-600 px-4 text-sm font-semibold text-white hover:bg-lagoon-700">Return to hotel website</Link>
  </main>;
}
