import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    FileSearch,
    Gavel,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { SiteLogo } from "@/components/site-logo";

type Locale = "ar" | "en";

type Plan = {
    id: string;
    name: string;
    price: string;
    cadence: string;
    body: string;
    features: string[];
    featured?: boolean;
};

const content = {
    ar: {
        dir: "rtl",
        otherHref: "/en",
        otherLabel: "English",
        otherFlag: "🇺🇸",
        open: "افتح المنصة",
        nav: ["الهوية", "الرسالة والرؤية", "الأهداف", "الاشتراكات", "تواصل معنا"],
        badge: "ذكاء قانوني عملي للمتحدثين بالعربية",
        title: "JBL يساعد المتحدثين بالعربية على فهم القانون الأمريكي والأوروبي والعمل به بثقة.",
        intro:
            "منصة JBL BIZ LAW ترشد المستخدمين إلى إنشاء النماذج القانونية والعقود، تأسيس الشركات، فهم الالتزامات الضريبية، ومراجعة المستندات وفق سياق واضح للقانون الأمريكي والأوروبي.",
        signup: "إنشاء حساب",
        login: "تسجيل الدخول",
        identityKicker: "هوية الموقع",
        identityTitle: "منصة قانونية وتجارية تساعدك على تحويل السؤال القانوني إلى مستند أو خطوة عملية.",
        pillars: [
            [
                "إرشاد للمتحدثين بالعربية",
                "تشرح المنصة مفاهيم القانون الأمريكي والأوروبي بلغة واضحة وتساعد المستخدم العربي على معرفة ما يحتاجه قبل إعداد النماذج أو اتخاذ خطوة تجارية.",
            ],
            [
                "نماذج وعقود وشركات",
                "تساعد في إنشاء ومراجعة النماذج القانونية والعقود، مستندات تأسيس الشركات، سياسات الامتثال، ومسارات العمل المرتبطة بالأعمال.",
            ],
            [
                "ضرائب ومخاطر وتزامات",
                "تقدم إرشادا أوليا لفهم الضرائب، المخاطر، والالتزامات، مع التأكيد أن المخرجات تساعد المختص ولا تستبدل الاستشارة القانونية أو الضريبية البشرية.",
            ],
        ],
        missionTitle: "الرسالة",
        mission:
            "رسالتنا أن نساعد المتحدثين بالعربية على الوصول إلى القانون الأمريكي والأوروبي بطريقة عملية ومفهومة، من خلال إرشادهم إلى إنشاء النماذج القانونية والعقود، تجهيز مستندات تأسيس الشركات، فهم المتطلبات الضريبية، ومراجعة الالتزامات والمخاطر بخطوات واضحة.",
        visionTitle: "الرؤية",
        vision:
            "رؤيتنا أن تصبح JBL BIZ LAW الجسر القانوني الرقمي للمتحدثين بالعربية عند التعامل مع الولايات المتحدة وأوروبا، بحيث تساعد الأفراد ورواد الأعمال والشركات على الانتقال من الفكرة إلى مستند قانوني أو إجراء تجاري منظم بسرعة ودقة.",
        goalsTitle: "الأهداف",
        goals: [
            "مساعدة المستخدمين على إنشاء عقود ونماذج قانونية قابلة للمراجعة والتخصيص.",
            "توجيه رواد الأعمال في خطوات تأسيس الشركات والامتثال التجاري في الولايات المتحدة وأوروبا.",
            "تبسيط فهم الضرائب، الالتزامات، والمخاطر القانونية بلغة عربية واضحة.",
            "توفير مساعد قانوني ذكي يعتمد على DeepSeek V4 Flash فقط داخل المنصة.",
        ],
        pricingTitle: "باقات الاشتراك",
        pricingIntro:
            "استخدام الذكاء الاصطناعي متاح للعضويات المدفوعة فقط، ويعمل داخل JBL BIZ LAW عبر DeepSeek V4 Flash.",
        choose: "اشترك الآن",
        freeCta: "إنشاء حساب",
        contact: "تواصل معنا",
        finalTitle: "ابدأ بسؤال قانوني أو مستند واحد، ثم حوّله إلى نموذج أو عقد أو خطة عمل واضحة.",
        finalCta: "الدخول إلى المساعد",
    },
    en: {
        dir: "ltr",
        otherHref: "/",
        otherLabel: "العربية",
        otherFlag: "🇸🇦",
        open: "Open app",
        nav: ["Identity", "Mission & vision", "Goals", "Pricing", "Contact"],
        badge: "Practical legal AI for Arabic speakers",
        title: "JBL helps Arabic speakers navigate U.S. and European law with confidence.",
        intro:
            "JBL BIZ LAW guides users through legal forms, contracts, company setup, tax-law questions, document review, and more under clear U.S. and European legal context.",
        signup: "Create account",
        login: "Log in",
        identityKicker: "Website identity",
        identityTitle: "A legal and business platform that turns legal questions into practical documents and next steps.",
        pillars: [
            [
                "Guidance for Arabic speakers",
                "The platform explains U.S. and European legal concepts in clear language and helps Arabic-speaking users understand what they need before preparing forms or taking business action.",
            ],
            [
                "Forms, contracts, companies",
                "JBL helps generate and review legal forms, contracts, company-formation documents, compliance policies, and business legal workflows.",
            ],
            [
                "Tax, risk, and obligations",
                "It provides first-pass guidance on taxes, risks, and obligations while making clear that outputs support professionals and do not replace human legal or tax advice.",
            ],
        ],
        missionTitle: "Mission",
        mission:
            "Our mission is to help Arabic speakers access U.S. and European law in a practical, understandable way by guiding them through legal forms, contracts, company setup documents, tax requirements, obligations, and risk review with clear steps.",
        visionTitle: "Vision",
        vision:
            "Our vision is for JBL BIZ LAW to become the digital legal bridge for Arabic speakers dealing with the United States and Europe, helping individuals, entrepreneurs, and companies move from an idea to a legal document or organized business action quickly and accurately.",
        goalsTitle: "Goals",
        goals: [
            "Help users generate legal forms and contracts that can be reviewed and customized.",
            "Guide entrepreneurs through company setup and business compliance in the United States and Europe.",
            "Simplify tax, obligation, and legal-risk concepts in clear Arabic and English.",
            "Provide an AI legal assistant powered only by DeepSeek V4 Flash inside the platform.",
        ],
        pricingTitle: "Subscription tiers",
        pricingIntro:
            "AI usage is available for paid memberships only, and JBL BIZ LAW runs on DeepSeek V4 Flash inside the platform.",
        choose: "Subscribe now",
        freeCta: "Create account",
        contact: "Contact us",
        finalTitle: "Start with one legal question or document, then turn it into a form, contract, or clear action plan.",
        finalCta: "Go to assistant",
    },
} satisfies Record<Locale, Record<string, unknown>>;

