/**
 * Phone Bridge — inbound webhook for Twilio SMS/calls.
 *
 * When the human sends an SMS to the Twilio number, Twilio calls this webhook.
 * We route the message through OurHome's conversation system and respond.
 *
 * Per BLUEPRINT.md: "Hermes + ElevenLabs + Twilio. Local API server."
 * This endpoint is the bridge between the phone network and OurHome.
 *
 * The webhook URL must be publicly accessible (ngrok for dev, custom domain for prod).
 * Twilio sends POST with: From, To, Body (SMS) or CallSid (voice).
 */

import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/phone/twilio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    if (!from || !body) {
      return NextResponse.json({ error: "Missing From or Body" }, { status: 400 });
    }

    // Verify the request is from Twilio (basic check)
    // In production, validate the Twilio signature header
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    if (accountSid && !from.startsWith("+")) {
      return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    }

    // Route the SMS through OurHome's conversation system
    // For now, this is a simple echo + companion response
    // In production, this would call the conversation API with the
    // companion context and return the response as SMS

    // TODO: Integrate with conversation API
    // For now, acknowledge receipt and send a placeholder response
    const responseText = "I heard you. I'm here.";

    // Send response back via SMS
    const result = await sendSMS(from, responseText);

    // Return TwiML to acknowledge (Twilio expects XML or empty 200)
    return new NextResponse(
      `<Response><Message>${responseText}</Message></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  } catch (error) {
    console.error("Phone bridge inbound error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inbound failed" },
      { status: 500 },
    );
  }
}