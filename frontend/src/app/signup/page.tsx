"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { CheckCircle2 } from "lucide-react";
import { signIn } from "next-auth/react";

export default function SignupPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [callbackUrl, setCallbackUrl] = useState("/assistant");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [organisation, setOrganisation] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

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
    const loginHref = locale === "ar" ? "/login" : "/login?lang=en";

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate passwords match
        if (password !== confirmPassword) {
            setError("كلمتا المرور غير متطابقتين");
            setLoading(false);
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل");
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
                throw new Error(data?.detail || "حدث خطأ أثناء إنشاء الحساب");
            }

            setSuccess(true);
            await signIn("credentials", { email, password, redirect: false });
            setTimeout(() => {
                router.push(callbackUrl);
            }, 2000);
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "حدث خطأ أثناء إنشاء الحساب",
            );
        } finally {
            setLoading(false);
        }
    };

    // Success View
    if (success) {
        return (
            <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative" dir={dir}>
                <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                    <SiteLogo size="md" className="md:text-4xl" asLink />
                </div>
                <div className="w-full max-w-md">
                    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                        <div className="mx-auto w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                            تم إنشاء الحساب
                        </h2>
                        <p className="text-gray-600 leading-relaxed">
                            جار تحويلك إلى الصفحة الرئيسية...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Default Signup Form View
    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative" dir={dir}>
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-left text-2xl font-serif">
                            إنشاء حساب
                        </h2>
                        <div className="bg-gray-100 p-1 rounded-md flex text-xs font-medium">
                            <Link
                                href={loginHref}
                                className="px-3 py-1 text-gray-500 hover:text-gray-900"
                            >
                                تسجيل الدخول
                            </Link>
                            <span className="px-3 py-1 bg-white rounded-sm shadow-sm text-gray-900">
                                إنشاء حساب
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div>
                            <label
                                htmlFor="name"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                الاسم{" "}
                                <span className="text-gray-400 font-normal">
                                    (اختياري)
                                </span>
                            </label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="اسمك"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="organisation"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                الجهة{" "}
                                <span className="text-gray-400 font-normal">
                                    (اختياري)
                                </span>
                            </label>
                            <Input
                                id="organisation"
                                type="text"
                                value={organisation}
                                onChange={(e) =>
                                    setOrganisation(e.target.value)
                                }
                                placeholder="اسم الجهة"
                                className="w-full"
                            />
                        </div>

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
                                placeholder="أنشئ كلمة مرور (6 أحرف على الأقل)"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                تأكيد كلمة المرور
                            </label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder="أعد إدخال كلمة المرور"
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
                            className="w-full bg-black hover:bg-gray-900 text-white"
                        >
                            {loading ? "جار إنشاء الحساب..." : "إنشاء الحساب"}
                        </Button>
                    </form>

                    {/* Terms and Privacy */}
                    <div className="mt-4 text-center text-xs text-gray-500">
                        بإنشاء الحساب فإنك توافق على{" "}
                        <Link
                            href="https://jblbizlaw.com/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            شروط الاستخدام
                        </Link>{" "}
                        و{" "}
                        <Link
                            href="https://jblbizlaw.com/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            سياسة الخصوصية
                        </Link>
                    </div>
                </div>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-2">
                    جبل بيز لو على jblbizlaw.com خدمة تجريبية حالياً.
                    يرجى عدم رفع أو تخزين مستندات حساسة أو سرية أو محمية بامتياز مهني أو تحتوي على بيانات شخصية.
                </p>
            </div>
        </div>
    );
}
