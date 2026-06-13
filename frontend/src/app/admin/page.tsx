"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
    getAdminOverview,
    updateAdminUser,
    updateUserSubscription,
    type AdminOverview,
} from "@/app/lib/mikeApi";
import {
    Activity,
    AlertTriangle,
    BarChart3,
    CreditCard,
    Download,
    RefreshCw,
    Search,
    Server,
    Shield,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab =
    | "users"
    | "subscriptions"
    | "ai"
    | "activity"
    | "security"
    | "support"
    | "settings";

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
    { id: "ai", label: "AI Usage", icon: Activity },
    { id: "activity", label: "Admin Activity", icon: Shield },
    { id: "security", label: "Security Logs", icon: AlertTriangle },
    { id: "support", label: "Support", icon: BarChart3 },
    { id: "settings", label: "System", icon: Server },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR" });

function exportJson(name: string, value: unknown) {
    const blob = new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function AdminPage() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("users");
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState<string | null>(null);

    const load = async () => {
        setError(null);
        try {
            setOverview(await getAdminOverview());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load admin console");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const users = useMemo(() => {
        const q = search.toLowerCase();
        return (overview?.recentUsers ?? []).filter(
            (user) =>
                !q ||
                user.email.toLowerCase().includes(q) ||
                (user.displayName ?? "").toLowerCase().includes(q) ||
                (user.organisation ?? "").toLowerCase().includes(q),
        );
    }, [overview, search]);

    const updateUser = async (
        userId: string,
        payload: Parameters<typeof updateAdminUser>[1],
    ) => {
        setSaving(userId);
        try {
            await updateAdminUser(userId, payload);
            await load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update user");
        } finally {
            setSaving(null);
        }
    };

    const updateSubscription = async (
        userId: string,
        planId: string,
        status = "active",
        autoRenew?: boolean,
    ) => {
        setSaving(userId);
        try {
            await updateUserSubscription(userId, { planId, status, autoRenew });
            await load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update subscription");
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <div className="p-8 text-sm text-gray-500">Loading admin console...</div>;
    if (error) return <div className="p-8 text-sm text-red-700">{error}</div>;
    if (!overview) return null;

    const stats = [
        { label: "Users", value: overview.counts.users, icon: Users },
        { label: "Active", value: overview.counts.activeUsers, icon: Activity },
        { label: "Suspended", value: overview.counts.suspendedUsers, icon: AlertTriangle },
        { label: "Revenue", value: money.format(overview.financials.totalRevenueCents / 100), icon: CreditCard },
    ];

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Admin</p>
                    <h1 className="text-2xl font-semibold text-gray-950">Operations dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">Least-privilege controls for users, billing, AI usage, logs, and support.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => exportJson(activeTab, currentExport(activeTab, overview, users))}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                    <Button variant="outline" onClick={load}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-md border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-gray-500">
                            {label}
                            <Icon className="h-4 w-4" />
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-1">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${
                            activeTab === id ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                        <Icon className="h-4 w-4" /> {label}
                    </button>
                ))}
            </div>

            {activeTab === "users" && (
                <Panel title="Website Users">
                    <SearchBox value={search} onChange={setSearch} />
                    <DataTable
                        headers={["User", "Role", "Tier", "Credits", "Status", "Actions"]}
                        rows={users.map((user) => [
                            <CellTitle key="u" title={user.email} subtitle={user.displayName || user.organisation || "No profile details"} />,
                            user.role,
                            user.tier,
                            String(user.messageCreditsUsed),
                            user.accountStatus,
                            <div key="a" className="flex flex-wrap gap-2">
                                {["Free", "Starter", "Professional", "Enterprise"].map((tier) => (
                                    <Button key={tier} variant="outline" size="sm" disabled={saving === user.id || user.tier === tier} onClick={() => updateUser(user.id, { tier })}>
                                        {tier}
                                    </Button>
                                ))}
                                <Button variant="outline" size="sm" disabled={saving === user.id} onClick={() => updateUser(user.id, { accountStatus: user.accountStatus === "suspended" ? "active" : "suspended", suspensionReason: "Suspended by admin" })}>
                                    {user.accountStatus === "suspended" ? "Activate" : "Suspend"}
                                </Button>
                            </div>,
                        ])}
                    />
                </Panel>
            )}

            {activeTab === "subscriptions" && (
                <Panel title="Subscriptions & Billing">
                    <div className="grid gap-3 md:grid-cols-3">
                        <MiniStat label="Paid subscriptions" value={overview.financials.paidSubscriptions} />
                        <MiniStat label="Pending subscriptions" value={overview.financials.pendingSubscriptions} />
                        <MiniStat label="30d revenue" value={money.format(overview.financials.revenue30dCents / 100)} />
                    </div>
                    <EmptyAware rows={overview.subscriptions} empty="No subscription records yet.">
                        <DataTable
                            headers={["User", "Plan", "Status", "Renewal", "Auto-renew", "Admin actions"]}
                            rows={overview.subscriptions.map((sub) => {
                                const userId = String(sub.user_id ?? "");
                                return [
                                    userId || "-",
                                    String(sub.tier ?? sub.plan_id ?? "-"),
                                    String(sub.status ?? "-"),
                                    sub.current_period_end ? new Date(String(sub.current_period_end)).toLocaleDateString() : "-",
                                    sub.auto_renew === false ? "No" : "Yes",
                                    <div key={userId || String(sub.id)} className="flex flex-wrap gap-2">
                                        {["free", "starter", "professional", "enterprise"].map((planId) => (
                                            <Button key={planId} size="sm" variant="outline" disabled={!userId || saving === userId} onClick={() => updateSubscription(userId, planId, planId === "free" ? "free" : "active")}>
                                                {planId}
                                            </Button>
                                        ))}
                                        <Button size="sm" variant="outline" disabled={!userId || saving === userId} onClick={() => updateSubscription(userId, String(sub.plan_id ?? "free"), "suspended")}>
                                            Suspend
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={!userId || saving === userId} onClick={() => updateSubscription(userId, String(sub.plan_id ?? "free"), String(sub.status ?? "active"), sub.auto_renew === false)}>
                                            {sub.auto_renew === false ? "Enable renew" : "Disable renew"}
                                        </Button>
                                    </div>,
                                ];
                            })}
                        />
                    </EmptyAware>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <EmptyAware rows={overview.subscriptionRenewalEvents} empty="No renewal events yet.">
                            <DataTable headers={["User", "Plan", "Status", "Due", "Created"]} rows={overview.subscriptionRenewalEvents.map((event) => [String(event.user_id ?? "-"), String(event.plan_id ?? "-"), String(event.status ?? "-"), String(event.due_at ?? "-"), String(event.created_at ?? "-")])} />
                        </EmptyAware>
                        <EmptyAware rows={overview.subscriptionPaymentEvents} empty="No payment events yet.">
                            <DataTable headers={["User", "Plan", "Status", "Amount", "Created"]} rows={overview.subscriptionPaymentEvents.map((event) => [String(event.user_id ?? "-"), String(event.plan_id ?? "-"), String(event.status ?? "-"), money.format(Number(event.amount_cents ?? 0) / 100), String(event.created_at ?? "-")])} />
                        </EmptyAware>
                    </div>
                </Panel>
            )}

            {activeTab === "ai" && (
                <Panel title="AI Usage & Provider Health">
                    <EmptyAware rows={overview.subscriptionUsageEvents} empty="No subscription usage events yet.">
                        <DataTable
                            headers={["User", "Metric", "Qty", "Source", "Model", "Period", "Created"]}
                            rows={overview.subscriptionUsageEvents.map((e) => [
                                String(e.user_id ?? "-"),
                                String(e.metric ?? "-"),
                                String(e.quantity ?? 0),
                                String(e.source ?? "-"),
                                String(e.model ?? "-"),
                                String(e.period_key ?? "-"),
                                String(e.created_at ?? "-"),
                            ])}
                        />
                    </EmptyAware>
                </Panel>
            )}

            {activeTab === "activity" && (
                <Panel title="Admin Activity Logs">
                    <DataTable headers={["Admin", "Action", "Module", "IP", "Date"]} rows={overview.activityEvents.map((e) => [e.email ?? "-", e.action, e.module, e.ipAddress ?? "-", new Date(e.createdAt).toLocaleString()])} />
                </Panel>
            )}

            {activeTab === "security" && (
                <Panel title="Security & Login History">
                    <DataTable headers={["Admin", "Event", "Success", "IP", "Device", "Date"]} rows={overview.loginEvents.map((e) => [e.email ?? "-", e.eventType, e.success ? "Yes" : "No", e.ipAddress ?? "-", e.userAgent ?? "-", new Date(e.createdAt).toLocaleString()])} />
                </Panel>
            )}

            {activeTab === "support" && (
                <Panel title="Support & Contact Intake">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <EmptyAware rows={overview.supportRequests} empty="No support requests yet.">
                            <DataTable headers={["Email", "Subject", "Status", "Created"]} rows={overview.supportRequests.map((r) => [String(r.email ?? "-"), String(r.subject ?? "-"), String(r.status ?? "-"), String(r.created_at ?? "-")])} />
                        </EmptyAware>
                        <EmptyAware rows={overview.contactMessages} empty="No contact form messages yet.">
                            <DataTable headers={["Email", "Subject", "Status", "Created"]} rows={overview.contactMessages.map((r) => [String(r.email ?? "-"), String(r.subject ?? "-"), String(r.status ?? "-"), String(r.created_at ?? "-")])} />
                        </EmptyAware>
                    </div>
                </Panel>
            )}

            {activeTab === "settings" && (
                <Panel title="Website Content & System Settings">
                    <div className="rounded-md border border-dashed border-gray-300 p-5 text-sm text-gray-500">
                        API key configuration remains server-only through deployment environment variables. Content/settings are prepared in `admin_system_settings`; add editable settings here as the site modules define stable keys.
                    </div>
                </Panel>
            )}
        </div>
    );
}

