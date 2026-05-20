import { supabaseAdmin } from '@/lib/supabase-server';
import OrderStatusBadge from '@/components/OrderStatusBadge';

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
