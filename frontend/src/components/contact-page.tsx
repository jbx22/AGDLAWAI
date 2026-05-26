"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Send } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";

type Locale = "ar" | "en";

const content = {
    ar: {
        dir: "rtl",
        homeHref: "/",
        switchHref: "/en/contact",
        switchLabel: "English",
        switchFlag: "EN",
        title: "تواصل معنا",
        intro:
            "املأ النموذج وسنراجع طلبك بخصوص العقود، النماذج القانونية، تأسيس الشركات، الضرائب، أو أي احتياج قانوني وتجاري مرتبط بالولايات المتحدة وأوروبا.",
        name: "الاسم الكامل",
        email: "البريد الإلكتروني",
        phone: "رقم الجوال",
        country: "الدولة",
        topic: "موضوع الطلب",
        message: "تفاصيل الطلب",
        placeholder:
            "اكتب ما تحتاجه: عقد، نموذج قانوني، تأسيس شركة، سؤال ضريبي، مراجعة مستند، أو خدمة أخرى...",
        submit: "إرسال الطلب",
        sending: "جار الإرسال...",
        successTitle: "تم استلام طلبك",
        successBody: "سنتواصل معك قريباً عبر البريد الإلكتروني أو رقم الجوال المسجل.",
        back: "العودة للرئيسية",
        error: "تعذر إرسال الطلب الآن. حاول مرة أخرى.",
        topics: [
            "إنشاء نموذج قانوني",
            "مراجعة عقد",
            "تأسيس شركة",
            "ضرائب والتزامات",
            "استفسار مؤسسي",
            "أخرى",
        ],
    },
    en: {
        dir: "ltr",
        homeHref: "/en",
        switchHref: "/contact",
        switchLabel: "العربية",
        switchFlag: "AR",
        title: "Contact us",
        intro:
            "Fill out the form and we will review your request about contracts, legal forms, company setup, tax questions, or other U.S. and European legal-business needs.",
        name: "Full name",
        email: "Email address",
        phone: "Phone number",
        country: "Country",
        topic: "Request topic",
        message: "Request details",
        placeholder:
            "Tell us what you need: contract, legal form, company setup, tax question, document review, or another service...",
        submit: "Send request",
        sending: "Sending...",
        successTitle: "Request received",
        successBody: "We will contact you soon by email or phone.",
        back: "Back to home",
        error: "Could not send the request right now. Please try again.",
        topics: [
            "Legal form generation",
            "Contract review",
            "Company setup",
            "Tax and obligations",
            "Enterprise inquiry",
            "Other",
        ],
    },
} satisfies Record<Locale, Record<string, unknown>>;

export function ContactPage({ locale = "ar" }: { locale?: Locale }) {
    const t = content[locale];
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, locale }),
            });

            if (!response.ok) {
                throw new Error("Contact request failed");
            }

            form.reset();
            setIsSubmitted(true);
        } catch (err) {
            console.error(err);
            setError(t.error as string);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#f7f5ef] text-[#151827]" dir={t.dir as string}>
            <header className="border-b border-[#ded6c3] bg-[#fdfcf8]/95">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
                    <SiteLogo asLink size="md" />
                    <div className="flex items-center gap-2">
                        <Link
                            href={t.switchHref as string}
                            className="inline-flex items-center gap-2 rounded-md border border-[#d8cfbd] bg-white px-3 py-2 text-sm font-semibold text-[#1a1a2e] transition hover:bg-[#f6f1e6]"
                        >
                            <span aria-hidden="true">{t.switchFlag as string}</span>
                            <span>{t.switchLabel as string}</span>
                        </Link>
                        <Link
                            href={t.homeHref as string}
                            className="inline-flex items-center rounded-md bg-[#1a1a2e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b2d4d]"
                        >
                            {t.back as string}
                        </Link>
                    </div>
                </div>
            </header>

            <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[0.85fr_1.15fr] md:px-8 md:py-16">
                <div>
                    <p className="text-sm font-bold text-[#8d7330]">JBL BIZ LAW</p>
                    <h1 className="mt-3 text-4xl font-extrabold text-[#151827] md:text-5xl">
                        {t.title as string}
                    </h1>
                    <p className="mt-5 text-lg leading-9 text-[#55565c]">{t.intro as string}</p>
                </div>

                <div className="rounded-md border border-[#ded6c3] bg-white p-6 shadow-sm md:p-8">
                    {isSubmitted ? (
                        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                            <CheckCircle className="h-14 w-14 text-[#2e7d63]" aria-hidden="true" />
                            <h2 className="mt-5 text-2xl font-extrabold">{t.successTitle as string}</h2>
                            <p className="mt-3 max-w-md leading-8 text-[#55565c]">{t.successBody as string}</p>
                            <Link
                                href={t.homeHref as string}
                                className="mt-7 inline-flex rounded-md bg-[#1a1a2e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2b2d4d]"
                            >
                                {t.back as string}
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="grid gap-5">
                            <div className="grid gap-5 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-[#343640]">
                                    {t.name as string}
                                    <input
                                        name="name"
                                        required
                                        className="rounded-md border border-[#cfc7b6] px-4 py-3 text-base outline-none transition focus:border-[#c9a84c] focus:ring-2 focus:ring-[#eadb9c]"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm font-semibold text-[#343640]">
                                    {t.email as string}
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        className="rounded-md border border-[#cfc7b6] px-4 py-3 text-base outline-none transition focus:border-[#c9a84c] focus:ring-2 focus:ring-[#eadb9c]"
                                    />
                                </label>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2">
                                <label className="grid gap-2 text-sm font-semibold text-[#343640]">
                                    {t.phone as string}
                                    <input
                                        name="phone"
                                        type="tel"
                                        className="rounded-md border border-[#cfc7b6] px-4 py-3 text-base outline-none transition focus:border-[#c9a84c] focus:ring-2 focus:ring-[#eadb9c]"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm font-semibold text-[#343640]">
                                    {t.country as string}
                                    <input
                                        name="country"
                                        className="rounded-md border border-[#cfc7b6] px-4 py-3 text-base outline-none transition focus:border-[#c9a84c] focus:ring-2 focus:ring-[#eadb9c]"
                                    />
                                </label>
                            </div>

                            <label className="grid gap-2 text-sm font-semibold text-[#343640]">
                                {t.topic as string}
                                <select
                                    name="topic"
                                    required
                                    className="rounded-md border border-[#cfc7b6] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c9a84c] focus:ring-2 focus:ring-[#eadb9c]"
                                >
                                    {(t.topics as string[]).map((topic) => (
                                        <option key={topic} value={topic}>
                                            {topic}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="grid gap-2 text-sm font-semibold text-[#343640]">
                                {t.message as string}
                                <textarea
                                    name="message"
                                    rows={7}
                                    required
                                    placeholder={t.placeholder as string}
                                    className="resize-none rounded-md border border-[#cfc7b6] px-4 py-3 text-base leading-8 outline-none transition focus:border-[#c9a84c] focus:ring-2 focus:ring-[#eadb9c]"
                                />
                            </label>

                            {error && (
                                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#c9a84c] px-5 py-3 text-sm font-bold text-[#151827] transition hover:bg-[#d9ba65] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? (
                                    <span>{t.sending as string}</span>
                                ) : (
                                    <>
                                        <Send size={16} aria-hidden="true" />
                                        <span>{t.submit as string}</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    );
}
