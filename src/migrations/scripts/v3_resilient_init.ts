import type { Migration } from '../types';
import { getAllMedications, upsertMedication } from '../../services/localDB';

/**
 * v3 — Data Resilience Migration.
 * Ensures all existing records have critical fields and handles any malformed legacy data.
 * This migration acts as a "sanity check" for backward compatibility.
 */
const migration: Migration = {
  version: 3,
  description: 'Sanitize existing records for improved backward compatibility',

  async up() {
    // Example: Sanitize medications
    const meds = await getAllMedications();
    for (const med of meds) {
      let changed = false;

      // Ensure id exists (should always, but let's be safe)
      if (!med.id) {
        med.id = Math.random().toString(36).substring(7);
        changed = true;
      }

      // Ensure type exists (defaulting to 'pills' if missing)
      if (!med.type) {
        med.type = 'pills';
        changed = true;
      }

      // Fix legacy frequency formats if any exist
      if (typeof med.frequency === 'number') {
        med.frequency = `${med.frequency}x per day`;
        changed = true;
      }

      if (changed) {
        await upsertMedication(med);
      }
    }
  },

  async down() {
    // Usually no-op for generic sanitization, or reverse specific format changes
    console.log('v3 down: Sanitization changes are kept for safety.');
  },
};

export default migration;
