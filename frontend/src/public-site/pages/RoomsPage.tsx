import { useQuery } from "@tanstack/react-query";
import { BedDouble } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { publicApi } from "@/services/publicApi";
import { RoomCard } from "../components/RoomCards";
import { Seo } from "../components/Seo";
import { Container } from "../components/Section";
import { useSite } from "../SiteContext";

export default function RoomsPage() {
  const { hotel, content } = useSite();
  const q = useQuery({ queryKey: ["public", "room-types"], queryFn: publicApi.roomTypes, staleTime: 30_000 });
  const seo = content.pageSeo.rooms;

  return (
    <Container className="py-14 sm:py-20">
      <Seo page="Rooms" titleOverride={seo?.title} description={seo?.description ?? `Rooms and suites at ${hotel.name}.`} path="/rooms" />
      <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Rooms and suites</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">Choose the room that suits your stay. Prices are per night.</p>
      <div className="mt-14">
        {q.isPending ? (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading rooms">{[0, 1, 2].map((i) => <div key={i}><Skeleton className="aspect-[4/3] w-full rounded-2xl" /><Skeleton className="mt-4 h-6 w-2/3" /></div>)}</div>
        ) : q.isError ? (
          <ErrorState description="We couldn't load the rooms. Please try again." onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : q.data.length === 0 ? (
          <EmptyState icon={BedDouble} title="Rooms will appear here soon" description="This hotel is still adding its rooms. Please check back, or contact the hotel to ask about availability." />
        ) : (
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{q.data.map((r) => <RoomCard key={r.slug} room={r} />)}</div>
        )}
      </div>
    </Container>
  );
}
