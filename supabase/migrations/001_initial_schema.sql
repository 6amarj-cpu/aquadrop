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
  tracking_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
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
