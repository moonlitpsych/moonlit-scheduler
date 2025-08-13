'use client'

type Step =
    | 'welcome'
    | 'payer-search'
    | 'calendar'
    | 'insurance-info'
    | 'roi'
    | 'confirmation'

const STEP_ORDER: Step[] = [
    'welcome',
    'payer-search',
    'calendar',
    'insurance-info',
    'roi',
    'confirmation'
]

const LABELS: Record<Step, string> = {
    'welcome': 'Start',
    'payer-search': 'Insurance',
    'calendar': 'Time',
    'insurance-info': 'Details',
    'roi': 'ROI',
    'confirmation': 'Done'
}

export default function BookingProgress({ step }: { step: Step }) {
    const idx = STEP_ORDER.indexOf(step)
    return (
        <div className="w-full px-4 py-3 bg-white/70 backdrop-blur sticky top-0 z-40">
            <ol className="max-w-4xl mx-auto flex items-center gap-2">
                {STEP_ORDER.map((s, i) => {
                    const done = i < idx
                    const current = i === idx
                    return (
                        <li key={s} className="flex-1 flex items-center gap-2">
                            <div className={[
                                "h-2 rounded-full w-full",
                                done ? "bg-[#BF9C73]" : current ? "bg-[#BF9C73]/60" : "bg-stone-200"
                            ].join(' ')} />
                            <span className={[
                                "text-xs whitespace-nowrap",
                                done ? "text-[#BF9C73]" : current ? "text-[#091747]" : "text-stone-400"
                            ].join(' ')}>
                                {LABELS[s]}
                            </span>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
