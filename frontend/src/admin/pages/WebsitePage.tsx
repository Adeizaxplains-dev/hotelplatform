import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/feedback/Alert";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormSection, Select, Textarea } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { cn } from "@/lib/cn";
import { buildBrandTheme, contrast } from "@/lib/color";
import { fieldErrors } from "@/lib/errors";
import { can, hasFeature } from "@/permissions";
import { adminApi, type ContentAdmin, type ProfileAdmin } from "@/services/adminApi";
import { AdminPage, FormError, QueryBoundary } from "../components/AdminPage";
import { ImagePicker } from "../components/ImagePicker";

const nullable = (v: string) => (v.trim() === "" ? null : v.trim());
const httpsOn = (hosts: string[], what: string) => z.string().refine((v) => {
  if (v === "") return true;
  try { const u = new URL(v); return u.protocol === "https:" && hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)); } catch { return false; }
}, `Enter a secure https link on ${what}.`);

// ---------------------------------------------------------------- hotel details
const profileSchema = z.object({
  tagline: z.string().max(140), description: z.string().max(600),
  phone: z.string().refine((v) => v === "" || /^\+?[0-9\s()-]{6,20}$/.test(v), "Enter a valid phone number."),
  whatsapp: z.string().refine((v) => v === "" || /^[1-9]\d{7,14}$/.test(v.replace(/[\s()+-]/g, "")), "Include the country code, e.g. 2348012345678."),
  email: z.string().refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address."),
  address: z.string().max(200), city: z.string().max(80), state: z.string().max(80), country: z.string().max(80),
  mapEmbedUrl: z.string().refine((v) => v === "" || v.startsWith("https://www.google.com/maps/embed"), "Paste the Google Maps embed link (starts with https://www.google.com/maps/embed)."),
  latitude: z.string().refine((v) => v === "" || (!Number.isNaN(Number(v)) && Math.abs(Number(v)) <= 90), "Latitude is between -90 and 90."),
  longitude: z.string().refine((v) => v === "" || (!Number.isNaN(Number(v)) && Math.abs(Number(v)) <= 180), "Longitude is between -180 and 180."),
  facebook: httpsOn(["facebook.com", "fb.com"], "facebook.com"), instagram: httpsOn(["instagram.com"], "instagram.com"), x: httpsOn(["x.com", "twitter.com"], "x.com"),
  tiktok: httpsOn(["tiktok.com"], "tiktok.com"), youtube: httpsOn(["youtube.com", "youtu.be"], "youtube.com"),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time like 14:00."), checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time like 12:00."),
  cancellation: z.string().max(1000), houseRules: z.string().max(1000), children: z.string().max(500), pets: z.string().max(500),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0B6E6E."), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #B8863B."), typography: z.enum(["modern", "classic"]),
  logo: z.array(z.string()).max(1), favicon: z.array(z.string()).max(1),
  titleTemplate: z.string().refine((v) => v === "" || v.includes("%s"), "Include %s where the page title goes, e.g. %s | Palm Hotel."), defaultDescription: z.string().max(300), ogImage: z.array(z.string()).max(1),
});
type ProfileValues = z.infer<typeof profileSchema>;

