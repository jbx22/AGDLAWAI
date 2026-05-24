"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    Activity,
    BadgeDollarSign,
    FileText,
    FolderOpen,
    Lock,
    ShieldCheck,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

type Role = "user" | "admin" | "super_admin";
type AccountStatus = "active" | "suspended" | "deleted";

type AdminOverview = {
    principal: { userId: string; email: string; role: Role };
    counts: Record<
        | "users"
        | "activeUsers"
        | "suspendedUsers"
        | "admins"
        | "projects"
        | "documents"
        | "chats"
        | "tabularReviews",
        number
    >;
    tiers: { tier: string; count: number }[];
    financials: {
        paidSubscriptions: number;
        pendingSubscriptions: number;
        totalRevenueCents: number;
        currency: string;
    };
    recentUsers: {
        id: string;
        email: string;
        displayName: string | null;
        organisation: string | null;
        tier: string | null;
        messageCreditsUsed: number | null;
        role: Role | null;
        accountStatus: AccountStatus | null;
        createdAt: string;
    }[];
    admins: AdminAccount[];
    auditLogs: {
        id: string;
        actorEmail: string | null;
        action: string;
        entityType: string;
        entityId: string | null;
        metadata: Record<string, unknown>;
        createdAt: string;
    }[];
};

type AdminAccount = {
    id: string;
    email: string;
    displayName: string | null;
    role: Role;
    accountStatus: AccountStatus;
    suspensionReason: string | null;
    createdAt?: string;
    updatedAt?: string;
};

const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
});

function StatCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string | number;
    icon: typeof Users;
}) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">{label}</span>
                <Icon className="h-4 w-4 text-gray-500" />
            </div>
            <div className="text-2xl font-semibold text-gray-950">{value}</div>
        </div>
    );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        cache: "no-store",
        ...init,
        headers: {
            Accept: "application/json",
            ...(init?.headers as Record<string, string> | undefined),
        },
    });
    if (!response.ok) {
        let detail = `Request failed: ${response.status}`;
        try {
            const body = await response.clone().json();
            detail = body?.detail || detail;
        } catch {
            detail = (await response.text()) || detail;
        }
        const error = new Error(detail) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    return response.json() as Promise<T>;
}

