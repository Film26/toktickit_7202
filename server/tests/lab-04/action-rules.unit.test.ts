import { describe, expect, it } from 'vitest'
import {
  canMoveAction,
  normalizeActionFields,
  ticketAcceptsActions,
  validateActionFields,
  type ActionFields,
} from '../../src/lib/actionRules'
import { bangkokDayStart } from '../../src/lib/dashboardTime'

// UNIT-01, UNIT-02 (docs/lab-04/tests.md) -- pure Action Taken rules, no DB.

const ticketCreatedAt = new Date('2026-10-01T00:00:00.000Z')
const now = new Date('2026-10-06T05:00:00.000Z')

function fields(overrides: Partial<ActionFields> = {}): ActionFields {
  return {
    actionAt: new Date('2026-10-06T04:00:00.000Z'),
    description: 'Restarted the print spooler',
    result: null,
    status: 'PLANNED',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    ...overrides,
  }
}

describe('UNIT-01 action status moves (BR-08)', () => {
  it.each([
    ['PLANNED', 'IN_PROGRESS', true],
    ['PLANNED', 'COMPLETED', true],
    ['PLANNED', 'CANCELLED', true],
    ['IN_PROGRESS', 'COMPLETED', true],
    ['IN_PROGRESS', 'CANCELLED', true],
    ['IN_PROGRESS', 'PLANNED', false],
    ['COMPLETED', 'PLANNED', false],
    ['COMPLETED', 'COMPLETED', false],
    ['CANCELLED', 'IN_PROGRESS', false],
  ] as const)('%s -> %s allowed: %s', (from, to, expected) => {
    expect(canMoveAction(from, to)).toBe(expected)
  })

  it('only open ticket statuses accept actions (BR-11)', () => {
    expect(ticketAcceptsActions('IN_PROGRESS')).toBe(true)
    expect(ticketAcceptsActions('REOPENED')).toBe(true)
    expect(ticketAcceptsActions('RESOLVED')).toBe(false)
    expect(ticketAcceptsActions('CLOSED')).toBe(false)
    expect(ticketAcceptsActions('CANCELLED')).toBe(false)
  })
})

describe('UNIT-02 merged action validation (BR-06, BR-07, BR-09, BR-10)', () => {
  it('accepts a valid planned action', () => {
    expect(validateActionFields(fields(), ticketCreatedAt, now)).toEqual({})
  })

  it('requires a follow-up note when follow-up is needed', () => {
    expect(validateActionFields(fields({ followUpRequired: true, followUpNote: '  ' }), ticketCreatedAt, now)).toHaveProperty('followUpNote')
  })

  it('requires a result to complete', () => {
    expect(validateActionFields(fields({ status: 'COMPLETED' }), ticketCreatedAt, now)).toHaveProperty('result')
    expect(validateActionFields(fields({ status: 'COMPLETED', result: 'Fixed' }), ticketCreatedAt, now)).toEqual({})
  })

  it('rejects a blank or too-long description', () => {
    expect(validateActionFields(fields({ description: '   ' }), ticketCreatedAt, now)).toHaveProperty('description')
    expect(validateActionFields(fields({ description: 'x'.repeat(2001) }), ticketCreatedAt, now)).toHaveProperty('description')
  })

  it('rejects dates before the ticket, and future dates unless Planned', () => {
    expect(validateActionFields(fields({ actionAt: new Date('2026-09-30T00:00:00Z') }), ticketCreatedAt, now)).toHaveProperty('actionAt')
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000)
    expect(validateActionFields(fields({ actionAt: tomorrow, status: 'PLANNED' }), ticketCreatedAt, now)).toEqual({})
    expect(validateActionFields(fields({ actionAt: tomorrow, status: 'IN_PROGRESS' }), ticketCreatedAt, now)).toHaveProperty('actionAt')
  })

  it('clears the follow-up note when no follow-up is needed and trims text', () => {
    const normalized = normalizeActionFields(fields({ description: '  Did it  ', followUpNote: 'stale note', attachmentNotes: ' ' }))
    expect(normalized.description).toBe('Did it')
    expect(normalized.followUpNote).toBeNull()
    expect(normalized.attachmentNotes).toBeNull()
  })
})

describe('UNIT-03 Bangkok day boundary (BR-22)', () => {
  it('23:30 Bangkok on Oct 6 belongs to Oct 6 (starts 2026-10-05T17:00Z)', () => {
    expect(bangkokDayStart(new Date('2026-10-06T16:30:00.000Z')).toISOString()).toBe('2026-10-05T17:00:00.000Z')
  })

  it('00:30 Bangkok on Oct 7 belongs to Oct 7 (starts 2026-10-06T17:00Z), although it is still Oct 6 in UTC', () => {
    expect(bangkokDayStart(new Date('2026-10-06T17:30:00.000Z')).toISOString()).toBe('2026-10-06T17:00:00.000Z')
  })
})
