
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { homeFor } from "@/features/auth/helpers";

/** Send signed-in users to their area and signed-out visitors to login. */
export default function RoleHome() {
  const { status, me } = useAuth();

  if (status === "loading") {
    return null;
  }

  if (status !== "authenticated" || !me) {
    return <Navigate to="/login" replace />;
  }

  const to = homeFor(me.user.role);

  if (to !== "/") {
    return <Navigate to={to} replace />;
  }

  return <Navigate to="/login" replace />;
}
