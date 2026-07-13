import { NextResponse } from "next/server";
import db from "@/lib/db";
import crypto from "crypto";

export async function POST() {
  try {
    const apiKey = "sfb_" + crypto.randomBytes(24).toString("hex");
    const now = new Date().toISOString();

    db.prepare("UPDATE Settings SET apiKey = ?, updatedAt = ? WHERE id = 'default'").run(apiKey, now);

    return NextResponse.json({ success: true, apiKey });
  } catch (error) {
    console.error("API key error:", error);
    return NextResponse.json({ success: false, error: "Xatolik" }, { status: 500 });
  }
}