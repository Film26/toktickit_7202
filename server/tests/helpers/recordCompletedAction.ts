import request from 'supertest'
import app from '../../src/app'

// Lab 4 resolution gate (docs/lab-04/specification.md BR-15): a Ticket can
// only be Resolved once it has a Completed Action Taken. Lab 1-3 tests that
// resolve a ticket call this first -- an intentional regression update
// logged in docs/lab-04/tests.md section 4.
export async function recordCompletedAction(ticketId: number, staffToken: string) {
  const response = await request(app)
    .post(`/api/tickets/${ticketId}/actions`)
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ description: 'Investigated and fixed the reported problem', status: 'COMPLETED', result: 'Problem fixed' })
  if (response.status !== 201) throw new Error(`recordCompletedAction failed: ${response.status} ${JSON.stringify(response.body)}`)
  return response.body
}
