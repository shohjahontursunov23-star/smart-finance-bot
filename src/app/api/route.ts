import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", engine: "better-sqlite3", message: "Smart Finance Bot is running" });
}