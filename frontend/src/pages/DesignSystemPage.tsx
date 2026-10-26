import { BedDouble, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const swatches = [
  ["ink", "bg-ink"], ["muted", "bg-muted"], ["canvas", "bg-canvas border border-line"], ["lagoon-600", "bg-lagoon-600"],
  ["lagoon-50", "bg-lagoon-50"], ["brass-500", "bg-brass-500"], ["success-700", "bg-success-700"], ["warning-700", "bg-warning-700"],
  ["danger-600", "bg-danger-600"], ["info-700", "bg-info-700"],
] as const;

/** Development-only reference page (route is not registered in production builds). */
export default function DesignSystemPage() {
  const [saving, setSaving] = useState(false);
  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-5 py-10">
      <div>
        <Link to="/" className="text-sm font-semibold text-lagoon-600 underline underline-offset-2">Back to status</Link>
        <h1 className="mt-3 text-3xl font-extrabold">Design system</h1>
        <p className="mt-1 text-muted">Foundation components. More arrive with the features that need them (tables, modals, date pickers, toasts).</p>
      </div>

      <Card>
        <CardHeader title="Colour" description="Text pairs are contrast-checked; status colours always come with an icon and a label." />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
          {swatches.map(([name, cls]) => (
            <div key={name}><div className={`h-14 rounded-md ${cls}`} /><p className="mt-1 text-xs font-semibold">{name}</p></div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Buttons" />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <Button icon={<Plus className="size-4" aria-hidden="true" />}>Create reservation</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger">Cancel booking</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button loading={saving} onClick={() => { setSaving(true); setTimeout(() => setSaving(false), 1500); }}>Save changes</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Form fields" />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Input label="Guest name" required hint="As it appears on their ID." placeholder="Amara Okafor" />
          <Input label="Email" type="email" error="Enter a valid email address." defaultValue="amara@" />
          <Input label="Phone" type="tel" />
          <Input label="Room number" disabled defaultValue="204" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Status" description="Icon + text, never colour alone." />
        <div className="flex flex-wrap gap-3 p-5">
          <StatusBadge tone="success">Confirmed</StatusBadge>
          <StatusBadge tone="warning">Pending payment</StatusBadge>
          <StatusBadge tone="danger">Cancelled</StatusBadge>
          <StatusBadge tone="info">Checked in</StatusBadge>
          <StatusBadge tone="neutral">Out of service</StatusBadge>
          <Badge>Standard</Badge>
        </div>
      </Card>

      <div className="grid gap-3">
        <Alert tone="info" title="Check-in opens at 2:00 pm">Early arrivals can leave luggage at reception.</Alert>
        <Alert tone="success" title="Reservation confirmed" />
        <Alert tone="warning" title="Room 105 is in maintenance" />
        <Alert tone="danger" title="Payment failed">The bank declined the transaction. Try another card.</Alert>
      </div>

      <Card>
        <CardHeader title="Loading, empty and error states" />
        <div className="grid gap-4 p-5"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-6 w-2/3" /></div>
        <div className="border-t border-line">
          <EmptyState icon={BedDouble} title="No reservations yet" description="Reservations from your website, reception desk, WhatsApp and other channels will appear here." action={<Button icon={<Plus className="size-4" aria-hidden="true" />}>Create reservation</Button>} />
        </div>
        <div className="border-t border-line">
          <ErrorState description="We couldn't load your reservations." onRetry={() => undefined} />
        </div>
      </Card>
    </main>
  );
}
