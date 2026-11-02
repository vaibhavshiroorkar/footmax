import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { compress, decompress } from './compress';
import { readSlotRaw } from './storage';
import { loadErrorText, loadSave } from '../engine/save';
import { Game } from '../engine/types';

// Save files are the same compressed text the game stores locally, so an
// export is a straight copy and an import is checked like any other load.

function fileName(name: string): string {
  const safe = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'save';
  return `footmax-${safe}.fmx`;
}

export async function exportSaveFile(slotId: string, name: string): Promise<string | null> {
  const raw = await readSlotRaw(slotId);
  if (!raw) return 'This save could not be read.';
  const text = raw.startsWith('z1:') ? raw : compress(raw);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  }
  // Native modules load lazily so the web bundle does not need them.
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, fileName(name));
  file.create({ overwrite: true });
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) return 'Sharing is not available on this device.';
  await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Save your FootMax game' });
  return null;
}

// Opens a file picker and returns the game inside, or an error to show.
export async function pickSaveFile(): Promise<{ game: Game } | { error: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  let text: string;
  try {
    if (Platform.OS === 'web' && asset.file) text = await asset.file.text();
    else {
      const { File } = await import('expo-file-system');
      text = await new File(asset.uri).text();
    }
  } catch {
    return { error: 'That file could not be read.' };
  }
  let json: string;
  try {
    json = decompress(text.trim());
  } catch {
    return { error: 'That is not a FootMax save file.' };
  }
  const r = loadSave(json);
  return r.ok ? { game: r.game } : { error: r.error === 'corrupt' ? 'That is not a FootMax save file, or it is damaged.' : loadErrorText(r.error) };
}
