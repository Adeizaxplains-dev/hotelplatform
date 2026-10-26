import { useQuery } from "@tanstack/react-query";
import { Menu, Phone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { cn } from "@/lib/cn";
import { buildBrandTheme } from "@/lib/color";
import { formatTime, telLink, whatsappLink } from "@/lib/format";
import { useTenantInfo } from "@/hooks/useTenantInfo";
import NotFoundPage from "@/pages/NotFoundPage";
import RoleHome from "@/pages/RoleHome";
import { ApiError } from "@/services/apiClient";
import { publicApi } from "@/services/publicApi";
import type { PublicSite } from "@/types/site";
import { SiteContext, useSite } from "./SiteContext";
import { PrimaryAction } from "./components/Actions";
import { Container } from "./components/Section";
import { SocialIcon } from "./icons";
import { primaryCta } from "./cta";

/**
 * Layout route for everything a hotel's visitors see. The server decides which hotel this address belongs to;
 * on the platform address the same routes fall back to the operator screens, on unknown addresses to "not found".
 */
export default function PublicShell() {
  const tenant = useTenantInfo();
  const { pathname } = useLocation();

  if (tenant.kind === "loading") return <ShellSkeleton />;
  if (tenant.kind === "platform") return pathname === "/" ? <RoleHome /> : <NotFoundPage />;
  if (tenant.kind === "unknown") return <Notice title="We couldn't find this hotel" text="Check the address you were given and try again." />;
  if (tenant.info.status === "SUSPENDED") return <Notice title={`${tenant.info.name} is temporarily unavailable`} text="Please contact the hotel directly." />;
  return <HotelSite />;
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading the hotel website">
      <Skeleton className="h-[70svh] w-full rounded-none" />
      <div className="mx-auto grid max-w-6xl gap-4 p-8"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-24 w-full" /></div>
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div role="alert"><h1 className="text-3xl font-extrabold">{title}</h1><p className="mt-2 text-muted">{text}</p></div>
    </main>
  );
}

function HotelSite() {
  // Retry once for server hiccups; never retry 4xx answers (suspended, not available), which cannot succeed.
  const q = useQuery({
    queryKey: ["public", "site"], queryFn: publicApi.site, staleTime: 30_000,
    retry: (count, err) => !(err instanceof ApiError && err.status > 0 && err.status < 500) && count < 1, retryDelay: 300,
  });
  if (q.isPending) return <ShellSkeleton />;
  if (q.isError) {
    const unavailable = q.error instanceof ApiError && q.error.code === "FEATURE_NOT_AVAILABLE";
    return unavailable
      ? <Notice title="This website isn't available" text="Please contact the hotel directly." />
      : <div className="grid min-h-dvh place-items-center"><ErrorState description="We couldn't load this website. Please try again." onRetry={() => void q.refetch()} retrying={q.isFetching} /></div>;
  }
  return <SiteChrome site={q.data} />;
}

function SiteChrome({ site }: { site: PublicSite }) {
  const { pathname } = useLocation();
  const theme = useMemo(() => buildBrandTheme(site.hotel.branding.primaryColor, site.hotel.branding.accentColor, site.hotel.branding.typography), [site.hotel.branding]);
  const mainRef = useRef<HTMLElement>(null);

  // New page: start at the top and move keyboard/screen-reader focus to the content.
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  const home = pathname === "/";
  return (
    <SiteContext.Provider value={site}>
      <div className="site-root min-h-dvh bg-white text-ink" style={theme.vars as React.CSSProperties}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-ink focus:shadow-lg">Skip to content</a>
        <SiteHeader overlay={home} />
        <main id="main" ref={mainRef} tabIndex={-1} className={cn("outline-none", !home && "pt-20", "pb-20 lg:pb-0")}>
          <Outlet />
        </main>
        <SiteFooter />
        <ActionBar />
      </div>
    </SiteContext.Provider>
  );
}

function useNavItems() {
  const site = useSite();
  const has = (f: string) => site.features.includes(f);
  return [
    ...(has("rooms") && site.featuredRooms.length ? [{ to: "/rooms", label: "Rooms" }] : []),
    ...(site.facilities.length ? [{ to: "/facilities", label: "Facilities" }] : []),
    ...(has("gallery") && site.gallery.length ? [{ to: "/gallery", label: "Gallery" }] : []),
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
  ];
}

function Brand({ light }: { light: boolean }) {
  const { hotel } = useSite();
  return (
    <Link to="/" className={cn("inline-flex items-center gap-3 font-display text-xl font-semibold tracking-tight", light ? "text-white" : "text-ink")} aria-label={`${hotel.name} home`}>
      {hotel.branding.logo ? <img src={hotel.branding.logo.url} alt="" width={hotel.branding.logo.width} height={hotel.branding.logo.height} className="h-9 w-auto max-w-[9rem] object-contain" /> : null}
      <span className={cn(hotel.branding.logo && "sr-only sm:not-sr-only")}>{hotel.name}</span>
    </Link>
  );
}

