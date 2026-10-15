import { RotateCcw, RotateCw, X } from 'lucide-react';
import { Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Accessory, BodyType, Build, HairStyle, Height, SkinToneId, VisualProfile } from '../domain/character';
import { OUTFIT_BY_ID, outfitsForWorld } from '../data/outfits';
import { EYE_COLORS, HAIR_COLORS, PRESET_BY_ID, PRESETS, SIGNATURE_COLORS, SKIN_TONES } from '../data/presets';
import { WORLD_BY_ID, WORLDS } from '../data/worlds';
import type { PoseMode, SpriteDir } from '../render/sprites';
import { resolveOutfit } from '../store/characters';
import type { TKey } from '../i18n';
import { useApp, useServices, useT, useTD } from './context';
import { Button, Chips, Modal, Portrait, Segmented, Swatches } from './kit';
import { WorldThumb } from './shared';

const HAIR: HairStyle[] = ['mane', 'tousled', 'crew', 'spiky', 'shaved', 'bun', 'curly', 'afro', 'ponytail', 'undercut', 'bob', 'braids', 'long'];
// the Cast has one view (front 3/4, SE) and its mirror (SW)
const DIRS: SpriteDir[] = ['se', 'sw'];
const ROLE_IDEAS: TKey[] = ['a.role.ceo', 'a.role.founder', 'a.role.researcher', 'a.role.engineer', 'a.role.designer', 'a.role.analyst', 'a.role.operator', 'a.role.writer', 'a.role.qa', 'a.role.strategist', 'a.role.ops', 'a.role.assistant'];

