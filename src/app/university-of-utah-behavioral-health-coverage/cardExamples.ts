export interface CardCallout {
  number: number
  title: string
  detail: string
  top: number
  left: number
}

export interface InsuranceCardExample {
  id: string
  title: string
  cardType: 'Regence' | 'UUHP'
  /** When true, the card displays with amber/warning styling as a "what the absent indicator looks like" comparison. */
  isWarning?: boolean
  imageSrc: string
  imageWidth: number
  imageHeight: number
  alt: string
  caption: string
  /** Warning explanation shown below the image for isWarning cards. */
  warningNote?: string
  callouts: CardCallout[]
}

// Adjust top/left percentages after images are placed — they are approximate starting points.
// All four PNGs should be dropped into: public/images/hmhi-bhn-cards/
export const insuranceCardExamples: InsuranceCardExample[] = [
  {
    id: 'regence-hmhi-bhn',
    title: 'Regence card with HMHI BHN indicator',
    cardType: 'Regence',
    imageSrc: '/images/hmhi-bhn-cards/Regence_card_HMHIBHN.png',
    imageWidth: 1200,
    imageHeight: 750,
    alt: 'De-identified Regence insurance card showing HMHI Behavioral Health Network indicator for University of Utah employee plan.',
    caption:
      'Example only. Card layouts can change by plan year. The HMHI BHN indicator controls outpatient psychiatry and therapy claims — not the Regence logo.',
    callouts: [
      {
        number: 1,
        title: 'Medical carrier name (Regence)',
        detail:
          'This area identifies the medical carrier. It does not confirm behavioral health network — that is shown separately.',
        top: 30,
        left: 22,
      },
      {
        number: 2,
        title: 'HMHI BHN behavioral health indicator',
        detail:
          'Look for HMHI Behavioral Health Network or BHN text here. This is the network that controls outpatient psychiatry and therapy claims for many U of U employee plans.',
        top: 74,
        left: 72,
      },
      {
        number: 3,
        title: 'Member services / eligibility number',
        detail:
          'If the BHN indicator is unclear, call this number and ask which network administers outpatient behavioral health for your plan.',
        top: 76,
        left: 27,
      },
    ],
  },
  {
    id: 'uuhp-front-hmhi-bhn',
    title: 'UUHP card with HMHI BHN indicator (front)',
    cardType: 'UUHP',
    imageSrc: '/images/hmhi-bhn-cards/UUHP_card_HMHIBHN.png',
    imageWidth: 1200,
    imageHeight: 750,
    alt: 'De-identified University of Utah Health Plans insurance card (front) with HMHI Behavioral Health Network indicator highlighted.',
    caption:
      'UUHP card front example. BHN language may appear on the front or back depending on plan year.',
    callouts: [
      {
        number: 1,
        title: 'UUHP plan identifier',
        detail:
          'UUHP branding on the card does not automatically tell you who administers behavioral health claims.',
        top: 28,
        left: 21,
      },
      {
        number: 2,
        title: 'HMHI BHN behavioral health indicator',
        detail:
          'This text or logo is the key indicator that behavioral health claims may route through HMHI BHN rather than UUHP medical.',
        top: 68,
        left: 70,
      },
      {
        number: 3,
        title: 'Member services number',
        detail:
          'Call this number and ask specifically about outpatient behavioral health network coverage before your first visit.',
        top: 78,
        left: 30,
      },
    ],
  },
  {
    id: 'uuhp-back-hmhi-bhn',
    title: 'UUHP card with HMHI BHN indicator (back)',
    cardType: 'UUHP',
    imageSrc: '/images/hmhi-bhn-cards/UUHP_card_HMHIBHN_back.png',
    imageWidth: 1200,
    imageHeight: 750,
    alt: 'De-identified University of Utah Health Plans insurance card (back) showing HMHI BHN behavioral health network references.',
    caption:
      'Back-of-card examples frequently include separate behavioral or mental health contact details and network identifiers.',
    callouts: [
      {
        number: 1,
        title: 'Behavioral health contact line',
        detail:
          'A dedicated behavioral health number on the back confirms benefits may be administered separately from general medical.',
        top: 32,
        left: 26,
      },
      {
        number: 2,
        title: 'BHN or mental health network wording',
        detail:
          'Look for HMHI BHN, Behavioral Health Network, or similar language near mental health instructions.',
        top: 62,
        left: 73,
      },
      {
        number: 3,
        title: 'Authorization / plan instructions',
        detail:
          'If this section references preauthorization, network rules, or eligibility checks, follow those steps before your first appointment.',
        top: 80,
        left: 47,
      },
    ],
  },
  {
    id: 'uuhp-no-hmhi-bhn',
    title: 'UUHP card without HMHI BHN indicator (comparison example)',
    cardType: 'UUHP',
    isWarning: true,
    imageSrc: '/images/hmhi-bhn-cards/UUHP_card_not_HMHIBHN.png',
    imageWidth: 1200,
    imageHeight: 750,
    alt: 'De-identified University of Utah Health Plans insurance card with no HMHI BHN indicator visible — comparison example for identifying absent behavioral health carve-out language.',
    caption:
      'Comparison example. This card shows no visible HMHI BHN indicator — this does not necessarily mean HMHI BHN is absent. It may mean the wording is on the back, or the plan year uses different language.',
    warningNote:
      'If your card looks like this — no BHN logo or text visible — do not assume behavioral health is covered under the same network as medical. Call the member services number on your card and ask: "Which network administers outpatient behavioral health for my plan?" Then verify with any provider before your first visit.',
    callouts: [
      {
        number: 1,
        title: 'No BHN indicator visible here',
        detail:
          'When this area is absent of HMHI BHN or behavioral health language, the network may still exist — check the back of the card.',
        top: 30,
        left: 22,
      },
      {
        number: 2,
        title: 'General member services number',
        detail:
          'Use this number to ask specifically about behavioral health coverage. Request the name of the network that administers outpatient mental health for your plan.',
        top: 72,
        left: 55,
      },
    ],
  },
]
