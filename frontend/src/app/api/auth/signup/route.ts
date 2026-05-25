import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const DEFAULT_TABULAR_MODEL = "deepseek-v4-flash";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, organisation } = await req.json();
    
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ detail: "Invalid input" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ detail: "Email already registered" }, { status: 409 });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = `scrypt:${crypto.scryptSync(password, salt, 64).toString("hex")}`;

    const [newUser] = await db.insert(users).values({
      email: normalizedEmail,
      password_hash: passwordHash,
      password_salt: salt,
      display_name: name?.trim() || null,
    }).returning();

    await db.insert(userProfiles).values({
      user_id: newUser.id,
      display_name: name?.trim() || null,
      organisation: organisation?.trim() || null,
      tabular_model: DEFAULT_TABULAR_MODEL,
    });

    return NextResponse.json({ ok: true, userId: newUser.id });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
