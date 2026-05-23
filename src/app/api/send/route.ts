import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

function sendTelegramMessage(token: string, chatId: string, text: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sendSms(to: string, body: string): Promise<any> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  if (!twilioSid || !twilioToken || !twilioFrom) {
    return Promise.resolve({ ok: false, error: 'SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER' });
  }
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    const payload = new URLSearchParams({ To: to, From: twilioFrom, Body: body }).toString();
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, raw: body }); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const { message, secret, platform = 'telegram', to } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Bad Request: message is required' }, { status: 400 });
    }

    const EXPECTED_SECRET = process.env.RELAY_SECRET || 'nova';
    if (secret !== EXPECTED_SECRET) {
      return NextResponse.json({ error: 'Forbidden: invalid secret' }, { status: 403 });
    }

    if (platform === 'telegram') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken) return NextResponse.json({ error: 'Telegram bot token not configured' }, { status: 500 });
      const result = await sendTelegramMessage(botToken, chatId || '', message);
      return NextResponse.json({ ok: true, platform: 'telegram', sent: result.ok === true, result });
    } else if (platform === 'sms') {
      if (!to) return NextResponse.json({ error: 'Missing field: to (phone number)' }, { status: 400 });
      const result = await sendSms(to, message);
      return NextResponse.json({ ok: true, platform: 'sms', sent: result.sid !== undefined, result });
    } else {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
