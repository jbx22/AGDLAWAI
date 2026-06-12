"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    Activity,
    BadgeDollarSign,
    BarChart3,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Eye,
    EyeOff,
    FileText,
    Fingerprint,
    FolderOpen,
    Key,
    LayoutDashboard,
    Lock,
    LogOut,
    RefreshCw,
    Search,
    Settings,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    Terminal,
    TrendingUp,
    UserCheck,
    UserCog,
    UserMinus,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        | "tabularReviews"
        | "aiCreditsUsed",
        number
    >;
    tiers: { tier: string; count: number }[];
    financials: {
        paidSubscriptions: number;
        pendingSubscriptions: number;
        activeSubscriptions: number;
        totalRevenueCents: number;
        revenue30dCents: number;
        payingUsers: number;
        averageRevenuePerPaidUserCents: number;
        currency: string;
    };
    signupsPerDay: { date: string; count: number }[];
    revenuePerDay: { date: string; total: number; count: number }[];
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
    admins: {
        id: string;
        email: string;
        displayName: string | null;
        role: Role;
        accountStatus: AccountStatus;
        suspensionReason: string | null;
        createdAt?: string;
        updatedAt?: string;
    }[];
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

const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
});

const TIERS = ["Free", "Explorer", "Business", "Founder Pro", "Enterprise"];

