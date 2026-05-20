import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phone, trackingToken } = await request.json();

    if (!phone || !trackingToken) {
      return NextResponse.json({ error: 'Missing phone or tracking token' }, { status: 400 });
    }

    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/order/${trackingToken}`;
    const message = `AquaDrop: Your water order is confirmed! Track it here: ${trackingUrl}`;

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: process.env.TWILIO_PHONE_NUMBER!,
          Body: message,
        }),
      }
    );

    if (!twilioResponse.ok) {
      console.error('Twilio error:', await twilioResponse.text());
      return NextResponse.json({ error: 'SMS failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SMS error:', error);
    return NextResponse.json({ error: 'SMS failed' }, { status: 500 });
  }
}
