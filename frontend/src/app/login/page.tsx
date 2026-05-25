"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { useAuth } from "@/contexts/AuthContext";

const demoAccounts = [
    {
        label: "User demo",
        email: "demo@jblbizlaw.com",
        password: "DemoUser123!",
        callbackUrl: "/assistant",
    },
    {
        label: "Admin demo",
        email: "admin@jblbizlaw.com",
        password: "AdminDemo123!",
        callbackUrl: "/admin",
    },
    {
        label: "Super admin demo",
        email: "superadmin@jblbizlaw.com",
        password: "SuperAdminDemo123!",
        callbackUrl: "/super-admin",
    },
] as const;

export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const [callbackUrl, setCallbackUrl] = useState("/assistant");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("callbackUrl");
        if (next && next.startsWith("/") && !next.startsWith("//")) {
            setCallbackUrl(next);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace(callbackUrl);
        }
    }, [authLoading, isAuthenticated, router, callbackUrl]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await signIn("credentials", { email, password, redirect: false });
            if (result?.error) {
                setError("Invalid email or password");
            } else {
                router.push(callbackUrl);
            }
        } catch {
            setError("An error occurred during login");
        } finally {
            setLoading(false);
        }
    };

    const useDemoAccount = (account: (typeof demoAccounts)[number]) => {
        setEmail(account.email);
        setPassword(account.password);
        setCallbackUrl(account.callbackUrl);
        setError(null);
    };

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                {/* Login Form */}
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-left text-2xl font-serif">
                            Log In
                        </h2>
                        <div className="bg-gray-100 p-1 rounded-md flex text-xs font-medium">
                            <span className="text-gray-600 px-3 py-1 bg-white rounded-sm shadow-sm">
                                Log in
                            </span>
                            <Link
                                href="/signup"
                                className="px-3 py-1 text-gray-500 hover:text-gray-900"
                            >
                                Sign up
                            </Link>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="w-full"
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-5 bg-black hover:bg-gray-900 text-white"
                        >
                            {loading ? "Logging in..." : "Log in"}
                        </Button>
                    </form>
                </div>
                <div className="mb-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <div>
                        <div className="font-semibold">Demo accounts for testing</div>
                        <div className="mt-1 text-xs text-amber-900">
                            Pick a role to fill the form and open the matching page after login.
                        </div>
                    </div>
                    {demoAccounts.map((account) => (
                        <div
                            key={account.email}
                            className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-white/75 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <div className="font-semibold">{account.label}</div>
                                <div className="mt-1 break-all font-mono text-xs">
                                    {account.email} / {account.password}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                                onClick={() => useDemoAccount(account)}
                            >
                                Use demo
                            </Button>
                        </div>
                    ))}
                </div>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-2">
                    JBL BIZ LAW hosted on jblbizlaw.com is currently a demo service.
                    Please do not upload, submit, or store sensitive,
                    confidential, privileged, client, or personally
                    identifiable documents.
                </p>
            </div>
        </div>
    );
}
