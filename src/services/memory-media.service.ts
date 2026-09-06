import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { MemoryError, memoryPatientDirectory, validateMemoryPhotoPath, type SelectedMemoryPhoto } from '../memories/types';

export type PhotoPickResult = { status: 'selected'; photo: SelectedMemoryPhoto } | { status: 'canceled' | 'denied' | 'failed' | 'unavailable' };
const maxPhotoBytes = 20 * 1024 * 1024;

function pickerFile(photo: SelectedMemoryPhoto) {
  if (!photo.uri.startsWith('file:///') || decodeURIComponent(photo.uri).split('/').includes('..') ||
      !/^(jpg|png|webp|heic|heif|avif|gif)$/u.test(photo.extension)) throw new MemoryError('photo');
  const file = new File(photo.uri);
  const cache = Paths.cache.uri.replace(/\/$/u, '') + '/';
  if (!file.uri.startsWith(cache) || !file.exists || file.size <= 0 || file.size > maxPhotoBytes) throw new MemoryError('photo');
  return file;
}
function managedFile(patientId: string, path: string) {
  validateMemoryPhotoPath(patientId, path);
  const directory = new Directory(Paths.document, memoryPatientDirectory(patientId));
  const file = new File(Paths.document, path);
  if (!file.uri.startsWith(directory.uri.replace(/\/$/u, '') + '/')) throw new MemoryError('photo');
  return file;
}
async function pick(): Promise<PhotoPickResult> {
  if (Platform.OS === 'web') return { status: 'unavailable' };
  try {
    // The system photo picker grants access to the selected image; broad library permission is unnecessary.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false,
      allowsEditing: false, quality: 0.8, exif: false, base64: false });
    if (result.canceled) return { status: 'canceled' };
    const asset = result.assets[0];
    if (!asset || asset.type !== 'image') return { status: 'failed' };
    const suffix = asset.uri.split('.').pop()?.toLowerCase();
    const extension = suffix === 'jpeg' ? 'jpg' : suffix;
    if (!extension) return { status: 'failed' };
    const photo = { uri: asset.uri, extension };
    pickerFile(photo);
    return { status: 'selected', photo };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    return { status: /permission/iu.test(code) ? 'denied' : 'failed' };
  }
}
function importPhoto(patientId: string, photo: SelectedMemoryPhoto, fileId: string) {
  if (Platform.OS === 'web' || !/^[a-f0-9]{32}$/u.test(fileId)) throw new MemoryError('photo');
  const source = pickerFile(photo);
  const path = `${memoryPatientDirectory(patientId)}/${fileId}.${photo.extension}`;
  const target = managedFile(patientId, path);
  if (target.exists) throw new MemoryError('photo');
  new Directory(Paths.document, memoryPatientDirectory(patientId)).create({ intermediates: true, idempotent: true });
  try {
    source.copy(target);
    if (!target.exists || target.size !== source.size) throw new MemoryError('photo');
    return path;
  } catch {
    // A failed copy can leave a partial file. Never remove the picker source or an old working photo.
    try { if (target.exists) target.delete(); } catch { throw new MemoryError('cleanup'); }
    throw new MemoryError('photo');
  }
}
function resolve(patientId: string, path: string | null): string | null {
  if (Platform.OS === 'web' || path === null) return null;
  try { const file = managedFile(patientId, path); return file.exists && file.size > 0 ? file.uri : null; }
  catch { return null; }
}
function remove(patientId: string, path: string) {
  if (Platform.OS === 'web') throw new MemoryError('photo');
  const file = managedFile(patientId, path);
  if (file.exists) file.delete();
}
export const memoryMedia = { pick, importPhoto, resolve, remove };
