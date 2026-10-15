// ─────────────────────────────────────────────────────────────
// CHARACTER = visual identity.
// It is NOT the agent runtime (see domain/agent.ts). A character can later
// be bound to an AgentDefinition, but owns only how it looks and where it is.
// ─────────────────────────────────────────────────────────────

export type SkinToneId = 'porcelain' | 'fair' | 'warm' | 'olive' | 'tan' | 'brown' | 'deep' | 'ebony';

export type HairStyle =
  | 'mane'
  | 'tousled'
  | 'crew'
  | 'spiky'
  | 'shaved'
  | 'bun'
  | 'curly'
  | 'afro'
  | 'ponytail'
  | 'undercut'
  | 'bob'
  | 'braids'
  | 'long';

export type BodyType = 'masc' | 'fem' | 'neutral';
export type Build = 'slim' | 'regular' | 'broad';
export type Height = 'short' | 'regular' | 'tall';
export type Accessory = 'none' | 'headphones' | 'flower' | 'scarf';

/** Every visual knob of the modular character (base body + hair + face + accessory). */
export interface VisualProfile {
  body: BodyType;
  skin: SkinToneId;
  hair: HairStyle;
  hairColor: string;
  eyeColor: string;
  build: Build;
  height: Height;
  glasses?: 'round' | 'square';
  facialHair?: 'beard' | 'mustache' | 'stubble';
  freckles?: boolean;
  earring?: string;
  hairAccent?: string;
  accessory?: Accessory;
  /** hand-drawn art that replaces the composed figure (src/render/hd4/peopleTemplate.ts): 'alex' is the founder */
  art?: 'alex';
}

/** A starting look. Presets have a label, never a person's name or role. */
export interface VisualPreset {
  id: string;
  label: string;
  /** the founder avatar (reference C); always available in the creator */
  founderPreset?: boolean;
  signature: string;
  /** the outfit this look starts in (else the world's default) */
  outfitId?: string;
  profile: VisualProfile;
}

export interface Character {
  id: string;
  /** chosen by the user */
  name: string;
  /** chosen by the user, free text */
  role: string;
  visualPresetId: string;
  /** the preset's profile after user edits */
  profile: VisualProfile;
  /** UI colour + tint for outfits using `signature` */
  signature: string;
  worldId: string;
  outfitId: string;
  outfitVariant?: string;
  /** the outfit last worn in each world, so moving back restores it */
  worldOutfits?: Record<string, { outfitId: string; outfitVariant?: string }>;
  metadata: {
    createdAt: number;
    updatedAt: number;
    founder?: boolean;
    notes?: string;
    /** future: binds this visual identity to a runtime AgentDefinition */
    agentDefinitionId?: string;
  };
}
