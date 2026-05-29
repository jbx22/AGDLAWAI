"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const copy = {
    ar: {
        title: "تسجيل الدخول",
        active: "دخول",
        alternate: "إنشاء حساب",
        email: "البريد الإلكتروني",
        emailPlaceholder: "أدخل بريدك الإلكتروني",
        password: "كلمة المرور",
        passwordPlaceholder: "أدخل كلمة المرور",
        submit: "تسجيل الدخول",
        loading: "جار تسجيل الدخول...",
        invalid: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        failed: "حدث خطأ أثناء تسجيل الدخول",
        notice:
            "AGD LAW AI خدمة تجريبية حالياً. يرجى عدم رفع أو تخزين مستندات حساسة أو سرية أو محمية بامتياز مهني أو تحتوي على بيانات شخصية.",
    },
    en: {
        title: "Sign in",
        active: "Sign in",
        alternate: "Create account",
        email: "Email",
        emailPlaceholder: "Enter your email",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        submit: "Sign in",
        loading: "Signing in...",
        invalid: "Email or password is incorrect",
        failed: "Something went wrong while signing in",
        notice:
            "AGD LAW AI is currently a demo service. Please do not upload or store sensitive, confidential, privileged, or personally identifiable documents.",
    },
} as const;

export default function LoginPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [callbackUrl, setCallbackUrl] = useState("/assistant");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Redirect already-authenticated users away from login
    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            router.replace(callbackUrl);
        }
    }, [status, session, router, callbackUrl]);

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
    const textAlign = locale === "ar" ? "text-right" : "text-left";
    const signupHref = locale === "ar" ? "/signup" : "/en/signup";
    const t = copy[locale];

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await signIn("credentials", { email, password, redirect: false });
            if (result?.error) {
                setError(t.invalid);
            } else {
                router.push(callbackUrl);
            }
        } catch {
            setError(t.failed);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative" dir={dir} lang={locale}>
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
                    <div className="flex justify-between items-center gap-4 mb-6">
                        <h2 className={`text-2xl font-serif ${textAlign}`}>{t.title}</h2>
                        <div className="bg-gray-100 p-1 rounded-md flex text-xs font-medium">
                            <span className="text-gray-600 px-3 py-1 bg-white rounded-sm shadow-sm">
                                {t.active}
                            </span>
                            <Link href={signupHref} className="px-3 py-1 text-gray-500 hover:text-gray-900">
                                {t.alternate}
                            </Link>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className={textAlign}>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                {t.email}
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t.emailPlaceholder}
                                autoComplete="email"
                                required
                                className="w-full"
                                dir="ltr"
                            />
                        </div>

                        <div className={textAlign}>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                {t.password}
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t.passwordPlaceholder}
                                autoComplete="current-password"
                                required
                                className="w-full"
                                dir="ltr"
                            />
                        </div>

                        {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}

                        <Button type="submit" disabled={loading} className="w-full mt-5 bg-black hover:bg-gray-900 text-white">
                            {loading ? t.loading : t.submit}
                        </Button>
                    </form>
                </div>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-2">{t.notice}</p>
            </div>
        </div>
    );
}
