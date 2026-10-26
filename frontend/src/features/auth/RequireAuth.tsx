import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/feedback/Skeleton";
import { can } from "@/permissions";
import type { Permission, Role } from "@/types/auth";
import { useAuth } from "./AuthContext";

interface Props {
  /** Only these roles may see the route (UX guard; the API enforces the real rule). */
  roles?: Role[];
  permission?: Permission;
}

export default function RequireAuth({ roles, permission }: Props) {
  const { status, me } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 p-8" aria-busy="true" aria-label="Loading your account">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (status === "anonymous" || !me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if ((roles && !roles.includes(me.user.role)) || (permission && !can(me, permission))) return <Navigate to="/403" replace />;
  return <Outlet />;
}