function currentExport(tab: Tab, overview: AdminOverview, users: AdminOverview["recentUsers"]) {
    if (tab === "users") return users;
    if (tab === "activity") return overview.activityEvents;
    if (tab === "security") return overview.loginEvents;
    if (tab === "ai") return overview.aiUsageEvents;
    if (tab === "support") return { supportRequests: overview.supportRequests, contactMessages: overview.contactMessages };
    return overview;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-md border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-900">{title}</div>
            <div className="space-y-4 p-4">{children}</div>
        </section>
    );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search" className="pl-9" />
        </div>
    );
}

function CellTitle({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div>
            <div className="font-medium text-gray-950">{title}</div>
            <div className="text-xs text-gray-500">{subtitle}</div>
        </div>
    );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                    <tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                        <tr key={i}>{row.map((cell, j) => <td key={j} className="px-4 py-3 align-top">{cell}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function EmptyAware<T>({ rows, empty, children }: { rows: T[]; empty: string; children: React.ReactNode }) {
    if (rows.length === 0) return <div className="rounded-md border border-dashed border-gray-300 p-5 text-sm text-gray-500">{empty}</div>;
    return <>{children}</>;
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-md border border-gray-200 p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
            <div className="mt-1 text-xl font-semibold text-gray-950">{value}</div>
        </div>
    );
}
