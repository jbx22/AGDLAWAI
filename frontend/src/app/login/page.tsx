"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";

export default function LoginPage() {
    const router = useRouter();
    const pathname = usePathname();
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
    }, [pathname]);

    const locale =
        pathname === "/en" ||
        pathname?.startsWith("/en/") ||
        (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("lang") === "en")
            ? "en"
            : "ar";
    const dir = locale === "ar" ? "rtl" : "ltr";
    const signupHref = locale === "ar" ? "/signup" : "/signup?lang=en";

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await signIn("credentials", { email, password, redirect: false });
            if (result?.error) {
                setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
            } else {
                router.push(callbackUrl);
            }
        } catch {
            setError("حدث خطأ أثناء تسجيل الدخول");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative" dir={dir}>
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                {/* Login Form */}
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className={`text-2xl font-serif ${locale === "ar" ? "text-right" : "text-left"}`}>
                            تسجيل الدخول
                        </h2>
                        <div className="bg-gray-100 p-1 rounded-md flex text-xs font-medium">
                            <span className="text-gray-600 px-3 py-1 bg-white rounded-sm shadow-sm">
                                دخول
                            </span>
                            <Link
                                href={signupHref}
                                className="px-3 py-1 text-gray-500 hover:text-gray-900"
                            >
                                إنشاء حساب
                            </Link>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                البريد الإلكتروني
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="أدخل بريدك الإلكتروني"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                كلمة المرور
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="أدخل كلمة المرور"
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
                            {loading ? "جار تسجيل الدخول..." : "تسجيل الدخول"}
                        </Button>
                    </form>
                </div>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-2">
                    جبل بيز لو على jblbizlaw.com خدمة تجريبية حالياً.
                    يرجى عدم رفع أو تخزين مستندات حساسة أو سرية أو محمية بامتياز مهني أو تحتوي على بيانات شخصية.
                </p>
            </div>
        </div>
    );
}
