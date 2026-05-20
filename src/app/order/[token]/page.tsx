import { supabaseAdmin } from '@/lib/supabase-server';
import Header from '@/components/Header';
import { notFound } from 'next/navigation';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
}

interface Order {
  id: string;
  tracking_token: string;
  customer_name: string | null;
  customer_phone: string;
  delivery_address: string;
  delivery_instructions: string | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  order_items: OrderItem[];
}

const STATUS_STEPS = [
  { key: 'placed', label: 'Placed', emoji: '📝' },
  { key: 'confirmed', label: 'Confirmed', emoji: '✅' },
  { key: 'preparing', label: 'Preparing', emoji: '📦' },
  { key: 'out_for_delivery', label: 'Out for Delivery', emoji: '🚗' },
  { key: 'delivered', label: 'Delivered', emoji: '💧' },
];

function getStatusIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

function getStatusMessage(status: string): string {
  if (status === 'delivered') return '🎉 Your water has been delivered!';
  if (status === 'out_for_delivery') return '🚗 Your water is on the way!';
  if (status === 'preparing') return '📦 We are preparing your order.';
  if (status === 'confirmed') return '✅ Your order has been confirmed.';
  return '📝 Order received — awaiting confirmation.';
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('tracking_token', token)
    .single();

  if (!order) notFound();

  const typedOrder = order as Order;
  const currentStep = getStatusIndex(typedOrder.order_status);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Order Status</h2>
          <p className="text-sm text-gray-500 mt-1">
            Token: #{typedOrder.tracking_token.slice(0, 8)}
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="relative flex items-start justify-between mb-6">
            {/* Connector lines */}
            {STATUS_STEPS.map((_, i) =>
              i < STATUS_STEPS.length - 1 ? (
                <div
                  key={`line-${i}`}
                  className="absolute top-5 h-0.5"
                  style={{
                    left: `calc(${(i / (STATUS_STEPS.length - 1)) * 100}% + 20px)`,
                    right: `calc(${((STATUS_STEPS.length - 2 - i) / (STATUS_STEPS.length - 1)) * 100}% + 20px)`,
                    backgroundColor: i < currentStep ? '#2563eb' : '#e5e7eb',
                  }}
                />
              ) : null
            )}
            {STATUS_STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${
                    i <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {step.emoji}
                </div>
                <span className="text-xs text-gray-500 mt-2 text-center leading-tight">
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600 mt-4">
            {getStatusMessage(typedOrder.order_status)}
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Order Details</h3>
          <div className="space-y-1">
            {typedOrder.order_items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-600">
                  {item.product_name} &times; {item.quantity}
                </span>
                <span className="text-gray-900">
                  ${(item.total_price_cents / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery</span>
              <span>
                {typedOrder.delivery_fee_cents === 0
                  ? 'FREE'
                  : `$${(typedOrder.delivery_fee_cents / 100).toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>${(typedOrder.total_cents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Information */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Delivery Information</h3>
          <p className="text-sm text-gray-600">{typedOrder.delivery_address}</p>
          {typedOrder.delivery_instructions && (
            <p className="text-sm text-gray-500 mt-2">
              📝 {typedOrder.delivery_instructions}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2">📱 {typedOrder.customer_phone}</p>
        </div>
      </div>
    </main>
  );
}