const plans = {
    ar: [
        {
            id: "free",
            name: "الأساسي",
            price: "مجاني",
            cadence: "للتصفح",
            body: "لإنشاء حساب وتجربة الواجهة",
            features: [
                "لا يشمل استخدام الذكاء الاصطناعي",
                "الترقية مطلوبة لاستخدام DeepSeek V4 Flash",
                "مناسب لاستكشاف المنصة",
            ],
        },
        {
            id: "professional",
            name: "المهني",
            price: "99 ر.س",
            cadence: "شهريا",
            body: "للمحامين والمستشارين",
            features: [
                "DeepSeek V4 Flash فقط",
                "200 طلب ذكاء اصطناعي شهريا",
                "إنشاء ومراجعة عقود ونماذج ومستندات",
            ],
            featured: true,
        },
        {
            id: "business",
            name: "الأعمال",
            price: "299 ر.س",
            cadence: "شهريا",
            body: "للشركات والفرق الصغيرة",
            features: [
                "DeepSeek V4 Flash فقط",
                "1,000 طلب ذكاء اصطناعي شهريا",
                "مسارات عمل للشركات والعقود والضرائب",
            ],
        },
        {
            id: "enterprise",
            name: "المؤسسي",
            price: "حسب الاحتياج",
            cadence: "اتفاق سنوي",
            body: "للجهات ذات المتطلبات الخاصة",
            features: [
                "DeepSeek V4 Flash فقط",
                "5,000 طلب شهري مبدئيا",
                "حوكمة وتكاملات ودعم إعداد",
            ],
        },
    ],
    en: [
        {
            id: "free",
            name: "Basic",
            price: "Free",
            cadence: "browse",
            body: "For account setup and interface review",
            features: [
                "No AI model usage included",
                "Upgrade required for DeepSeek V4 Flash",
                "Useful for exploring the platform",
            ],
        },
        {
            id: "professional",
            name: "Professional",
            price: "SAR 99",
            cadence: "monthly",
            body: "For lawyers and consultants",
            features: [
                "DeepSeek V4 Flash only",
                "200 AI requests per month",
                "Generate and review contracts, forms, and documents",
            ],
            featured: true,
        },
        {
            id: "business",
            name: "Business",
            price: "SAR 299",
            cadence: "monthly",
            body: "For companies and small teams",
            features: [
                "DeepSeek V4 Flash only",
                "1,000 AI requests per month",
                "Workflows for companies, contracts, and tax questions",
            ],
        },
        {
            id: "enterprise",
            name: "Enterprise",
            price: "Custom",
            cadence: "annual agreement",
            body: "For specialized requirements",
            features: [
                "DeepSeek V4 Flash only",
                "5,000 monthly requests to start",
                "Governance, integrations, setup support",
            ],
        },
    ],
} satisfies Record<Locale, Plan[]>;

