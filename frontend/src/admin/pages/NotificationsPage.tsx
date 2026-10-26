import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailWarning, RefreshCw } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/services/apiClient";
import { adminApi } from "@/services/adminApi";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/permissions";
import { AdminPage, QueryBoundary } from "../components/AdminPage";

const dateTime = (value?: string) => value ? new Date(value).toLocaleString() : "—";
export default function NotificationsPage() {
  const { me } = useAuth(); const mayRetry = can(me, "notifications.retry");
  const [status, setStatus] = useState("FAILED"); const [message, setMessage] = useState(""); const qc = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "notifications", status], queryFn: () => adminApi.notifications(status) });
  const retry = useMutation({ mutationFn: (id: string) => adminApi.retryNotification(id), onSuccess: async (r) => { setMessage(r.message); await qc.invalidateQueries({ queryKey: ["admin", "notifications"] }); }, onError: (e) => setMessage(e instanceof ApiError ? e.message : "The notification could not be retried.") });
  return <AdminPage title="Guest notifications" description="Inspect delivery attempts for guest email notifications. Retries are manual and audited. A provider timeout can be ambiguous, so only notifications marked FAILED can be retried here.">
    <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-semibold">Status<select className="min-h-11 rounded-md border border-line bg-surface px-3" value={status} onChange={(e) => setStatus(e.target.value)}><option value="FAILED">Failed</option><option value="PENDING">Pending</option><option value="SENDING">Sending</option><option value="SENT">Sent</option><option value="">All statuses</option></select></label><Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => void query.refetch()}>Refresh</Button></div>
    {message && <Alert tone="info" title="Notification update">{message}</Alert>}
    <QueryBoundary query={query} what="guest notifications">{(result) => result.items.length ? <div className="grid gap-3">{result.items.map((item) => <Card key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.subject}</h2><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "SENT" ? "bg-emerald-100 text-emerald-900" : item.status === "FAILED" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"}`}>{item.status}</span></div><p className="mt-1 text-sm">{item.recipient}</p><p className="mt-1 text-xs text-muted">Event: {item.eventKey} · Attempts: {item.attempts} · Updated: {dateTime(item.updatedAt)}</p>{item.sentAt && <p className="text-xs text-muted">Sent at: {dateTime(item.sentAt)}</p>}{item.lastError && <p className="mt-2 text-sm text-danger-700">Last error: {item.lastError}</p>}</div>{mayRetry && item.status === "FAILED" && <Button variant="secondary" disabled={retry.isPending || item.attempts >= 5} loading={retry.isPending && retry.variables === item.id} onClick={() => { if (window.confirm("Retry this failed guest email? If the previous provider outcome was ambiguous, the guest could receive a duplicate.")) { setMessage(""); retry.mutate(item.id); } }}>Retry email</Button>}</Card>)}</div> : <EmptyState icon={MailWarning} title="No notifications found" description="No notifications match this status filter. Try another status or refresh the list." />}</QueryBoundary>
    <p className="text-xs text-muted">Guest email bodies are stored to enable retries and are excluded from ordinary list responses. Limit staff access and configure a retention policy appropriate for your hotel.</p>
  </AdminPage>;
}
