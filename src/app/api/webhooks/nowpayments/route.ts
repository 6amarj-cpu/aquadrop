import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const receivedSig = request.headers.get('x-nowpayments-sig');

    const expectedSig = crypto
      .createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET!)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== receivedSig) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    if (body.payment_status === 'finished' || body.payment_status === 'confirmed') {
      const orderId = body.order_id;

      await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'confirmed',
          crypto_payment_id: body.payment_id,
          crypto_currency: body.pay_currency,
        })
        .eq('id', orderId);

      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('customer_phone, tracking_token')
        .eq('id', orderId)
        .single();

      if (order) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sms/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: order.customer_phone,
            trackingToken: order.tracking_token,
          }),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('NOWPayments webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 });
  }
}
