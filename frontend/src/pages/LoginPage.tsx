import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import AuthLayout from "@/features/auth/AuthLayout";
import { useAuth } from "@/features/auth/AuthContext";
import { describeLoginError, homeFor } from "@/features/auth/helpers";

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type Values = z.infer<typeof schema>;

type LoginLocationState = {
  from?: string;
};

export default function LoginPage() {
  const { status, me, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
  });

  if (status === "authenticated" && me) {
    return <Navigate to={homeFor(me.user.role)} replace />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);

    try {
      await login(email.trim(), password);

      // Keep the requested destination when it exists.
      // Otherwise, send users to the landing page for their role.
      const state = location.state as LoginLocationState | null;
      const requestedPath = state?.from;

      navigate(requestedPath || "/", { replace: true });
    } catch (err) {
      setServerError(describeLoginError(err));
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {serverError && (
          <Alert tone="danger" title="Couldn't sign you in">
            {serverError}
          </Alert>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="username"
          required
          error={formState.errors.email?.message}
          {...register("email")}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          error={formState.errors.password?.message}
          {...register("password")}
        />

        <Button
          type="submit"
          size="lg"
          loading={formState.isSubmitting}
        >
          Sign in
        </Button>

        <Link
          to="/forgot-password"
          className="text-center text-sm font-semibold text-lagoon-600 underline underline-offset-2"
        >
          Forgot your password?
        </Link>
      </form>
    </AuthLayout>
  );
}
