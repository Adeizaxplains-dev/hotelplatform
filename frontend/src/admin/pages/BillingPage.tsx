import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import { ApiError } from "@/services/apiClient";
import { adminApi, type BillingPlan } from "@/services/adminApi";
import { AdminPage, QueryBoundary } from "../components/AdminPage";

const dateTime = (v: string | null | undefined) => v ? new Date(v).toLocaleString() : "—";
const featureNames: Record<string, string> = { website: "Hotel website", cms: "Website content management", rooms: "Room catalogue", gallery: "Photo gallery", booking: "Online bookings", reservations: "Reservation management", guests: "Guest directory", payments: "Guest payments", invoices: "Invoices", reports: "Reports", staff: "Staff management", housekeeping: "Housekeeping", expenses: "Expenses", offers: "Offers", events: "Events", restaurant: "Restaurant tools", auditLogs: "Audit logs" };

export default function BillingPage() {
  const [search] = useSearchParams();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const qc = useQueryClient();
  const reference = search.get("reference") ?? search.get("trxref");
  const verificationStarted = useRef<string | null>(null);
  const current = useQuery({ queryKey: ["admin", "billing-current"], queryFn: adminApi.billingCurrent });
  const history = useQuery({ queryKey: ["admin", "billing-history"], queryFn: adminApi.billingHistory });
  const verify = useMutation({ mutationFn: adminApi.verifyBillingPayment, onSuccess: async (r) => { setNotice(r.message); setError(""); await qc.invalidateQueries({ queryKey: ["admin", "billing-current"] }); await qc.invalidateQueries({ queryKey: ["admin", "billing-history"] }); }, onError: (e) => setError(e instanceof ApiError ? e.message : "We could not verify this subscription payment.") });
  const startTrial = useMutation({ mutationFn: adminApi.startBillingTrial, onSuccess: async () => { setNotice("Your 14-day trial has started."); setError(""); await qc.invalidateQueries({ queryKey: ["admin", "billing-current"] }); }, onError: (e) => setError(e instanceof ApiError ? e.message : "The trial could not be started.") });
  const checkout = useMutation({ mutationFn: adminApi.checkoutBillingPlan, onSuccess: (r) => { window.location.assign(r.authorizationUrl); }, onError: (e) => setError(e instanceof ApiError ? e.message : "Subscription checkout could not be started.") });
  const verifyPayment = verify.mutate;
  useEffect(() => { if (reference && verificationStarted.current !== reference) { verificationStarted.current = reference; verifyPayment(reference); } }, [reference, verifyPayment]);

  return <AdminPage title="Subscription & billing" description="Manage this hotel's plan and subscription payments. Guest accommodation payments remain separate from the hotel's SaaS subscription.">
    {error && <Alert tone="danger" title="Billing action needs attention">{error}</Alert>}
    {notice && <Alert tone="success" title="Billing update">{notice}</Alert>}
    {reference && <Card className="flex items-center gap-3 p-4"><RefreshCw className={`size-5 ${verify.isPending ? "animate-spin" : ""}`} /><div><p className="font-semibold">Subscription payment verification</p><p className="text-sm text-muted">Reference: {reference} · {verify.isPending ? "Checking payment with Paystack…" : verify.data?.status ?? "Verification required"}</p></div>{verify.isError && <Button variant="secondary" size="sm" onClick={() => verify.mutate(reference)}>Retry verification</Button>}</Card>}
    <QueryBoundary query={current} what="subscription details">{(sub) => <>
      <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">Current plan: {sub.plans.find((p) => p.key === sub.plan)?.name ?? sub.plan}</h2><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{sub.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-sm text-muted">Trial ends: {dateTime(sub.trialEndsAt)} · Paid period ends: {dateTime(sub.currentPeriodEnd)}</p>{sub.lastPaymentReference && <p className="mt-1 text-xs text-muted">Last subscription payment: {sub.lastPaymentReference}</p>}</div>{sub.status === "NOT_STARTED" && <Button loading={startTrial.isPending} onClick={() => startTrial.mutate()}>Start 14-day trial</Button>}</Card>
      <section className="grid gap-3"><div><h2 className="text-xl font-bold">Available plans</h2><p className="text-sm text-muted">Monthly pricing is controlled by platform environment settings. Checkout stays disabled until prices are configured.</p></div><div className="grid gap-4 lg:grid-cols-3">{sub.plans.map((plan: BillingPlan) => <Card key={plan.key} className="flex flex-col gap-4 p-5"><div><h3 className="text-lg font-bold">{plan.name}</h3><p className="mt-1 text-2xl font-extrabold">{plan.monthlyPriceKobo === null ? "Price not configured" : `${formatMoney(plan.monthlyPriceKobo, plan.currency)}`}<span className="text-sm font-normal text-muted">{plan.monthlyPriceKobo === null ? "" : " / month"}</span></p></div><ul className="grid gap-2 text-sm">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />{featureNames[feature] ?? feature}</li>)}</ul><div className="mt-auto border-t border-line pt-4">{plan.key === sub.plan && sub.status === "ACTIVE" ? <Button disabled className="w-full" variant="secondary">Current plan</Button> : <Button className="w-full" loading={checkout.isPending && checkout.variables === plan.key} disabled={plan.monthlyPriceKobo === null || checkout.isPending} onClick={() => { setError(""); setNotice(""); checkout.mutate(plan.key); }} icon={<CreditCard className="size-4" />}>Choose {plan.name}</Button>}</div></Card>)}</div></section>
    </>}</QueryBoundary>
    <section className="grid gap-3"><h2 className="text-xl font-bold">Subscription payment history</h2><QueryBoundary query={history} what="subscription payment history">{(result) => result.items.length ? result.items.map((item) => <Card key={item.reference} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{item.plan} · {item.reference}</p><p className="text-sm text-muted">{dateTime(item.paidAt ?? item.createdAt)}</p></div><div className="text-right"><p className="font-bold">{formatMoney(item.amountKobo, item.currency)}</p><p className="text-xs text-muted">{item.status}</p></div></Card>) : <Card className="p-5 text-sm text-muted">No subscription payments recorded yet.</Card>}</QueryBoundary></section>
  </AdminPage>;
}
