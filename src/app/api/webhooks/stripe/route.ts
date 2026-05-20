import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  try {
    // Lazy import Stripe to avoid build-time errors when STRIPE_SECRET_KEY is not set
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder');

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orderId = session.metadata?.order_id;

      if (orderId) {
        await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid', order_status: 'confirmed' })
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
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 });
  }
}
