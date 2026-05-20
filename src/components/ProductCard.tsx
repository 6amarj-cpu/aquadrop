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
