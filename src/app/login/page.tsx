"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { AuthBrandPanel } from "@/components/auth-brand";
import { analytics } from "@/lib/analytics";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateEmail(value: string) {
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setEmailError("Enter a valid email address.");
    } else {
      setEmailError("");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return; // Prevent duplicate submissions
    validateEmail(email);
    if (emailError) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Unable to sign in.");
        return;
      }
      analytics.login();
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to sign in. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh">
      <AuthBrandPanel />

      <div className="flex min-w-0 flex-1 flex-col px-5 py-8 sm:px-8">
        {/* Mobile-only brand */}
        <Link href="/" className="mb-auto flex items-center gap-2.5 sm:mt-2 lg:hidden" aria-label="JobPilot AI home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">J</span>
          <span className="font-display text-lg font-semibold tracking-tight">JobPilot AI</span>
        </Link>

        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue your AI job search.</p>

          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "email-error" : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={(e) => e.target.value && validateEmail(e.target.value)}
                required
              />
              {emailError ? (
                <p id="email-error" className="flex items-center gap-1.5 text-xs text-destructive">
                  <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" /> {emailError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="flex items-start gap-1.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            No account yet? <Link href="/register" className="inline-block py-2 -my-2 font-medium text-primary hover:underline">Create one</Link>
          </p>
        </div>

        <p className="mx-auto w-full max-w-sm text-xs text-muted-foreground lg:hidden">
          <Link href="/" className="inline-block rounded-lg px-2 py-2 -ml-2 transition-colors hover:text-foreground">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
