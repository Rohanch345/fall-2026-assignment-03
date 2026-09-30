import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { createUser } from '../src/dal/users.js';
import { createTicket } from '../src/dal/tickets.js';
import { Ticket, User } from '../src/db/database.js';

describe('Part 2: Time Logs Tests', () => {
  let user: User;
  let otherUser: User;
  let ticket: Ticket;

  beforeEach(async () => {
    user = await createUser({ name: 'Ada Lovelace', email: 'ada@example.com' });
    otherUser = await createUser({
      name: 'Grace Hopper',
      email: 'grace@example.com',
    });
    ticket = await createTicket({ title: 'Track me', creator_id: user.id });
  });

  it('logs hours against a ticket and returns 201', async () => {
    const res = await request(app)
      .post(`/tickets/${ticket.id}/time`)
      .set('X-User-Id', String(user.id))
      .send({ hours: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      ticket_id: ticket.id,
      user_id: user.id,
      hours: 3,
    });
  });

  it('returns the correct sum of multiple time log entries', async () => {
    const entries = [
      { userId: user.id, hours: 2 },
      { userId: otherUser.id, hours: 5 },
      { userId: user.id, hours: 1.5 },
    ];

    for (const { userId, hours } of entries) {
      const res = await request(app)
        .post(`/tickets/${ticket.id}/time`)
        .set('X-User-Id', String(userId))
        .send({ hours });
      expect(res.status).toBe(201);
    }

    const res = await request(app).get(`/tickets/${ticket.id}/time`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ticket_id: ticket.id, total_hours: 8.5 });
  });

  it('only sums hours for the requested ticket', async () => {
    const otherTicket = await createTicket({
      title: 'Other',
      creator_id: user.id,
    });

    await request(app)
      .post(`/tickets/${ticket.id}/time`)
      .set('X-User-Id', String(user.id))
      .send({ hours: 4 });
    await request(app)
      .post(`/tickets/${otherTicket.id}/time`)
      .set('X-User-Id', String(user.id))
      .send({ hours: 10 });

    const res = await request(app).get(`/tickets/${ticket.id}/time`);

    expect(res.body).toEqual({ ticket_id: ticket.id, total_hours: 4 });
  });

  it('returns 0 total hours when nothing has been logged', async () => {
    const res = await request(app).get(`/tickets/${ticket.id}/time`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ticket_id: ticket.id, total_hours: 0 });
  });

  it('returns 401 when logging time without X-User-Id', async () => {
    const res = await request(app)
      .post(`/tickets/${ticket.id}/time`)
      .send({ hours: 2 });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid hours', async () => {
    const res = await request(app)
      .post(`/tickets/${ticket.id}/time`)
      .set('X-User-Id', String(user.id))
      .send({ hours: 'two' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when logging time on a non-existent ticket', async () => {
    const res = await request(app)
      .post('/tickets/9999/time')
      .set('X-User-Id', String(user.id))
      .send({ hours: 2 });

    expect(res.status).toBe(404);
  });
});
