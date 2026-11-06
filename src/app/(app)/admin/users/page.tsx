"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  activeSessions: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setUsers(data.users);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load users");
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">User Management</h1>
          <p className="text-sm text-muted-foreground">
            View all registered users and their login activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <Users className="mr-1 h-4 w-4" /> {users.length} Total Users
          </Badge>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Users &amp; Login Activity</CardTitle>
          <CardDescription>Track logins across all registered accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading users…
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHead className="w-[200px]">User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Joined</TableHead>
                  <TableHead className="text-center">Last Login</TableHead>
                  <TableHead className="text-center">Login Count</TableHead>
                  <TableHead className="text-center">Active Sessions</TableHead>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{u.email}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {u.lastLoginAt ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{new Date(u.lastLoginAt).toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">{u.loginCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={u.activeSessions > 0 ? "success" : "secondary"}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs"
                      >
                        <Activity className="h-3 w-3" />
                        {u.activeSessions}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}