function localizedPath(locale: Locale, path: string) {
    return locale === "ar" ? path : `/en${path}`;
}

function LanguageSwitcher({ locale }: { locale: Locale }) {
    const t = content[locale];
    return (
        <Link
            href={t.otherHref as string}
            className="inline-flex items-center gap-2 rounded-md border border-[#d8cfbd] bg-white px-3 py-2 text-sm font-semibold text-[#1a1a2e] transition hover:bg-[#f6f1e6]"
        >
            <span aria-hidden="true">{t.otherFlag as string}</span>
            <span>{t.otherLabel as string}</span>
        </Link>
    );
}

function SubscribeButton({
    plan,
    locale,
    label,
}: {
    plan: Plan;
    locale: Locale;
    label: string;
}) {
    if (plan.id === "free") {
        return (
            <Link
                href="/signup"
                className="mt-7 inline-flex w-full items-center justify-center rounded-md border border-[#1a1a2e] px-4 py-3 text-sm font-bold text-[#1a1a2e] transition hover:bg-[#1a1a2e] hover:text-white"
            >
                {label}
            </Link>
        );
    }

    if (plan.id === "enterprise") {
        return (
            <Link
                href={localizedPath(locale, "/contact")}
                className="mt-7 inline-flex w-full items-center justify-center rounded-md border border-[#1a1a2e] px-4 py-3 text-sm font-bold text-[#1a1a2e] transition hover:bg-[#1a1a2e] hover:text-white"
            >
                {label}
            </Link>
        );
    }

    return (
        <form action="/api/billing/moyasar/checkout" method="post" className="mt-7">
            <input type="hidden" name="plan" value={plan.id} />
            <input type="hidden" name="locale" value={locale} />
            <button
                type="submit"
                className={`inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-bold transition ${
                    plan.featured
                        ? "bg-[#c9a84c] text-[#151827] hover:bg-[#d9ba65]"
                        : "border border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white"
                }`}
            >
                {label}
            </button>
        </form>
    );
}

