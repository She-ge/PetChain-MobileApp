import express from 'express';

import { authenticateJWT, authorizeRoles, type AuthenticatedRequest } from '../../middleware/auth';
import { UserRole } from '../../models/UserRole';
import { ok, sendError } from '../response';
import { store, type StoredMedicalRecord } from '../store';

const router = express.Router();

function toApiRecord(r: StoredMedicalRecord) {
  return {
    id: r.id,
    petId: r.petId,
    vetId: r.vetId,
    type: r.type,
    diagnosis: r.diagnosis,
    treatment: r.treatment,
    notes: r.notes,
    visitDate: r.visitDate,
    nextVisitDate: r.nextVisitDate,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// All medical record routes require authentication
router.use(authenticateJWT);

router.get('/pet/:petId', (req: AuthenticatedRequest, res) => {
  const petId = req.params.petId as string;
  const pet = store.pets.get(petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');

  // Only admin, vet, or the owner can view medical records
  if (req.user!.role === UserRole.OWNER && req.user!.id !== pet.ownerId) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view these medical records');
  }

  const list = [...store.medicalRecords.values()]
    .filter((r) => r.petId === petId)
    .map(toApiRecord);
  return res.json(ok(list));
});

router.get('/', (req: AuthenticatedRequest, res) => {
  const { petId, vetId, type } = req.query as { petId?: string; vetId?: string; type?: string };
  
  // Owners must provide petId
  if (req.user!.role === UserRole.OWNER && !petId) {
    return sendError(res, 403, 'FORBIDDEN', 'PetId parameter is required for pet owners');
  }

  if (petId) {
    const pet = store.pets.get(petId);
    if (pet && req.user!.role === UserRole.OWNER && req.user!.id !== pet.ownerId) {
      return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view these medical records');
    }
  }

  let list = [...store.medicalRecords.values()];
  if (petId) list = list.filter((r) => r.petId === petId);
  if (vetId) list = list.filter((r) => r.vetId === vetId);
  if (type) list = list.filter((r) => r.type === type);
  list.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  return res.json(ok(list.map(toApiRecord)));
});

router.get('/:id', (req: AuthenticatedRequest, res) => {
  const row = store.medicalRecords.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Medical record not found');
  
  const pet = store.pets.get(row.petId);
  // Only admin, vet, or the owner can view this record
  if (pet && req.user!.role === UserRole.OWNER && req.user!.id !== pet.ownerId) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view this medical record');
  }

  return res.json(ok(toApiRecord(row)));
});

// Only Admin and Vet can create, update, or delete medical records
router.post('/', authorizeRoles(UserRole.ADMIN, UserRole.VET), (req, res) => {
  const { petId, vetId, type, diagnosis, treatment, notes, visitDate, nextVisitDate } = req.body as Partial<
    StoredMedicalRecord
  >;
  if (!petId?.trim() || !vetId?.trim() || !type?.trim() || !visitDate?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId, vetId, type, and visitDate are required');
  }
  if (!store.pets.get(petId.trim())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId must reference an existing pet');
  }
  const t = new Date().toISOString();
  const id = store.newId();
  const row: StoredMedicalRecord = {
    id,
    petId: petId.trim(),
    vetId: vetId.trim(),
    type: String(type),
    diagnosis: diagnosis?.trim(),
    treatment: treatment?.trim(),
    notes: notes?.trim(),
    visitDate: visitDate.trim(),
    nextVisitDate: nextVisitDate?.trim(),
    createdAt: t,
    updatedAt: t,
  };
  store.medicalRecords.set(id, row);
  return res.status(201).json(ok(toApiRecord(row), 'Medical record created'));
});

router.put('/:id', authorizeRoles(UserRole.ADMIN, UserRole.VET), (req, res) => {
  const row = store.medicalRecords.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Medical record not found');
  const b = req.body as Partial<StoredMedicalRecord>;
  const t = new Date().toISOString();
  const next: StoredMedicalRecord = {
    ...row,
    ...(b.type !== undefined ? { type: String(b.type) } : {}),
    ...(b.diagnosis !== undefined ? { diagnosis: b.diagnosis } : {}),
    ...(b.treatment !== undefined ? { treatment: b.treatment } : {}),
    ...(b.notes !== undefined ? { notes: b.notes } : {}),
    ...(b.visitDate !== undefined ? { visitDate: String(b.visitDate) } : {}),
    ...(b.nextVisitDate !== undefined ? { nextVisitDate: b.nextVisitDate } : {}),
    ...(b.vetId !== undefined ? { vetId: String(b.vetId) } : {}),
    ...(b.petId !== undefined ? { petId: String(b.petId) } : {}),
    updatedAt: t,
  };
  store.medicalRecords.set(row.id, next);
  return res.json(ok(toApiRecord(next), 'Medical record updated'));
});

router.delete('/:id', authorizeRoles(UserRole.ADMIN, UserRole.VET), (req, res) => {
  if (!store.medicalRecords.delete(req.params.id)) {
    return sendError(res, 404, 'NOT_FOUND', 'Medical record not found');
  }
  return res.json(ok(null, 'Medical record deleted'));
});

export default router;
