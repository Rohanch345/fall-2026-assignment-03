import { Router } from 'express';
import {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
} from '../dal/tickets.js';
import { insertTimeLog, getTotalHoursForTicket } from '../dal/timeLogs.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

function parseNonNegativeInt(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  const num = Number(value);
  if (typeof value !== 'string' || !Number.isInteger(num) || num < 0) {
    return null;
  }
  return num;
}

router.get('/', async (req, res) => {
  const limit = parseNonNegativeInt(req.query.limit);
  const offset = parseNonNegativeInt(req.query.offset);
  const { status } = req.query;

  if (limit === null || offset === null) {
    res
      .status(400)
      .json({ error: 'limit and offset must be non-negative integers' });
    return;
  }
  if (
    status !== undefined &&
    (typeof status !== 'string' || !VALID_STATUSES.includes(status))
  ) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const tickets = await getAllTickets({ limit, offset, status });
  res.status(200).json(tickets);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const ticket = Number.isInteger(id) ? await getTicketById(id) : undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  res.status(200).json(ticket);
});

router.post('/', authMiddleware, async (req, res) => {
  const { title, description } = req.body ?? {};
  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (
    description !== undefined &&
    description !== null &&
    typeof description !== 'string'
  ) {
    res.status(400).json({ error: 'description must be a string' });
    return;
  }

  try {
    const ticket = await createTicket({
      title,
      description: description ?? null,
      creator_id: res.locals.userId,
    });
    res.status(201).json(ticket);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23503'
    ) {
      res.status(400).json({ error: 'Creator does not exist' });
      return;
    }
    throw err;
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};

  if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const ticket = Number.isInteger(id)
    ? await updateTicketStatus(id, status)
    : undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  res.status(200).json(ticket);
});

router.post('/:id/time', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { hours } = req.body ?? {};

  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
    res.status(400).json({ error: 'hours must be a positive number' });
    return;
  }

  const ticket = Number.isInteger(id) ? await getTicketById(id) : undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  try {
    const timeLog = await insertTimeLog(id, res.locals.userId, hours);
    res.status(201).json(timeLog);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23503'
    ) {
      res.status(400).json({ error: 'User does not exist' });
      return;
    }
    throw err;
  }
});

router.get('/:id/time', async (req, res) => {
  const id = Number(req.params.id);
  const ticket = Number.isInteger(id) ? await getTicketById(id) : undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const totalHours = await getTotalHoursForTicket(id);
  res.status(200).json({ ticket_id: id, total_hours: totalHours });
});

export default router;