export default function AdminPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newAdmin, setNewAdmin] = useState({
        email: "",
        displayName: "",
        password: "",
        role: "admin" as Role,
    });

    const isSuperAdmin = overview?.principal.role === "super_admin";
    const isSuperAdminPage = pathname === "/super-admin";
    const { user } = useAuth();

    const loadOverview = async () => {
        setError(null);
        setAccessDenied(false);
        try {
            setOverview(await api<AdminOverview>("/api/admin/overview"));
        } catch (err) {
            if (err instanceof Error && "status" in err && err.status === 401) {
                router.replace("/login?callbackUrl=/admin");
                return;
            }
            if (err instanceof Error && "status" in err && err.status === 403) {
                setAccessDenied(true);
                return;
            }
            setError(err instanceof Error ? err.message : "Failed to load admin console");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totalRevenue = useMemo(
        () => money.format((overview?.financials.totalRevenueCents ?? 0) / 100),
        [overview],
    );

    const createAdmin = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            await api("/api/admin/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newAdmin),
            });
            setNewAdmin({ email: "", displayName: "", password: "", role: "admin" });
            await loadOverview();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create admin");
        } finally {
            setSaving(false);
        }
    };

    const updateAdmin = async (id: string, body: Record<string, unknown>) => {
        setSaving(true);
        setError(null);
        try {
            await api(`/api/admin/accounts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            await loadOverview();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Admin update failed");
        } finally {
            setSaving(false);
        }
    };

    const updateUser = async (id: string, body: Record<string, unknown>) => {
        setSaving(true);
        setError(null);
        try {
            await api(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            await loadOverview();
        } catch (err) {
            setError(err instanceof Error ? err.message : "User update failed");
        } finally {
            setSaving(false);
        }
    };

    const deleteAdmin = async (id: string) => {
        if (!confirm("Delete this admin account permanently?")) return;
        setSaving(true);
        setError(null);
        try {
            await api(`/api/admin/accounts/${id}`, { method: "DELETE" });
            await loadOverview();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Admin deletion failed");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
        );
    }

    if (error && !overview) {
        return (
            <div className="mx-auto max-w-xl p-8">
                <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    {error}
                </div>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50 p-6">
                <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-red-50 text-red-600">
                        <Lock className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-950">Admin access required</h1>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                        You are signed in as {user?.email || "a non-admin account"}. This account is not an admin or super admin, so the admin pages cannot open with it.
                    </p>
                    <div className="mt-5 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                        Use the super admin account:
                        <div className="mt-1 font-mono text-xs text-gray-950">superadmin@jblbizlaw.com</div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                            type="button"
                            className="bg-black text-white hover:bg-gray-900"
                            onClick={() => signOut({ callbackUrl: "/login?callbackUrl=/admin" })}
                        >
                            Sign out and log in as admin
                        </Button>
                        <Button type="button" variant="outline" onClick={loadOverview}>
                            Try again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!overview) return null;

    return (
        <div className="h-full overflow-y-auto bg-gray-50">
            <div className="mx-auto max-w-7xl px-5 py-6">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                            <ShieldCheck className="h-4 w-4" />
                            {isSuperAdminPage ? "JBL Super Admin Console" : "JBL Admin Console"}
                        </div>
                        <h1 className="mt-2 text-3xl font-semibold text-gray-950">
                            {isSuperAdminPage
                                ? "Super admin controls, account governance, and audit log"
                                : "Operations, users, subscriptions, and admin dashboard"}
                        </h1>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        {overview.principal.email} · {overview.principal.role.replace("_", " ")}
                    </div>
                </div>

                {isSuperAdmin && (
                    <div className="mb-5 flex justify-end">
                        <Button
                            type="button"
                            onClick={() => router.push(isSuperAdminPage ? "/admin" : "/super-admin")}
                            className="bg-black text-white hover:bg-gray-900"
                        >
                            {isSuperAdminPage ? "Open admin page" : "Open super admin page"}
                        </Button>
                    </div>
                )}

                {error && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total users" value={overview.counts.users} icon={Users} />
                    <StatCard label="Active users" value={overview.counts.activeUsers} icon={Activity} />
                    <StatCard label="Documents" value={overview.counts.documents} icon={FileText} />
                    <StatCard label="Projects" value={overview.counts.projects} icon={FolderOpen} />
                    <StatCard label="Admins" value={overview.counts.admins} icon={ShieldCheck} />
                    <StatCard label="AI chats" value={overview.counts.chats} icon={Activity} />
                    <StatCard label="Tabular reviews" value={overview.counts.tabularReviews} icon={FileText} />
                    <StatCard label="Paid revenue" value={totalRevenue} icon={BadgeDollarSign} />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                    <section className="rounded-lg border border-gray-200 bg-white">
                        <div className="border-b border-gray-200 p-4">
                            <h2 className="font-semibold text-gray-950">Admin Accounts</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Super admins can add, revoke, edit, suspend, reset passwords, and delete admin accounts.
                            </p>
                        </div>

                        {isSuperAdmin && (
                            <form onSubmit={createAdmin} className="grid gap-3 border-b border-gray-200 p-4 md:grid-cols-5">
                                <Input
                                    className="md:col-span-1"
                                    placeholder="Email"
                                    type="email"
                                    value={newAdmin.email}
                                    onChange={(e) => setNewAdmin((v) => ({ ...v, email: e.target.value }))}
                                    required
                                />
                                <Input
                                    className="md:col-span-1"
                                    placeholder="Name"
                                    value={newAdmin.displayName}
                                    onChange={(e) => setNewAdmin((v) => ({ ...v, displayName: e.target.value }))}
                                />
                                <Input
                                    className="md:col-span-1"
                                    placeholder="Temporary password"
                                    type="password"
                                    minLength={10}
                                    value={newAdmin.password}
                                    onChange={(e) => setNewAdmin((v) => ({ ...v, password: e.target.value }))}
                                    required
                                />
                                <select
                                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
                                    value={newAdmin.role}
                                    onChange={(e) => setNewAdmin((v) => ({ ...v, role: e.target.value as Role }))}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super admin</option>
                                </select>
                                <Button type="submit" disabled={saving} className="bg-black text-white hover:bg-gray-900">
                                    Add admin
                                </Button>
                            </form>
                        )}

                        <div className="divide-y divide-gray-100">
                            {overview.admins.map((admin) => (
                                <div key={admin.id} className="grid gap-3 p-4 md:grid-cols-[1fr_140px_150px_auto_auto] md:items-center">
                                    <div className="min-w-0">
                                        <div className="truncate font-medium text-gray-950">{admin.email}</div>
                                        <div className="text-sm text-gray-500">{admin.displayName || "No display name"}</div>
                                    </div>
                                    <select
                                        disabled={!isSuperAdmin || admin.id === overview.principal.userId || saving}
                                        value={admin.role}
                                        onChange={(e) => updateAdmin(admin.id, { role: e.target.value })}
                                        className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-50"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="super_admin">Super admin</option>
                                        <option value="user">Revoke</option>
                                    </select>
                                    <select
                                        disabled={!isSuperAdmin || admin.id === overview.principal.userId || saving}
                                        value={admin.accountStatus}
                                        onChange={(e) =>
                                            updateAdmin(admin.id, {
                                                accountStatus: e.target.value,
                                                suspensionReason: "Suspended by super admin",
                                            })
                                        }
                                        className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-50"
                                    >
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={!isSuperAdmin || admin.id === overview.principal.userId || saving}
                                        onClick={() => {
                                            const password = prompt("Enter a new temporary password, minimum 10 characters");
                                            if (password) updateAdmin(admin.id, { password });
                                        }}
                                    >
                                        Reset password
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={!isSuperAdmin || admin.id === overview.principal.userId || saving}
                                        onClick={() => deleteAdmin(admin.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white">
                        <div className="border-b border-gray-200 p-4">
                            <h2 className="font-semibold text-gray-950">Subscription and Financials</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Plan mix, paid Moyasar subscriptions, pending payments, and revenue.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 p-4">
                            <div className="rounded-md bg-gray-50 p-3">
                                <div className="text-sm text-gray-500">Paid subscriptions</div>
                                <div className="mt-1 text-xl font-semibold">{overview.financials.paidSubscriptions}</div>
                            </div>
                            <div className="rounded-md bg-gray-50 p-3">
                                <div className="text-sm text-gray-500">Pending payments</div>
                                <div className="mt-1 text-xl font-semibold">{overview.financials.pendingSubscriptions}</div>
                            </div>
                        </div>
                        <div className="space-y-2 px-4 pb-4">
                            {overview.tiers.map((tier) => (
                                <div key={tier.tier} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm">
                                    <span>{tier.tier}</span>
                                    <span className="font-medium">{tier.count}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <section className="rounded-lg border border-gray-200 bg-white">
                        <div className="border-b border-gray-200 p-4">
                            <h2 className="font-semibold text-gray-950">Recent Users</h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {overview.recentUsers.map((user) => (
                                <div key={user.id} className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_130px_140px_130px] md:items-center">
                                    <div className="min-w-0">
                                        <div className="truncate font-medium text-gray-950">{user.email}</div>
                                        <div className="truncate text-gray-500">
                                            {user.organisation || user.displayName || "No organisation"} · {user.messageCreditsUsed ?? 0} credits used
                                        </div>
                                    </div>
                                    <select
                                        disabled={saving || (user.role === "super_admin" && !isSuperAdmin)}
                                        value={user.tier || "Free"}
                                        onChange={(e) => updateUser(user.id, { tier: e.target.value })}
                                        className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-50"
                                    >
                                        <option value="Free">Free</option>
                                        <option value="Professional">Professional</option>
                                        <option value="Business">Business</option>
                                        <option value="Enterprise">Enterprise</option>
                                    </select>
                                    <select
                                        disabled={saving || user.id === overview.principal.userId || (user.role !== "user" && !isSuperAdmin)}
                                        value={user.accountStatus || "active"}
                                        onChange={(e) =>
                                            updateUser(user.id, {
                                                accountStatus: e.target.value,
                                                suspensionReason: "Suspended by admin",
                                            })
                                        }
                                        className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-50"
                                    >
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={saving}
                                        onClick={() => updateUser(user.id, { messageCreditsUsed: 0 })}
                                    >
                                        Reset usage
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-white">
                        <div className="flex items-center gap-2 border-b border-gray-200 p-4">
                            <Lock className="h-4 w-4 text-gray-500" />
                            <h2 className="font-semibold text-gray-950">Admin Workflow Log</h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {overview.auditLogs.length === 0 ? (
                                <div className="p-4 text-sm text-gray-500">No admin workflow events yet.</div>
                            ) : (
                                overview.auditLogs.map((log) => (
                                    <div key={log.id} className="p-4 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-medium text-gray-950">{log.action}</span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-gray-500">
                                            {log.actorEmail || "System"} · {log.entityType}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
