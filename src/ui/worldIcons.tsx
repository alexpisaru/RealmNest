// One icon per world, for the UI (the product uses icons, never emoji).

import { Bot, Building2, Factory, FlaskConical, Globe, Microscope, Palette, Rocket, Server, Ship, Wheat, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  office: Building2,
  factory: Factory,
  farm: Wheat,
  space: Rocket,
  chemlab: FlaskConical,
  studio: Palette,
  robotics: Bot,
  datacenter: Server,
  research: Microscope,
  port: Ship,
};

export function WorldIcon({ id, size = 16 }: { id: string; size?: number }) {
  const Icon = ICONS[id] ?? Globe;
  return <Icon size={size} strokeWidth={1.8} aria-hidden />;
}
