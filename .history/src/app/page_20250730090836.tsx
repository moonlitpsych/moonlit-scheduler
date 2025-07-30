// src/app/page.tsx
export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-4">
          Moonlit Scheduler
        </h1>
        <p className="text-slate-600 mb-6">
          Healthcare booking system is loading...
        </p>
        <a
          href="/test-tailwind"
          className="btn-primary inline-block"
        >
          Test Tailwind Styles
        </a>
      </div>
    </div>
  )
}