import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { savingsTransferred } = body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE txns SET
        savingsTransferred = ?,
        confirmedAt = ?,
        updatedAt = ?
      WHERE id = ?
    `).run(savingsTransferred ? 1 : 0, savingsTransferred ? now : null, now, id);

    const transaction = db.prepare("SELECT * FROM txns WHERE id = ?").get(id);
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("PATCH transaction error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    db.prepare("DELETE FROM txns WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE transaction error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}