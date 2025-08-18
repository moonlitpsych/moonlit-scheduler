import type { Database } from '../../types/database.ts'

export type Payer = Database['public']['Tables']['payers']['Row']

export type PayerAcceptanceStatus = 'active' | 'future' | 'not-accepted'

export interface PayerWithStatus extends Payer {
  acceptanceStatus: PayerAcceptanceStatus
  statusMessage: string
}

export function enrichPayerWithStatus(payer: Payer): PayerWithStatus {
  const today = new Date()
  const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
  const projectedDate = payer.projected_effective_date ? new Date(payer.projected_effective_date) : null

  let acceptanceStatus: PayerAcceptanceStatus
  let statusMessage: string

  if (
    payer.credentialing_status === 'Approved' &&
    effectiveDate &&
    effectiveDate <= today
  ) {
    acceptanceStatus = 'active'
    statusMessage = "We're in network with your payer."

    if (payer.requires_attending) {
      statusMessage += " All appointments will be supervised by our attending physician."
    }
  } else if (
    payer.credentialing_status === 'Approved' &&
    effectiveDate &&
    effectiveDate > today
  ) {
    acceptanceStatus = 'future'
    statusMessage = `We'll be in network starting ${effectiveDate.toLocaleDateString()}.`
  } else if (
    projectedDate &&
    projectedDate > today &&
    ['Waiting on them', 'In progress'].includes(payer.credentialing_status || '')
  ) {
    acceptanceStatus = 'future'
    statusMessage = `We're working to accept this insurance by ${projectedDate.toLocaleDateString()}.`
  } else if (
    ['Waiting on them', 'In progress'].includes(payer.credentialing_status || '')
  ) {
    acceptanceStatus = 'future'
    statusMessage = "We're working to get in network with this payer. Join our waitlist!"
  } else {
    acceptanceStatus = 'not-accepted'
    switch (payer.credentialing_status) {
      case 'X Denied or perm. blocked':
        statusMessage = "This payer doesn't accept new providers currently, but you can join our waitlist."
        break
      case 'Blocked':
        statusMessage = "We're temporarily unable to accept this insurance. Join our waitlist for updates."
        break
      case 'On pause':
        statusMessage = "We've paused credentialing with this payer. Join our waitlist for updates."
        break
      case 'Not started':
        statusMessage = "We haven't started credentialing with this payer yet. Join our waitlist!"
        break
      default:
        statusMessage = "We don't currently accept this insurance, but you can join our waitlist."
    }
  }

  return { ...payer, acceptanceStatus, statusMessage }
}
