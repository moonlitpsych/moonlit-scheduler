'use client'

export default function PrintGuideButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="coverage-print-hidden inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#BF9C73] bg-white px-5 py-2.5 text-sm font-medium text-[#091747] transition-colors hover:bg-[#FEF8F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF9C73]/50"
      style={{ fontFamily: 'Newsreader, serif' }}
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[#BF9C73]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"
        />
      </svg>
      Print or save this guide
    </button>
  )
}
