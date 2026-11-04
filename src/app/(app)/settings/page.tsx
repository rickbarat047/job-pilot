"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/form-controls";
import { Checkbox } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";

interface EmailIntegration {
  provider: string;
  fromEmail: string | null;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  configured: boolean;
  hasPassword: boolean;
  status: string;
}

interface WorkerStatus {
  status: string;
  lastHeartbeat: string | null;
  online: boolean;
  meta: Record<string, unknown>;
}

const EMPTY_INTEGRATION: EmailIntegration = {
  provider: "smtp", fromEmail: null, host: null, port: null, secure: false,
  user: null, configured: false, hasPassword: false, status: "not_configured",
};

export default function SettingsPage() {
  const [permissions, setPermissions] = useState<Record<string, unknown>>({});
  const [notifications, setNotifications] = useState<Record<string, unknown>>({});
  const [email, setEmail] = useState<EmailIntegration>(EMPTY_INTEGRATION);
  const [password, setPassword] = useState("");
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [saving, setSaving] = useState("");
  const [testing, setTesting] = useState(false);

  const loadWorker = useCallback(async () => {
    try {
      const response = await fetch("/api/automation/worker", { cache: "no-store" });
      const data = await response.json();
      setWorker(data);
    } catch {
      setWorker({ status: "offline", lastHeartbeat: null, online: false, meta: {} });
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [p, n, e] = await Promise.all([
        fetch("/api/settings/permissions").then((r) => r.json()),
        fetch("/api/settings/notifications").then((r) => r.json()),
        fetch("/api/settings/email-integration").then((r) => r.json()),
      ]);
      if (p.permissions) setPermissions(p.permissions);
      if (n.preferences) setNotifications(n.preferences);
      if (e.integration) setEmail({ ...EMPTY_INTEGRATION, ...e.integration });
    })();
    loadWorker();
    const timer = window.setInterval(loadWorker, 30_000);
    return () => window.clearInterval(timer);
  }, [loadWorker]);

  async function savePermissions() {
    setSaving("permissions");
    const response = await fetch("/api/settings/permissions", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(permissions) });
    const data = await response.json().catch(() => ({}));
    setSaving("");
    if (!response.ok) return toast.error(data.error || "Unable to save permissions.");
    toast.success("Automation permissions saved.");
  }

  async function saveNotifications() {
    setSaving("notifications");
    const response = await fetch("/api/settings/notifications", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(notifications) });
    const data = await response.json().catch(() => ({}));
    setSaving("");
    if (!response.ok) return toast.error(data.error || "Unable to save notifications.");
    toast.success("Notification preferences saved.");
  }

  async function saveEmail() {
    setSaving("email");
    const response = await fetch("/api/settings/email-integration", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: email.provider,
        fromEmail: email.fromEmail,
        host: email.host,
        port: email.port,
        secure: email.secure,
        user: email.user,
        password,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving("");
    if (!response.ok) return toast.error(data.error || "Unable to save email integration.");
    setPassword("");
    setEmail((current) => ({ ...current, configured: Boolean(data.configured), hasPassword: current.hasPassword || Boolean(password), status: data.status ?? current.status }));
    toast.success(data.configured ? "Email integration saved. Send a test email to verify it." : "Email details saved. Add the password to finish setup.");
  }

  async function testEmail() {
    setTesting(true);
    const response = await fetch("/api/settings/email-integration/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    const data = await response.json().catch(() => ({}));
    setTesting(false);
    if (data.ok) toast.success(`Test email sent to ${data.to ?? "your inbox"}.`);
    else toast.error(data.error || `Test email failed (${data.status ?? "unknown"}).`);
  }

  async function removeEmail() {
    if (!confirm("Remove the saved SMTP credentials?")) return;
    const response = await fetch("/api/settings/email-integration", { method: "DELETE" });
    if (!response.ok) return toast.error("Unable to remove the email integration.");
    setEmail(EMPTY_INTEGRATION);
    setPassword("");
    toast.success("Email integration removed.");
  }

  const workerOnline = Boolean(worker?.online);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Control what JobPilot may do, and connect the services you trust.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation permissions</CardTitle>
          <CardDescription>JobPilot never accepts offers or signs contracts for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Autonomy level</Label>
            <Select value={String(permissions.autonomyLevel ?? 3)} onChange={(e) => setPermissions({ ...permissions, autonomyLevel: Number(e.target.value) })}>
              <option value="1">1 — Discovery only</option>
              <option value="2">2 — Discover + prepare</option>
              <option value="3">3 — Apply with approval</option>
              <option value="4">4 — Rule-based auto-apply</option>
            </Select>
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-lg px-1 py-1 text-sm"><Checkbox checked={Boolean(permissions.demoMode)} onChange={(e) => setPermissions({ ...permissions, demoMode: e.target.checked })} /> Demo mode (simulate submissions, never contact employers)</label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg px-1 py-1 text-sm"><Checkbox checked={Boolean(permissions.allowDuplicateApplications)} onChange={(e) => setPermissions({ ...permissions, allowDuplicateApplications: e.target.checked })} /> Allow duplicate applications</label>
          <Button onClick={savePermissions} disabled={saving === "permissions"}>{saving === "permissions" ? "Saving…" : "Save permissions"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose which updates appear in your dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex min-h-10 items-center gap-2 rounded-lg px-1 py-1 text-sm"><Checkbox checked={Boolean(notifications.dailyDigest ?? true)} onChange={(e) => setNotifications({ ...notifications, dailyDigest: e.target.checked })} /> Daily digest</label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg px-1 py-1 text-sm"><Checkbox checked={Boolean(notifications.applicationUpdates ?? true)} onChange={(e) => setNotifications({ ...notifications, applicationUpdates: e.target.checked })} /> Application updates</label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg px-1 py-1 text-sm"><Checkbox checked={Boolean(notifications.interviewReminders ?? true)} onChange={(e) => setNotifications({ ...notifications, interviewReminders: e.target.checked })} /> Interview reminders</label>
          <Button onClick={saveNotifications} disabled={saving === "notifications"}>{saving === "notifications" ? "Saving…" : "Save notifications"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Email integration</CardTitle>
              <CardDescription>Used only for applications you approve. Credentials are encrypted at rest.</CardDescription>
            </div>
            <Badge variant={email.configured ? "success" : "secondary"}>{email.configured ? "Configured" : "Not configured"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>SMTP host</Label><Input value={email.host ?? ""} placeholder="smtp.gmail.com" onChange={(e) => setEmail({ ...email, host: e.target.value })} /></div>
            <div><Label>SMTP port</Label><Input type="number" inputMode="numeric" value={email.port ?? ""} placeholder="587" onChange={(e) => setEmail({ ...email, port: e.target.value ? Number(e.target.value) : null })} /></div>
            <div><Label>SMTP username</Label><Input value={email.user ?? ""} placeholder="you@example.com" onChange={(e) => setEmail({ ...email, user: e.target.value })} /></div>
            <div><Label>SMTP password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={email.hasPassword ? "Saved — enter to replace" : "App password"} /></div>
            <div><Label>From email</Label><Input type="email" value={email.fromEmail ?? ""} placeholder="JobPilot AI <you@example.com>" onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })} /></div>
            <label className="flex items-end gap-2 pb-3 text-sm"><Checkbox checked={email.secure} onChange={(e) => setEmail({ ...email, secure: e.target.checked })} /> Use TLS/SSL (port 465)</label>
          </div>
          <p className="text-xs text-muted-foreground">Gmail and Outlook require an app password. JobPilot never sends bulk email and only contacts publicly listed, domain-verified addresses.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveEmail} disabled={saving === "email"}>{saving === "email" ? "Saving…" : "Save email integration"}</Button>
            <Button variant="outline" onClick={testEmail} disabled={testing || !email.configured}>{testing ? "Sending…" : "Send test email"}</Button>
            {email.configured ? <Button variant="ghost" onClick={removeEmail}>Remove</Button> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Browser automation worker</CardTitle>
              <CardDescription>The worker fills approved application forms. It never bypasses CAPTCHAs, MFA or login walls.</CardDescription>
            </div>
            <Badge variant={workerOnline ? "success" : "warning"}>{workerOnline ? "Online" : "Offline"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-medium">{worker?.status ?? "offline"}</div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-xs text-muted-foreground">Last heartbeat</div>
              <div className="font-medium">{worker?.lastHeartbeat ? new Date(worker.lastHeartbeat).toLocaleString() : "Never"}</div>
            </div>
          </div>
          {workerOnline ? (
            <p className="text-muted-foreground">Approved applications can be submitted with browser automation from the application page.</p>
          ) : (
            <p className="text-muted-foreground">Deploy the worker from <code className="rounded bg-muted px-1 py-0.5">worker/</code> and set <code className="rounded bg-muted px-1 py-0.5">WORKER_TOKEN</code> plus <code className="rounded bg-muted px-1 py-0.5">APP_URL</code>. Until then, JobPilot opens the official application page for manual submission.</p>
          )}
          <Button variant="outline" onClick={loadWorker}>Refresh worker status</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data control</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.open("/api/settings/account", "_blank")}>Export data</Button>
          <Button variant="destructive" onClick={async () => { if (confirm("Delete your account and all data? This cannot be undone.")) { await fetch("/api/settings/account", { method: "DELETE" }); window.location.href = "/"; } }}>Delete account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