const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const profileDefaults = (p: ProfileAdmin): ProfileValues => ({
  tagline: s(p.tagline), description: s(p.description), phone: s(p.contact.phone), whatsapp: s(p.contact.whatsapp), email: s(p.contact.email), address: s(p.contact.address), city: s(p.contact.city), state: s(p.contact.state), country: s(p.contact.country),
  mapEmbedUrl: s(p.contact.mapEmbedUrl), latitude: s(p.contact.latitude), longitude: s(p.contact.longitude),
  facebook: s(p.social.facebook), instagram: s(p.social.instagram), x: s(p.social.x), tiktok: s(p.social.tiktok), youtube: s(p.social.youtube),
  checkInTime: p.policies.checkInTime, checkOutTime: p.policies.checkOutTime, cancellation: s(p.policies.cancellation), houseRules: s(p.policies.houseRules), children: s(p.policies.children), pets: s(p.policies.pets),
  primaryColor: p.branding.primaryColor, accentColor: p.branding.accentColor, typography: p.branding.typography,
  logo: p.branding.logoAssetId ? [p.branding.logoAssetId] : [], favicon: p.branding.faviconAssetId ? [p.branding.faviconAssetId] : [],
  titleTemplate: s(p.seo.titleTemplate), defaultDescription: s(p.seo.defaultDescription), ogImage: p.seo.ogImageAssetId ? [p.seo.ogImageAssetId] : [],
});
const profileBody = (v: ProfileValues) => ({
  tagline: nullable(v.tagline), description: nullable(v.description),
  contact: { phone: nullable(v.phone), whatsapp: nullable(v.whatsapp), email: nullable(v.email), address: nullable(v.address), city: nullable(v.city), state: nullable(v.state), country: nullable(v.country), mapEmbedUrl: nullable(v.mapEmbedUrl), latitude: v.latitude.trim() === "" ? null : Number(v.latitude), longitude: v.longitude.trim() === "" ? null : Number(v.longitude) },
  social: { facebook: nullable(v.facebook), instagram: nullable(v.instagram), x: nullable(v.x), tiktok: nullable(v.tiktok), youtube: nullable(v.youtube) },
  policies: { checkInTime: v.checkInTime, checkOutTime: v.checkOutTime, cancellation: nullable(v.cancellation), houseRules: nullable(v.houseRules), children: nullable(v.children), pets: nullable(v.pets) },
  branding: { primaryColor: v.primaryColor, accentColor: v.accentColor, typography: v.typography, logoAssetId: v.logo[0] ?? null, faviconAssetId: v.favicon[0] ?? null },
  seo: { titleTemplate: nullable(v.titleTemplate), defaultDescription: nullable(v.defaultDescription), ogImageAssetId: v.ogImage[0] ?? null },
});

