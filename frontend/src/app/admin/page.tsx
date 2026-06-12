"use client";

import { useEffect, useMemo, useState } from "react";
import {
    getAdminOverview,
    updateAdminUser,
    type AdminOverview,
} from "@/app/lib/mikeApi";
import { Activity, CreditCard, RefreshCw, Search, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
});

export default function AdminPage() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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

    if (loading) return <div className="p-8 text-sm text-gray-500">Loading admin console...</div>;
    if (error) {
        return (
            <div className="p-8">
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            </div>
        );
    }
    if (!overview) return null;

    const stats = [
        { label: "Users", value: overview.counts.users, icon: Users },
        { label: "Active", value: overview.counts.activeUsers, icon: Activity },
        { label: "Suspended", value: overview.counts.suspendedUsers, icon: ShieldAlert },
        {
            label: "Revenue",
            value: money.format(overview.financials.totalRevenueCents / 100),
            icon: CreditCard,
        },
    ];

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Admin</p>
                    <h1 className="text-2xl font-semibold text-gray-950">Website control</h1>
                </div>
                <Button variant="outline" onClick={load}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
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

            <div className="rounded-md border border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 p-4">
                    <h2 className="text-sm font-semibold text-gray-900">Users</h2>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search users"
                            className="pl-9"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Tier</th>
                                <th className="px-4 py-3">Credits</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-950">{user.email}</div>
                                        <div className="text-xs text-gray-500">{user.displayName || user.organisation || "No profile details"}</div>
                                    </td>
                                    <td className="px-4 py-3">{user.role}</td>
                                    <td className="px-4 py-3">{user.tier}</td>
                                    <td className="px-4 py-3">{user.messageCreditsUsed}</td>
                                    <td className="px-4 py-3">{user.accountStatus}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            {["Free", "Explorer", "Business", "Founder Pro", "Enterprise"].map((tier) => (
                                                <Button
                                                    key={tier}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={saving === user.id || user.tier === tier}
                                                    onClick={() => updateUser(user.id, { tier })}
                                                >
                                                    {tier}
                                                </Button>
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={saving === user.id}
                                                onClick={() =>
                                                    updateUser(user.id, {
                                                        accountStatus:
                                                            user.accountStatus === "suspended"
                                                                ? "active"
                                                                : "suspended",
                                                        suspensionReason: "Suspended by admin",
                                                    })
                                                }
                                            >
                                                {user.accountStatus === "suspended" ? "Activate" : "Suspend"}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
