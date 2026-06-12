"use client";

import { useEffect, useMemo, useState } from "react";
import {
    assignAdminRoles,
    createAdminAccount,
    deleteAdminAccount,
    getAdminOverview,
    requestAdminLogout,
    requestAdminPasswordReset,
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
    const [search, setSearch] = useState("");
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

    const admins = useMemo(() => {
        const q = search.toLowerCase();
        return (overview?.admins ?? []).filter(
            (admin) =>
                !q ||
                admin.email.toLowerCase().includes(q) ||
                (admin.displayName ?? "").toLowerCase().includes(q) ||
                admin.role.includes(q),
        );
    }, [overview, search]);

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

    const replaceRoles = async (userId: string, roleId: string, checked: boolean) => {
        const existing = overview?.roleAssignments
            .filter((assignment) => assignment.admin_user_id === userId)
            .map((assignment) => assignment.role_id) ?? [];
        const next = checked
            ? [...new Set([...existing, roleId])]
            : existing.filter((id) => id !== roleId);
        setSaving(true);
        try {
            await assignAdminRoles(userId, next);
            await load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to assign roles");
        } finally {
            setSaving(false);
        }
    };

    const removeAccount = async (userId: string, email: string) => {
        const typed = prompt(`Type DELETE ${email} to delete this admin account.`);
        if (typed !== `DELETE ${email}`) return;
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

    const resetPassword = async (userId: string) => {
        setSaving(true);
        try {
            const result = await requestAdminPasswordReset(userId);
            if (result.actionLink) {
                await navigator.clipboard?.writeText(result.actionLink).catch(() => undefined);
                alert("Password reset link generated and copied when clipboard access is available.");
            } else {
                alert("Password reset request logged.");
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to request reset");
        } finally {
            setSaving(false);
        }
    };

    const logoutAdmin = async (userId: string) => {
        setSaving(true);
        try {
            await requestAdminLogout(userId);
            await load();
            alert("Admin session logout request was logged.");
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to request logout");
        } finally {
            setSaving(false);
        }
    };

    if (error) return <div className="p-8 text-sm text-red-700">{error}</div>;

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
            <div>
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <ShieldCheck className="h-4 w-4" /> Super Admin
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-gray-950">Admin RBAC and access control</h1>
                <p className="mt-1 text-sm text-gray-500">Create admins, assign job roles, revoke permissions, and review sensitive access operations.</p>
            </div>

            <section className="rounded-md border border-gray-200 bg-white p-4">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Create admin</h2>
                <div className="grid gap-3 md:grid-cols-4">
                    <Input placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    <Input placeholder="Display name" value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} />
                    <Input placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
                    <select className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "admin" | "super_admin" }))}>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                    </select>
                </div>
                <Button className="mt-3" disabled={saving} onClick={createAccount}>Create admin</Button>
            </section>

            <section className="rounded-md border border-gray-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm font-semibold text-gray-900">Current admins</div>
                    <Input className="max-w-sm" placeholder="Search admins" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="px-4 py-3">Admin</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Jobs</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {admins.map((admin) => {
                                const assigned = new Set(
                                    overview?.roleAssignments
                                        .filter((assignment) => assignment.admin_user_id === admin.id)
                                        .map((assignment) => assignment.role_id) ?? [],
                                );
                                return (
                                    <tr key={admin.id}>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-950">{admin.email}</div>
                                            <div className="text-xs text-gray-500">{admin.displayName || "No display name"}</div>
                                        </td>
                                        <td className="px-4 py-3">{admin.role}</td>
                                        <td className="px-4 py-3">
                                            <div className="grid gap-1">
                                                {(overview?.roles ?? []).filter((role) => role.slug !== "super-admin").map((role) => (
                                                    <label key={role.id} className="flex items-center gap-2 text-xs">
                                                        <input type="checkbox" checked={assigned.has(role.id)} disabled={saving} onChange={(e) => replaceRoles(admin.id, role.id, e.target.checked)} />
                                                        <span>{role.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{admin.accountStatus}</div>
                                            <div className={admin.adminAccessEnabled ? "text-xs text-emerald-700" : "text-xs text-red-700"}>
                                                {admin.adminAccessEnabled ? "Admin access enabled" : "Admin access disabled"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                {(["user", "admin", "super_admin"] as AdminRole[]).map((role) => (
                                                    <Button key={role} variant="outline" size="sm" disabled={saving || admin.role === role} onClick={() => patchAccount(admin.id, { role })}>{role}</Button>
                                                ))}
                                                <Button variant="outline" size="sm" disabled={saving} onClick={() => patchAccount(admin.id, { accountStatus: admin.accountStatus === "suspended" ? "active" : "suspended", suspensionReason: "Suspended by super admin" })}>
                                                    {admin.accountStatus === "suspended" ? "Activate" : "Suspend"}
                                                </Button>
                                                <Button variant="outline" size="sm" disabled={saving} onClick={() => patchAccount(admin.id, { adminAccessEnabled: !admin.adminAccessEnabled })}>
                                                    {admin.adminAccessEnabled ? "Disable access" : "Enable access"}
                                                </Button>
                                                <Button variant="outline" size="sm" disabled={saving} onClick={() => resetPassword(admin.id)}>Reset password</Button>
                                                <Button variant="outline" size="sm" disabled={saving} onClick={() => logoutAdmin(admin.id)}>Logout</Button>
                                                <Button variant="outline" size="sm" disabled={saving} onClick={() => removeAccount(admin.id, admin.email)}>Delete</Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-md border border-gray-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">Permission catalog</h2>
                <div className="grid gap-2 md:grid-cols-2">
                    {(overview?.permissions ?? []).map((permission) => (
                        <div key={permission.id} className="rounded-md border border-gray-200 p-3">
                            <div className="text-sm font-medium text-gray-950">{permission.id}</div>
                            <div className="text-xs text-gray-500">{permission.category}</div>
                            <div className="mt-1 text-xs text-gray-600">{permission.description}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
