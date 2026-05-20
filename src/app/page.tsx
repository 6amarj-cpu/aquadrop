import Header from '@/components/Header';
import LandingClient from '@/components/LandingClient';
import { getProducts } from '@/lib/products';

export default async function Home() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      <Header />
      <LandingClient products={products} />
    </main>
  );
}
