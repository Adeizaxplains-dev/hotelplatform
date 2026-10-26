import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import AuthLayout from "@/features/auth/AuthLayout";
import { ApiError } from "@/services/apiClient";
import { authApi } from "@/services/authApi";

const schema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters.").max(128, "Use at most 128 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords don't match." });
type Values = z.infer<typeof schema>;

/** Used for "forgot password" links and for first-time invitations (?invite=1). */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  // Keep the one-time token in memory, then remove it from the address bar so it does not linger in history or screenshots.
  const [token] = useState(() => params.get("token") ?? "");
  const [invite] = useState(() => params.get("invite") === "1");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError && err.code !== "NETWORK_ERROR" ? err.message : "We couldn't update your password. Please try again.");
    }
  });

  const title = invite ? "Set your password" : "Choose a new password";
  if (!token) {
    return (
      <AuthLayout title={title}>
        <Alert tone="warning" title="This link is incomplete">Open the link from your email again, or <Link className="font-semibold underline" to="/forgot-password">request a new one</Link>.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={title} subtitle={invite ? "You've been invited. Choose a password to finish setting up your account." : "Pick something only you would know. Longer is stronger."}>
      {done ? (
        <div className="grid gap-5">
          <Alert tone="success" title="Password saved">You can now sign in with your new password.</Alert>
          <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-md bg-lagoon-600 px-6 font-semibold text-white hover:bg-lagoon-700">Go to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          {error && <Alert tone="danger" title="Couldn't save your password">{error} <Link className="font-semibold underline" to="/forgot-password">Request a new link</Link></Alert>}
          <Input label="New password" type="password" autoComplete="new-password" required hint="At least 10 characters." error={formState.errors.password?.message} {...register("password")} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" required error={formState.errors.confirm?.message} {...register("confirm")} />
          <Button type="submit" size="lg" loading={formState.isSubmitting}>Save password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
