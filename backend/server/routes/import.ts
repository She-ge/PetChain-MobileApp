import express from 'express';

import { authenticateJWT, authorizeRoles, type AuthenticatedRequest } from '../../middleware/auth';
import { UserRole } from '../../models/UserRole';
import { ok, sendError } from '../response';
import { store, type StoredPet } from '../store';

const router = express.Router();

// ─── CSV Parser ───────────────────────────────────────────────────────────────

/**
 * Parses a single CSV line, correctly handling quoted fields that may
 * contain commas or escaped quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses CSV text into an array of row objects keyed by header column names.
 * Returns null if the CSV has no valid header row.
 */
function parseCsv(text: string): Array<Record<string, string>> | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 1) return null;

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  if (headers.length === 0) return null;

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface RowError {
  row: number;
  field: string;
  message: string;
}

interface ValidatedPet {
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  ownerId: string;
}

function validateRow(
  row: Record<string, string>,
  rowIndex: number,
): { pet: ValidatedPet; errors: RowError[] } | { pet: null; errors: RowError[] } {
  const errors: RowError[] = [];

  const name = row['name']?.trim() ?? '';
  const species = row['species']?.trim() ?? '';
  const ownerId = row['ownerid']?.trim() ?? '';
  const breed = row['breed']?.trim() || undefined;
  const dateOfBirth = row['dateofbirth']?.trim() || undefined;
  const microchipId = row['microchipid']?.trim() || undefined;

  if (!name) errors.push({ row: rowIndex, field: 'name', message: 'name is required' });
  if (!species) errors.push({ row: rowIndex, field: 'species', message: 'species is required' });
  if (!ownerId) errors.push({ row: rowIndex, field: 'ownerId', message: 'ownerId is required' });

  if (ownerId && !store.users.has(ownerId)) {
    errors.push({ row: rowIndex, field: 'ownerId', message: `User '${ownerId}' does not exist` });
  }

  if (dateOfBirth && !DATE_RE.test(dateOfBirth)) {
    errors.push({
      row: rowIndex,
      field: 'dateOfBirth',
      message: `dateOfBirth '${dateOfBirth}' must be in YYYY-MM-DD format`,
    });
  }

  if (errors.length > 0) return { pet: null, errors };

  return {
    pet: { name, species, breed, dateOfBirth, microchipId, ownerId },
    errors: [],
  };
}

// ─── Import Route ─────────────────────────────────────────────────────────────

/**
 * POST /api/import/pets
 *
 * Body: raw CSV text (Content-Type: text/plain)
 *
 * Required columns: name, species, ownerId
 * Optional columns: breed, dateOfBirth (YYYY-MM-DD), microchipId
 *
 * Returns a JSON import report:
 * {
 *   imported: number,
 *   skipped: number,
 *   errors: Array<{ row: number, field: string, message: string }>
 * }
 */
router.post(
  '/pets',
  authenticateJWT,
  authorizeRoles(UserRole.ADMIN, UserRole.VET),
  express.text({ type: 'text/plain', limit: '2mb' }),
  (req: AuthenticatedRequest, res) => {
    const body = req.body as string;

    if (!body || typeof body !== 'string' || !body.trim()) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Request body must be non-empty CSV text');
    }

    const rows = parseCsv(body);
    if (!rows) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Could not parse CSV — check header row');
    }

    if (rows.length === 0) {
      return res.json(ok({ imported: 0, skipped: 0, errors: [] }, 'No data rows found'));
    }

    const allErrors: RowError[] = [];
    const imported: StoredPet[] = [];
    const t = new Date().toISOString();

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // +1 for 0-index, +1 for header row
      const result = validateRow(row, rowNum);

      if (result.errors.length > 0) {
        allErrors.push(...result.errors);
        return; // skip this row
      }

      const pet = result.pet!;
      const id = store.newId();
      const storedPet: StoredPet = {
        id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        dateOfBirth: pet.dateOfBirth,
        microchipId: pet.microchipId,
        ownerId: pet.ownerId,
        createdAt: t,
        updatedAt: t,
      };

      store.pets.set(id, storedPet);

      // Link pet to its owner
      const owner = store.users.get(pet.ownerId);
      if (owner) {
        owner.pets.push({ id, name: pet.name });
        store.users.set(pet.ownerId, owner);
      }

      imported.push(storedPet);
    });

    return res.status(imported.length > 0 ? 201 : 200).json(
      ok(
        {
          imported: imported.length,
          skipped: rows.length - imported.length,
          errors: allErrors,
          pets: imported.map((p) => ({ id: p.id, name: p.name, species: p.species })),
        },
        `Import complete: ${imported.length} imported, ${rows.length - imported.length} skipped`,
      ),
    );
  },
);

export default router;
