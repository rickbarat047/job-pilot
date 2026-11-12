"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Clock,
  Calendar,
  Briefcase,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";

export default function MobileHomePage() {
  const [userName, setUserName] = useState("Aryan");
  const router = useRouter();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const statCards = [
    { icon: Briefcase, label: "New matches", value: "32" },
    { icon: Calendar, label: "Applications", value: "5" },
    { icon: Clock, label: "Interviews", value: "2" },
  ];

  const matchItem = {
    id: "job-1",
    title: "Software Engineer",
    company: "Zoho",
    location: "Chennai · Remote",
    score: 96,
    sources: ["Node.js", "PostgreSQL"],
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f172a]">
      <header className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
              J
            </div>
            <div>
              <div className="text-sm font-semibold">{greeting}, {userName}👋</div>
              <div className="text-xs text-gray-500">Let's move your career forward.</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 border border-green-500/30">
              <img className="w-6 h-6 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aryan" alt="User" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-lg">
                📈
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Career Progress</div>
                <div className="text-2xl font-bold">85%</div>
              </div>
              <div className="ml-auto flex items-center gap-1 text-sm font-medium text-emerald-600">
                <span className="text-xs">+2%</span>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={85} className="h-2" />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                CV ready
              </span>
              <div className="h-px w-4 bg-gray-200 mx-2" />
              <span className="text-xs text-gray-600">Profile complete</span>
              <div className="h-px w-4 bg-gray-200 mx-2" />
              <span className="text-xs text-gray-600">Preferences set</span>
            </div>
        </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 mt-5">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <stat.icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-gray-600">{stat.label}</span>
              </div>
              <div className="text-xl font-bold">{stat.value}</div>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Your top match</h2>
            <Link href="/jobs" className="text-sm font-medium text-emerald-600 hover:underline">
              View all →
            </Link>
          </div>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/jobs/${matchItem.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                  <span className="text-lg">💼</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{matchItem.title}</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50/20 px-2 py-0.5 rounded-full">{matchItem.score}% Match</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">{matchItem.company} · Remote</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {matchItem.sources.map((tag) => (
                      <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <Link href={`/jobs/${matchItem.id}`} className="text-xs font-medium text-emerald-600 hover:underline">
                    View role
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 mb-8">
          <Card className="bg-emerald-900 text-white rounded-2xl p-6 relative overflow-hidden">
            <CardContent className="p-5">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <div className="text-sm font-semibold">Recommended next step</div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Review 3 new matches that fit your profile</h3>
                <Button className="w-full bg-white text-emerald-600 font-semibold shadow-lg hover:bg-white/90" onClick={() => router.push("/jobs")}>
                  Review matches →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <nav className="h-14 border-t border-gray-200/30 bg-white/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 h-full">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">J</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{greeting}, {userName}👋</span>
              <div className="text-xs text-gray-500">Let's move your career forward.</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 border border-green-500/30">
              <img className="w-6 h-6 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aryan" alt="User" />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}