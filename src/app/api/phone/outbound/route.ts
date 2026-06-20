/**
 * Phone Bridge — outbound SMS/call initiation.
 *
 * The companion can send an SMS or initiate a voice call to the human.
 * This is used when the companion wants to reach out proactively
 * (e.g., a memory recall, a check-in, an urgent message).
 *
 * Requires RELAY_SECRET for authentication (per DR-006 security).
 */

import { NextRequest, NextResponse } from "next/server";
import { sendSMS, makeCall, isTwilioConfigured } from "@/lib/phone/twilio";
import { checkRateLimit, getClientIP } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { to, message, type, secret, twimlUrl } = await request.json() as {
      to: string;
      message?: string;
      type: "sms" | "call";
      secret: string;
      twimlUrl?: string;
    };

    // Auth check — must have valid RELAY_SECRET
    const expectedSecret = process.env.RELAY_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: "RELAY_SECRET not configured" }, { status: 503 });
    }
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!to) {
      return NextResponse.json({ error: "Recipient phone number required" }, { status: 400 });
    }

    if (!isTwilioConfigured()) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
    }

    if (type === "sms") {
      if (!message) {
        return NextResponse.json({ error: "Message required for SMS" }, { status: 400 });
      }
      const result = await sendSMS(to, message);
      if (result.success) {
        return NextResponse.json({ ok: true, messageId: result.messageId });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    } else if (type === "call") {
      if (!twimlUrl) {
        return NextResponse.json({ error: "TwiML URL required for calls" }, { status: 400 });
      }
      const result = await makeCall(to, twimlUrl);
      if (result.success) {
        return NextResponse.json({ ok: true, callId: result.callId });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ error: "Invalid type (use 'sms' or 'call')" }, { status: 400 });
  } catch (error) {
    console.error("Phone outbound error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Outbound failed" },
      { status: 500 },
    );
  }
}