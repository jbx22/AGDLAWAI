import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/db";
import { envRoleForEmail } from "@/lib/admin";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, organisation } = await req.json();

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      password.length < 6 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json({ detail: "Invalid input" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (envRoleForEmail(normalizedEmail)) {
      return NextResponse.json(
        { detail: "This account must be provisioned by an administrator" },
        { status: 403 }
      );
    }

    // Check if user already exists in Supabase Auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    if (existing) {
      return NextResponse.json(
        { detail: "Email already registered" },
        { status: 409 }
      );
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: name?.trim() || null,
      },
    });

    if (error || !data.user) {
      console.error("Supabase admin createUser error:", error);
      return NextResponse.json(
        { detail: error?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    // The auth.users trigger creates a profile. Upsert keeps the explicit
    // signup metadata without racing or failing on the trigger-created row.
    const { error: profileError } = await supabase.from("user_profiles").upsert(
      {
        user_id: data.user.id,
        display_name: typeof name === "string" ? name.trim() || null : null,
        organisation:
          typeof organisation === "string"
            ? organisation.trim() || null
            : null,
        tabular_model: "deepseek-v4-flash",
      },
      { onConflict: "user_id" }
    );
    if (profileError) {
      console.error("Supabase profile upsert error:", profileError);
      return NextResponse.json(
        { detail: "Failed to create user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
