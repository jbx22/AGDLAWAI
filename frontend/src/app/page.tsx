import Link from "next/link";
import {
    ArrowLeft,
    BadgeCheck,
    Building2,
    Check,
    FileSearch,
    Gavel,
    LockKeyhole,
    ShieldCheck,
    Sparkles,
    Users,
} from "lucide-react";
import { SiteLogo } from "@/components/site-logo";

const identityPillars = [
    {
        title: "هوية المنصة",
        body: "جبل بيز لو منصة عربية للذكاء القانوني والتجاري، مصممة للمحامين، الإدارات القانونية، ورواد الأعمال الذين يحتاجون إلى قراءة أسرع وفهم أدق للمستندات.",
        icon: Gavel,
    },
    {
        title: "وعد العلامة",
        body: "تحويل المستندات المعقدة إلى قرارات عملية قابلة للتنفيذ، مع الحفاظ على دور المختص القانوني في المراجعة والحكم النهائي.",
        icon: ShieldCheck,
    },
    {
        title: "أسلوب العمل",
        body: "دقة، وضوح، قابلية تتبع، وتجربة عربية افتراضية تراعي اللغة القانونية والسياق التجاري في المنطقة.",
        icon: FileSearch,
    },
];

const goals = [
    "تقليل وقت مراجعة العقود والمستندات المتكررة.",
    "توحيد منهجية التحليل داخل الفرق القانونية والتجارية.",
    "رفع جودة التقارير القانونية قبل الاجتماعات أو التفاوض.",
    "إتاحة أدوات ذكاء اصطناعي مهنية باللغة العربية من اليوم الأول.",
];

const tiers = [
    {
        name: "الأساسي",
        audience: "للأفراد والتجربة المهنية",
        price: "مجاني",
        cadence: "للبداية",
        features: [
            "مساعد قانوني وتجاري أساسي",
            "مشاريع محدودة لتنظيم العمل",
            "نماذج سير عمل جاهزة",
            "استخدام مفاتيح API الشخصية",
        ],
        cta: "ابدأ التجربة",
        href: "/signup",
    },
    {
        name: "المهني",
        audience: "للمحامين والمستشارين",
        price: "99 ر.س",
        cadence: "شهريا",
        featured: true,
        features: [
            "مراجعات مستندات أكثر",
            "تحليل عقود وجداول مقارنة",
            "حفظ المحادثات وسجل المشاريع",
            "أولوية في سرعة المعالجة",
        ],
        cta: "اختر المهني",
        href: "/signup",
    },
    {
        name: "الأعمال",
        audience: "للشركات والفرق الصغيرة",
        price: "299 ر.س",
        cadence: "شهريا",
        features: [
            "مساحات عمل ومشاريع مشتركة",
            "صلاحيات أعضاء الفريق",
            "قوالب مراجعة قابلة للتخصيص",
            "تقارير ملخصة للإدارة",
        ],
        cta: "ابدأ للأعمال",
        href: "/signup",
    },
    {
        name: "المؤسسي",
        audience: "للجهات ذات المتطلبات الخاصة",
        price: "حسب الاحتياج",
        cadence: "اتفاق سنوي",
        features: [
            "إعدادات أمن وحوكمة متقدمة",
            "تكاملات تخزين وسير عمل مخصصة",
            "حدود استخدام مخصصة",
            "دعم إعداد وتدريب للفريق",
        ],
        cta: "تواصل معنا",
        href: "/support",
    },
];

const metrics = [
    { value: "عربي", label: "افتراضي في الواجهة والمحتوى" },
    { value: "17", label: "جدولا منظما للبيانات والمشاريع" },
    { value: "24/7", label: "مساعد متاح عند الحاجة" },
];

