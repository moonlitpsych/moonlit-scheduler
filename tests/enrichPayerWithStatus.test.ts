import type { Payer, PayerWithStatus } from '../src/lib/services/payerStatus'
const assert = require('assert')
const { enrichPayerWithStatus } = require('../src/lib/services/payerStatus')

// Helper to build a base payer
function basePayer(overrides: Partial<Payer>): Payer {
  return {
    id: 'payer-id',
    created_at: null,
    name: 'Test Payer',
    payer_type: null,
    notes: null,
    status_code: null,
    effective_date: null,
    projected_effective_date: null,
    requires_attending: false,
    requires_individual_contract: false,
    state: null,
    ...overrides
  }
}

// Fixture: Active payer
const activePayer = basePayer({
  status_code: 'Approved',
  effective_date: '2000-01-01'
})

// Fixture: Future payer
const futureDate = '2099-01-01'
const futurePayer = basePayer({
  status_code: 'Approved',
  effective_date: futureDate
})

// Fixture: Not accepted payer
const notAcceptedPayer = basePayer({
  status_code: 'Not started'
})

// Assertions
const activeResult: PayerWithStatus = enrichPayerWithStatus(activePayer)
assert.strictEqual(activeResult.acceptanceStatus, 'active')
assert.strictEqual(activeResult.statusMessage, "We're in network with your payer.")

const futureResult: PayerWithStatus = enrichPayerWithStatus(futurePayer)
assert.strictEqual(futureResult.acceptanceStatus, 'future')
const futureExpected = new Date(futureDate).toLocaleDateString()
assert.strictEqual(futureResult.statusMessage, `We'll be in network starting ${futureExpected}.`)

const notAcceptedResult: PayerWithStatus = enrichPayerWithStatus(notAcceptedPayer)
assert.strictEqual(notAcceptedResult.acceptanceStatus, 'not-accepted')
assert.strictEqual(
  notAcceptedResult.statusMessage,
  "We haven't started credentialing with this payer yet. Join our waitlist!"
)

console.log('enrichPayerWithStatus tests passed')

