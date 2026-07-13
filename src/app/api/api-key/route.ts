import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST() {
  try {
    const apiKey = "sfb_" + crypto.randomBytes(24).toString("hex");

    await db.settings.upsert({
      where: { id: "default" },
      update: { apiKey },
      create: { id: "default", apiKey },
    });

    return NextResponse.json({ success: true, apiKey });
  } catch (error) {
    console.error("API key error:", error);
    return NextResponse.json(
      { success: false, error: "Xatolik" },
      { status: 500 }
    );
  }
}