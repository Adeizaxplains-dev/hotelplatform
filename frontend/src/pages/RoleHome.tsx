import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import StatusPage from "./StatusPage";
import { homeFor } from "@/features/auth/helpers";

/** "/" sends signed-in staff and operators to their area. Everyone else sees the status page until the public site exists (Phase 2). */
export default function RoleHome() {
  const { status, me } = useAuth();
  if (status === "authenticated" && me) {
    const to = homeFor(me.user.role);
    if (to !== "/") return <Navigate to={to} replace />;
  }
  return <StatusPage />;
}