const TABS = [
    { id: "dashboard", label: "Governance", icon: ShieldAlert },
    { id: "admins", label: "Admin Mgmt", icon: UserCog },
    { id: "audit", label: "Audit Log", icon: Terminal },
    { id: "users", label: "Users", icon: Users },
    { id: "finance", label: "Finance", icon: CreditCard },
    { id: "config", label: "System", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string | number;
    icon: typeof Users;
    color?: string;
}) {
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-sm">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {label}
                </span>
                <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md ${
                        color || "bg-gray-50 text-gray-500"
                    }`}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="text-2xl font-bold text-gray-950">{value}</div>
        </div>
    );
}

function SimpleBarChart({
    data,
    height = 120,
    color = "#6366f1",
    valueKey = "count",
    formatValue,
}: {
    data: { [key: string]: string | number }[];
    height?: number;
    color?: string;
    valueKey?: string;
    formatValue?: (v: number) => string;
}) {
    if (!data.length) {
        return (
            <div
                className="flex items-center justify-center text-xs text-gray-400"
                style={{ height }}
            >
                No data yet
            </div>
        );
    }
    const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
    return (
        <div className="flex items-end gap-[2px]" style={{ height }}>
            {data.map((d, i) => {
                const v = Number(d[valueKey]);
                const pct = (v / max) * 100;
                return (
                    <div
                        key={i}
                        className="group relative flex flex-1 cursor-pointer items-end"
                        style={{ height: "100%" }}
                    >
                        <div
                            className="w-full rounded-t transition-all hover:opacity-80"
                            style={{
                                height: `${Math.max(pct, 2)}%`,
                                backgroundColor: color,
                            }}
                        />
                        <div className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                            {d.date || d.label}: {formatValue ? formatValue(v) : v}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function SuperAdminPage() {
    const router = useRouter();
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>("dashboard");

    // New admin form
    const [newAdmin, setNewAdmin] = useState({
        email: "",
        displayName: "",
        password: "",
        role: "admin" as Role,
    });
    const [showPassword, setShowPassword] = useState(false);

    // User filters
    const [userSearch, setUserSearch] = useState("");
    const [userStatusFilter, setUserStatusFilter] = useState<string>("all");
    const [userPage, setUserPage] = useState(0);
    const USERS_PER_PAGE = 20;

    // Audit filters
    const [auditSearch, setAuditSearch] = useState("");
    const [auditTimeFilter, setAuditTimeFilter] = useState<string>("all");
    const [auditActionFilter, setAuditActionFilter] = useState<string>("all");
    const [auditExpanded, setAuditExpanded] = useState<Set<string>>(new Set());

    // Tab persistence via hash
    useEffect(() => {
        const hash = window.location.hash.replace("#", "") as TabId;
        if (TABS.some((t) => t.id === hash)) setActiveTab(hash);
    }, []);

    useEffect(() => {
        window.location.hash = activeTab;
    }, [activeTab]);

    const loadOverview = useCallback(async () => {
        setError(null);
        setAccessDenied(false);
        setRefreshing(true);
        try {
            const data = await api<AdminOverview>("/api/admin/overview");
            setOverview(data);
        } catch (err) {
            if (err instanceof Error && "status" in err && err.status === 401) {
                router.replace("/login?callbackUrl=/super-admin");
                return;
            }
            if (err instanceof Error && "status" in err && err.status === 403) {
                setAccessDenied(true);
                return;
            }
            setError(
                err instanceof Error ? err.message : "Failed to load admin console"
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    // Derived data
    const totalRevenue = useMemo(
        () => money.format((overview?.financials.totalRevenueCents ?? 0) / 100),
        [overview]
    );
    const revenue30d = useMemo(
        () => money.format((overview?.financials.revenue30dCents ?? 0) / 100),
        [overview]
    );

    // Filtered users
    const filteredUsers = useMemo(() => {
        if (!overview?.recentUsers) return [];
        return overview.recentUsers.filter((u) => {
            const q = userSearch.toLowerCase();
            if (
                q &&
                !u.email.toLowerCase().includes(q) &&
                !(u.displayName || "").toLowerCase().includes(q) &&
                !(u.organisation || "").toLowerCase().includes(q)
            )
                return false;
            if (
                userStatusFilter !== "all" &&
                (u.accountStatus || "active") !== userStatusFilter
            )
                return false;
            return true;
        });
    }, [overview, userSearch, userStatusFilter]);

    const paginatedUsers = useMemo(
        () =>
            filteredUsers.slice(userPage * USERS_PER_PAGE, (userPage + 1) * USERS_PER_PAGE),
        [filteredUsers, userPage]
    );
    const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

    // Filtered audit logs
    const allActions = useMemo(() => {
        if (!overview?.auditLogs) return [];
        return [...new Set(overview.auditLogs.map((l) => l.action))];
    }, [overview]);

    const filteredAuditLogs = useMemo(() => {
        if (!overview?.auditLogs) return [];
        return overview.auditLogs.filter((l) => {
            if (auditActionFilter !== "all" && l.action !== auditActionFilter)
                return false;
            if (auditSearch) {
                const q = auditSearch.toLowerCase();
                if (
                    !(l.actorEmail || "").toLowerCase().includes(q) &&
                    !l.action.toLowerCase().includes(q) &&
                    !l.entityType.toLowerCase().includes(q)
                )
                    return false;
            }
            if (auditTimeFilter !== "all") {
                const now = Date.now();
                const ms =
                    auditTimeFilter === "24h"
                        ? 86400000
                        : auditTimeFilter === "7d"
                          ? 604800000
                          : auditTimeFilter === "30d"
                            ? 2592000000
                            : 0;
                if (ms && now - new Date(l.createdAt).getTime() > ms) return false;
            }
            return true;
        });
    }, [overview, auditSearch, auditTimeFilter, auditActionFilter]);

    // Admin action count (last 7 days)
    const adminActivityCount = useMemo(() => {
        if (!overview?.auditLogs) return 0;
        const weekAgo = Date.now() - 604800000;
        return overview.auditLogs.filter(
            (l) => new Date(l.createdAt).getTime() > weekAgo
        ).length;
    }, [overview]);

    // Handlers
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
        if (!confirm("Delete this admin account permanently? This cannot be undone."))
            return;
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

    const toggleAuditExpand = (id: string) => {
        setAuditExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Reset user page on filter change
    useEffect(() => {
        setUserPage(0);
    }, [userSearch, userStatusFilter]);

    const isSuperAdmin = overview?.principal.role === "super_admin";

    // Redirect non-super-admins away
    useEffect(() => {
        if (!loading && overview && !isSuperAdmin) {
            router.replace("/admin");
        }
    }, [loading, overview, isSuperAdmin, router]);

    // Loading state
    if (loading) {
        return (
            <div className="flex h-full min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#c9a84c]" />
                    <span className="text-sm text-gray-500">
                        Loading super admin panel…
                    </span>
                </div>
            </div>
        );
    }

    // Error state
    if (error && !overview) {
        return (
            <div className="mx-auto max-w-xl p-8">
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <ShieldAlert className="h-5 w-5 text-red-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-red-800">
                        Governance panel unavailable
                    </h2>
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                    <div className="mt-4 flex justify-center gap-3">
                        <Button
                            type="button"
                            onClick={loadOverview}
                            className="bg-black text-white hover:bg-gray-900"
                        >
                            Retry
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/")}
                        >
                            Back to site
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Access denied state
    if (accessDenied) {
        return (
            <div className="flex h-full min-h-[60vh] items-center justify-center bg-gray-50 p-6">
                <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <Fingerprint className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-950">
                        Super admin access required
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                        Only super admin accounts can access this governance panel.
                    </p>
                    <div className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                        Sign in with the super admin account to manage admin
                        accounts and audit the full system.
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                            type="button"
                            className="bg-black text-white hover:bg-gray-900"
                            onClick={() =>
                                signOut({ callbackUrl: "/login?callbackUrl=/super-admin" })
                            }
                        >
                            Sign out and retry
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

    // If we already know they are not super admin, show access denied immediately
    if (!isSuperAdmin) {
        return (
            <div className="flex h-full min-h-[60vh] items-center justify-center bg-gray-50 p-6">
                <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <Fingerprint className="h-6 w-6" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-950">
                        Super admin access required
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                        This governance panel requires super admin privileges.
                    </p>
                    <div className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                        You are signed in as{" "}
                        <strong>{overview.principal.email}</strong> with role{" "}
                        <strong>{overview.principal.role.replace("_", " ")}</strong>.
                        Only super admins can access this panel.
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                            type="button"
                            className="bg-black text-white hover:bg-gray-900"
                            onClick={() =>
                                signOut({ callbackUrl: "/login?callbackUrl=/super-admin" })
                            }
                        >
                            Sign out and retry
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/admin")}
                        >
                            Go to admin panel
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
                {/* Header */}
                <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                            <ShieldCheck className="h-3.5 w-3.5 text-[#c9a84c]" />
                            AGD LAW AI Governance
                        </div>
                        <h1 className="mt-1 text-xl font-bold text-white md:text-2xl">
                            Super Admin Panel
                        </h1>
                        <p className="mt-0.5 text-sm text-gray-400">
                            {overview.principal.email}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5">
                            <div className="h-2 w-2 rounded-full bg-green-400" />
                            <span className="text-xs font-medium text-gray-300">
                                Super Admin
                            </span>
                        </div>
                        <button
                            onClick={loadOverview}
                            disabled={refreshing}
                            className="rounded-md border border-gray-700 bg-gray-800 p-2 text-gray-400 transition hover:bg-gray-700 disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                            />
                        </button>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="rounded-md border border-gray-700 bg-gray-800 p-2 text-gray-400 transition hover:bg-gray-700"
                            title="Sign out"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/admin")}
                            className="hidden border-gray-700 text-gray-300 hover:bg-gray-700 md:inline-flex"
                        >
                            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                            Admin panel
                        </Button>
                    </div>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300 md:mb-6">
                        <div className="flex items-start gap-2">
                            <X
                                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                                onClick={() => setError(null)}
                            />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Tab bar */}
                <div className="mb-4 overflow-x-auto md:mb-6">
                    <div className="flex min-w-max gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition md:px-4 md:text-sm ${
                                        isActive
                                            ? "bg-[#c9a84c] text-gray-900 shadow-sm"
                                            : "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="sm:hidden">
                                        {tab.label.slice(0, 4)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ===================== DASHBOARD / GOVERNANCE ===================== */}
                {activeTab === "dashboard" && (
                    <div className="space-y-4 md:space-y-6">
                        {/* Stats row */}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                            <StatCard
                                label="Total Users"
                                value={overview.counts.users}
                                icon={Users}
                            />
                            <StatCard
                                label="Active Users"
                                value={overview.counts.activeUsers}
                                icon={UserCheck}
                            />
                            <StatCard
                                label="Admins"
                                value={overview.counts.admins}
                                icon={ShieldCheck}
                            />
                            <StatCard
                                label="Suspended"
                                value={overview.counts.suspendedUsers}
                                icon={UserMinus}
                            />
                            <StatCard
                                label="7d Events"
                                value={adminActivityCount}
                                icon={Terminal}
                            />
                            <StatCard
                                label="Documents"
                                value={overview.counts.documents}
                                icon={FileText}
                            />
                            <StatCard
                                label="Projects"
                                value={overview.counts.projects}
                                icon={FolderOpen}
                            />
                            <StatCard
                                label="AI Chats"
                                value={overview.counts.chats}
                                icon={Activity}
                            />
                            <StatCard
                                label="Tabular Reviews"
                                value={overview.counts.tabularReviews}
                                icon={BarChart3}
                            />
                            <StatCard
                                label="AI Credits"
                                value={overview.counts.aiCreditsUsed.toLocaleString()}
                                icon={SlidersHorizontal}
                            />
                            <StatCard
                                label="Revenue (30d)"
                                value={revenue30d}
                                icon={BadgeDollarSign}
                            />
                            <StatCard
                                label="Total Revenue"
                                value={totalRevenue}
                                icon={CreditCard}
                            />
                        </div>

                        {/* Charts */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                                <h3 className="mb-3 text-sm font-semibold text-gray-200">
                                    Revenue (30 days)
                                </h3>
                                <SimpleBarChart
                                    data={overview.revenuePerDay}
                                    height={160}
                                    color="#c9a84c"
                                    valueKey="total"
                                    formatValue={(v) => money.format(v / 100)}
                                />
                            </div>
                            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                                <h3 className="mb-3 text-sm font-semibold text-gray-200">
                                    New users (30 days)
                                </h3>
                                <SimpleBarChart
                                    data={overview.signupsPerDay}
                                    height={160}
                                    color="#818cf8"
                                />
                            </div>
                        </div>

                        {/* Admin accounts quick view */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800">
                            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
                                <h3 className="text-sm font-semibold text-gray-200">
                                    Admin accounts ({overview.admins.length})
                                </h3>
                                <button
                                    onClick={() => setActiveTab("admins")}
                                    className="text-xs text-[#c9a84c] hover:underline"
                                >
                                    Manage →
                                </button>
                            </div>
                            <div className="divide-y divide-gray-700">
                                {overview.admins.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-gray-500">
                                        No admin accounts yet
                                    </div>
                                ) : (
                                    overview.admins.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between px-4 py-2.5"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
                                                    {(a.displayName || a.email || "?")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-200">
                                                        {a.displayName || "Unnamed"}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {a.email}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        a.role === "super_admin"
                                                            ? "bg-amber-900/50 text-amber-300"
                                                            : "bg-blue-900/50 text-blue-300"
                                                    }`}
                                                >
                                                    {a.role.replace("_", " ")}
                                                </span>
                                                <span
                                                    className={`text-xs ${
                                                        a.accountStatus === "active"
                                                            ? "text-green-400"
                                                            : "text-red-400"
                                                    }`}
                                                >
                                                    {a.accountStatus}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent audit events */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800">
                            <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
                                <h3 className="text-sm font-semibold text-gray-200">
                                    Recent audit events
                                </h3>
                                <button
                                    onClick={() => setActiveTab("audit")}
                                    className="text-xs text-[#c9a84c] hover:underline"
                                >
                                    View all →
                                </button>
                            </div>
                            <div className="divide-y divide-gray-700">
                                {overview.auditLogs.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-gray-500">
                                        No audit events yet
                                    </div>
                                ) : (
                                    overview.auditLogs.slice(0, 10).map((log) => (
                                        <div key={log.id} className="px-4 py-2.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs font-medium text-gray-300">
                                                        {log.action}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {log.entityType}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 text-xs text-gray-500">
                                                by {log.actorEmail || "System"}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== ADMIN MANAGEMENT TAB ===================== */}
                {activeTab === "admins" && (
                    <div className="space-y-4">
                        {/* Create admin form */}
                        <form
                            onSubmit={createAdmin}
                            className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                        >
                            <h3 className="mb-3 text-sm font-semibold text-gray-200">
                                Create new admin account
                            </h3>
                            <div className="grid gap-3 md:grid-cols-5">
                                <Input
                                    placeholder="Email"
                                    type="email"
                                    value={newAdmin.email}
                                    onChange={(e) =>
                                        setNewAdmin((v) => ({
                                            ...v,
                                            email: e.target.value,
                                        }))
                                    }
                                    required
                                    className="border-gray-600 bg-gray-700 text-gray-200 placeholder:text-gray-500 md:col-span-1"
                                />
                                <Input
                                    placeholder="Display name"
                                    value={newAdmin.displayName}
                                    onChange={(e) =>
                                        setNewAdmin((v) => ({
                                            ...v,
                                            displayName: e.target.value,
                                        }))
                                    }
                                    className="border-gray-600 bg-gray-700 text-gray-200 placeholder:text-gray-500 md:col-span-1"
                                />
                                <div className="relative md:col-span-1">
                                    <Input
                                        placeholder="Temporary password (min 10)"
                                        type={showPassword ? "text" : "password"}
                                        minLength={10}
                                        value={newAdmin.password}
                                        onChange={(e) =>
                                            setNewAdmin((v) => ({
                                                ...v,
                                                password: e.target.value,
                                            }))
                                        }
                                        required
                                        className="border-gray-600 bg-gray-700 text-gray-200 placeholder:text-gray-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                <select
                                    value={newAdmin.role}
                                    onChange={(e) =>
                                        setNewAdmin((v) => ({
                                            ...v,
                                            role: e.target.value as Role,
                                        }))
                                    }
                                    className="h-10 rounded-md border border-gray-600 bg-gray-700 px-3 text-sm text-gray-200 outline-none"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                                <Button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-[#c9a84c] text-gray-900 hover:bg-[#d9ba65]"
                                >
                                    {saving ? "Creating…" : "Create admin"}
                                </Button>
                            </div>
                            {newAdmin.password.length > 0 &&
                                newAdmin.password.length < 10 && (
                                    <p className="mt-2 text-xs text-red-400">
                                        Password must be at least 10 characters
                                    </p>
                                )}
                        </form>

                        {/* Admin list */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800">
                            <div className="border-b border-gray-700 px-4 py-3">
                                <h3 className="text-sm font-semibold text-gray-200">
                                    Admin accounts ({overview.admins.length})
                                </h3>
                                <p className="mt-0.5 text-xs text-gray-400">
                                    Manage roles, status, passwords, or delete.
                                </p>
                            </div>

                            {/* Desktop table */}
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-700 bg-gray-800/50 text-xs text-gray-400">
                                            <th className="px-4 py-3 font-medium">
                                                Admin
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Role
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {overview.admins.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-4 py-10 text-center text-sm text-gray-500"
                                                >
                                                    No admin accounts yet
                                                </td>
                                            </tr>
                                        ) : (
                                            overview.admins.map((a) => {
                                                const isSelf =
                                                    a.id ===
                                                    overview.principal.userId;
                                                return (
                                                    <tr
                                                        key={a.id}
                                                        className="hover:bg-gray-750"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
                                                                    {(a.displayName ||
                                                                        a.email ||
                                                                        "?")[0].toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-gray-200">
                                                                        {a.displayName ||
                                                                            "Unnamed"}
                                                                        {isSelf && (
                                                                            <span className="ml-2 text-xs text-[#c9a84c]">
                                                                                (you)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {a.email}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                disabled={
                                                                    isSelf || saving
                                                                }
                                                                value={a.role}
                                                                onChange={(e) =>
                                                                    updateAdmin(
                                                                        a.id,
                                                                        {
                                                                            role: e
                                                                                .target
                                                                                .value,
                                                                        }
                                                                    )
                                                                }
                                                                className="h-8 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                            >
                                                                <option value="admin">
                                                                    Admin
                                                                </option>
                                                                <option value="super_admin">
                                                                    Super Admin
                                                                </option>
                                                                <option value="user">
                                                                    Revoke
                                                                </option>
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <select
                                                                disabled={
                                                                    isSelf || saving
                                                                }
                                                                value={
                                                                    a.accountStatus
                                                                }
                                                                onChange={(e) =>
                                                                    updateAdmin(
                                                                        a.id,
                                                                        {
                                                                            accountStatus:
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                            suspensionReason:
                                                                                e
                                                                                    .target
                                                                                    .value ===
                                                                                "suspended"
                                                                                    ? "Suspended by super admin"
                                                                                    : null,
                                                                        }
                                                                    )
                                                                }
                                                                className="h-8 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                            >
                                                                <option value="active">
                                                                    Active
                                                                </option>
                                                                <option value="suspended">
                                                                    Suspend
                                                                </option>
                                                            </select>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    disabled={
                                                                        isSelf || saving
                                                                    }
                                                                    onClick={() => {
                                                                        const pw =
                                                                            prompt(
                                                                                "New temporary password (min 10 chars):"
                                                                            );
                                                                        if (
                                                                            pw &&
                                                                            pw.length >=
                                                                                10
                                                                        )
                                                                            updateAdmin(
                                                                                a.id,
                                                                                {
                                                                                    password:
                                                                                        pw,
                                                                                }
                                                                            );
                                                                    }}
                                                                    className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-600 disabled:opacity-50"
                                                                >
                                                                    Reset password
                                                                </button>
                                                                <button
                                                                    disabled={
                                                                        isSelf || saving
                                                                    }
                                                                    onClick={() =>
                                                                        deleteAdmin(
                                                                            a.id
                                                                        )
                                                                    }
                                                                    className="rounded-md border border-red-800 bg-red-900/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-900/40 disabled:opacity-50"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="space-y-2 p-4 md:hidden">
                                {overview.admins.length === 0 ? (
                                    <div className="text-center text-sm text-gray-500">
                                        No admin accounts yet
                                    </div>
                                ) : (
                                    overview.admins.map((a) => {
                                        const isSelf =
                                            a.id === overview.principal.userId;
                                        return (
                                            <div
                                                key={a.id}
                                                className="rounded-lg border border-gray-700 bg-gray-750 p-4"
                                            >
                                                <div className="mb-2 flex items-start justify-between">
                                                    <div>
                                                        <div className="font-medium text-gray-200">
                                                            {a.displayName ||
                                                                "Unnamed"}
                                                            {isSelf && (
                                                                <span className="ml-2 text-xs text-[#c9a84c]">
                                                                    (you)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {a.email}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <select
                                                        disabled={isSelf || saving}
                                                        value={a.role}
                                                        onChange={(e) =>
                                                            updateAdmin(a.id, {
                                                                role: e.target.value,
                                                            })
                                                        }
                                                        className="h-8 flex-1 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                    >
                                                        <option value="admin">
                                                            Admin
                                                        </option>
                                                        <option value="super_admin">
                                                            Super Admin
                                                        </option>
                                                        <option value="user">
                                                            Revoke
                                                        </option>
                                                    </select>
                                                    <select
                                                        disabled={isSelf || saving}
                                                        value={a.accountStatus}
                                                        onChange={(e) =>
                                                            updateAdmin(a.id, {
                                                                accountStatus:
                                                                    e.target.value,
                                                            })
                                                        }
                                                        className="h-8 flex-1 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                    >
                                                        <option value="active">
                                                            Active
                                                        </option>
                                                        <option value="suspended">
                                                            Suspend
                                                        </option>
                                                    </select>
                                                    <button
                                                        disabled={isSelf || saving}
                                                        onClick={() => {
                                                            const pw =
                                                                prompt(
                                                                    "New password (min 10):"
                                                                );
                                                            if (pw && pw.length >= 10)
                                                                updateAdmin(a.id, {
                                                                    password: pw,
                                                                });
                                                        }}
                                                        className="h-8 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-300 disabled:opacity-50"
                                                    >
                                                        Reset PW
                                                    </button>
                                                    <button
                                                        disabled={isSelf || saving}
                                                        onClick={() =>
                                                            deleteAdmin(a.id)
                                                        }
                                                        className="h-8 rounded-md border border-red-800 bg-red-900/20 px-2 text-xs text-red-300 disabled:opacity-50"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== AUDIT LOG TAB ===================== */}
                {activeTab === "audit" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-col gap-3 md:flex-row">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search by actor, action, entity…"
                                    value={auditSearch}
                                    onChange={(e) => setAuditSearch(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-3 text-sm text-gray-200 outline-none transition focus:border-gray-500 placeholder:text-gray-500"
                                />
                            </div>
                            <select
                                value={auditActionFilter}
                                onChange={(e) => setAuditActionFilter(e.target.value)}
                                className="h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm text-gray-200 outline-none focus:border-gray-500"
                            >
                                <option value="all">All actions</option>
                                {allActions.map((action) => (
                                    <option key={action} value={action}>
                                        {action}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={auditTimeFilter}
                                onChange={(e) => setAuditTimeFilter(e.target.value)}
                                className="h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm text-gray-200 outline-none focus:border-gray-500"
                            >
                                <option value="all">All time</option>
                                <option value="24h">Last 24 hours</option>
                                <option value="7d">Last 7 days</option>
                                <option value="30d">Last 30 days</option>
                            </select>
                        </div>

                        <p className="text-xs text-gray-500">
                            {filteredAuditLogs.length} event
                            {filteredAuditLogs.length !== 1 ? "s" : ""}
                            {filteredAuditLogs.length !== overview.auditLogs.length
                                ? " (filtered)"
                                : ""}
                        </p>

                        {/* Log entries */}
                        <div className="space-y-2">
                            {filteredAuditLogs.length === 0 ? (
                                <div className="rounded-lg border border-gray-700 bg-gray-800 p-8 text-center text-sm text-gray-500">
                                    No audit events found
                                </div>
                            ) : (
                                filteredAuditLogs.map((log) => {
                                    const isExpanded = auditExpanded.has(log.id);
                                    return (
                                        <div
                                            key={log.id}
                                            className="rounded-lg border border-gray-700 bg-gray-800 transition hover:border-gray-600"
                                        >
                                            <button
                                                onClick={() =>
                                                    toggleAuditExpand(log.id)
                                                }
                                                className="flex w-full items-center justify-between p-4 text-left"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300">
                                                        {log.action}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {log.entityType}
                                                    </span>
                                                    {log.entityId && (
                                                        <span className="font-mono text-xs text-gray-500">
                                                            {log.entityId.slice(
                                                                0,
                                                                8
                                                            )}
                                                            …
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(
                                                        log.createdAt
                                                    ).toLocaleString()}
                                                </span>
                                            </button>
                                            <div className="px-4 pb-2 text-xs text-gray-500">
                                                by {log.actorEmail || "System"}
                                            </div>
                                            {isExpanded &&
                                                Object.keys(log.metadata)
                                                    .length > 0 && (
                                                    <div className="border-t border-gray-700 px-4 pb-3 pt-2">
                                                        <pre className="overflow-x-auto rounded-md bg-gray-900 p-2 text-xs text-gray-400">
                                                            {JSON.stringify(
                                                                log.metadata,
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                    </div>
                                                )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* ===================== USERS TAB ===================== */}
                {activeTab === "users" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-col gap-3 md:flex-row">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search by name, email, organisation…"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-3 text-sm text-gray-200 outline-none transition focus:border-gray-500 placeholder:text-gray-500"
                                />
                            </div>
                            <select
                                value={userStatusFilter}
                                onChange={(e) => setUserStatusFilter(e.target.value)}
                                className="h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 text-sm text-gray-200 outline-none focus:border-gray-500"
                            >
                                <option value="all">All status</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>

                        <p className="text-xs text-gray-500">
                            {filteredUsers.length} user
                            {filteredUsers.length !== 1 ? "s" : ""}
                        </p>

                        {/* User list */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800">
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-700 text-xs text-gray-400">
                                            <th className="px-4 py-3 font-medium">
                                                User
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Org
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Tier
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Credits
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Joined
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {paginatedUsers.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="px-4 py-10 text-center text-sm text-gray-500"
                                                >
                                                    No users found
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedUsers.map((u) => (
                                                <tr
                                                    key={u.id}
                                                    className="hover:bg-gray-750"
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-200">
                                                            {u.displayName ||
                                                                "Unnamed"}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {u.email}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-400">
                                                        {u.organisation || "—"}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            disabled={saving}
                                                            value={u.tier || "Free"}
                                                            onChange={(e) =>
                                                                updateUser(u.id, {
                                                                    tier: e.target.value,
                                                                })
                                                            }
                                                            className="h-8 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                        >
                                                            {TIERS.map((t) => (
                                                                <option key={t} value={t}>
                                                                    {t}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            disabled={saving}
                                                            value={
                                                                u.accountStatus ||
                                                                "active"
                                                            }
                                                            onChange={(e) =>
                                                                updateUser(u.id, {
                                                                    accountStatus:
                                                                        e.target
                                                                            .value,
                                                                    suspensionReason:
                                                                        e.target
                                                                            .value ===
                                                                        "suspended"
                                                                            ? "Suspended by super admin"
                                                                            : null,
                                                                })
                                                            }
                                                            className="h-8 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                        >
                                                            <option value="active">
                                                                Active
                                                            </option>
                                                            <option value="suspended">
                                                                Suspend
                                                            </option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-400">
                                                        {u.messageCreditsUsed ?? 0}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                                                        {new Date(
                                                            u.createdAt
                                                        ).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            disabled={saving}
                                                            onClick={() =>
                                                                updateUser(u.id, {
                                                                    messageCreditsUsed: 0,
                                                                })
                                                            }
                                                            className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-600 disabled:opacity-50"
                                                        >
                                                            Reset usage
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="space-y-2 p-4 md:hidden">
                                {paginatedUsers.length === 0 ? (
                                    <div className="text-center text-sm text-gray-500">
                                        No users found
                                    </div>
                                ) : (
                                    paginatedUsers.map((u) => (
                                        <div
                                            key={u.id}
                                            className="rounded-lg border border-gray-700 bg-gray-750 p-4"
                                        >
                                            <div className="mb-2 flex items-start justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate font-medium text-gray-200">
                                                        {u.displayName || "Unnamed"}
                                                    </div>
                                                    <div className="truncate text-xs text-gray-400">
                                                        {u.email}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        (u.accountStatus ||
                                                            "active") === "active"
                                                            ? "bg-green-900/30 text-green-300"
                                                            : "bg-red-900/30 text-red-300"
                                                    }`}
                                                >
                                                    {u.accountStatus || "active"}
                                                </span>
                                            </div>
                                            <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-gray-400">
                                                <span>
                                                    {u.organisation || "No org"}
                                                </span>
                                                <span>·</span>
                                                <span>
                                                    {u.messageCreditsUsed ?? 0}{" "}
                                                    credits
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <select
                                                    disabled={saving}
                                                    value={u.tier || "Free"}
                                                    onChange={(e) =>
                                                        updateUser(u.id, {
                                                            tier: e.target.value,
                                                        })
                                                    }
                                                    className="h-8 flex-1 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                >
                                                    {TIERS.map((t) => (
                                                        <option key={t} value={t}>
                                                            {t}
                                                        </option>
                                                    ))}
                                                </select>
                                                <select
                                                    disabled={saving}
                                                    value={u.accountStatus || "active"}
                                                    onChange={(e) =>
                                                        updateUser(u.id, {
                                                            accountStatus:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className="h-8 flex-1 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-200 disabled:opacity-50"
                                                >
                                                    <option value="active">
                                                        Active
                                                    </option>
                                                    <option value="suspended">
                                                        Suspend
                                                    </option>
                                                </select>
                                                <button
                                                    disabled={saving}
                                                    onClick={() =>
                                                        updateUser(u.id, {
                                                            messageCreditsUsed: 0,
                                                        })
                                                    }
                                                    className="h-8 rounded-md border border-gray-600 bg-gray-700 px-2 text-xs text-gray-300 disabled:opacity-50"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Pagination */}
                        {totalUserPages > 1 && (
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={() =>
                                        setUserPage((p) => Math.max(0, p - 1))
                                    }
                                    disabled={userPage === 0}
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-700 bg-gray-800 text-gray-400 transition hover:bg-gray-700 disabled:opacity-50"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-sm text-gray-500">
                                    Page {userPage + 1} of {totalUserPages}
                                </span>
                                <button
                                    onClick={() =>
                                        setUserPage((p) =>
                                            Math.min(totalUserPages - 1, p + 1)
                                        )
                                    }
                                    disabled={userPage >= totalUserPages - 1}
                                    className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-700 bg-gray-800 text-gray-400 transition hover:bg-gray-700 disabled:opacity-50"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ===================== FINANCE TAB ===================== */}
                {activeTab === "finance" && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                            <StatCard
                                label="Total Revenue"
                                value={totalRevenue}
                                icon={CreditCard}
                            />
                            <StatCard
                                label="30-Day Revenue"
                                value={revenue30d}
                                icon={BadgeDollarSign}
                            />
                            <StatCard
                                label="Paid Subs"
                                value={overview.financials.paidSubscriptions}
                                icon={UserCheck}
                            />
                            <StatCard
                                label="Pending"
                                value={overview.financials.pendingSubscriptions}
                                icon={Activity}
                            />
                            <StatCard
                                label="Active Subs"
                                value={overview.financials.activeSubscriptions}
                                icon={UserCog}
                            />
                            <StatCard
                                label="Paying Users"
                                value={overview.financials.payingUsers}
                                icon={Users}
                            />
                        </div>

                        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-gray-200">
                                Revenue trend (30 days)
                            </h3>
                            <SimpleBarChart
                                data={overview.revenuePerDay}
                                height={160}
                                color="#c9a84c"
                                valueKey="total"
                                formatValue={(v) => money.format(v / 100)}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                                <h3 className="mb-4 text-sm font-semibold text-gray-200">
                                    Plan distribution
                                </h3>
                                <div className="space-y-2">
                                    {overview.tiers.map((t) => (
                                        <div
                                            key={t.tier}
                                            className="flex items-center justify-between rounded-md border border-gray-700 bg-gray-700/50 px-3 py-2 text-sm"
                                        >
                                            <span className="text-gray-300">
                                                {t.tier}
                                            </span>
                                            <span className="font-medium text-gray-200">
                                                {t.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                                <h3 className="mb-4 text-sm font-semibold text-gray-200">
                                    Financial details
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        {
                                            label: "Paid subscriptions",
                                            value: overview.financials.paidSubscriptions,
                                        },
                                        {
                                            label: "Pending payments",
                                            value: overview.financials.pendingSubscriptions,
                                        },
                                        {
                                            label: "Active subscriptions",
                                            value: overview.financials.activeSubscriptions,
                                        },
                                        {
                                            label: "Paying users",
                                            value: overview.financials.payingUsers,
                                        },
                                        {
                                            label: "ARPU",
                                            value:
                                                money.format(
                                                    (overview.financials.averageRevenuePerPaidUserCents || 0) / 100
                                                ),
                                        },
                                        {
                                            label: "30d Revenue",
                                            value: revenue30d,
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className="rounded-md bg-gray-700/50 p-3"
                                        >
                                            <div className="text-xs text-gray-400">
                                                {item.label}
                                            </div>
                                            <div className="mt-1 text-lg font-semibold text-gray-200">
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================== SYSTEM CONFIG TAB ===================== */}
                {activeTab === "config" && (
                    <div className="space-y-4">
                        {/* Environment checks */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-gray-200">
                                Environment status
                            </h3>
                            <div className="space-y-3">
                                {[
                                    {
                                        key: "NEXT_PUBLIC_SUPABASE_URL",
                                        label: "Supabase URL",
                                        check: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                                    },
                                    {
                                        key: "SUPABASE_SERVICE_ROLE_KEY",
                                        label: "Service role key",
                                        check: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                                    },
                                    {
                                        key: "MOYASAR_SECRET_KEY",
                                        label: "Moyasar secret key",
                                        check: !!process.env.MOYASAR_SECRET_KEY,
                                    },
                                    {
                                        key: "NEXTAUTH_SECRET",
                                        label: "NextAuth secret",
                                        check: !!process.env.NEXTAUTH_SECRET,
                                    },
                                ].map((env) => (
                                    <div
                                        key={env.key}
                                        className="flex items-center justify-between rounded-md bg-gray-900 px-3 py-2"
                                    >
                                        <div>
                                            <span className="text-sm text-gray-300">
                                                {env.label}
                                            </span>
                                            <div className="text-xs text-gray-500">
                                                {env.key}
                                            </div>
                                        </div>
                                        <span
                                            className={`flex items-center gap-1.5 text-xs font-medium ${
                                                env.check
                                                    ? "text-green-400"
                                                    : "text-red-400"
                                            }`}
                                        >
                                            {env.check ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    Set
                                                </>
                                            ) : (
                                                <>
                                                    <X className="h-3.5 w-3.5" />
                                                    Not set
                                                </>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Database schema info */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-gray-200">
                                Database status
                            </h3>
                            <div className="space-y-2">
                                {[
                                    {
                                        table: "users",
                                        label: "User accounts",
                                        count: overview.counts.users,
                                    },
                                    {
                                        table: "user_profiles",
                                        label: "User profiles",
                                        count: overview.counts.users,
                                    },
                                    {
                                        table: "subscriptions",
                                        label: "Subscriptions",
                                        count:
                                            overview.financials.paidSubscriptions +
                                            overview.financials.pendingSubscriptions,
                                    },
                                    {
                                        table: "documents",
                                        label: "Documents",
                                        count: overview.counts.documents,
                                    },
                                    {
                                        table: "projects",
                                        label: "Projects",
                                        count: overview.counts.projects,
                                    },
                                ].map((t) => (
                                    <div
                                        key={t.table}
                                        className="flex items-center justify-between rounded-md bg-gray-900 px-3 py-2 text-sm"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-xs text-gray-500">
                                                {t.table}
                                            </span>
                                            <span className="text-gray-300">
                                                {t.label}
                                            </span>
                                        </div>
                                        <span className="font-medium text-gray-200">
                                            {t.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Version info */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-gray-200">
                                System info
                            </h3>
                            <div className="space-y-1 text-sm text-gray-400">
                                <p>AGD LAW AI — Super Admin Panel</p>
                                <p>Next.js 16.2.6 · Supabase · Moyasar</p>
                                <p className="text-xs">
                                    Build fullstack · All analytics queries run against
                                    live Supabase Postgres
                                </p>
                            </div>
                        </div>

                        {/* Note */}
                        <div className="rounded-lg border border-amber-800 bg-amber-900/20 p-4 text-sm text-amber-300">
                            <strong>⚠ Security note:</strong> Environment variables
                            shown above check only whether values are set, not whether
                            they are valid. API keys and secrets are never exposed in
                            the client bundle.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
