import { memoriesRepository as repository } from '../db/repositories/memories.repository';
import { MemoryError, validateMemory, type MemoryPhotoChange, type PersonalMemoryInput } from '../memories/types';
import { validateRecordId } from '../utils/validation';
import { memoryMedia } from './memory-media.service';

// ponytail: one local write queue keeps copy/save/old-file cleanup ordered; split per patient only if simultaneous patient use is introduced.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
function cleanup(patientId: string, path: string | null) {
  if (!path) return true;
  try { memoryMedia.remove(patientId, path); return true; } catch { return false; }
}
export const memoriesService = {
  saveRecording: (patientId: string, id: string, uri: string | null, current: () => boolean) => serialized(async () => {
    patientId = validateRecordId(patientId); id = validateRecordId(id);
    if (!current()) throw new MemoryError('save');
    const previous = await repository.get(patientId, id);
    if (!previous) throw new MemoryError('missing');
    const fileId = uri ? await repository.newId() : null;
    if (!current()) throw new MemoryError('save');
    const staged = uri && fileId ? memoryMedia.importRecording(patientId, uri, fileId) : null;
    try { await repository.setAudio(patientId, id, staged, current); }
    catch (error) { if (!cleanup(patientId, staged)) throw new MemoryError('cleanup'); throw error; }
    let cleanupFailed = !cleanup(patientId, previous.audioPath);
    if (uri) { try { memoryMedia.discardRecording(uri); } catch { cleanupFailed = true; } }
    return { audioPath: staged, cleanupFailed };
  }),
  save: (patientId: string, input: PersonalMemoryInput, photo: MemoryPhotoChange, id?: string) => serialized(async () => {
    patientId = validateRecordId(patientId);
    input = validateMemory(input);
    const previous = id === undefined ? null : await repository.get(patientId, validateRecordId(id));
    if (id !== undefined && !previous) throw new MemoryError('missing');
    const staged = photo.kind === 'replace' ? memoryMedia.importPhoto(patientId, photo.photo, await repository.newId()) : null;
    const photoPath = photo.kind === 'keep' ? previous?.photoPath ?? null : staged;
    let memory;
    try { memory = await repository.save(patientId, input, photoPath, id); }
    catch (error) {
      if (!cleanup(patientId, staged)) throw new MemoryError('cleanup');
      throw error;
    }
    const cleanupFailed = previous?.photoPath && previous.photoPath !== photoPath ? !cleanup(patientId, previous.photoPath) : false;
    return { memory, cleanupFailed };
  }),
  remove: (patientId: string, id: string) => serialized(async () => {
    patientId = validateRecordId(patientId); id = validateRecordId(id);
    const memory = await repository.get(patientId, id);
    if (!memory) throw new MemoryError('missing');
    await repository.remove(patientId, id);
    const photoRemoved = cleanup(patientId, memory.photoPath);
    const audioRemoved = cleanup(patientId, memory.audioPath);
    return { cleanupFailed: !photoRemoved || !audioRemoved };
  }),
};
