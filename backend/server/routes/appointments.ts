import express from 'express';

import { AppointmentStatus, AppointmentType } from '../../models/Appointment';
import { ok, sendError } from '../response';
import { store, type StoredAppointment } from '../store';

const router = express.Router();

function toResponse(a: StoredAppointment) {
  return {
    success: true as const,
    data: a,
    timestamp: new Date().toISOString(),
  };
}

router.get('/', (req, res) => {
  const petId = req.query.petId as string | undefined;
  let list = [...store.appointments.values()];
  if (petId) list = list.filter((a) => a.petId === petId);
  list.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return res.json({
    success: true,
    data: list,
    total: list.length,
    timestamp: new Date().toISOString(),
  });
});

router.get('/:id', (req, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');
  return res.json(toResponse(row));
});

router.post('/', (req, res) => {
  const body = req.body as Partial<StoredAppointment>;
  if (!body.petId?.trim() || !body.vetId?.trim() || !body.date?.trim() || !body.time?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId, vetId, date, and time are required');
  }
  if (!store.pets.get(body.petId.trim())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId must reference an existing pet');
  }
  const t = new Date().toISOString();
  const id = store.newId();
  const row: StoredAppointment = {
    id,
    petId: body.petId.trim(),
    vetId: body.vetId.trim(),
    date: body.date.trim(),
    time: body.time.trim(),
    durationMinutes: body.durationMinutes ?? 30,
    type: (body.type as AppointmentType) ?? AppointmentType.ROUTINE_CHECKUP,
    status: (body.status as AppointmentStatus) ?? AppointmentStatus.PENDING,
    notes: body.notes?.trim(),
    createdAt: t,
    updatedAt: t,
  };
  store.appointments.set(id, row);
  return res.status(201).json(toResponse(row));
});

router.put('/:id', (req, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');
  const b = req.body as Partial<StoredAppointment>;
  const t = new Date().toISOString();
  const next: StoredAppointment = {
    ...row,
    ...(b.date !== undefined ? { date: String(b.date) } : {}),
    ...(b.time !== undefined ? { time: String(b.time) } : {}),
    ...(b.durationMinutes !== undefined ? { durationMinutes: b.durationMinutes } : {}),
    ...(b.type !== undefined ? { type: b.type as AppointmentType } : {}),
    ...(b.status !== undefined ? { status: b.status as AppointmentStatus } : {}),
    ...(b.notes !== undefined ? { notes: b.notes } : {}),
    ...(b.vetId !== undefined ? { vetId: String(b.vetId) } : {}),
    ...(b.petId !== undefined ? { petId: String(b.petId) } : {}),
    updatedAt: t,
    ...(b.status === AppointmentStatus.CANCELLED
      ? { cancelledAt: t, cancellationReason: b.cancellationReason ?? row.cancellationReason }
      : {}),
  };
  store.appointments.set(row.id, next);
  return res.json(toResponse(next));
});

router.delete('/:id', (req, res) => {
  if (!store.appointments.delete(req.params.id)) {
    return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');
  }
  return res.json(ok(null, 'Appointment deleted'));
});

export default router;
