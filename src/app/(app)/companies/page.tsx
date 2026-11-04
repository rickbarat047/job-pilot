"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form-controls";
import { Building2, Globe, Mail, Search, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<Record<string, any[]>>({});
  const [query, setQuery] = useState("");
  const [tracked, setTracked] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (tracked) params.set("tracked", "true");
    const response = await fetch(`/api/companies?${params.toString()}`);
    const data = await response.json();
    setCompanies(data.companies ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tracked]);

  async function track(id: string) {
    await fetch(`/api/companies/${id}/track`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "watching" }) });
    load();
  }

  async function check(id: string) {
    await fetch(`/api/companies/${id}/check`, { method: "POST" });
    load();
  }

  async function discoverContacts(id: string) {
    await fetch(`/api/companies/${id}/discover-contacts`, { method: "POST" });
    const response = await fetch(`/api/companies/${id}/contacts`);
    const data = await response.json();
    setContacts((current) => ({ ...current, [id]: data.contacts ?? [] }));
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-accent/20 px-6 py-7 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-medium text-primary">
              <Building2 className="h-3.5 w-3.5" /> Employer intelligence
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">Company explorer</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Research employers, verify career pages, and discover publicly listed recruiter contacts before you apply.
            </p>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="border-border/80 bg-card/70 pl-9 shadow-sm" placeholder="Search companies or industries…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" onClick={load}>Search</Button>
            <Button variant={tracked ? "default" : "outline"} className="w-full sm:w-auto" onClick={() => setTracked(!tracked)}>
              {tracked ? "Showing tracked" : "Tracked only"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-5 w-1/2 rounded bg-muted" />
                <div className="mt-2 h-4 w-2/3 rounded bg-muted" />
                <div className="mt-4 h-2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && companies.length === 0 ? (
        <EmptyState title="No companies found" description="Try a different search, or run discovery to populate your company list." />
      ) : null}

      {!loading && companies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company) => (
            <Card key={company.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-sm font-semibold uppercase">
                      {company.name?.slice(0, 1) || "C"}
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-lg font-semibold">{company.name}</div>
                      <div className="text-sm text-muted-foreground">{company.industry || "Industry unknown"} · {company.location || "Location unknown"}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{company.stage || "Stage unknown"}</Badge>
                        <Badge variant="outline">{company.size || "Size unknown"}</Badge>
                        {company.verified ? <Badge variant="success">Verified board</Badge> : <Badge variant="warning">Career page</Badge>}
                        {company.openJobs ? <Badge variant="accent">{company.openJobs} tracked jobs</Badge> : null}
                        {company.tracked ? <Badge variant="default">Tracked</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {company.careersUrl ? <a href={company.careersUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"><Globe className="h-3.5 w-3.5" /> Careers</a> : null}
                    {company.website ? <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"><Globe className="h-3.5 w-3.5" /> Website</a> : null}
                  </div>
                </div>
                {company.description ? <p className="mt-3 text-sm text-muted-foreground">{company.description}</p> : null}
                {contacts[company.id]?.length ? (
                  <div className="mt-3 space-y-1">
                    {contacts[company.id].map((contact) => (
                      <div key={contact.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex min-w-0 items-center gap-2 break-all"><Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{contact.email}</span>
                        <Badge variant={contact.verificationStatus === "verified" ? "success" : "secondary"}>{contact.verificationStatus}</Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => track(company.id)}>{company.tracked ? "Tracked" : "Track"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => check(company.id)}>Check career page</Button>
                  <Button size="sm" variant="ghost" onClick={() => discoverContacts(company.id)}>
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> Find public contacts
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