export function HomePage({ locale = "ar" }: { locale?: Locale }) {
    const t = content[locale];
    const Icon = locale === "ar" ? ArrowLeft : ArrowRight;
    const navTargets = ["#identity", "#mission", "#goals", "#pricing", localizedPath(locale, "/contact")];

    return (
        <main className="min-h-screen bg-[#f7f5ef] text-[#151827]" dir={t.dir as string}>
            <header className="border-b border-[#ded6c3] bg-[#fdfcf8]/95">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
                    <SiteLogo asLink size="md" />
                    <nav className="hidden items-center gap-7 text-sm font-semibold text-[#45423b] lg:flex">
                        {(t.nav as string[]).map((item, index) => (
                            <a key={item} href={navTargets[index]} className="hover:text-[#1a1a2e]">
                                {item}
                            </a>
                        ))}
                    </nav>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher locale={locale} />
                        <Link
                            href="/assistant"
                            className="inline-flex items-center gap-2 rounded-md bg-[#1a1a2e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b2d4d]"
                        >
                            {t.open as string}
                            <Icon size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </header>

            <section className="bg-[#fdfcf8]">
                <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-20">
                    <div className="flex flex-col justify-center">
                        <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-md border border-[#d6c68f] bg-[#fbf4db] px-3 py-1 text-sm font-semibold text-[#7b6220]">
                            <Sparkles size={16} aria-hidden="true" />
                            {t.badge as string}
                        </p>
                        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-[#151827] md:text-6xl">
                            {t.title as string}
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-9 text-[#4b4b52]">{t.intro as string}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                href="/signup"
                                className="inline-flex items-center gap-2 rounded-md bg-[#c9a84c] px-5 py-3 text-sm font-bold text-[#151827] transition hover:bg-[#d9ba65]"
                            >
                                {t.signup as string}
                                <Icon size={16} aria-hidden="true" />
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 rounded-md border border-[#1a1a2e] px-5 py-3 text-sm font-bold text-[#1a1a2e] transition hover:bg-[#1a1a2e] hover:text-white"
                            >
                                {t.login as string}
                            </Link>
                            <Link
                                href={localizedPath(locale, "/contact")}
                                className="inline-flex items-center gap-2 rounded-md border border-[#c9a84c] px-5 py-3 text-sm font-bold text-[#7b6220] transition hover:bg-[#fbf4db]"
                            >
                                {t.contact as string}
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-center justify-center rounded-md border border-[#ded6c3] bg-white p-8 shadow-sm">
                        <img
                            src="/jbl-logo.png"
                            alt="JBL BIZ LAW"
                            className="h-auto max-h-[420px] w-full max-w-[520px] object-contain"
                        />
                    </div>
                </div>
            </section>

            <section id="identity" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
                <p className="text-sm font-bold text-[#8d7330]">{t.identityKicker as string}</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-extrabold text-[#151827] md:text-4xl">
                    {t.identityTitle as string}
                </h2>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {(t.pillars as string[][]).map(([title, body], index) => {
                        const PillarIcon = [Gavel, ShieldCheck, FileSearch][index];
                        return (
                            <article key={title} className="rounded-md border border-[#ded6c3] bg-white p-6">
                                <PillarIcon size={24} className="mb-5 text-[#2e7d63]" aria-hidden="true" />
                                <h3 className="text-xl font-bold text-[#151827]">{title}</h3>
                                <p className="mt-4 leading-8 text-[#55565c]">{body}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section id="mission" className="bg-white">
                <div className="mx-auto grid max-w-7xl gap-5 px-5 py-16 md:grid-cols-2 md:px-8">
                    <article className="rounded-md border border-[#ded6c3] p-7">
                        <p className="text-sm font-bold text-[#8d7330]">{t.missionTitle as string}</p>
                        <p className="mt-4 text-lg leading-9 text-[#55565c]">{t.mission as string}</p>
                    </article>
                    <article className="rounded-md border border-[#ded6c3] p-7">
                        <p className="text-sm font-bold text-[#8d7330]">{t.visionTitle as string}</p>
                        <p className="mt-4 text-lg leading-9 text-[#55565c]">{t.vision as string}</p>
                    </article>
                </div>
            </section>

            <section id="goals" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
                <div className="grid gap-8 md:grid-cols-[0.7fr_1.3fr]">
                    <h2 className="text-3xl font-extrabold text-[#151827]">{t.goalsTitle as string}</h2>
                    <div className="grid gap-3">
                        {(t.goals as string[]).map((goal) => (
                            <div key={goal} className="flex items-start gap-3 rounded-md border border-[#ded6c3] bg-white p-4">
                                <Check size={20} className="mt-1 shrink-0 text-[#2e7d63]" aria-hidden="true" />
                                <p className="leading-7 text-[#42444c]">{goal}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="pricing" className="bg-[#fdfcf8]">
                <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
                    <div className="max-w-3xl">
                        <p className="text-sm font-bold text-[#8d7330]">{t.pricingTitle as string}</p>
                        <h2 className="mt-3 text-3xl font-extrabold text-[#151827] md:text-4xl">
                            {t.pricingIntro as string}
                        </h2>
                    </div>
                    <div className="mt-9 grid gap-4 lg:grid-cols-4">
                        {plans[locale].map((plan) => (
                            <article
                                key={plan.id}
                                className={`rounded-md border p-6 ${
                                    plan.featured
                                        ? "border-[#c9a84c] bg-[#1a1a2e] text-white shadow-lg"
                                        : "border-[#ded6c3] bg-white text-[#151827]"
                                }`}
                            >
                                <p className={`text-sm font-bold ${plan.featured ? "text-[#c9a84c]" : "text-[#8d7330]"}`}>
                                    {plan.body}
                                </p>
                                <h3 className="mt-2 text-2xl font-extrabold">{plan.name}</h3>
                                <div className="mt-5">
                                    <span className="text-3xl font-extrabold">{plan.price}</span>
                                    <span className={`mx-2 text-sm ${plan.featured ? "text-white/70" : "text-[#666]"}`}>
                                        {plan.cadence}
                                    </span>
                                </div>
                                <ul className="mt-6 space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm leading-6">
                                            <Check
                                                size={16}
                                                className={`mt-1 shrink-0 ${plan.featured ? "text-[#c9a84c]" : "text-[#2e7d63]"}`}
                                                aria-hidden="true"
                                            />
                                            <span className={plan.featured ? "text-white/85" : "text-[#4d4f57]"}>
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <SubscribeButton
                                    plan={plan}
                                    locale={locale}
                                    label={
                                        plan.id === "free"
                                            ? (t.freeCta as string)
                                            : plan.id === "enterprise"
                                              ? (t.contact as string)
                                              : (t.choose as string)
                                    }
                                />
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-[#1a1a2e] text-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-12 md:flex-row md:items-center md:justify-between md:px-8">
                    <h2 className="max-w-3xl text-3xl font-extrabold">{t.finalTitle as string}</h2>
                    <Link
                        href="/assistant"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-[#1a1a2e] transition hover:bg-[#f2ead7]"
                    >
                        {t.finalCta as string}
                        <Icon size={16} aria-hidden="true" />
                    </Link>
                </div>
            </section>
        </main>
    );
}
