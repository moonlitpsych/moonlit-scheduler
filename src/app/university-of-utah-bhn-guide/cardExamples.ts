export interface CardCallout {
  number: number
  /** Short label for the numbered pin legend */
  title: string
  /** Longer explanation shown in the legend card */
  detail: string
  /** Vertical position of the pin as a percentage of image height */
  top: number
  /** Horizontal position of the pin as a percentage of image width */
  left: number
}

export interface CardSide {
  imageSrc: string
  /** Actual pixel width of the PNG — used by Next.js Image for layout calculations */
  imageWidth: number
  /** Actual pixel height of the PNG */
  imageHeight: number
  alt: string
  caption: string
  callouts: CardCallout[]
}

export interface InsuranceCardExample {
  id: string
  title: string
  cardType: 'Regence' | 'UUHP'
  /**
   * When true, renders with amber/warning styling.
   * Use for cards that show the ABSENT indicator — the "what not to assume" comparison.
   */
  isWarning?: boolean
  imageSrc: string
  /** Actual pixel width of the PNG — used by Next.js Image for layout calculations */
  imageWidth: number
  /** Actual pixel height of the PNG */
  imageHeight: number
  alt: string
  caption: string
  /**
   * Only for isWarning cards. Displayed in an amber callout box below the image
   * explaining what to do when you see a card like this.
   */
  warningNote?: string
  callouts: CardCallout[]
  /** Optional back-of-card image and callouts, rendered within the same article card. */
  backSide?: CardSide
}

/**
 * All four card images live in: public/images/hmhi-bhn-cards/
 *
 * After images are placed, fine-tune the top/left percentages so pins
 * align with the correct areas of each card. Values are approximate starting points.
 */
export const insuranceCardExamples: InsuranceCardExample[] = [
  {
    id: 'regence-hmhi-bhn',
    title: 'Example 1 — Regence card with HMHI BHN indicator',
    cardType: 'Regence',
    imageSrc: '/images/hmhi-bhn-cards/Regence_card_HMHIBHN.png',
    imageWidth: 1200,
    imageHeight: 756,
    alt: 'De-identified Regence insurance card for University of Utah employee plan showing HMHI Behavioral Health Network indicator.',
    caption:
      'Example only — not a real member card. Many Regence U of U cards include HMHI BHN language near the lower portion, but layout varies by plan year. There are multiple networks within this payer, so details on your insurance card may vary.',
    callouts: [
      {
        number: 1,
        title: 'Regence logo / medical carrier area',
        detail:
          'This identifies the medical carrier. It does not confirm the behavioral health network — that is shown separately on the card.',
        top: 28,
        left: 22,
      },
      {
        number: 2,
        title: 'HMHI BHN behavioral health indicator',
        detail:
          'This is the most important area to find. Text or a logo referencing HMHI Behavioral Health Network (or "BHN") confirms that outpatient psychiatry and therapy claims may route through this separate network.',
        top: 76,
        left: 27,
      },
    ],
    backSide: {
      imageSrc: '/images/hmhi-bhn-cards/regence_card_HMHIBHN_back.png',
      imageWidth: 1320,
      imageHeight: 756,
      alt: 'Back of de-identified Regence insurance card for University of Utah employee plan, showing member services numbers and dedicated MH Claims / HMHI BHN contact line.',
      caption:
        'Card back — the MH Claims/HMHIBHN* line and the note "Contracts separately with group" confirm the behavioral health carve-out and provide the number to call for eligibility verification.',
      callouts: [
        {
          number: 1,
          title: 'Members Call number',
          detail:
            'General member services. Call this number to confirm which network administers outpatient behavioral health for your specific plan and to verify provider eligibility before scheduling.',
          top: 22,
          left: 62,
        },
        {
          number: 2,
          title: 'HMHI BHN members number',
          detail:
            'This dedicated mental health claims number confirms that behavioral health routes through HMHI BHN separately from medical. The asterisk note "Contracts separately with group" is the plain-language carve-out signal.',
          top: 42,
          left: 62,
        },
      ],
    },
  },
  {
    id: 'uuhp-front-hmhi-bhn',
    title: 'Example 2 — UUHP card with HMHI BHN indicator',
    cardType: 'UUHP',
    imageSrc: '/images/hmhi-bhn-cards/UUHP_card_HMHIBHN.png',
    imageWidth: 1200,
    imageHeight: 756,
    alt: 'De-identified University of Utah Health Plans insurance card front.',
    caption:
      'Card front — UUHP branding identifies the medical carrier. The behavioral health network indicator appears on the back. There are multiple networks within this payer, so details on your insurance card may vary.',
    callouts: [
      {
        number: 1,
        title: 'UUHP plan identifier',
        detail:
          'UUHP branding alone does not tell you who administers behavioral health claims — the carve-out network may differ from the medical network.',
        top: 27,
        left: 21,
      },
    ],
    backSide: {
      imageSrc: '/images/hmhi-bhn-cards/UUHP_card_HMHIBHN_back.png',
      imageWidth: 1200,
      imageHeight: 756,
      alt: 'De-identified back of a University of Utah Health Plans insurance card showing HMHI BHN behavioral health network references and contact details.',
      caption:
        'Card back — many UUHP cards include separate behavioral health contact details here. Check both sides carefully.',
      callouts: [
        {
          number: 1,
          title: 'Member services number',
          detail:
            'Call this number before your first visit and ask specifically about outpatient behavioral health network coverage and which providers are in-network.',
          top: 18,
          left: 20,
        },
        {
          number: 3,
          title: 'Dedicated behavioral health phone line',
          detail:
            'A separate behavioral health number on the back is a strong signal that benefits are administered through a different network than general medical.',
          top: 65,
          left: 15,
        },
        {
          number: 4,
          title: 'BHN / mental health network wording',
          detail:
            'Look for HMHI BHN, Behavioral Health Network, or similar language. This confirms the carve-out arrangement and tells you which network your behavioral health provider must be part of.',
          top: 75,
          left: 15,
        },
      ],
    },
  },
  {
    id: 'uuhp-no-hmhi-bhn',
    title: 'Example 3 — UUHP card without a behavioral health carve-out',
    cardType: 'UUHP',
    imageSrc: '/images/hmhi-bhn-cards/UUHP_card_not_HMHIBHN.png',
    imageWidth: 1200,
    imageHeight: 756,
    alt: 'De-identified University of Utah Health Plans insurance card for a plan where behavioral health is administered directly through UUHP with no separate carve-out network.',
    caption:
      'Example only. Some U of U employee plans administer behavioral health directly through UUHP — no separate carve-out network. If your card looks like this, verify in-network status with UUHP directly rather than asking about HMHI BHN.',
    callouts: [
      {
        number: 1,
        title: 'UUHP plan identifier',
        detail:
          'For plans without a behavioral health carve-out, UUHP administers both medical and behavioral health claims. Being in-network with UUHP for medical care may mean the same network applies to outpatient mental health — but confirm with your provider before your first visit.',
        top: 15,
        left: 22,
      },
    ],
  },
]
