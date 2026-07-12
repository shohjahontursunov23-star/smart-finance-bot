import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST() {
  try {
    const apiKey = "sfb_" + crypto.randomBytes(24).toString("hex");
    const existing = await db.settings.findUnique({ where: { id: "default" } });
    if (existing) {
      await db.settings.update({ where: { id: "default" }, data: { apiKey } });
    } else {
      await db.settings.create({ data: { id: "default", apiKey } });
    }
    return NextResponse.json({ success: true, apiKey });
  } catch (error) {
    console.error("API key error:", error);
    return NextResponse.json({ success: false, error: "Xatolik", details: error instanceof Error ? error.message : "Unknown" }, { status: 500 });
  }
}