function ProfileForm({ profile, canEdit }: { profile: ProfileAdmin; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const defaults = useMemo(() => profileDefaults(profile), [profile]);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const e = form.formState.errors;
  const save = useMutation({
    mutationFn: (v: ProfileValues) => adminApi.saveProfile(profileBody(v)),
    onSuccess: (p) => { toast("Hotel details saved."); qc.setQueryData(["admin", "profile"], p); void qc.invalidateQueries({ queryKey: ["public"] }); form.reset(profileDefaults(p)); },
    onError: (err) => { for (const [k, m] of Object.entries(fieldErrors(err))) form.setError(k.split(".").pop() as keyof ProfileValues, { message: m }); },
  });
  const [primary, accent, typography] = useWatch({ control: form.control, name: ["primaryColor", "accentColor", "typography"] });
  const preview = useMemo(() => (/^#[0-9a-fA-F]{6}$/.test(primary) && /^#[0-9a-fA-F]{6}$/.test(accent) ? buildBrandTheme(primary.toUpperCase(), accent.toUpperCase(), typography) : null), [primary, accent, typography]);

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-6">
      <fieldset disabled={!canEdit || save.isPending} className="grid gap-6">
        <FormError error={save.error && Object.keys(fieldErrors(save.error)).length === 0 ? save.error : null} />
        <Card className="grid gap-8 p-5">
          <FormSection title="About the hotel"><Input label="Tagline" hint="A short line under your name, e.g. Calm in the heart of Lagos." error={e.tagline?.message} {...form.register("tagline")} /><Textarea label="Short description" hint="Used in search results and as a fallback introduction." error={e.description?.message} {...form.register("description")} /></FormSection>
          <FormSection title="Contact" description="Shown on your website. WhatsApp and phone power the call and chat buttons.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Phone" inputMode="tel" error={e.phone?.message} {...form.register("phone")} />
              <Input label="WhatsApp number" inputMode="tel" hint="With country code, e.g. 2348012345678" error={e.whatsapp?.message} {...form.register("whatsapp")} />
              <Input label="Email" type="email" error={e.email?.message} {...form.register("email")} />
              <Input label="Street address" error={e.address?.message} {...form.register("address")} />
              <Input label="City" error={e.city?.message} {...form.register("city")} /><Input label="State" error={e.state?.message} {...form.register("state")} />
              <Input label="Country" error={e.country?.message} {...form.register("country")} />
            </div>
            <Input label="Google Maps embed link" hint="In Google Maps choose Share, then Embed a map, and paste the src link." error={e.mapEmbedUrl?.message} {...form.register("mapEmbedUrl")} />
            <div className="grid gap-4 sm:grid-cols-2"><Input label="Latitude" inputMode="decimal" error={e.latitude?.message} {...form.register("latitude")} /><Input label="Longitude" inputMode="decimal" error={e.longitude?.message} {...form.register("longitude")} /></div>
          </FormSection>
          <FormSection title="Stay information">
            <div className="grid gap-4 sm:grid-cols-2"><Input label="Check-in from" required hint="24-hour, e.g. 14:00" error={e.checkInTime?.message} {...form.register("checkInTime")} /><Input label="Check-out by" required hint="24-hour, e.g. 12:00" error={e.checkOutTime?.message} {...form.register("checkOutTime")} /></div>
            <Textarea label="Cancellation policy" error={e.cancellation?.message} {...form.register("cancellation")} /><Textarea label="House rules" error={e.houseRules?.message} {...form.register("houseRules")} />
            <div className="grid gap-4 sm:grid-cols-2"><Textarea label="Children" error={e.children?.message} {...form.register("children")} /><Textarea label="Pets" error={e.pets?.message} {...form.register("pets")} /></div>
          </FormSection>
          <FormSection title="Social links" description="Secure (https) links on each network.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Facebook" error={e.facebook?.message} {...form.register("facebook")} /><Input label="Instagram" error={e.instagram?.message} {...form.register("instagram")} />
              <Input label="X (Twitter)" error={e.x?.message} {...form.register("x")} /><Input label="TikTok" error={e.tiktok?.message} {...form.register("tiktok")} />
              <Input label="YouTube" error={e.youtube?.message} {...form.register("youtube")} />
            </div>
          </FormSection>
          <FormSection title="Branding" description="Your colours and style. Text on buttons is always chosen to be readable.">
            <div className="grid gap-4 sm:grid-cols-3">
              <ColourField label="Main colour" error={e.primaryColor?.message} {...form.register("primaryColor")} />
              <ColourField label="Accent colour" error={e.accentColor?.message} {...form.register("accentColor")} />
              <Select label="Style" {...form.register("typography")}><option value="modern">Modern (clean sans-serif)</option><option value="classic">Classic (elegant serif headings)</option></Select>
            </div>
            {preview && (
              <div className="rounded-lg border border-line p-4" style={preview.vars as React.CSSProperties} aria-label="Brand preview">
                <p className="text-sm font-semibold text-muted">Preview</p>
                <p className="mt-2 text-2xl font-semibold" style={{ fontFamily: "var(--site-display)" }}>Rest well. Wake happy.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3"><span className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold" style={{ background: "var(--brand)", color: "var(--on-brand)" }}>Book now</span><span className="font-semibold" style={{ color: "var(--brand-text)" }}>View rooms</span></div>
                <p className="mt-3 text-sm text-muted">Button text contrast: {contrast(preview.onBrand, primary).toFixed(1)}:1 (needs 4.5:1)</p>
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              <Controller control={form.control} name="logo" render={({ field }) => <ImagePicker label="Logo" value={field.value} onChange={field.onChange} max={1} hint="Shown in the website header." />} />
              <Controller control={form.control} name="favicon" render={({ field }) => <ImagePicker label="Browser tab icon" value={field.value} onChange={field.onChange} max={1} hint="A small square image." />} />
            </div>
          </FormSection>
          <FormSection title="Search engines" description="How your hotel appears in Google and when shared.">
            <Input label="Page title format" hint="%s is replaced by the page name, e.g. %s | Palm Hotel" error={e.titleTemplate?.message} {...form.register("titleTemplate")} />
            <Textarea label="Default description" error={e.defaultDescription?.message} {...form.register("defaultDescription")} />
            <Controller control={form.control} name="ogImage" render={({ field }) => <ImagePicker label="Share image" value={field.value} onChange={field.onChange} max={1} hint="Shown when your site is shared on WhatsApp and social media." />} />
          </FormSection>
        </Card>
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <p className="text-sm text-muted" aria-live="polite">{form.formState.isDirty ? "You have unsaved changes." : "All changes saved."}</p>
          <Button type="submit" loading={save.isPending} disabled={!canEdit || !form.formState.isDirty}>Save hotel details</Button>
        </div>
      </fieldset>
    </form>
  );
}

function ColourField({ label, error, ...rest }: { label: string; error?: string | undefined } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="text" inputMode="text" maxLength={7} aria-invalid={error ? true : undefined} className={cn("min-h-11 w-full rounded-md border bg-surface px-3 font-mono uppercase", error ? "border-danger-600" : "border-line-strong")} {...rest} />
      </div>
      {error && <p className="text-sm font-medium text-danger-700">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- website content
const contentSchema = z.object({
  headline: z.string().max(120), subheadline: z.string().max(300), heroImages: z.array(z.string()).max(5),
  aboutHeading: z.string().max(120), aboutBody: z.string().max(4000), aboutImage: z.array(z.string()).max(1),
  highlights: z.array(z.object({ label: z.string().trim().min(1, "Enter a label.").max(40), value: z.string().trim().min(1, "Enter a value.").max(40) })).max(6),
  why: z.array(z.object({ title: z.string().trim().min(1, "Enter a title.").max(80), text: z.string().trim().min(1, "Enter some text.").max(300), icon: z.string() })).max(6),
  testimonials: z.array(z.object({ quote: z.string().trim().min(1, "Enter the quote.").max(600), guestName: z.string().trim().min(1, "Enter the guest's name.").max(80), source: z.string().max(60), rating: z.string() })).max(12),
  faqs: z.array(z.object({ question: z.string().trim().min(1, "Enter the question.").max(200), answer: z.string().trim().min(1, "Enter the answer.").max(1000) })).max(12),
  seo: z.object({ home: z.object({ title: z.string().max(90), description: z.string().max(300) }), about: z.object({ title: z.string().max(90), description: z.string().max(300) }), rooms: z.object({ title: z.string().max(90), description: z.string().max(300) }), contact: z.object({ title: z.string().max(90), description: z.string().max(300) }) }),
});
type ContentValues = z.infer<typeof contentSchema>;
const seoPages = [["home", "Home"], ["about", "About"], ["rooms", "Rooms"], ["contact", "Contact"]] as const;

const contentDefaults = (c: ContentAdmin): ContentValues => ({
  headline: s(c.hero.headline), subheadline: s(c.hero.subheadline), heroImages: c.hero.imageAssetIds,
  aboutHeading: s(c.about.heading), aboutBody: s(c.about.body), aboutImage: c.about.imageAssetId ? [c.about.imageAssetId] : [], highlights: c.about.highlights,
  why: c.whyChooseUs, testimonials: c.testimonials.map((t) => ({ quote: t.quote, guestName: t.guestName, source: s(t.source), rating: t.rating ? String(t.rating) : "" })), faqs: c.faqs,
  seo: Object.fromEntries(seoPages.map(([k]) => [k, { title: s(c.pageSeo[k]?.title), description: s(c.pageSeo[k]?.description) }])) as ContentValues["seo"],
});
const contentBody = (v: ContentValues) => ({
  hero: { headline: nullable(v.headline), subheadline: nullable(v.subheadline), imageAssetIds: v.heroImages },
  about: { heading: nullable(v.aboutHeading), body: nullable(v.aboutBody), imageAssetId: v.aboutImage[0] ?? null, highlights: v.highlights },
  whyChooseUs: v.why,
  testimonials: v.testimonials.map((t) => ({ quote: t.quote, guestName: t.guestName, ...(t.source.trim() ? { source: t.source.trim() } : {}), ...(t.rating ? { rating: Number(t.rating) } : {}) })),
  faqs: v.faqs,
  pageSeo: Object.fromEntries(seoPages.map(([k]) => [k, { title: nullable(v.seo[k].title), description: nullable(v.seo[k].description) }])),
});

function ContentForm({ content, canEdit }: { content: ContentAdmin; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const icons = useQuery({ queryKey: ["admin", "icons"], queryFn: adminApi.icons, staleTime: Infinity });
  const defaults = useMemo(() => contentDefaults(content), [content]);
  const form = useForm<ContentValues>({ resolver: zodResolver(contentSchema), defaultValues: defaults });
  const e = form.formState.errors;
  const hl = useFieldArray({ control: form.control, name: "highlights" });
  const why = useFieldArray({ control: form.control, name: "why" });
  const tm = useFieldArray({ control: form.control, name: "testimonials" });
  const fq = useFieldArray({ control: form.control, name: "faqs" });
  const save = useMutation({
    mutationFn: (v: ContentValues) => adminApi.saveContent(contentBody(v)),
    onSuccess: (c) => { toast("Website content saved."); qc.setQueryData(["admin", "content"], c); void qc.invalidateQueries({ queryKey: ["public"] }); form.reset(contentDefaults(c)); },
  });
  const addBtn = (label: string, onClick: () => void, disabled = false) => <Button type="button" variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={onClick} disabled={disabled}>{label}</Button>;
  const rm = (label: string, onClick: () => void) => <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={onClick} aria-label={label}>Remove</Button>;

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-6">
      <fieldset disabled={!canEdit || save.isPending} className="grid gap-6">
        <FormError error={save.error} />
        <Card className="grid gap-8 p-5">
          <FormSection title="Home page banner" description="The first thing visitors see.">
            <Input label="Headline" error={e.headline?.message} {...form.register("headline")} />
            <Input label="Sub-headline" error={e.subheadline?.message} {...form.register("subheadline")} />
            <Controller control={form.control} name="heroImages" render={({ field }) => <ImagePicker label="Banner photos" value={field.value} onChange={field.onChange} max={5} hint="Upload 2–5 wide, bright photos of your actual rooms or suites for the full-screen slideshow. Use your own property photography before launch." />} />
          </FormSection>
          <FormSection title="About your hotel">
            <Input label="Heading" error={e.aboutHeading?.message} {...form.register("aboutHeading")} />
            <Textarea label="Your story" hint="Leave a blank line between paragraphs." className="min-h-40" error={e.aboutBody?.message} {...form.register("aboutBody")} />
            <Controller control={form.control} name="aboutImage" render={({ field }) => <ImagePicker label="Photo" value={field.value} onChange={field.onChange} max={1} />} />
            <div className="grid gap-3"><p className="text-sm font-semibold">Highlights <span className="font-normal text-muted">(for example Since 2009, 48 rooms)</span></p>
              {hl.fields.map((f, i) => <div key={f.id} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input label="Label" error={e.highlights?.[i]?.label?.message} {...form.register(`highlights.${i}.label`)} /><Input label="Value" error={e.highlights?.[i]?.value?.message} {...form.register(`highlights.${i}.value`)} /><div className="sm:pt-7">{rm(`Remove highlight ${i + 1}`, () => hl.remove(i))}</div></div>)}
              {addBtn("Add highlight", () => hl.append({ label: "", value: "" }), hl.fields.length >= 6)}</div>
          </FormSection>
          <FormSection title="Why guests choose you" description="Up to 6 short points.">
            {why.fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-lg border border-line p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_12rem]"><Input label="Title" error={e.why?.[i]?.title?.message} {...form.register(`why.${i}.title`)} /><Select label="Icon" {...form.register(`why.${i}.icon`)}>{(icons.data ?? [f.icon]).map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
                <Textarea label="Text" className="min-h-20" error={e.why?.[i]?.text?.message} {...form.register(`why.${i}.text`)} />
                <div>{rm(`Remove point ${i + 1}`, () => why.remove(i))}</div>
              </div>
            ))}
            {addBtn("Add a point", () => why.append({ title: "", text: "", icon: "Sparkles" }), why.fields.length >= 6)}
          </FormSection>
          <FormSection title="Guest reviews" description="Only add real feedback from your guests.">
            {tm.fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-lg border border-line p-4">
                <Textarea label="Quote" className="min-h-20" error={e.testimonials?.[i]?.quote?.message} {...form.register(`testimonials.${i}.quote`)} />
                <div className="grid gap-3 sm:grid-cols-3"><Input label="Guest name" error={e.testimonials?.[i]?.guestName?.message} {...form.register(`testimonials.${i}.guestName`)} /><Input label="Source" hint="e.g. Google" {...form.register(`testimonials.${i}.source`)} /><Select label="Rating" {...form.register(`testimonials.${i}.rating`)}><option value="">No rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</Select></div>
                <div>{rm(`Remove review ${i + 1}`, () => tm.remove(i))}</div>
              </div>
            ))}
            {addBtn("Add a review", () => tm.append({ quote: "", guestName: "", source: "", rating: "" }), tm.fields.length >= 12)}
          </FormSection>
          <FormSection title="Questions and answers" description="Shown on the Contact page.">
            {fq.fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-lg border border-line p-4">
                <Input label="Question" error={e.faqs?.[i]?.question?.message} {...form.register(`faqs.${i}.question`)} /><Textarea label="Answer" className="min-h-20" error={e.faqs?.[i]?.answer?.message} {...form.register(`faqs.${i}.answer`)} />
                <div>{rm(`Remove question ${i + 1}`, () => fq.remove(i))}</div>
              </div>
            ))}
            {addBtn("Add a question", () => fq.append({ question: "", answer: "" }), fq.fields.length >= 12)}
          </FormSection>
          <FormSection title="Search results for each page" description="Optional. Leave blank to use sensible defaults.">
            {seoPages.map(([k, label]) => <div key={k} className="grid gap-3 sm:grid-cols-2"><Input label={`${label} page title`} error={e.seo?.[k]?.title?.message} {...form.register(`seo.${k}.title`)} /><Input label={`${label} page description`} error={e.seo?.[k]?.description?.message} {...form.register(`seo.${k}.description`)} /></div>)}
          </FormSection>
        </Card>
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <p className="text-sm text-muted" aria-live="polite">{form.formState.isDirty ? "You have unsaved changes." : "All changes saved."}</p>
          <Button type="submit" loading={save.isPending} disabled={!canEdit || !form.formState.isDirty}>Save website content</Button>
        </div>
      </fieldset>
    </form>
  );
}

