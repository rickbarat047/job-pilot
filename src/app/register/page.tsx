"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CircleAlert, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { AuthBrandPanel } from "@/components/auth-brand";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const rules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "Contains a letter", test: (value: string) => /[a-zA-Z]/.test(value) },
  { label: "Contains a number", test: (value: string) => /\d/.test(value) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const checks = rules.map((rule) => ({ ...rule, ok: rule.test(password) }));
  const passwordValid = checks.every((check) => check.ok);
  const emailValid = /^\S+@\S+\.\S+$/.test(email);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (loading || !passwordValid || !emailValid || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Unable to create account.");
        return;
      }
      analytics.signup();
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Unable to create account. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh">
      <AuthBrandPanel />

      <div className="flex min-w-0 flex-1 flex-col px-5 py-8 sm:px-8">
        <Link href="/" className="mb-auto flex items-center gap-2.5 sm:mt-2 lg:hidden" aria-label="JobPilot AI home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">J</span>
          <span className="font-display text-lg font-semibold tracking-tight">JobPilot AI</span>
        </Link>

        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Create your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Start with your CV and preferences. Applications stay under your control.</p>

          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Your full name"
                aria-invalid={touched && !name.trim()}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {touched && !name.trim() ? <p className="text-xs text-destructive">Please enter your name.</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={touched && !emailValid}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {touched && !emailValid ? <p className="text-xs text-destructive">Enter a valid email address.</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  className="pr-11"
                  aria-invalid={touched && !passwordValid}
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
              <ul className="space-y-1.5 pt-1" aria-label="Password requirements">
                {checks.map((check) => (
                  <li key={check.label} className={cn("flex items-center gap-2 text-xs transition-colors", check.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", check.ok ? "border-transparent bg-emerald-600 text-white dark:bg-emerald-400 dark:text-[#06251e]" : "border-input")}>
                      {check.ok ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}
                    </span>
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>

            {error ? (
              <p role="alert" className="flex items-start gap-1.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
              </p>
            ) : null}

            <Button className="w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Already registered? <Link href="/login" className="inline-block py-2 -my-2 font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="mx-auto w-full max-w-sm text-xs text-muted-foreground lg:hidden">
          <Link href="/" className="inline-block rounded-lg px-2 py-2 -ml-2 transition-colors hover:text-foreground">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
