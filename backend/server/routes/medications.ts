import express from 'express';

import { sendError } from '../response';
import { store, type StoredMedication } from '../store';

const router = express.Router();

router.get('/', (req, res) => {
  const petId = req.query.petId as string | undefined;
  let list = [...store.medications.values()];
  if (petId) list = list.filter((m) => m.petId === petId);
  return res.json(list);
});

router.get('/:id', (req, res) => {
  const row = store.medications.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Medication not found');
  return res.json(row);
});

router.post('/', (req, res) => {
  const body = req.body as Partial<StoredMedication>;
  if (!body.petId?.trim() || !body.name?.trim() || !body.dosage?.trim() || !body.frequency?.trim() || !body.startDate?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId, name, dosage, frequency, and startDate are required');
  }
  if (!store.pets.get(body.petId.trim())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId must reference an existing pet');
  }
  const id = store.newId();
  const row: StoredMedication = {
    id,
    petId: body.petId.trim(),
    name: body.name.trim(),
    dosage: body.dosage.trim(),
    frequency: body.frequency.trim(),
    startDate: body.startDate.trim(),
    endDate: body.endDate?.trim(),
    active: body.active !== false,
  };
  store.medications.set(id, row);
  return res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const row = store.medications.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Medication not found');
  const b = req.body as Partial<StoredMedication>;
  const next: StoredMedication = {
    ...row,
    ...(b.name !== undefined ? { name: String(b.name) } : {}),
    ...(b.dosage !== undefined ? { dosage: String(b.dosage) } : {}),
    ...(b.frequency !== undefined ? { frequency: String(b.frequency) } : {}),
    ...(b.startDate !== undefined ? { startDate: String(b.startDate) } : {}),
    ...(b.endDate !== undefined ? { endDate: b.endDate } : {}),
    ...(b.active !== undefined ? { active: Boolean(b.active) } : {}),
    ...(b.petId !== undefined ? { petId: String(b.petId) } : {}),
  };
  store.medications.set(row.id, next);
  return res.json(next);
});

router.delete('/:id', (req, res) => {
  if (!store.medications.delete(req.params.id)) {
    return sendError(res, 404, 'NOT_FOUND', 'Medication not found');
  }
  return res.status(204).send();
});

export default router;
