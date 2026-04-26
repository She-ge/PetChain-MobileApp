import * as SQLite from 'expo-sqlite';
import { encrypt, decrypt } from '../utils/encryption';

const db = SQLite.openDatabase('petchain.db');

/**
 * Helper to safely decrypt data, falling back to original data if decryption fails.
 * This handles transition from unencrypted to encrypted data.
 */
async function safeDecrypt<T = string>(
  data: string,
  purpose: string,
  parseJson: boolean = false
): Promise<T> {
  try {
    return await decrypt<T>(data, purpose, parseJson);
  } catch (error) {
    // If decryption fails, it might be unencrypted legacy data
    if (parseJson) {
      try {
        return JSON.parse(data) as T;
      } catch {
        // Not JSON either, return as is if T is string
        return data as unknown as T;
      }
    }
    return data as unknown as T;
  }
}

function executeSql(sql: string, params: any[] = []): Promise<SQLite.SQLResultSet> {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        (_tx, result) => resolve(result),
        (_tx, err) => {
          reject(err);
          return false;
        },
      );
    });
  });
}

async function init(): Promise<void> {
  // Key-value store for misc JSON blobs
  await executeSql(
    `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT)`,
  );

  // Structured tables for medications and dose logs
  await executeSql(
    `CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL)`,
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS dose_logs (id TEXT PRIMARY KEY NOT NULL, medication_id TEXT, taken_at TEXT, skipped INTEGER, notes TEXT, data TEXT NOT NULL)`,
  );

  await executeSql(
    `CREATE TABLE IF NOT EXISTS health_metrics (id TEXT PRIMARY KEY NOT NULL, pet_id TEXT NOT NULL, recorded_at TEXT NOT NULL, data TEXT NOT NULL)`,
  );
}

// Initialize DB on module import
init().catch(() => {});

// KV helpers (compat with AsyncStorage-like API)
export async function getItem(key: string): Promise<string | null> {
  const res = await executeSql(`SELECT value FROM kv_store WHERE key = ? LIMIT 1`, [key]);
  if (res.rows.length === 0) return null;
  const value = res.rows.item(0).value as string;
  return await safeDecrypt(value, `localdb_kv_${key}`);
}

export async function setItem(key: string, value: string): Promise<void> {
  const encryptedValue = await encrypt(value, `localdb_kv_${key}`);
  await executeSql(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`, [key, encryptedValue]);
}

export async function removeItem(key: string): Promise<void> {
  await executeSql(`DELETE FROM kv_store WHERE key = ?`, [key]);
}

export async function multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => '?').join(',');
  const res = await executeSql(`SELECT key, value FROM kv_store WHERE key IN (${placeholders})`, keys);
  const map: Record<string, string> = {};
  for (let i = 0; i < res.rows.length; i++) {
    const row = res.rows.item(i);
    map[row.key] = row.value;
  }
  
  return await Promise.all(
    keys.map(async (k) => {
      const val = map[k];
      return [k, val ? await safeDecrypt(val, `localdb_kv_${k}`) : null] as [string, string | null];
    })
  );
}

export async function multiSet(items: Array<[string, string]>): Promise<void> {
  const encryptedItems = await Promise.all(
    items.map(async ([k, v]) => {
      const encryptedValue = await encrypt(v, `localdb_kv_${k}`);
      return [k, encryptedValue] as [string, string];
    })
  );

  await new Promise<void>((resolve, reject) => {
    db.transaction((tx) => {
      try {
        for (const [k, v] of encryptedItems) {
          tx.executeSql(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`, [k, v]);
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Medications CRUD
export async function getAllMedications(): Promise<any[]> {
  const res = await executeSql(`SELECT data FROM medications`);
  const out: any[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    try {
      const decrypted = await safeDecrypt(res.rows.item(i).data, 'localdb_medications', true);
      out.push(decrypted);
    } catch {
      // ignore bad rows
    }
  }
  return out;
}

export async function upsertMedication(med: any): Promise<void> {
  const encryptedData = await encrypt(med, 'localdb_medications');
  await executeSql(`INSERT OR REPLACE INTO medications (id, data) VALUES (?, ?)`, [med.id, encryptedData]);
}

export async function deleteMedicationById(id: string): Promise<void> {
  await executeSql(`DELETE FROM medications WHERE id = ?`, [id]);
}

// Dose logs
export async function getDoseLogs(): Promise<any[]> {
  const res = await executeSql(`SELECT data FROM dose_logs ORDER BY taken_at ASC`);
  const out: any[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    try {
      const decrypted = await safeDecrypt(res.rows.item(i).data, 'localdb_dose_logs', true);
      out.push(decrypted);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function addDoseLog(log: any): Promise<void> {
  const encryptedData = await encrypt(log, 'localdb_dose_logs');
  await executeSql(
    `INSERT OR REPLACE INTO dose_logs (id, medication_id, taken_at, skipped, notes, data) VALUES (?, ?, ?, ?, ?, ?)`,
    [log.id, log.medicationId ?? null, log.takenAt ?? null, log.skipped ? 1 : 0, log.notes ?? null, encryptedData],
  );
}

export async function getHealthMetricsByPetId(petId: string): Promise<any[]> {
  const res = await executeSql(
    `SELECT data FROM health_metrics WHERE pet_id = ? ORDER BY recorded_at ASC`,
    [petId],
  );
  const out: any[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    try {
      const decrypted = await safeDecrypt(res.rows.item(i).data, 'localdb_health_metrics', true);
      out.push(decrypted);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function upsertHealthMetric(entry: { id: string; petId: string; recordedAt: string; [k: string]: unknown }): Promise<void> {
  const encryptedData = await encrypt(entry, 'localdb_health_metrics');
  await executeSql(`INSERT OR REPLACE INTO health_metrics (id, pet_id, recorded_at, data) VALUES (?, ?, ?, ?)`, [
    entry.id,
    entry.petId,
    entry.recordedAt,
    encryptedData,
  ]);
}

export async function deleteHealthMetricById(id: string): Promise<void> {
  await executeSql(`DELETE FROM health_metrics WHERE id = ?`, [id]);
}

export default {
  getItem,
  setItem,
  removeItem,
  multiGet,
  multiSet,
  getAllMedications,
  upsertMedication,
  deleteMedicationById,
  getDoseLogs,
  addDoseLog,
  getHealthMetricsByPetId,
  upsertHealthMetric,
  deleteHealthMetricById,
};
