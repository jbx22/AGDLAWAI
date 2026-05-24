import { providerForModel } from "./llm";
import { createServerSupabase } from "./supabase";

type Db = ReturnType<typeof createServerSupabase>;

type TierPolicy = {
    monthlyAiRequests: number;
    deepseek: boolean;
    openai: boolean;
};

const TIER_POLICIES: Record<string, TierPolicy> = {
    Free: { monthlyAiRequests: 0, deepseek: false, openai: false },
    Professional: { monthlyAiRequests: 30, deepseek: true, openai: false },
    Business: { monthlyAiRequests: 75, deepseek: true, openai: false },
    Enterprise: { monthlyAiRequests: 300, deepseek: true, openai: false },
};

function policyForTier(tier: string | null | undefined): TierPolicy {
    return TIER_POLICIES[tier || ""] ?? TIER_POLICIES.Free;
}

export function monthlyAiRequestsForTier(tier: string | null | undefined): number {
    return policyForTier(tier).monthlyAiRequests;
}

export async function assertAndConsumeAiCredit(
    userId: string,
    model: string,
    db: Db,
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
    const { data, error } = await db
        .from("user_profiles")
        .select("tier, message_credits_used, credits_reset_date")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) return { ok: false, status: 500, detail: error.message };
    if (!data) {
        const { error: createError } = await db
            .from("user_profiles")
            .insert({ user_id: userId, tabular_model: "deepseek-v4-flash" });
        if (createError) {
            return { ok: false, status: 500, detail: createError.message };
        }
        return assertAndConsumeAiCredit(userId, model, db);
    }

    const tier = (data.tier as string | null) || "Free";
    const policy = policyForTier(tier);
    const provider = providerForModel(model);

    if (provider === "deepseek" && !policy.deepseek) {
        return {
            ok: false,
            status: 402,
            detail: "DeepSeek V4 Flash is available on paid memberships only.",
        };
    }

    if (provider === "openai" && !policy.openai) {
        return {
            ok: false,
            status: 402,
            detail: "OpenAI models are not included in the current JBL subscription plans.",
        };
    }

    if (provider !== "deepseek" && provider !== "openai") {
        return {
            ok: false,
            status: 403,
            detail: "This plan only supports DeepSeek V4 Flash.",
        };
    }

    let creditsUsed = Number(data.message_credits_used ?? 0);
    const resetAt = data.credits_reset_date ? new Date(String(data.credits_reset_date)) : null;
    if (!resetAt || Number.isNaN(resetAt.getTime()) || new Date() > resetAt) {
        const nextReset = new Date();
        nextReset.setDate(nextReset.getDate() + 30);
        creditsUsed = 0;
        const { error: resetError } = await db
            .from("user_profiles")
            .update({
                message_credits_used: 0,
                credits_reset_date: nextReset.toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        if (resetError) {
            return { ok: false, status: 500, detail: resetError.message };
        }
    }

    if (creditsUsed >= policy.monthlyAiRequests) {
        return {
            ok: false,
            status: 402,
            detail: `Monthly AI request limit reached for the ${tier} plan.`,
        };
    }

    const { error: updateError } = await db
        .from("user_profiles")
        .update({
            message_credits_used: creditsUsed + 1,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

    if (updateError) {
        return { ok: false, status: 500, detail: updateError.message };
    }

    return { ok: true };
}
