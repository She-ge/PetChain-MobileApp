import type { Migration } from '../types';
import { getAllMedications, upsertMedication } from '../../services/localDB';

/**
 * v2 — Backfill prescriberInfo / pharmacyInfo on medication records that
 * were saved before those fields were introduced.
 */
const migration: Migration = {
  version: 2,
  description: 'Backfill prescriberInfo and pharmacyInfo on medication records',

  async up() {
    const meds = await getAllMedications();
    for (const med of meds) {
      let dirty = false;
      if (!med.prescriberInfo) {
        med.prescriberInfo = { name: '', contact: '', clinic: '' };
        dirty = true;
      }
      if (!med.pharmacyInfo) {
        med.pharmacyInfo = { name: '', phone: '', address: '' };
        dirty = true;
      }
      if (dirty) await upsertMedication(med);
    }
  },

  async down() {
    const meds = await getAllMedications();
    for (const med of meds) {
      const { prescriberInfo: _p, pharmacyInfo: _ph, ...rest } = med;
      await upsertMedication(rest);
    }
  },
};

export default migration;
