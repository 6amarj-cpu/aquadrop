# AquaDrop MVP Implementation Plan

> **For Hermes:** Use claude-code skill (print mode `-p`) to implement this plan task-by-task. Each task is a separate `claude -p` invocation. Workdir is `/workspace/aquadrop`.

**Goal:** Build a no-login water delivery ordering web app where customers select water products, enter their address, pay via Stripe or crypto, and receive SMS confirmation — all without creating an account.

**Architecture:** Next.js 14 (App Router) full-stack app. PostgreSQL via Supabase. Stripe for card payments. NOWPayments for crypto. Twilio for SMS. Vercel for hosting. No customer auth — orders are tied to a unique token URL for tracking.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Stripe, NOWPayments, Twilio, Vercel

---

## Phase 0: Project Scaffold

### Task 0.1: Initialize Next.js 14 project

**Objective:** Create a fresh Next.js 14 project with TypeScript and Tailwind CSS.

**Files:**
- Create: `/workspace/aquadrop/` (entire project)

**Step 1: Create the project**

Run from `/workspace/`:
```bash
npx create-next-app@14 aquadrop --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

**Step 2: Verify it runs**

```bash
cd /workspace/aquadrop && npm run dev
```
Expected: Dev server starts on http://localhost:3000

**Step 3: Install dependencies**

```bash
npm install @supabase/supabase-js stripe @stripe/stripe-js twilio
npm install -D @types/twilio
```

**Step 4: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js 14 project with TypeScript + Tailwind"
```

---

### Task 0.2: Set up environment variables

**Objective:** Create `.env.local` with all required environment variable placeholders.

**Files:**
- Create: `/workspace/aquadrop/.env.local`
- Create: `/workspace/aquadrop/.env.example`

**Step 1: Create `.env.local`**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# NOWPayments (Crypto)
NOWPAYMENTS_API_KEY=your-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=your-ipn-secret

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 2: Create `.env.example`** (same structure, with placeholder values)

**Step 3: Add `.env.local` to `.gitignore` if not already**

**Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add environment variable templates"
```

---

### Task 0.3: Set up Supabase client

**Objective:** Create Supabase client utilities for browser and server.

**Files:**
- Create: `/workspace/aquadrop/src/lib/supabase-client.ts`
- Create: `/workspace/aquadrop/src/lib/supabase-server.ts`

**Step 1: Browser client (`src/lib/supabase-client.ts`)**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 2: Server client (`src/lib/supabase-server.ts`)**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
```

**Step 3: Commit**

```bash
git add src/lib/
git commit -m "chore: add Supabase client utilities"
```

---

## Phase 1: Database Schema

### Task 1.1: Create database tables

**Objective:** Create all database tables needed for the MVP.

**Files:**
- Create: `/workspace/aquadrop/supabase/migrations/001_initial_schema.sql`

**Step 1: Create migration file**

```sql
-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT '5-gallon jug',
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'water',
  in_stock BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders table (no user_id — no login required)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_instructions TEXT,
  subtotal_cents INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'card', -- 'card' or 'crypto'
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  stripe_payment_intent_id TEXT,
  crypto_payment_id TEXT,
  crypto_currency TEXT,
  order_status TEXT NOT NULL DEFAULT 'placed', -- 'placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_orders_tracking_token ON orders(tracking_token);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read
CREATE POLICY "Anyone can view products" ON products FOR SELECT USING (true);

-- Orders: anyone can create, anyone with tracking token can view (handled in app layer)
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can update orders" ON orders FOR UPDATE USING (true);

-- Order items: anyone can create and view
CREATE POLICY "Anyone can create order items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view order items" ON order_items FOR SELECT USING (true);

-- Insert sample products
INSERT INTO products (name, description, price_cents, unit, category, sort_order) VALUES
  ('Still Purified Water', 'Clean, crisp purified water — perfect for everyday hydration.', 500, '5-gallon jug', 'water', 1),
  ('Alkaline Water', 'pH-balanced alkaline water for optimal wellness.', 800, '5-gallon jug', 'water', 2),
  ('Mineral Spring Water', 'Naturally sourced mineral spring water with essential electrolytes.', 1000, '5-gallon jug', 'water', 3),
  ('Electrolyte Infused (6-Pack)', 'Hydration boost with added electrolytes. 1L bottles.', 1200, '1L x 6-pack', 'water', 4),
  ('Chilled Spring Water (12-Pack)', 'Ready-to-drink chilled spring water. 1L bottles.', 900, '1L x 12-pack', 'water', 5);
```

**Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): create initial schema with products, orders, order_items"
```

---

## Phase 2: Product Catalog & Landing Page

### Task 2.1: Build the landing page with product catalog

**Objective:** Create a beautiful landing page that displays water products and allows adding to cart.

**Files:**
- Modify: `/workspace/aquadrop/src/app/page.tsx`
- Create: `/workspace/aquadrop/src/components/ProductCard.tsx`
- Create: `/workspace/aquadrop/src/components/Cart.tsx`
- Create: `/workspace/aquadrop/src/components/Header.tsx`
- Create: `/workspace/aquadrop/src/lib/products.ts`

**Step 1: Create product fetching utility (`src/lib/products.ts`)**

```typescript
import { supabaseAdmin } from './supabase-server';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  unit: string;
  image_url: string | null;
  category: string;
  in_stock: boolean;
  sort_order: number;
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('in_stock', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}
```

**Step 2: Create ProductCard component (`src/components/ProductCard.tsx`)**

```tsx
'use client';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    unit: string;
    image_url: string | null;
  };
  onAddToCart: (product: { id: string; name: string; price_cents: number; unit: string }) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-40 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <span className="text-6xl">💧</span>
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-lg text-gray-900">{product.name}</h3>
        <p className="text-sm text-gray-500 mt-1">{product.description}</p>
        <p className="text-xs text-gray-400 mt-1">{product.unit}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-bold text-blue-600">
            ${(product.price_cents / 100).toFixed(2)}
          </span>
          <button
            onClick={() => onAddToCart(product)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create Cart component (`src/components/Cart.tsx`)**

```tsx
'use client';

interface CartItem {
  id: string;
  name: string;
  price_cents: number;
  unit: string;
  quantity: number;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export default function Cart({ items, onUpdateQuantity, onRemove, onCheckout }: CartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const deliveryFee = subtotal >= 2000 ? 0 : 300;
  const total = subtotal + deliveryFee;

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl block mb-3">🛒</span>
        <p>Your cart is empty</p>
        <p className="text-sm mt-1">Add some water to get started!</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Your Order</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div className="flex-1">
              <p className="font-medium text-gray-900">{item.name}</p>
              <p className="text-sm text-gray-500">${(item.price_cents / 100).toFixed(2)} / {item.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
              >
                −
              </button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
              >
                +
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="ml-2 text-red-400 hover:text-red-600 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-gray-100 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>${(subtotal / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Delivery</span>
          <span>{deliveryFee === 0 ? 'FREE' : `$${(deliveryFee / 100).toFixed(2)}`}</span>
        </div>
        {subtotal < 2000 && (
          <p className="text-xs text-blue-600">Free delivery on orders over $20!</p>
        )}
        <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>${(total / 100).toFixed(2)}</span>
        </div>
      </div>
      <button
        onClick={onCheckout}
        className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
      >
        Proceed to Checkout →
      </button>
    </div>
  );
}
```

**Step 4: Create Header component (`src/components/Header.tsx`)**

```tsx
export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💧</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            AquaDrop
          </h1>
        </div>
        <p className="text-sm text-gray-500 hidden sm:block">Water delivered. No strings attached.</p>
      </div>
    </header>
  );
}
```

**Step 5: Build the landing page (`src/app/page.tsx`)**

```tsx
'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import Cart from '@/components/Cart';
import { getProducts, Product } from '@/lib/products';
import { useRouter } from 'next/navigation';

interface CartItem {
  id: string;
  name: string;
  price_cents: number;
  unit: string;
  quantity: number;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useState(() => {
    getProducts().then(setProducts).finally(() => setLoading(false));
  });

  const addToCart = (product: { id: string; name: string; price_cents: number; unit: string }) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = () => {
    // Store cart in sessionStorage and redirect to checkout
    sessionStorage.setItem('aquadrop_cart', JSON.stringify(cart));
    router.push('/checkout');
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3">
            Thirsty? <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Sorted.</span>
          </h2>
          <p className="text-lg text-gray-500 max-w-md mx-auto">
            Premium water delivered to your door. No account needed. Pay with card or crypto.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Product Grid */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Water</h3>
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                ))}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-24">
              <Cart
                items={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                onCheckout={handleCheckout}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add product catalog landing page with cart"
```

---

## Phase 3: Checkout Flow

### Task 3.1: Create checkout page with address form

**Objective:** Build the checkout page where customers enter their address and contact info.

**Files:**
- Create: `/workspace/aquadrop/src/app/checkout/page.tsx`
- Create: `/workspace/aquadrop/src/components/CheckoutForm.tsx`

**Step 1: Create checkout page (`src/app/checkout/page.tsx`)**

```tsx
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
    paymentMethod: 'card', // 'card' or 'crypto'
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

      // Clear cart
      sessionStorage.removeItem('aquadrop_cart');

      // Redirect to payment or confirmation
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
          ← Back to shop
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h2>

        {/* Order Summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{item.name} × {item.quantity}</span>
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
                <span className="text-2xl block mb-1">💳</span>
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
                <span className="text-2xl block mb-1">₿</span>
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
```

**Step 2: Commit**

```bash
git add src/app/checkout/
git commit -m "feat: add checkout page with address form and payment method selection"
```

---

### Task 3.2: Create order API route

**Objective:** Build the API endpoint that creates orders in the database.

**Files:**
- Create: `/workspace/aquadrop/src/app/api/orders/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customer, paymentMethod, subtotal_cents, delivery_fee_cents, total_cents } = body;

    // Validate
    if (!items?.length || !customer.phone || !customer.address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create order
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

    // Create order items
    const orderItems = items.map((item: { id: string; name: string; price_cents: number; quantity: number }) => ({
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

    // Handle payment
    if (paymentMethod === 'card') {
      // Create Stripe Checkout Session
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/${order.tracking_token}?paid=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
        metadata: { order_id: order.id, tracking_token: order.tracking_token },
        line_items: items.map((item: { name: string; price_cents: number; quantity: number }) => ({
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
              delivery_estimate: { minimum: { unit: 'hour', value: 1 }, maximum: { unit: 'hour', value: 3 } },
            },
          },
        ],
        phone_number_collection: { enabled: true },
      });

      // Update order with Stripe session ID
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
      // Create crypto payment via NOWPayments
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
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/orders/
git commit -m "feat: add order creation API route with Stripe and crypto support"
```

---

## Phase 4: Order Tracking

### Task 4.1: Create order tracking page

**Objective:** Build a public order tracking page accessible via unique token — no login required.

**Files:**
- Create: `/workspace/aquadrop/src/app/order/[token]/page.tsx`

**Step 1: Create tracking page**

```tsx
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
  { key: 'placed', label: 'Order Placed', emoji: '📝' },
  { key: 'confirmed', label: 'Confirmed', emoji: '✅' },
  { key: 'preparing', label: 'Preparing', emoji: '📦' },
  { key: 'out_for_delivery', label: 'Out for Delivery', emoji: '🚗' },
  { key: 'delivered', label: 'Delivered', emoji: '💧' },
];

function getStatusIndex(status: string): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

export default async function OrderPage({ params }: { params: { token: string } }) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('tracking_token', params.token)
    .single();

  if (!order) notFound();

  const currentStep = getStatusIndex(order.order_status);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Order Status</h2>
          <p className="text-sm text-gray-500 mt-1">
            Token: #{order.tracking_token.slice(0, 8)}
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            {STATUS_STEPS.map((step, i) => (
              <div key={step.key} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    i <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {step.emoji}
                </div>
                <span className="text-xs text-gray-500 mt-2 text-center">{step.label}</span>
                {i < STATUS_STEPS.length - 1 && (
                  <div
                    className={`absolute h-0.5 w-full ${
                      i < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    style={{ transform: 'translateX(50%)' }}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            {order.order_status === 'delivered'
              ? '🎉 Your water has been delivered!'
              : order.order_status === 'out_for_delivery'
              ? '🚗 Your water is on the way!'
              : 'We are preparing your order.'}
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Order Details</h3>
          {order.order_items.map((item: OrderItem) => (
            <div key={item.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{item.product_name} × {item.quantity}</span>
              <span className="text-gray-900">${(item.total_price_cents / 100).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-3 pt-3">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>${(order.total_cents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Delivery Information</h3>
          <p className="text-sm text-gray-600">{order.delivery_address}</p>
          {order.delivery_instructions && (
            <p className="text-sm text-gray-500 mt-2">📝 {order.delivery_instructions}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">📱 {order.customer_phone}</p>
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/order/
git commit -m "feat: add public order tracking page with status progress bar"
```

---

## Phase 5: Webhooks & SMS

### Task 5.1: Create Stripe webhook handler

**Objective:** Handle Stripe payment confirmations and update order status + send SMS.

**Files:**
- Create: `/workspace/aquadrop/src/app/api/webhooks/stripe/route.ts`

**Step 1: Create webhook handler**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  try {
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      const trackingToken = session.metadata?.tracking_token;

      if (orderId) {
        // Update order status
        await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid', order_status: 'confirmed' })
          .eq('id', orderId);

        // Get order details for SMS
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (order) {
          // Send SMS confirmation
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
```

**Step 2: Commit**

```bash
git add src/app/api/webhooks/stripe/
git commit -m "feat: add Stripe webhook handler for payment confirmation"
```

---

### Task 5.2: Create SMS confirmation API

**Objective:** Send SMS order confirmation via Twilio.

**Files:**
- Create: `/workspace/aquadrop/src/app/api/sms/confirm/route.ts`

**Step 1: Create SMS API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phone, trackingToken } = await request.json();

    if (!phone || !trackingToken) {
      return NextResponse.json({ error: 'Missing phone or tracking token' }, { status: 400 });
    }

    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/order/${trackingToken}`;
    const message = `💧 AquaDrop: Your water order is confirmed! Track it here: ${trackingUrl}`;

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
```

**Step 2: Commit**

```bash
git add src/app/api/sms/
git commit -m "feat: add SMS order confirmation via Twilio"
```

---

### Task 5.3: Create NOWPayments webhook handler

**Objective:** Handle crypto payment confirmations from NOWPayments.

**Files:**
- Create: `/workspace/aquadrop/src/app/api/webhooks/nowpayments/route.ts`

**Step 1: Create webhook handler**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify IPN signature
    const rawBody = JSON.stringify(body);
    const signature = crypto
      .createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET!)
      .update(rawBody)
      .digest('hex');

    const receivedSig = request.headers.get('x-nowpayments-sig');
    if (signature !== receivedSig) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

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

      // Send SMS
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*')
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
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/webhooks/nowpayments/
git commit -m "feat: add NOWPayments crypto webhook handler"
```

---

## Phase 6: Admin Dashboard

### Task 6.1: Create admin dashboard

**Objective:** Build a simple admin dashboard to view and manage orders.

**Files:**
- Create: `/workspace/aquadrop/src/app/admin/page.tsx`
- Create: `/workspace/aquadrop/src/app/admin/orders/page.tsx`
- Create: `/workspace/aquadrop/src/components/OrderStatusBadge.tsx`

**Step 1: Create OrderStatusBadge component (`src/components/OrderStatusBadge.tsx`)**

```tsx
const STATUS_COLORS: Record<string, string> = {
  placed: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-yellow-100 text-yellow-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.placed}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
```

**Step 2: Create admin orders page (`src/app/admin/orders/page.tsx`)**

```tsx
import { supabaseAdmin } from '@/lib/supabase-server';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { redirect } from 'next/navigation';

interface Order {
  id: string;
  tracking_token: string;
  customer_name: string | null;
  customer_phone: string;
  delivery_address: string;
  total_cents: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
}

async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

async function updateOrderStatus(orderId: string, newStatus: string) {
  'use server';
  await supabaseAdmin.from('orders').update({ order_status: newStatus }).eq('id', orderId);
  redirect('/admin/orders');
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">💧</span>
            <h1 className="text-lg font-bold text-gray-900">AquaDrop Admin</h1>
          </div>
          <a href="/" className="text-sm text-blue-600 hover:underline">← Back to store</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Orders</h2>

        {orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No orders yet</p>
            <p className="text-sm mt-1">Orders will appear here when customers place them.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Token</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <a
                        href={`/order/${order.tracking_token}`}
                        className="text-blue-600 hover:underline text-sm font-mono"
                      >
                        #{order.tracking_token.slice(0, 8)}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{order.customer_name || '—'}</p>
                      <p className="text-xs text-gray-500">{order.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {order.delivery_address}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${(order.total_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {order.payment_method}
                      </span>
                      <span className={`ml-1 text-xs ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.order_status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/admin/ src/components/OrderStatusBadge.tsx
git commit -m "feat: add admin dashboard for order management"
```

---

## Phase 7: Deployment

### Task 7.1: Configure for Vercel deployment

**Objective:** Ensure the project is ready for Vercel deployment.

**Files:**
- Create: `/workspace/aquadrop/vercel.json`
- Modify: `/workspace/aquadrop/next.config.js`

**Step 1: Create `vercel.json`**

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install"
}
```

**Step 2: Update `next.config.js` for Stripe webhook raw body**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['stripe'],
  },
};

module.exports = nextConfig;
```

**Step 3: Commit**

```bash
git add vercel.json next.config.js
git commit -m "chore: configure for Vercel deployment"
```

---

### Task 7.2: Set up Supabase database

**Objective:** Run the migration against the Supabase project.

**Prerequisite:** User must provide Supabase credentials.

**Step 1: Connect to Supabase**

```bash
supabase link --project-ref <your-project-ref>
```

**Step 2: Run migration**

```bash
supabase db push
```

**Step 3: Verify**

```bash
supabase db lint
```

**Step 4: Commit**

```bash
git add supabase/
git commit -m "chore: apply database migrations"
```

---

## Summary

### Files Created (MVP)

```
aquadrop/
├── docs/plans/2026-05-20-mvp-implementation.md  ← This plan
├── supabase/migrations/001_initial_schema.sql
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← Landing page + product catalog
│   │   ├── layout.tsx                  ← Root layout
│   │   ├── checkout/page.tsx           ← Checkout flow
│   │   ├── order/[token]/page.tsx      ← Order tracking
│   │   ├── admin/orders/page.tsx       ← Admin dashboard
│   │   └── api/
│   │       ├── orders/route.ts         ← Create order
│   │       ├── sms/confirm/route.ts    ← Send SMS
│   │       └── webhooks/
│   │           ├── stripe/route.ts     ← Stripe webhook
│   │           └── nowpayments/route.ts ← Crypto webhook
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── ProductCard.tsx
│   │   ├── Cart.tsx
│   │   └── OrderStatusBadge.tsx
│   └── lib/
│       ├── supabase-client.ts
│       ├── supabase-server.ts
│       └── products.ts
├── .env.local
├── .env.example
├── vercel.json
└── next.config.js
```

### Deployment Pipeline

```
Code push to GitHub main branch
        │
        ▼
  Vercel auto-detects push
        │
        ▼
  npm install + next build
        │
        ▼
  Deployed to https://aquadrop.vercel.app (production)
        │
        ▼
  Supabase PostgreSQL serves data
        │
        ▼
  Stripe + NOWPayments handle payments
        │
        ▼
  Twilio sends SMS confirmations
```

### Environment Variables Needed on Vercel

All variables from `.env.local` must be added in Vercel Dashboard → Project Settings → Environment Variables for both Production and Preview environments.

### Post-MVP Features (v2)

- Subscription/recurring delivery
- Google Places address autocomplete
- Delivery agent mobile app view
- B2B bulk ordering
- Referral program
- Multi-city support
- Push notifications
- Order history via phone number lookup
- Water cooler rental upsell
 