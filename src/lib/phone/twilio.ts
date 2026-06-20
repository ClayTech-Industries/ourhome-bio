/**
 * Twilio SMS/Voice Client
 *
 * Sends and receives SMS and voice calls via Twilio.
 * Used by the phone bridge to connect OurHome to the human's phone.
 *
 * Per BLUEPRINT.md: "Hermes + ElevenLabs + Twilio. Local API server."
 * Twilio handles the phone network, Hermes routes messages,
 * ElevenLabs handles voice synthesis/recognition.
 */

// -----------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    return null;
  }

  return { accountSid, authToken, phoneNumber };
}

// -----------------------------------------------------------------
// SMS
// -----------------------------------------------------------------

export async function sendSMS(to: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getTwilioConfig();
  if (!config) {
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: config.phoneNumber,
          Body: body,
        }).toString(),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Twilio error: ${error}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.sid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "SMS failed" };
  }
}

// -----------------------------------------------------------------
// Voice Call
// -----------------------------------------------------------------

export async function makeCall(to: string, twimlUrl: string): Promise<{ success: boolean; callId?: string; error?: string }> {
  const config = getTwilioConfig();
  if (!config) {
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: config.phoneNumber,
          Url: twimlUrl,
        }).toString(),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Twilio call error: ${error}` };
    }

    const data = await response.json();
    return { success: true, callId: data.sid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Call failed" };
  }
}

// -----------------------------------------------------------------
// Validation
// -----------------------------------------------------------------

export function isTwilioConfigured(): boolean {
  return getTwilioConfig() !== null;
}

export function getPhoneNumber(): string | null {
  const config = getTwilioConfig();
  return config?.phoneNumber ?? null;
}