import express from 'express';

import { ok, sendError } from '../response';
import { store, type StoredMedicalRecord, type StoredPet } from '../store';

const router = express.Router();

function ownerSummary(ownerId: string) {
  const u = store.users.get(ownerId);
  if (!u) return undefined;
  return { id: u.id, name: u.name, email: u.email };
}

function toPetResponse(p: StoredPet) {
  return {
    ...p,
    owner: ownerSummary(p.ownerId),
  };
}

function mapMobileRecordType(t: string): 'vaccination' | 'treatment' | 'diagnosis' {
  if (t === 'vaccination') return 'vaccination';
  if (t === 'treatment') return 'treatment';
  return 'diagnosis';
}

function medicalToMobileRow(r: StoredMedicalRecord) {
  return {
    id: r.id,
    petId: r.petId,
    type: mapMobileRecordType(r.type),
    date: r.visitDate,
    veterinarian: store.users.get(r.vetId)?.name ?? r.vetId,
    notes: r.notes ?? r.diagnosis ?? '',
    createdAt: r.createdAt,
  };
}

router.get('/owner/:ownerId', (req, res) => {
  const list = [...store.pets.values()].filter((p) => p.ownerId === req.params.ownerId).map(toPetResponse);
  return res.json(ok(list));
});

router.get('/qr/:qrCode', (req, res) => {
  const raw = decodeURIComponent(req.params.qrCode);
  let pet = store.pets.get(raw);
  if (!pet && raw.includes('pet/')) {
    const tail = raw.split('pet/').pop()?.trim();
    if (tail) pet = store.pets.get(tail) ?? store.pets.get(decodeURIComponent(tail));
  }
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found for QR code');
  return res.json(ok(toPetResponse(pet)));
});

router.get('/:petId/medical-records', (req, res) => {
  const { petId } = req.params;
  const type = req.query.type as string | undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  let rows = [...store.medicalRecords.values()].filter((r) => r.petId === petId);
  if (type) rows = rows.filter((r) => r.type === type);
  rows.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  const total = rows.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const slice = rows.slice(start, start + limit).map(medicalToMobileRow);

  return res.json({
    data: slice,
    total,
    page,
    limit,
    totalPages,
  });
});

router.get('/', (req, res) => {
  const ownerId = req.query.ownerId as string | undefined;
  let list = [...store.pets.values()];
  if (ownerId) list = list.filter((p) => p.ownerId === ownerId);
  return res.json(ok(list.map(toPetResponse)));
});

router.get('/:id', (req, res) => {
  const pet = store.pets.get(req.params.id);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  return res.json(ok(toPetResponse(pet)));
});

router.post('/', (req, res) => {
  const { name, species, breed, dateOfBirth, microchipId, photoUrl, thumbnailUrl, ownerId } = req.body as Partial<
    StoredPet & { thumbnailUrl?: string }
  >;
  if (!name?.trim() || !species?.trim() || !ownerId?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'name, species, and ownerId are required');
  }
  if (!store.users.get(ownerId.trim())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'ownerId must reference an existing user');
  }
  const t = new Date().toISOString();
  const id = store.newId();
  const row: StoredPet = {
    id,
    name: name.trim(),
    species: species.trim(),
    breed: breed?.trim(),
    dateOfBirth: dateOfBirth?.trim(),
    microchipId: microchipId?.trim(),
    photoUrl: photoUrl?.trim(),
    thumbnailUrl: thumbnailUrl?.trim(),
    ownerId: ownerId.trim(),
    createdAt: t,
    updatedAt: t,
  };
  store.pets.set(id, row);
  const owner = store.users.get(row.ownerId);
  if (owner) {
    owner.pets = [...owner.pets.filter((p) => p.id !== id), { id, name: row.name }];
    owner.updatedAt = t;
  }
  return res.status(201).json(ok(toPetResponse(row), 'Pet created'));
});

router.put('/:id', (req, res) => {
  const pet = store.pets.get(req.params.id);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  const body = req.body as Partial<StoredPet>;
  const t = new Date().toISOString();
  const next: StoredPet = {
    ...pet,
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.species !== undefined ? { species: String(body.species) } : {}),
    ...(body.breed !== undefined ? { breed: body.breed ? String(body.breed) : undefined } : {}),
    ...(body.dateOfBirth !== undefined ? { dateOfBirth: body.dateOfBirth ? String(body.dateOfBirth) : undefined } : {}),
    ...(body.microchipId !== undefined
      ? { microchipId: body.microchipId ? String(body.microchipId) : undefined }
      : {}),
    ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl ? String(body.photoUrl) : undefined } : {}),
    ...(body.thumbnailUrl !== undefined
      ? { thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl) : undefined }
      : {}),
    ...(body.ownerId !== undefined ? { ownerId: String(body.ownerId) } : {}),
    updatedAt: t,
  };
  store.pets.set(pet.id, next);
  return res.json(ok(toPetResponse(next), 'Pet updated'));
});

router.delete('/:id', (req, res) => {
  if (!store.pets.delete(req.params.id)) {
    return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  }
  for (const u of store.users.values()) {
    u.pets = u.pets.filter((p) => p.id !== req.params.id);
  }
  return res.json(ok(null, 'Pet deleted'));
});

export default router;
