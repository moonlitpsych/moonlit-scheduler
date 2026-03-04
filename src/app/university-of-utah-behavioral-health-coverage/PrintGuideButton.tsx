'use client'

export default function PrintGuideButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="coverage-print-hidden inline-flex items-center justify-center rounded-lg border border-[#BF9C73] bg-white px-4 py-2 text-sm font-medium text-[#091747] transition-colors hover:bg-[#BF9C73]/10 focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/40"
      style={{ fontFamily: 'Newsreader, serif' }}
    >
      Print or save this guide
    </button>
  )
}
