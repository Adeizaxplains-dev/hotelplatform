import { createBrowserRouter, type RouteObject } from "react-router-dom";
import RequireAuth from "@/features/auth/RequireAuth";
import type { Role } from "@/types/auth";

/** Every page is lazy-loaded so the first bundle stays small. */
const lazyPage = (
  load: () => Promise<{ default: React.ComponentType }>
): Pick<RouteObject, "lazy"> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

const HOTEL_ROLES: Role[] = [
  "HOTEL_OWNER",
  "HOTEL_MANAGER",
  "RECEPTIONIST",
  "ACCOUNTANT",
  "HOUSEKEEPER",
  "RESTAURANT_MANAGER",
  "STAFF",
];

/*
 * Route guards here are UX only: they send people to the right screen.
 * Every API call is authorised again on the server by role, permission and plan.
 */
export const routes: RouteObject[] = [
  // A hotel's public website. On the platform address "/" shows the operator home instead (handled inside the shell).
  {
    lazy: async () => ({
      Component: (await import("@/public-site/PublicShell")).default,
    }),
    children: [
      { path: "/", ...lazyPage(() => import("@/public-site/pages/HomePage")) },
      { path: "/about", ...lazyPage(() => import("@/public-site/pages/AboutPage")) },
      { path: "/rooms", ...lazyPage(() => import("@/public-site/pages/RoomsPage")) },
      {
        path: "/rooms/:slug",
        ...lazyPage(() => import("@/public-site/pages/RoomDetailPage")),
      },
      {
        path: "/facilities",
        ...lazyPage(() => import("@/public-site/pages/FacilitiesPage")),
      },
      { path: "/gallery", ...lazyPage(() => import("@/public-site/pages/GalleryPage")) },
      { path: "/contact", ...lazyPage(() => import("@/public-site/pages/ContactPage")) },
      { path: "/booking", ...lazyPage(() => import("@/public-site/pages/BookingPage")) },
    ],
  },

  { path: "/payment/callback", ...lazyPage(() => import("@/pages/PaymentCallbackPage")) },
  { path: "/login", ...lazyPage(() => import("@/pages/LoginPage")) },
  {
    path: "/forgot-password",
    ...lazyPage(() => import("@/pages/ForgotPasswordPage")),
  },
  { path: "/reset-password", ...lazyPage(() => import("@/pages/ResetPasswordPage")) },
  { path: "/verify-email", ...lazyPage(() => import("@/pages/VerifyEmailPage")) },
  { path: "/403", ...lazyPage(() => import("@/pages/ForbiddenPage")) },

  // Hotel staff administration. Platform super-admin remains outside this route group.
  {
    element: <RequireAuth roles={HOTEL_ROLES} />,
    children: [
      {
        lazy: async () => ({
          Component: (await import("@/admin/AdminLayout")).default,
        }),
        children: [
          { path: "/admin", ...lazyPage(() => import("@/pages/AdminHomePage")) },
          {
            path: "/admin/website",
            ...lazyPage(() => import("@/admin/pages/WebsitePage")),
          },

          {
            element: <RequireAuth permission="reservations.read" />,
            children: [
              {
                path: "/admin/reservations",
                ...lazyPage(() => import("@/admin/pages/ReservationsPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="invoices.read" />,
            children: [
              {
                path: "/admin/invoices",
                ...lazyPage(() => import("@/admin/pages/InvoicesPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="guests.read" />,
            children: [
              {
                path: "/admin/guests",
                ...lazyPage(() => import("@/admin/pages/GuestsPage")),
              },
            ],
          },

          // Staff directory, invitations, role assignment and account status.
          {
            element: <RequireAuth permission="staff.read" />,
            children: [
              {
                path: "/admin/staff",
                ...lazyPage(() => import("@/admin/pages/StaffPage")),
              },
            ],
          },

          {
            element: <RequireAuth permission="reports.financial" />,
            children: [
              {
                path: "/admin/financial-report",
                ...lazyPage(() => import("@/admin/pages/FinancialReportPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="payments.read" />,
            children: [
              {
                path: "/admin/payment-controls",
                ...lazyPage(() => import("@/admin/pages/PaymentControlsPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="notifications.read" />,
            children: [
              {
                path: "/admin/notifications",
                ...lazyPage(() => import("@/admin/pages/NotificationsPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="settings.update" />,
            children: [
              {
                path: "/admin/billing",
                ...lazyPage(() => import("@/admin/pages/BillingPage")),
              },
              {
                path: "/admin/billing/callback",
                ...lazyPage(() => import("@/admin/pages/BillingPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="housekeeping.read" />,
            children: [
              {
                path: "/admin/housekeeping",
                ...lazyPage(() => import("@/admin/pages/HousekeepingPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="reports.read" />,
            children: [
              {
                path: "/admin/reports",
                ...lazyPage(() => import("@/admin/pages/OperationsReportPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="rooms.read" />,
            children: [
              {
                path: "/admin/room-types",
                ...lazyPage(() => import("@/admin/pages/RoomTypesPage")),
              },
              {
                path: "/admin/rooms",
                ...lazyPage(() => import("@/admin/pages/RoomsPage")),
              },
            ],
          },
          {
            element: <RequireAuth permission="cms.read" />,
            children: [
              {
                path: "/admin/facilities",
                ...lazyPage(() => import("@/admin/pages/FacilitiesPage")),
              },
              {
                path: "/admin/gallery",
                ...lazyPage(() => import("@/admin/pages/GalleryPage")),
              },
            ],
          },
        ],
      },
    ],
  },

  // Platform administration is separate from hotel staff management.
  {
    element: <RequireAuth roles={["PLATFORM_SUPER_ADMIN"]} />,
    children: [
      {
        path: "/platform",
        ...lazyPage(() => import("@/pages/PlatformHomePage")),
      },
    ],
  },

  // Registered only in development; Vite removes the branch from production builds.
  ...(import.meta.env.DEV
    ? [
        {
          path: "/design-system",
          ...lazyPage(() => import("@/pages/DesignSystemPage")),
        },
      ]
    : []),

  { path: "*", ...lazyPage(() => import("@/pages/NotFoundPage")) },
];

export const createRouter = () => createBrowserRouter(routes);