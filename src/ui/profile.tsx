// The user's profile: a photo when they chose one, otherwise the initial of
// their name. The photo is cropped to a square and stored as a small JPEG with
// the other settings (it never leaves this computer).

import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useApp, useServices, useT } from './context';
import { Button } from './kit';

const PHOTO_PX = 256;
const MAX_SOURCE_BYTES = 15_000_000;

/** the first letter of a name ("alex" → "A"), or "?" without one */
export function initialOf(name: string): string {
  const ch = [...name.trim()][0];
  return ch ? ch.toLocaleUpperCase() : '?';
}

export function Avatar({ name, photo, size = 32 }: { name: string; photo?: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }} aria-hidden>
      {photo ? <img src={photo} alt="" draggable={false} /> : initialOf(name)}
    </span>
  );
}

/** centre-crop to a square, scale to PHOTO_PX, encode as JPEG */
export async function squarePhoto(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > MAX_SOURCE_BYTES) throw new Error('unsupported');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PHOTO_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.86);
}

/** Settings › General › Profile */
export function ProfileEditor() {
  const st = useApp();
  const t = useT();
  const { store } = useServices();
  const s = st.settings;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      store.updateSettings({ avatar: await squarePhoto(file) });
    } catch {
      setError(t('settings.photoBad'));
    }
  };

  return (
    <div className="profile-editor">
      <button type="button" className="profile-photo" onClick={() => input.current?.click()} aria-label={s.avatar ? t('settings.photoChange') : t('settings.photoUpload')}>
        <Avatar name={s.displayName} photo={s.avatar} size={72} />
        <span className="profile-photo-edit">
          <Camera size={14} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
      <div className="profile-fields">
        <label className="field-stack">
          <span>{t('settings.name')}</span>
          <input defaultValue={s.displayName} maxLength={40} placeholder="Alex" onBlur={(e) => e.target.value.trim() !== s.displayName && store.updateSettings({ displayName: e.target.value.trim() })} aria-label={t('settings.name')} />
        </label>
        <label className="field-stack">
          <span>{t('settings.role')}</span>
          <input defaultValue={s.profileRole} maxLength={40} placeholder={t('a.profile.rolePh')} onBlur={(e) => e.target.value.trim() !== s.profileRole && store.updateSettings({ profileRole: e.target.value.trim() })} aria-label={t('settings.role')} />
        </label>
        <div className="row profile-actions">
          <Button size="sm" icon={<Camera size={14} />} onClick={() => input.current?.click()}>
            {s.avatar ? t('settings.photoChange') : t('settings.photoUpload')}
          </Button>
          {s.avatar && (
            <Button size="sm" tone="ghost" icon={<Trash2 size={14} />} onClick={() => store.updateSettings({ avatar: '' })}>
              {t('settings.photoRemove')}
            </Button>
          )}
        </div>
        {error && <small className="muted">{error}</small>}
      </div>
    </div>
  );
}
