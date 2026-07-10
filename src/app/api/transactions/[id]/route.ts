import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { savingsTransferred } = body;

    const transaction = await db.transaction.update({
      where: { id },
      data: {
        ...(savingsTransferred !== undefined && {
          savingsTransferred,
          confirmedAt: savingsTransferred ? new Date() : null,
        }),
      },
    });

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
    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE transaction error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}