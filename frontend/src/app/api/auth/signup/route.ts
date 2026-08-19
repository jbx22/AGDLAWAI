import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/db";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, organisation } = await req.json();

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ detail: "Invalid input" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

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

    // Create user profile
    await supabase.from("user_profiles").insert({
      user_id: data.user.id,
      display_name: name?.trim() || null,
      organisation: organisation?.trim() || null,
      tabular_model: "gpt-5.6-luna",
    });

    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
