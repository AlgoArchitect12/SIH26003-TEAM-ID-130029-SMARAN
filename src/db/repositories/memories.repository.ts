import { getDatabase } from '../client';
import { validateRecordId } from '../../utils/validation';
import { MemoryError, validateMemory, validateMemoryPhotoPath, type PersonalMemory, type PersonalMemoryInput } from '../../memories/types';

async function newId() {
  const row = await (await getDatabase()).getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id');
  if (!row) throw new MemoryError('save');
  return row.id;
}
async function get(patientId: string, id: string) {
  return (await getDatabase()).getFirstAsync<PersonalMemory>(`SELECT id, patient_id AS patientId, name, relationship, description,
    photo_path AS photoPath, created_at AS createdAt, updated_at AS updatedAt
    FROM personal_memories WHERE patient_id = ? AND id = ?`, validateRecordId(patientId), validateRecordId(id));
}
async function list(patientId: string) {
  return (await getDatabase()).getAllAsync<PersonalMemory>(`SELECT id, patient_id AS patientId, name, relationship, description,
    photo_path AS photoPath, created_at AS createdAt, updated_at AS updatedAt
    FROM personal_memories WHERE patient_id = ? ORDER BY updated_at DESC, id`, validateRecordId(patientId));
}
async function save(patientId: string, input: PersonalMemoryInput, photoPath: string | null, id?: string) {
  patientId = validateRecordId(patientId);
  const value = validateMemory(input);
  photoPath = validateMemoryPhotoPath(patientId, photoPath);
  const recordId = id === undefined ? await newId() : validateRecordId(id);
  const now = new Date().toISOString();
  // Return the committed values directly: a post-write read failure must not cause media rollback after a successful save.
  const db = await getDatabase();
  let createdAt = now;
  await db.withExclusiveTransactionAsync(async tx => {
    if (id !== undefined) {
      const current = await tx.getFirstAsync<{ createdAt: string }>('SELECT created_at AS createdAt FROM personal_memories WHERE patient_id = ? AND id = ?', patientId, recordId);
      if (!current) throw new MemoryError('missing');
      createdAt = current.createdAt;
      await tx.runAsync(`UPDATE personal_memories SET name = ?, relationship = ?, description = ?, photo_path = ?, updated_at = ?
        WHERE patient_id = ? AND id = ?`, value.name, value.relationship, value.description, photoPath, now, patientId, recordId);
    } else {
      await tx.runAsync(`INSERT INTO personal_memories (id, patient_id, name, relationship, description, photo_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, recordId, patientId, value.name, value.relationship, value.description, photoPath, now, now);
    }
  });
  return { ...value, id: recordId, patientId, photoPath, createdAt, updatedAt: now } satisfies PersonalMemory;
}
async function remove(patientId: string, id: string) {
  const result = await (await getDatabase()).runAsync('DELETE FROM personal_memories WHERE patient_id = ? AND id = ?', validateRecordId(patientId), validateRecordId(id));
  if (!result.changes) throw new MemoryError('missing');
}
export const memoriesRepository = { newId, get, list, save, remove };
