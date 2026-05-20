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