function SiteHeader({ overlay }: { overlay: boolean }) {
  const site = useSite();
  const items = useNavItems();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 32);
  // The menu is open only for the page it was opened on, so navigating closes it without any effect.
  const { pathname } = useLocation();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const light = overlay && !scrolled && !open;
  return (
    <header className={cn("fixed inset-x-0 top-0 z-40 transition-colors duration-300", light ? "bg-gradient-to-b from-black/60 to-transparent text-white" : "border-b border-ink/10 bg-white/95 text-ink backdrop-blur")}>
      <Container className="flex h-20 items-center justify-between gap-6">
        <Brand light={light} />
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => cn("font-semibold underline-offset-8 hover:underline", isActive && "underline")}>{i.label}</NavLink>
          ))}
          <PrimaryAction site={site} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-on-brand hover:bg-brand-hover" />
        </nav>
        <button type="button" className="grid size-11 place-items-center rounded-full lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpenOn(open ? null : pathname)}>
          {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>
      </Container>
      {open && <MobileMenu items={items} onClose={() => setOpenOn(null)} />}
    </header>
  );
}

function MobileMenu({ items, onClose }: { items: Array<{ to: string; label: string }>; onClose: () => void }) {
  const site = useSite();
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    first.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-x-0 bottom-0 top-20 overflow-y-auto bg-white p-6 text-ink lg:hidden">
      <nav aria-label="Mobile" className="grid gap-1">
        {items.map((i, idx) => (
          <Link key={i.to} to={i.to} ref={idx === 0 ? first : undefined} className="rounded-lg px-3 py-4 font-display text-3xl font-semibold hover:bg-brand-soft">{i.label}</Link>
        ))}
      </nav>
      <PrimaryAction site={site} className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-lg font-semibold text-on-brand" />
    </div>
  );
}

function SiteFooter() {
  const { hotel } = useSite();
  const items = useNavItems();
  const c = hotel.contact;
  const social = (Object.entries(hotel.social) as Array<[string, string | null]>).filter(([, v]) => v);
  return (
    <footer className="bg-ink text-white/85">
      <Container className="grid gap-10 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-semibold text-white">{hotel.name}</p>
          {hotel.tagline && <p className="mt-2 max-w-xs">{hotel.tagline}</p>}
          {social.length > 0 && (
            <ul className="mt-5 flex gap-3">
              {social.map(([name, url]) => (
                <li key={name}><a href={url!} target="_blank" rel="noopener noreferrer" aria-label={`${hotel.name} on ${name === "x" ? "X" : name}`} className="grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><SocialIcon name={name} className="size-5" /></a></li>
              ))}
            </ul>
          )}
        </div>
        <nav aria-label="Footer">
          <p className="font-semibold text-white">Explore</p>
          <ul className="mt-3 grid gap-2">{items.map((i) => <li key={i.to}><Link to={i.to} className="hover:text-white hover:underline">{i.label}</Link></li>)}</ul>
        </nav>
        <div>
          <p className="font-semibold text-white">Visit and contact</p>
          <ul className="mt-3 grid gap-2">
            {(c.address || c.city) && <li>{[c.address, c.city].filter(Boolean).join(", ")}</li>}
            {c.phone && <li><a href={telLink(c.phone)} className="hover:text-white hover:underline">{c.phone}</a></li>}
            {c.email && <li><a href={`mailto:${c.email}`} className="hover:text-white hover:underline">{c.email}</a></li>}
            <li>Check-in from {formatTime(hotel.policies.checkInTime)}, check-out by {formatTime(hotel.policies.checkOutTime)}</li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10 py-5 text-center text-sm text-white/70">© {new Date().getFullYear()} {hotel.name}. All rights reserved.</div>
    </footer>
  );
}

/** Mobile-only bar: the three things a traveller on a phone wants, always one tap away. */
function ActionBar() {
  const site = useSite();
  const { hotel } = site;
  const cta = primaryCta(site);
  const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-sm font-semibold";
  return (
    <nav aria-label="Quick actions" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {hotel.contact.whatsapp && (
        <a href={whatsappLink(hotel.contact.whatsapp, `Hello ${hotel.name}, I'd like to know more.`)} target="_blank" rel="noopener noreferrer" className={cn(item, "text-ink")}>WhatsApp</a>
      )}
      {hotel.contact.phone && <a href={telLink(hotel.contact.phone)} className={cn(item, "text-ink")}><Phone className="size-4" aria-hidden="true" />Call</a>}
      {cta.external ? (
        <a href={cta.href} target="_blank" rel="noopener noreferrer" className={cn(item, "bg-brand text-on-brand")}>{cta.label}</a>
      ) : (
        <Link to={cta.href} className={cn(item, "bg-brand text-on-brand")}>{cta.label}</Link>
      )}
    </nav>
  );
}
