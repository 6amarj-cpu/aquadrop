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
