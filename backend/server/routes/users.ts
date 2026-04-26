import express from 'express';

import { UserRole } from '../../models/UserRole';
import { ok, sendError } from '../response';
import { store, type StoredUser } from '../store';

const router = express.Router();

function sanitize(u: StoredUser) {
  const { passwordHash: _p, ...rest } = u;
  return rest;
}

function resolveUserFromAuth(authHeader: string | undefined): StoredUser | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  if (token.startsWith('mock-')) {
    const id = token.slice('mock-'.length);
    return store.users.get(id) ?? null;
  }
  const first = [...store.users.values()][0];
  return first ?? null;
}

router.get('/me', (req, res) => {
  const user = resolveUserFromAuth(req.headers.authorization);
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
  return res.json(ok(sanitize(user)));
});

router.get('/', (req, res) => {
  const role = req.query.role as string | undefined;
  const search = (req.query.search as string | undefined)?.toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  let list = [...store.users.values()].map(sanitize);
  if (role) list = list.filter((u) => u.role === role);
  if (search) {
    list = list.filter(
      (u) =>
        u.email.toLowerCase().includes(search) ||
        u.name.toLowerCase().includes(search) ||
        u.id.toLowerCase().includes(search),
    );
  }
  const total = list.length;
  const start = (page - 1) * limit;
  const slice = list.slice(start, start + limit);
  const totalPages = Math.ceil(total / limit) || 1;

  return res.json({
    success: true,
    data: slice,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  });
});

router.get('/:id', (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) return sendError(res, 404, 'NOT_FOUND', 'User not found');
  return res.json(ok(sanitize(user)));
});

router.post('/', (req, res) => {
  const { email, name, phone, role } = req.body as {
    email?: string;
    name?: string;
    phone?: string;
    role?: string;
  };
  if (!email?.trim() || !name?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'email and name are required');
  }
  if ([...store.users.values()].some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return sendError(res, 409, 'CONFLICT', 'Email already registered');
  }
  const t = new Date().toISOString();
  const id = store.newId();
  const row: StoredUser = {
    id,
    email: email.trim(),
    name: name.trim(),
    phone: phone?.trim(),
    role: (role as UserRole) || UserRole.OWNER,
    pets: [],
    createdAt: t,
    updatedAt: t,
    isEmailVerified: false,
  };
  store.users.set(id, row);
  return res.status(201).json(ok(sanitize(row), 'User created'));
});

router.put('/:id', (req, res) => {
  const user = store.users.get(req.params.id);
  if (!user) return sendError(res, 404, 'NOT_FOUND', 'User not found');
  const { name, phone, role, isEmailVerified } = req.body as Partial<StoredUser>;
  const next: StoredUser = {
    ...user,
    ...(name !== undefined ? { name: String(name) } : {}),
    ...(phone !== undefined ? { phone: String(phone) } : {}),
    ...(role !== undefined ? { role: role as UserRole } : {}),
    ...(isEmailVerified !== undefined ? { isEmailVerified: Boolean(isEmailVerified) } : {}),
    updatedAt: new Date().toISOString(),
  };
  store.users.set(user.id, next);
  return res.json(ok(sanitize(next), 'User updated'));
});

router.delete('/:id', (req, res) => {
  if (!store.users.delete(req.params.id)) {
    return sendError(res, 404, 'NOT_FOUND', 'User not found');
  }
  return res.json(ok(null, 'User deleted'));
});

export default router;
