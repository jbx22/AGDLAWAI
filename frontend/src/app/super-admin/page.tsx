"use client";

import { useEffect, useState } from "react";
import {
    createAdminAccount,
    deleteAdminAccount,
    getAdminOverview,
    updateAdminAccount,
    type AdminOverview,
    type AdminRole,
} from "@/app/lib/mikeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

export default function SuperAdminPage() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        email: "",
        displayName: "",
        password: "",
        role: "admin" as "admin" | "super_admin",
    });

    const load = async () => {
        try {
            setOverview(await getAdminOverview());
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load super admin console");
        }
    };

    useEffect(() => {
        load();
    }, []);

    const createAccount = async () => {
        setSaving(true);
        try {
            await createAdminAccount({
                email: form.email,
                displayName: form.displayName || null,
                password: form.password,
                role: form.role,
            });
            setForm({ email: "", displayName: "", password: "", role: "admin" });
            await load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to create admin");
        } finally {
            setSaving(false);
        }
    };

    const patchAccount = async (
        userId: string,
        payload: Parameters<typeof updateAdminAccount>[1],
    ) => {
        setSaving(true);
        try {
            await updateAdminAccount(userId, payload);
            await load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update admin");
        } finally {
            setSaving(false);
        }
    };

    const removeAccount = async (userId: string) => {
        if (!confirm("Delete this admin account? This cannot be undone.")) return;
        setSaving(true);
        try {
            await deleteAdminAccount(userId);
            await load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete admin");
        } finally {
            setSaving(false);
        }
    };

    if (error) return <div className="p-8 text-sm text-red-700">{error}</div>;

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
            <div>
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <ShieldCheck className="h-4 w-4" /> Super Admin
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-gray-950">Admin access control</h1>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Create admin</h2>
                <div className="grid gap-3 md:grid-cols-4">
                    <Input placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    <Input placeholder="Display name" value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} />
                    <Input placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
                    <select
                        className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                        value={form.role}
                        onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "admin" | "super_admin" }))}
                    >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                    </select>
                </div>
                <Button className="mt-3" disabled={saving} onClick={createAccount}>
                    Create admin
                </Button>
            </div>

            <div className="rounded-md border border-gray-200 bg-white">
                <div className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-900">
                    Current admins
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-4 py-3">Admin</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(overview?.admins ?? []).map((admin) => (
                                <tr key={admin.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-950">{admin.email}</div>
                                        <div className="text-xs text-gray-500">{admin.displayName || "No display name"}</div>
                                    </td>
                                    <td className="px-4 py-3">{admin.role}</td>
                                    <td className="px-4 py-3">{admin.accountStatus}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            {(["user", "admin", "super_admin"] as AdminRole[]).map((role) => (
                                                <Button
                                                    key={role}
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={saving || admin.role === role}
                                                    onClick={() => patchAccount(admin.id, { role })}
                                                >
                                                    {role}
                                                </Button>
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={saving}
                                                onClick={() =>
                                                    patchAccount(admin.id, {
                                                        accountStatus: admin.accountStatus === "suspended" ? "active" : "suspended",
                                                        suspensionReason: "Suspended by super admin",
                                                    })
                                                }
                                            >
                                                {admin.accountStatus === "suspended" ? "Activate" : "Suspend"}
                                            </Button>
                                            <Button variant="outline" size="sm" disabled={saving} onClick={() => removeAccount(admin.id)}>
                                                Delete
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