// ---------------------------------------------------------------- page
export default function WebsitePage() {
  const { me } = useAuth();
  const showProfile = can(me, "settings.read");
  const showContent = can(me, "cms.read") && hasFeature(me, "cms");
  const [chosen, setTab] = useState<"details" | "content">("details");
  // Derived, not synced by an effect: if the chosen tab is not allowed for this role, show the other one.
  const tab = chosen === "details" && !showProfile ? "content" : chosen === "content" && !showContent ? "details" : chosen;
  const profile = useQuery({ queryKey: ["admin", "profile"], queryFn: adminApi.profile, enabled: showProfile });
  const content = useQuery({ queryKey: ["admin", "content"], queryFn: adminApi.content, enabled: showContent });

  const tabs = [...(showProfile ? [["details", "Hotel details"] as const] : []), ...(showContent ? [["content", "Website content"] as const] : [])];

  return (
    <AdminPage title="Website" description="Your hotel's details, branding and the words and photos on your public website.">
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Website settings" className="flex gap-1 border-b border-line">
          {tabs.map(([k, l]) => <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} type="button" onClick={() => setTab(k)} className={cn("min-h-11 border-b-2 px-4 font-semibold", tab === k ? "border-lagoon-600 text-lagoon-700" : "border-transparent text-muted hover:text-ink")}>{l}</button>)}
        </div>
      )}
      {tab === "details" && showProfile && (
        <div role="tabpanel" id="panel-details" aria-labelledby="tab-details">
          {!can(me, "settings.update") && <Alert tone="info" title="View only" className="mb-4">Your role can view these details but not change them.</Alert>}
          <QueryBoundary query={profile} what="your hotel details">{(p) => <ProfileForm profile={p} canEdit={can(me, "settings.update")} />}</QueryBoundary>
        </div>
      )}
      {tab === "content" && showContent && (
        <div role="tabpanel" id="panel-content" aria-labelledby="tab-content">
          <QueryBoundary query={content} what="your website content">{(c) => <ContentForm content={c} canEdit={can(me, "cms.update")} />}</QueryBoundary>
        </div>
      )}
      {tabs.length === 0 && <Alert tone="info" title="Nothing to show">Your role and plan don't include website settings.</Alert>}
    </AdminPage>
  );
}
