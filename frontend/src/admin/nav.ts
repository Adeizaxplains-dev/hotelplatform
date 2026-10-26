import {
  BedDouble,
  CalendarCheck,
  DoorOpen,
  Globe,
  Images,
  LayoutDashboard,
  Sparkles,
  ClipboardCheck,
  ChartNoAxesCombined,
  Users,
  ReceiptText,
  WalletCards,
  ShieldCheck,
  MailWarning,
  CreditCard,
  UserCog,
} from "lucide-react";
import { can, hasFeature } from "@/permissions";
import type { MeResult } from "@/types/auth";

export interface NavDef {
  to: string;
  label: string;
  icon: typeof Globe;
  end?: boolean;
  permission?: string;
  feature?: string;
  group?:
    | "Overview"
    | "Front desk"
    | "Hotel operations"
    | "Finance"
    | "Website"
    | "Account";
}

export const NAV: NavDef[] = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
    group: "Overview",
  },

  {
    to: "/admin/reservations",
    label: "Reservations",
    icon: CalendarCheck,
    permission: "reservations.read",
    feature: "reservations",
    group: "Front desk",
  },
  {
    to: "/admin/guests",
    label: "Guests",
    icon: Users,
    permission: "guests.read",
    feature: "guests",
    group: "Front desk",
  },

  {
    to: "/admin/rooms",
    label: "Rooms",
    icon: DoorOpen,
    permission: "rooms.read",
    feature: "rooms",
    group: "Hotel operations",
  },
  {
    to: "/admin/room-types",
    label: "Room types",
    icon: BedDouble,
    permission: "rooms.read",
    feature: "rooms",
    group: "Hotel operations",
  },
  {
    to: "/admin/housekeeping",
    label: "Housekeeping",
    icon: ClipboardCheck,
    permission: "housekeeping.read",
    feature: "housekeeping",
    group: "Hotel operations",
  },
  {
    to: "/admin/facilities",
    label: "Facilities",
    icon: Sparkles,
    permission: "cms.read",
    feature: "cms",
    group: "Hotel operations",
  },

  {
    to: "/admin/invoices",
    label: "Invoices",
    icon: ReceiptText,
    permission: "invoices.read",
    feature: "invoices",
    group: "Finance",
  },
  {
    to: "/admin/financial-report",
    label: "Financial reports",
    icon: WalletCards,
    permission: "reports.financial",
    feature: "reports",
    group: "Finance",
  },
  {
    to: "/admin/payment-controls",
    label: "Payment controls",
    icon: ShieldCheck,
    permission: "payments.read",
    feature: "payments",
    group: "Finance",
  },
  {
    to: "/admin/billing",
    label: "Subscription & billing",
    icon: CreditCard,
    permission: "settings.update",
    group: "Finance",
  },

  {
    to: "/admin/website",
    label: "Website editor",
    icon: Globe,
    feature: "website",
    group: "Website",
  },
  {
    to: "/admin/gallery",
    label: "Photo gallery",
    icon: Images,
    permission: "cms.read",
    feature: "gallery",
    group: "Website",
  },

  {
    to: "/admin/notifications",
    label: "Notifications",
    icon: MailWarning,
    permission: "notifications.read",
    group: "Account",
  },
  {
    to: "/admin/reports",
    label: "Operations reports",
    icon: ChartNoAxesCombined,
    permission: "reports.read",
    feature: "reports",
    group: "Account",
  },
  {
    to: "/admin/staff",
    label: "Staff management",
    icon: UserCog,
    permission: "staff.read",
    feature: "staff",
    group: "Account",
  },
];

/**
 * Navigation is filtered for usability.
 * The API independently enforces permissions and subscription features.
 */
export function visibleNav(
  me: Pick<MeResult, "permissions" | "features">
): NavDef[] {
  return NAV.filter((item) => {
    const allowed =
      item.to === "/admin/website"
        ? can(me, "cms.read") || can(me, "settings.read")
        : !item.permission || can(me, item.permission);

    return allowed && (!item.feature || hasFeature(me, item.feature));
  });
}