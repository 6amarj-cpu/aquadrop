'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import Cart from '@/components/Cart';
import type { Product } from '@/lib/products';

interface CartItem {
  id: string;
  name: string;
  price_cents: number;
  unit: string;
  quantity: number;
}

export default function LandingClient({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const router = useRouter();

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
    sessionStorage.setItem('aquadrop_cart', JSON.stringify(cart));
    router.push('/checkout');
  };

  return (
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
          <div className="grid sm:grid-cols-2 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
          </div>
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
  );
}
