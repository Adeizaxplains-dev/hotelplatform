import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import AuthLayout from "@/features/auth/AuthLayout";
import { ApiError } from "@/services/apiClient";
import { authApi } from "@/services/authApi";

const schema = z.object({ email: z.email("Enter a valid email address.") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "RATE_LIMITED" ? "Too many requests. Please wait a while and try again." : "We couldn't send the email. Please try again.");
    }
  });

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a link to choose a new password.">
      {sent ? (
        <div className="grid gap-5">
          <Alert tone="success" title="Check your inbox">If an account exists for that email, a reset link is on its way. It works once and expires in an hour.</Alert>
          <Link to="/login" className="text-center text-sm font-semibold text-lagoon-600 underline underline-offset-2">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
          <Input label="Email" type="email" autoComplete="username" required error={formState.errors.email?.message} {...register("email")} />
          <Button type="submit" size="lg" loading={formState.isSubmitting}>Send reset link</Button>
          <Link to="/login" className="text-center text-sm font-semibold text-lagoon-600 underline underline-offset-2">Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}
