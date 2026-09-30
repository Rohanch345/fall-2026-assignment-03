import { Router } from 'express';
import { getAllUsers, getUserById, createUser } from '../dal/users.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const users = await getAllUsers();
  res.status(200).json(users);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = await getUserById(id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(200).json(user);
});

router.post('/', authMiddleware, async (req, res) => {
  const { name, email } = req.body ?? {};
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    !name.trim() ||
    !email.trim()
  ) {
    res.status(400).json({ error: 'name and email are required strings' });
    return;
  }

  try {
    const user = await createUser({ name, email });
    res.status(201).json(user);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    throw err;
  }
});

export default router;
