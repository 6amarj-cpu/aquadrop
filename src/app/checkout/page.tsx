'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

interface CartItem {
  id: string;
  name: string;
  price_cents: number;
  unit: string;
  quantity: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    instructions: '',
    paymentMethod: 'card',
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('aquadrop_cart');
    if (stored) {
      const items = JSON.parse(stored);
      if (items.length === 0) {
        router.push('/');
        return;
      }
      setCart(items);
    } else {
      router.push('/');
    }
  }, [router]);

  const subtotal = cart.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const deliveryFee = subtotal >= 2000 ? 0 : 300;
  const total = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          customer: {
            name: form.name,
            phone: form.phone,
            address: form.address,
            instructions: form.instructions,
          },
          paymentMethod: form.paymentMethod,
          subtotal_cents: subtotal,
          delivery_fee_cents: deliveryFee,
          total_cents: total,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Order failed');

      sessionStorage.removeItem('aquadrop_cart');

      if (form.paymentMethod === 'crypto' && data.crypto_payment_url) {
        window.location.href = data.crypto_payment_url;
      } else if (form.paymentMethod === 'card' && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        router.push(`/order/${data.tracking_token}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-blue-600 text-sm mb-6 hover:underline">
          &larr; Back to shop
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h2>

        {/* Order Summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{item.name} &times; {item.quantity}</span>
              <span className="text-gray-900">${((item.price_cents * item.quantity) / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery</span>
              <span>{deliveryFee === 0 ? 'FREE' : `$${(deliveryFee / 100).toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>${(total / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Checkout Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="John Doe"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
            <p className="text-xs text-gray-400 mt-1">For delivery updates via SMS</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
            <textarea
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Main St, Apt 4B, New York, NY 10001"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Instructions (optional)</label>
            <input
              type="text"
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Leave at door, Gate code: 1234, etc."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, paymentMethod: 'card' })}
                className={`p-4 rounded-xl border-2 text-center transition ${
                  form.paymentMethod === 'card'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-1">&#x1F4B3;</span>
                <span className="text-sm font-medium">Card</span>
                <span className="text-xs text-gray-400 block">Visa, MC, Apple Pay</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, paymentMethod: 'crypto' })}
                className={`p-4 rounded-xl border-2 text-center transition ${
                  form.paymentMethod === 'crypto'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-1">&#x20BF;</span>
                <span className="text-sm font-medium">Crypto</span>
                <span className="text-xs text-gray-400 block">BTC, ETH, USDC, SOL</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : `Pay $${(total / 100).toFixed(2)}`}
          </button>

          <p className="text-xs text-gray-400 text-center">
            No account needed. Your order tracking link will be sent via SMS.
          </p>
        </form>
      </div>
    </main>
  );
}
