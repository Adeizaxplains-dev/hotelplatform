import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { publicApi } from "@/services/publicApi";
import { HotelPhoto } from "../components/Img";
import { Seo } from "../components/Seo";
import { Container } from "../components/Section";
import { NamedIcon } from "../icons";
import { useSite } from "../SiteContext";

export default function FacilitiesPage() {
  const { hotel, content } = useSite();
  const q = useQuery({ queryKey: ["public", "facilities"], queryFn: publicApi.facilities, staleTime: 30_000 });
  const seo = content.pageSeo.facilities;
  return (
    <Container className="py-14 sm:py-20">
      <Seo page="Facilities" titleOverride={seo?.title} description={seo?.description ?? `Facilities and services at ${hotel.name}.`} path="/facilities" />
      <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Facilities</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">Everything you can enjoy during your stay.</p>
      <div className="mt-14">
        {q.isPending ? <Skeleton className="h-64 w-full" /> : q.isError ? <ErrorState description="We couldn't load the facilities. Please try again." onRetry={() => void q.refetch()} retrying={q.isFetching} /> : q.data.length === 0 ? (
          <EmptyState icon={Sparkles} title="Facilities will appear here soon" description="This hotel hasn't listed its facilities yet. Contact them to ask what's available." />
        ) : (
          <ul className="grid gap-12 sm:grid-cols-2">
            {q.data.map((f) => (
              <li key={f.name} className="grid gap-5">
                <div className="aspect-[16/10] overflow-hidden rounded-2xl"><HotelPhoto image={f.image} label={f.name} index={q.data.indexOf(f)} sizes="(min-width: 640px) 50vw, 100vw" /></div>
                <div className="flex gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-text"><NamedIcon name={f.icon} className="size-6" /></span>
                  <div><h2 className="text-2xl font-semibold">{f.name}</h2>{f.description && <p className="mt-2 text-lg text-muted">{f.description}</p>}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
