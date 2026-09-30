import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { createUser } from '../src/dal/users.js';
import { createTicket } from '../src/dal/tickets.js';
import { User } from '../src/db/database.js';

describe('Part 1: API Integration Tests', () => {
  let user: User;

  beforeEach(async () => {
    user = await createUser({ name: 'Ada Lovelace', email: 'ada@example.com' });
  });

  describe('Auth middleware', () => {
    it('returns 401 when X-User-Id is missing on POST', async () => {
      const res = await request(app)
        .post('/tickets')
        .send({ title: 'No auth' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when X-User-Id is not a valid number', async () => {
      const res = await request(app)
        .post('/tickets')
        .set('X-User-Id', 'abc')
        .send({ title: 'Bad auth' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when X-User-Id is missing on PATCH', async () => {
      const res = await request(app)
        .patch('/tickets/1/status')
        .send({ status: 'DONE' });

      expect(res.status).toBe(401);
    });
  });

  describe('Users', () => {
    it('creates a user and returns 201', async () => {
      const res = await request(app)
        .post('/users')
        .set('X-User-Id', String(user.id))
        .send({ name: 'Grace Hopper', email: 'grace@example.com' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(Number),
        name: 'Grace Hopper',
        email: 'grace@example.com',
      });
    });

    it('returns 400 for an invalid user payload', async () => {
      const res = await request(app)
        .post('/users')
        .set('X-User-Id', String(user.id))
        .send({ name: 'Missing Email' });

      expect(res.status).toBe(400);
    });

    it('returns all users', async () => {
      const res = await request(app).get('/users');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: user.id, name: 'Ada Lovelace' });
    });

    it('returns a single user by id', async () => {
      const res = await request(app).get(`/users/${user.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: user.id, email: 'ada@example.com' });
    });

    it('returns 404 for a non-existent user', async () => {
      const res = await request(app).get('/users/9999');

      expect(res.status).toBe(404);
    });
  });

  describe('Tickets', () => {
    it('creates a ticket using the X-User-Id as creator_id', async () => {
      const res = await request(app)
        .post('/tickets')
        .set('X-User-Id', String(user.id))
        .send({ title: 'Fix login bug', description: 'Users cannot log in' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(Number),
        title: 'Fix login bug',
        description: 'Users cannot log in',
        status: 'TODO',
        creator_id: user.id,
      });
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post('/tickets')
        .set('X-User-Id', String(user.id))
        .send({ description: 'No title' });

      expect(res.status).toBe(400);
    });

    it('returns a single ticket by id', async () => {
      const ticket = await createTicket({
        title: 'Existing',
        creator_id: user.id,
      });

      const res = await request(app).get(`/tickets/${ticket.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: ticket.id, title: 'Existing' });
    });

    it('returns 404 for a non-existent ticket', async () => {
      const res = await request(app).get('/tickets/9999');

      expect(res.status).toBe(404);
    });

    it('paginates tickets with limit and offset', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTicket({ title: `Ticket ${i}`, creator_id: user.id });
      }

      const res = await request(app).get('/tickets?limit=2&offset=2');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((t: { title: string }) => t.title)).toEqual([
        'Ticket 3',
        'Ticket 4',
      ]);
    });

    it('filters tickets by status', async () => {
      await createTicket({ title: 'Todo', creator_id: user.id });
      await createTicket({
        title: 'Done',
        status: 'DONE',
        creator_id: user.id,
      });

      const res = await request(app).get('/tickets?status=DONE');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ title: 'Done', status: 'DONE' });
    });

    it('returns 400 for invalid pagination params', async () => {
      const res = await request(app).get('/tickets?limit=-1');

      expect(res.status).toBe(400);
    });

    it('updates a ticket status and returns 200', async () => {
      const ticket = await createTicket({
        title: 'Move me',
        creator_id: user.id,
      });

      const res = await request(app)
        .patch(`/tickets/${ticket.id}/status`)
        .set('X-User-Id', String(user.id))
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: ticket.id, status: 'IN_PROGRESS' });
    });

    it('returns 400 for an invalid status value', async () => {
      const ticket = await createTicket({ title: 'Bad', creator_id: user.id });

      const res = await request(app)
        .patch(`/tickets/${ticket.id}/status`)
        .set('X-User-Id', String(user.id))
        .send({ status: 'NOPE' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when updating a non-existent ticket', async () => {
      const res = await request(app)
        .patch('/tickets/9999/status')
        .set('X-User-Id', String(user.id))
        .send({ status: 'DONE' });

      expect(res.status).toBe(404);
    });
  });
});
