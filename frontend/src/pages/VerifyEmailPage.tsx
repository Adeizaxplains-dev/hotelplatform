import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert } from "@/components/feedback/Alert";
import { Spinner } from "@/components/ui/Spinner";
import AuthLayout from "@/features/auth/AuthLayout";
import { ApiError } from "@/services/apiClient";
import { authApi } from "@/services/authApi";

type State = "working" | "done" | "failed";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  const [state, setState] = useState<State>(token ? "working" : "failed");
  const [message, setMessage] = useState("This link is incomplete.");

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    if (!token) return;
    let cancelled = false;
    authApi.verifyEmail(token).then(
      () => !cancelled && setState("done"),
      (err: unknown) => {
        if (cancelled) return;
        setMessage(err instanceof ApiError && err.code !== "NETWORK_ERROR" ? err.message : "We couldn't confirm your email. Please try again.");
        setState("failed");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthLayout title="Confirm your email">
      {state === "working" && <p className="flex items-center gap-3 text-muted"><Spinner className="size-5" label="Confirming" /> Confirming your email…</p>}
      {state === "done" && <Alert tone="success" title="Email confirmed">Thank you. You can <Link className="font-semibold underline" to="/login">sign in</Link> now.</Alert>}
      {state === "failed" && <Alert tone="danger" title="We couldn't confirm your email">{message}</Alert>}
    </AuthLayout>
  );
}
