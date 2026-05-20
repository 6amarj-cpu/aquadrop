import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-server';

interface CartItem {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
}

interface Customer {
  name?: string;
  phone: string;
  address: string;
  instructions?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customer, paymentMethod, subtotal_cents, delivery_fee_cents, total_cents } = body as {
      items: CartItem[];
      customer: Customer;
      paymentMethod: string;
      subtotal_cents: number;
      delivery_fee_cents: number;
      total_cents: number;
    };

    if (!items?.length || !customer?.phone || !customer?.address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: customer.name || null,
        customer_phone: customer.phone,
        delivery_address: customer.address,
        delivery_instructions: customer.instructions || null,
        subtotal_cents,
        delivery_fee_cents,
        total_cents,
        payment_method: paymentMethod,
        payment_status: 'pending',
        order_status: 'placed',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.price_cents,
      total_price_cents: item.price_cents * item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    if (paymentMethod === 'card') {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/${order.tracking_token}?paid=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
        metadata: { order_id: order.id, tracking_token: order.tracking_token },
        line_items: items.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: { name: item.name },
            unit_amount: item.price_cents,
          },
          quantity: item.quantity,
        })),
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: delivery_fee_cents, currency: 'usd' },
              display_name: 'Water Delivery',
              delivery_estimate: {
                minimum: { unit: 'hour', value: 1 },
                maximum: { unit: 'hour', value: 3 },
              },
            },
          },
        ],
        phone_number_collection: { enabled: true },
      });

      await supabaseAdmin
        .from('orders')
        .update({ stripe_payment_intent_id: session.id })
        .eq('id', order.id);

      return NextResponse.json({
        order_id: order.id,
        tracking_token: order.tracking_token,
        checkout_url: session.url,
      });
    } else {
      const nowpaymentsResponse = await fetch('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NOWPAYMENTS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_amount: total_cents / 100,
          price_currency: 'usd',
          pay_currency: 'btc',
          order_id: order.id,
          order_description: `AquaDrop Order #${order.tracking_token.slice(0, 8)}`,
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/${order.tracking_token}?paid=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
          ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/nowpayments`,
        }),
      });

      const cryptoData = await nowpaymentsResponse.json();

      return NextResponse.json({
        order_id: order.id,
        tracking_token: order.tracking_token,
        crypto_payment_url: cryptoData.invoice_url,
      });
    }
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
