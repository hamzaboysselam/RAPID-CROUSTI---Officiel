"use client";

export default function Navbar() {
  return (
    <header className="h-16 bg-zinc-950 border-b border-zinc-800 flex items-center justify-end px-6 gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-red-500 flex items-center justify-center text-black font-bold text-sm">
          A
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-white leading-tight">Admin</p>
          <p className="text-xs text-zinc-400 capitalize">Manager</p>
        </div>
      </div>
    </header>
  );
}
