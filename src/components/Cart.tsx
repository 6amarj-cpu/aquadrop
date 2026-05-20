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
