"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const copy = {
    ar: {
        title: "إنشاء حساب",
        login: "تسجيل الدخول",
        active: "إنشاء حساب",
        name: "الاسم",
        optional: "اختياري",
        namePlaceholder: "اسمك",
        organisation: "الجهة",
        organisationPlaceholder: "اسم الجهة",
        email: "البريد الإلكتروني",
        emailPlaceholder: "أدخل بريدك الإلكتروني",
        password: "كلمة المرور",
        passwordPlaceholder: "أنشئ كلمة مرور من 6 أحرف على الأقل",
        confirmPassword: "تأكيد كلمة المرور",
        confirmPasswordPlaceholder: "أعد إدخال كلمة المرور",
        submit: "إنشاء الحساب",
        loading: "جار إنشاء الحساب...",
        passwordsMismatch: "كلمتا المرور غير متطابقتين",
        passwordTooShort: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل",
        failed: "حدث خطأ أثناء إنشاء الحساب",
        successTitle: "تم إنشاء الحساب",
        successBody: "جار تحويلك إلى الصفحة الرئيسية...",
        termsStart: "بإنشاء الحساب فإنك توافق على",
        terms: "شروط الاستخدام",
        and: "و",
        privacy: "سياسة الخصوصية",
        notice:
            "AGD LAW AI خدمة تجريبية حالياً. يرجى عدم رفع أو تخزين مستندات حساسة أو سرية أو محمية بامتياز مهني أو تحتوي على بيانات شخصية.",
    },
    en: {
        title: "Create account",
        login: "Sign in",
        active: "Create account",
        name: "Name",
        optional: "optional",
        namePlaceholder: "Your name",
        organisation: "Organization",
        organisationPlaceholder: "Organization name",
        email: "Email",
        emailPlaceholder: "Enter your email",
        password: "Password",
        passwordPlaceholder: "Create a password, at least 6 characters",
        confirmPassword: "Confirm password",
        confirmPasswordPlaceholder: "Re-enter your password",
        submit: "Create account",
        loading: "Creating account...",
        passwordsMismatch: "Passwords do not match",
        passwordTooShort: "Password must be at least 6 characters",
        failed: "Something went wrong while creating the account",
        successTitle: "Account created",
        successBody: "Redirecting you to the app...",
        termsStart: "By creating an account, you agree to the",
        terms: "Terms of Use",
        and: "and",
        privacy: "Privacy Policy",
        notice:
            "AGD LAW AI is currently a demo service. Please do not upload or store sensitive, confidential, privileged, or personally identifiable documents.",
    },
} as const;

export default function SignupPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [callbackUrl, setCallbackUrl] = useState("/assistant");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [organisation, setOrganisation] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Redirect already-authenticated users away from signup
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
    const loginHref = locale === "ar" ? "/login" : "/en/login";
    const t = copy[locale];

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError(t.passwordsMismatch);
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError(t.passwordTooShort);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password,
                    name: name.trim() || undefined,
                    organisation: organisation.trim() || undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data?.detail || t.failed);
            }

            setSuccess(true);
            await signIn("credentials", { email, password, redirect: false });
            setTimeout(() => {
                router.push(callbackUrl);
            }, 2000);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : t.failed);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative" dir={dir} lang={locale}>
                <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                    <SiteLogo size="md" className="md:text-4xl" asLink />
                </div>
                <div className="w-full max-w-md">
                    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                        <div className="mx-auto w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">{t.successTitle}</h2>
                        <p className="text-gray-600 leading-relaxed">{t.successBody}</p>
                    </div>
                </div>
            </div>
        );
    }

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
                            <Link href={loginHref} className="px-3 py-1 text-gray-500 hover:text-gray-900">
                                {t.login}
                            </Link>
                            <span className="px-3 py-1 bg-white rounded-sm shadow-sm text-gray-900">{t.active}</span>
                        </div>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className={textAlign}>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                {t.name} <span className="text-gray-400 font-normal">({t.optional})</span>
                            </label>
                            <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className="w-full" />
                        </div>

                        <div className={textAlign}>
                            <label htmlFor="organisation" className="block text-sm font-medium text-gray-700 mb-2">
                                {t.organisation} <span className="text-gray-400 font-normal">({t.optional})</span>
                            </label>
                            <Input id="organisation" type="text" value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder={t.organisationPlaceholder} className="w-full" />
                        </div>

                        <div className={textAlign}>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                {t.email}
                            </label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} autoComplete="new-email" required className="w-full" dir="ltr" />
                        </div>

                        <div className={textAlign}>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                {t.password}
                            </label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder} autoComplete="new-password" required className="w-full" dir="ltr" />
                        </div>

                        <div className={textAlign}>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                {t.confirmPassword}
                            </label>
                            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.confirmPasswordPlaceholder} autoComplete="new-password" required className="w-full" dir="ltr" />
                        </div>

                        {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}

                        <Button type="submit" disabled={loading} className="w-full bg-black hover:bg-gray-900 text-white">
                            {loading ? t.loading : t.submit}
                        </Button>
                    </form>

                    <div className="mt-4 text-center text-xs text-gray-500">
                        {t.termsStart}{" "}
                        <Link href="https://agdlawai.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {t.terms}
                        </Link>{" "}
                        {t.and}{" "}
                        <Link href="https://agdlawai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {t.privacy}
                        </Link>
                    </div>
                </div>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-2">{t.notice}</p>
            </div>
        </div>
    );
}