export function CharacterCreator() {
  const st = useApp();
  const t = useT();
  const td = useTD();
  const { store } = useServices();
  const editing = st.creator?.editingId ? st.characters.find((c) => c.id === st.creator!.editingId) : undefined;
  const initialWorld = editing?.worldId ?? st.creator?.worldId ?? st.currentWorldId;

  const [name, setName] = useState(editing?.name ?? '');
  const [role, setRole] = useState(editing?.role ?? '');
  const [presetId, setPresetId] = useState(editing?.visualPresetId ?? PRESETS[1].id);
  const [profile, setProfile] = useState<VisualProfile>(editing?.profile ?? { ...PRESET_BY_ID[PRESETS[1].id].profile });
  const [signature, setSignature] = useState(editing?.signature ?? PRESETS[1].signature);
  const [worldId, setWorldId] = useState(initialWorld);
  const [outfitId, setOutfitId] = useState(editing?.outfitId ?? WORLD_BY_ID[initialWorld].defaultOutfitId);
  const [variant, setVariant] = useState<string | undefined>(editing?.outfitVariant);
  const [dirIdx, setDirIdx] = useState(1);
  const [mode, setMode] = useState<PoseMode | 'sit'>('stand');
  const [error, setError] = useState('');

  const world = WORLD_BY_ID[worldId];
  const outfits = outfitsForWorld(world.outfitCategory);
  const look = useMemo(() => ({ profile, outfitId, outfitVariant: variant, signature }), [profile, outfitId, variant, signature]);
  const set = <K extends keyof VisualProfile>(k: K, v: VisualProfile[K]) => setProfile((p) => ({ ...p, [k]: v }));

  const applyPreset = (id: string) => {
    const p = PRESET_BY_ID[id];
    setPresetId(id);
    setProfile({ ...p.profile });
    setSignature(p.signature);
  };
  const changeWorld = (id: string) => {
    setWorldId(id);
    setOutfitId(resolveOutfit(id, outfitId, profile.body));
    setVariant(undefined);
  };

  const save = () => {
    if (!name.trim()) return setError(t('a.cc.nameMissing'));
    const data = { name, role: role || 'Crew member', visualPresetId: presetId, profile, signature, worldId, outfitId, outfitVariant: variant };
    try {
      if (editing) store.updateCharacter(editing.id, data);
      else store.createCharacter(data);
      store.closeCreator();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const close = () => store.closeCreator();
  const outfit = OUTFIT_BY_ID[outfitId];

  return (
    <Modal title={editing ? t('creator.titleEdit') : t('creator.titleNew')} onClose={close} wide>
      <header className="modal-head">
        <h2>{editing ? t('creator.titleEdit') : t('creator.titleNew')}</h2>
        <button className="icon-btn" onClick={close} aria-label={t('chat.close')}>
          <X size={18} />
        </button>
      </header>
      <div className="creator">
        <div className="creator-preview">
          <WorldThumb w={world} width={420} className="cp-bg" />
          <div className="cp-figure">
            <Portrait look={look} scale={9} dir={DIRS[dirIdx % DIRS.length]} mode={mode === 'sit' ? 'stand' : mode} sit={mode === 'sit'} animate />
          </div>
          <div className="cp-controls">
            <button className="icon-btn" onClick={() => setDirIdx((i) => (i + DIRS.length - 1) % DIRS.length)} aria-label={t('a.cc.turnLeft')}>
              <RotateCcw size={16} />
            </button>
            <Segmented value={mode} onChange={setMode} label={t('a.cc.pose')} options={[{ value: 'stand', label: t('a.cc.pose.stand') }, { value: 'walk', label: t('a.cc.pose.walk') }, { value: 'work', label: t('a.cc.pose.work') }, { value: 'sit', label: t('a.cc.pose.sit') }]} />
            <button className="icon-btn" onClick={() => setDirIdx((i) => (i + 1) % DIRS.length)} aria-label={t('a.cc.turnRight')}>
              <RotateCw size={16} />
            </button>
          </div>
          <div className="cp-caption">
            <b>{name || t('a.cc.unnamed')}</b>
            <span>{role || t('creator.role')}</span>
            <small>
              {td(outfit?.name)} · {td(world.name)}
            </small>
          </div>
        </div>

        <div className="creator-form">
          <div className="row2">
            <label className="field">
              <span>{t('creator.name')}</span>
              <input autoFocus value={name} maxLength={40} onChange={(e) => (setName(e.target.value), setError(''))} placeholder={t('a.cc.namePh')} />
            </label>
            <label className="field">
              <span>{t('creator.role')}</span>
              <input value={role} maxLength={60} list="role-ideas" onChange={(e) => setRole(e.target.value)} placeholder={t('a.cc.rolePh')} />
              <datalist id="role-ideas">
                {ROLE_IDEAS.map((r) => (
                  <option key={r} value={t(r)} />
                ))}
              </datalist>
            </label>
          </div>

          <section>
            <h4>{t('creator.preset')}</h4>
            <div className="preset-grid">
              {PRESETS.map((p) => (
                <button key={p.id} className={`preset ${p.id === presetId ? 'on' : ''}`} onClick={() => applyPreset(p.id)} title={td(p.label)}>
                  <Portrait look={{ profile: p.profile, outfitId: 'universal.tee', signature: p.signature }} scale={2} bust />
                  {p.founderPreset && <Star size={11} className="star" fill="currentColor" aria-label={t('a.cc.founder')} />}
                </button>
              ))}
            </div>
            <small className="muted">{td(PRESET_BY_ID[presetId]?.label)}</small>
          </section>

          <section className="look">
            <h4>{t('creator.look')}</h4>
            <div className="look-grid">
              <span>{t('a.cc.body')}</span>
              <Segmented value={profile.body} onChange={(v: BodyType) => set('body', v)} label={t('a.cc.body')} options={[{ value: 'masc', label: t('a.cc.body.masc') }, { value: 'fem', label: t('a.cc.body.fem') }, { value: 'neutral', label: t('a.cc.body.neutral') }]} />
              <span>{t('a.cc.build')}</span>
              <Segmented value={profile.build} onChange={(v: Build) => set('build', v)} label={t('a.cc.build')} options={[{ value: 'slim', label: t('a.cc.build.slim') }, { value: 'regular', label: t('a.cc.build.regular') }, { value: 'broad', label: t('a.cc.build.broad') }]} />
              <span>{t('a.cc.height')}</span>
              <Segmented value={profile.height} onChange={(v: Height) => set('height', v)} label={t('a.cc.height')} options={[{ value: 'short', label: t('a.cc.height.short') }, { value: 'regular', label: t('a.cc.height.regular') }, { value: 'tall', label: t('a.cc.height.tall') }]} />
              <span>{t('a.cc.skin')}</span>
              <Swatches label={t('a.cc.skin')} colors={Object.values(SKIN_TONES).map((s) => s.base)} value={SKIN_TONES[profile.skin].base} onChange={(c) => set('skin', (Object.keys(SKIN_TONES) as SkinToneId[]).find((k) => SKIN_TONES[k].base === c)!)} />
              <span>{t('a.cc.hair')}</span>
              <Chips label={t('a.cc.hairStyle')} value={profile.hair} onChange={(v) => set('hair', v)} options={HAIR.map((h) => ({ value: h, label: t(`a.hair.${h}` as TKey) }))} />
              <span>{t('a.cc.hairColour')}</span>
              <Swatches label={t('a.cc.hairColour')} colors={HAIR_COLORS} value={profile.hairColor} onChange={(c) => set('hairColor', c)} />
              <span>{t('a.cc.eyes')}</span>
              <Swatches label={t('a.cc.eyeColour')} colors={EYE_COLORS} value={profile.eyeColor} onChange={(c) => set('eyeColor', c)} />
              <span>{t('a.cc.facialHair')}</span>
              <Chips label={t('a.cc.facialHair')} value={profile.facialHair ?? 'none'} onChange={(v) => set('facialHair', v === 'none' ? undefined : (v as VisualProfile['facialHair']))} options={[{ value: 'none', label: t('a.cc.facial.none') }, { value: 'stubble', label: t('a.cc.facial.stubble') }, { value: 'mustache', label: t('a.cc.facial.mustache') }, { value: 'beard', label: t('a.cc.facial.beard') }]} />
              <span>{t('a.cc.glasses')}</span>
              <Chips label={t('a.cc.glasses')} value={profile.glasses ?? 'none'} onChange={(v) => set('glasses', v === 'none' ? undefined : (v as 'round' | 'square'))} options={[{ value: 'none', label: t('a.cc.glasses.none') }, { value: 'round', label: t('a.cc.glasses.round') }, { value: 'square', label: t('a.cc.glasses.square') }]} />
              <span>{t('a.cc.accessory')}</span>
              <Chips label={t('a.cc.accessory')} value={profile.accessory ?? 'none'} onChange={(v: Accessory) => set('accessory', v)} options={[{ value: 'none', label: t('a.cc.acc.none') }, { value: 'headphones', label: t('a.cc.acc.headphones') }, { value: 'flower', label: t('a.cc.acc.flower') }, { value: 'scarf', label: t('a.cc.acc.scarf') }]} />
              <span>{t('a.cc.freckles')}</span>
              <Chips label={t('a.cc.freckles')} value={profile.freckles ? 'yes' : 'no'} onChange={(v) => set('freckles', v === 'yes')} options={[{ value: 'no', label: t('a.cc.no') }, { value: 'yes', label: t('a.cc.yes') }]} />
              <span>{t('a.cc.signature')}</span>
              <Swatches label={t('a.cc.signature')} colors={SIGNATURE_COLORS} value={signature} onChange={setSignature} />
            </div>
          </section>

          <section>
            <h4>{t('creator.world')}</h4>
            <select value={worldId} onChange={(e) => changeWorld(e.target.value)} aria-label={t('creator.world')}>
              {WORLDS.map((w) => (
                <option key={w.id} value={w.id}>
                  {td(w.name)}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h4>
              {t('creator.outfit')} <small className="muted">· {t('a.cc.collection', { world: td(world.name) })}</small>
            </h4>
            <div className="outfit-picker">
              {outfits.map((o) => (
                <button key={o.id} className={`outfit-opt ${o.id === outfitId ? 'on' : ''}`} onClick={() => (setOutfitId(o.id), setVariant(undefined))} title={td(o.name)}>
                  <Portrait look={{ ...look, outfitId: o.id, outfitVariant: undefined }} scale={2} />
                  <span>{td(o.name)}</span>
                </button>
              ))}
            </div>
            {outfit?.variants && (
              <Chips label={t('a.cc.variant')} value={variant ?? ''} onChange={(v) => setVariant(v || undefined)} options={[{ value: '', label: t('a.cc.variantDefault') }, ...outfit.variants.map((v) => ({ value: v.id, label: td(v.name) }))]} />
            )}
          </section>
        </div>
      </div>
      <footer className="modal-foot">
        {error && <span className="error">{error}</span>}
        <Button tone="ghost" onClick={close}>
          {t('creator.cancel')}
        </Button>
        <Button tone="primary" onClick={save}>
          {editing ? t('creator.save') : t('creator.create')}
        </Button>
      </footer>
    </Modal>
  );
}