export default function HomePage() {
    return (
        <main className="min-h-screen bg-[#f7f5ef] text-[#151827]" dir="rtl">
            <header className="border-b border-[#ded6c3] bg-[#fdfcf8]/95">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
                    <SiteLogo asLink size="md" />
                    <nav className="hidden items-center gap-7 text-sm font-semibold text-[#45423b] md:flex">
                        <a href="#identity" className="hover:text-[#1a1a2e]">الهوية</a>
                        <a href="#mission" className="hover:text-[#1a1a2e]">الرسالة والرؤية</a>
                        <a href="#goals" className="hover:text-[#1a1a2e]">الأهداف</a>
                        <a href="#pricing" className="hover:text-[#1a1a2e]">الاشتراكات</a>
                    </nav>
                    <Link
                        href="/assistant"
                        className="inline-flex items-center gap-2 rounded-md bg-[#1a1a2e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b2d4d]"
                    >
                        افتح المنصة
                        <ArrowLeft size={16} aria-hidden="true" />
                    </Link>
                </div>
            </header>

            <section className="bg-[#fdfcf8]">
                <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-20">
                    <div className="flex flex-col justify-center">
                        <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-md border border-[#d6c68f] bg-[#fbf4db] px-3 py-1 text-sm font-semibold text-[#7b6220]">
                            <Sparkles size={16} aria-hidden="true" />
                            منصة قانونية وتجارية عربية أولا
                        </p>
                        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-[#151827] md:text-6xl">
                            ذكاء قانوني عملي للمستندات، العقود، وقرارات الأعمال.
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-9 text-[#4b4b52]">
                            جبل بيز لو يساعدك على فهم المستندات بسرعة، استخراج البنود المهمة، بناء مراجعات منظمة، ومشاركة النتائج مع فريقك بلغة عربية واضحة.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                href="/signup"
                                className="inline-flex items-center gap-2 rounded-md bg-[#c9a84c] px-5 py-3 text-sm font-bold text-[#151827] transition hover:bg-[#d9ba65]"
                            >
                                إنشاء حساب
                                <ArrowLeft size={16} aria-hidden="true" />
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 rounded-md border border-[#1a1a2e] px-5 py-3 text-sm font-bold text-[#1a1a2e] transition hover:bg-[#1a1a2e] hover:text-white"
                            >
                                تسجيل الدخول
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-md border border-[#ded6c3] bg-white shadow-sm">
                        <div className="border-b border-[#e7dfcf] px-5 py-4">
                            <p className="text-sm font-bold text-[#1a1a2e]">لوحة مراجعة مستند</p>
                            <p className="mt-1 text-xs text-[#69645a]">مثال على تجربة العمل داخل المنصة</p>
                        </div>
                        <div className="grid gap-4 p-5">
                            <div className="rounded-md bg-[#f5f7fb] p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-sm font-bold text-[#1a1a2e]">ملخص العقد</span>
                                    <BadgeCheck size={18} className="text-[#2e7d63]" aria-hidden="true" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-2 rounded bg-[#1a1a2e]/80" />
                                    <div className="h-2 w-5/6 rounded bg-[#c9a84c]/80" />
                                    <div className="h-2 w-2/3 rounded bg-[#2e7d63]/70" />
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-md border border-[#e5dfd1] p-4">
                                    <LockKeyhole size={18} className="mb-3 text-[#1a1a2e]" aria-hidden="true" />
                                    <p className="text-sm font-bold">حوكمة وصلاحيات</p>
                                    <p className="mt-2 text-xs leading-6 text-[#666]">تنظيم الوصول حسب المشروع والفريق.</p>
                                </div>
                                <div className="rounded-md border border-[#e5dfd1] p-4">
                                    <Users size={18} className="mb-3 text-[#1a1a2e]" aria-hidden="true" />
                                    <p className="text-sm font-bold">تعاون مهني</p>
                                    <p className="mt-2 text-xs leading-6 text-[#666]">محادثات، مستندات، ومراجعات في مكان واحد.</p>
                                </div>
                            </div>
                            <div className="rounded-md bg-[#151827] p-4 text-white">
                                <p className="text-sm font-bold">سؤال جاهز</p>
                                <p className="mt-2 text-sm leading-7 text-white/80">
                                    استخرج التزامات الإنهاء، مدد الإشعار، وأي مخاطر تجارية غير معتادة.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-[#ded6c3] bg-[#1a1a2e] text-white">
                <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-3 md:px-8">
                    {metrics.map((metric) => (
                        <div key={metric.label}>
                            <p className="text-3xl font-extrabold text-[#c9a84c]">{metric.value}</p>
                            <p className="mt-2 text-sm text-white/75">{metric.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="identity" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
                <div className="max-w-3xl">
                    <p className="text-sm font-bold text-[#8d7330]">هوية الموقع</p>
                    <h2 className="mt-3 text-3xl font-extrabold text-[#151827] md:text-4xl">
                        علامة مهنية هادئة، واضحة، ومبنية على الثقة.
                    </h2>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {identityPillars.map((item) => {
                        const Icon = item.icon;
                        return (
                            <article key={item.title} className="rounded-md border border-[#ded6c3] bg-white p-6">
                                <Icon size={24} className="mb-5 text-[#2e7d63]" aria-hidden="true" />
                                <h3 className="text-xl font-bold text-[#151827]">{item.title}</h3>
                                <p className="mt-4 leading-8 text-[#55565c]">{item.body}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section id="mission" className="bg-white">
                <div className="mx-auto grid max-w-7xl gap-5 px-5 py-16 md:grid-cols-2 md:px-8">
                    <article className="rounded-md border border-[#ded6c3] p-7">
                        <p className="text-sm font-bold text-[#8d7330]">الرسالة</p>
                        <h2 className="mt-3 text-2xl font-extrabold">تمكين المهنيين من اتخاذ قرارات أوضح.</h2>
                        <p className="mt-4 leading-8 text-[#55565c]">
                            رسالتنا هي جعل التحليل القانوني والتجاري أسرع وأكثر تنظيما، عبر أدوات ذكاء اصطناعي تساعد في القراءة، المقارنة، التلخيص، واكتشاف المخاطر دون استبدال الخبرة البشرية.
                        </p>
                    </article>
                    <article className="rounded-md border border-[#ded6c3] p-7">
                        <p className="text-sm font-bold text-[#8d7330]">الرؤية</p>
                        <h2 className="mt-3 text-2xl font-extrabold">أن تكون المنصة العربية المرجعية للعمل القانوني المدعوم بالذكاء الاصطناعي.</h2>
                        <p className="mt-4 leading-8 text-[#55565c]">
                            نطمح إلى بناء بيئة عمل موثوقة تربط بين المستندات، المعرفة، وسير العمل، وتمنح الفرق القانونية والتجارية في المنطقة ميزة إنتاجية قابلة للقياس.
                        </p>
                    </article>
                </div>
            </section>

            <section id="goals" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
                <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
                    <div>
                        <p className="text-sm font-bold text-[#8d7330]">الأهداف</p>
                        <h2 className="mt-3 text-3xl font-extrabold text-[#151827]">أهداف واضحة وقابلة للتحويل إلى منتج.</h2>
                    </div>
                    <div className="grid gap-3">
                        {goals.map((goal) => (
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
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                        <div className="max-w-3xl">
                            <p className="text-sm font-bold text-[#8d7330]">باقات الاشتراك</p>
                            <h2 className="mt-3 text-3xl font-extrabold text-[#151827] md:text-4xl">
                                تسعير تدريجي يناسب التجربة، الفرد، الفريق، والمؤسسة.
                            </h2>
                        </div>
                        <p className="max-w-md text-sm leading-7 text-[#666]">
                            الباقات مبنية وفق أفضل ممارسات SaaS: بداية منخفضة الاحتكاك، ترقية عند زيادة الاستخدام، وخطة مؤسسية للحوكمة والتكامل.
                        </p>
                    </div>

                    <div className="mt-9 grid gap-4 lg:grid-cols-4">
                        {tiers.map((tier) => (
                            <article
                                key={tier.name}
                                className={`rounded-md border p-6 ${
                                    tier.featured
                                        ? "border-[#c9a84c] bg-[#1a1a2e] text-white shadow-lg"
                                        : "border-[#ded6c3] bg-white text-[#151827]"
                                }`}
                            >
                                <div className="flex min-h-28 flex-col">
                                    <p className={`text-sm font-bold ${tier.featured ? "text-[#c9a84c]" : "text-[#8d7330]"}`}>
                                        {tier.audience}
                                    </p>
                                    <h3 className="mt-2 text-2xl font-extrabold">{tier.name}</h3>
                                    <div className="mt-5">
                                        <span className="text-3xl font-extrabold">{tier.price}</span>
                                        <span className={`me-2 text-sm ${tier.featured ? "text-white/70" : "text-[#666]"}`}>
                                            {tier.cadence}
                                        </span>
                                    </div>
                                </div>
                                <ul className="mt-6 space-y-3">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm leading-6">
                                            <Check size={16} className={`mt-1 shrink-0 ${tier.featured ? "text-[#c9a84c]" : "text-[#2e7d63]"}`} aria-hidden="true" />
                                            <span className={tier.featured ? "text-white/85" : "text-[#4d4f57]"}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={tier.href}
                                    className={`mt-7 inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-bold transition ${
                                        tier.featured
                                            ? "bg-[#c9a84c] text-[#151827] hover:bg-[#d9ba65]"
                                            : "border border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white"
                                    }`}
                                >
                                    {tier.cta}
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-[#1a1a2e] text-white">
                <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-12 md:flex-row md:items-center md:justify-between md:px-8">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-bold text-[#c9a84c]">
                            <Building2 size={18} aria-hidden="true" />
                            جاهز للعمل القانوني والتجاري اليومي
                        </p>
                        <h2 className="mt-3 text-3xl font-extrabold">ابدأ بمستند واحد، ثم ابن سير عمل كامل لفريقك.</h2>
                    </div>
                    <Link
                        href="/assistant"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold text-[#1a1a2e] transition hover:bg-[#f2ead7]"
                    >
                        الدخول إلى المساعد
                        <ArrowLeft size={16} aria-hidden="true" />
                    </Link>
                </div>
            </section>
        </main>
    );
}
