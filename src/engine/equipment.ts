import { AttrKey, Game } from './types';
import { Rng, clamp } from './rng';
import { careerPlayer } from './careerBase';
import { formatMoney } from './player';

// Equipment from cases. Each piece fits one slot and adds to one attribute
// while it is worn: one piece per slot. Better pieces are rarer.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Slot = 'boots' | 'gloves' | 'shinpads' | 'top' | 'headband' | 'watch';

export interface EquipItem {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  attr: AttrKey;
  bonus: number;
}

export const RARITY: Record<Rarity, { label: string; bonus: number; color: string; sell: number }> = {
  common: { label: 'Common', bonus: 1, color: '#9aa5b4', sell: 400 },
  rare: { label: 'Rare', bonus: 2, color: '#3b9dff', sell: 1500 },
  epic: { label: 'Epic', bonus: 3, color: '#a97bff', sell: 5000 },
  legendary: { label: 'Legendary', bonus: 5, color: '#ffc531', sell: 15000 },
};

export const SLOTS: Record<Slot, { label: string; attrs: AttrKey[]; names: string[]; icon: string }> = {
  boots: { label: 'Boots', attrs: ['shooting', 'pace'], names: ['Strikers', 'Velocity', 'Phantom', 'Blaze'], icon: 'footsteps' },
  gloves: { label: 'Gloves', attrs: ['goalkeeping'], names: ['Grip', 'Wall', 'Safe Hands', 'Octopus'], icon: 'hand-left' },
  shinpads: { label: 'Shin pads', attrs: ['defending'], names: ['Guard', 'Shield', 'Bulwark', 'Iron'], icon: 'shield' },
  top: { label: 'Training top', attrs: ['physical', 'dribbling'], names: ['Engine', 'Flow', 'Motor', 'Glide'], icon: 'shirt' },
  headband: { label: 'Headband', attrs: ['composure'], names: ['Calm', 'Focus', 'Zen', 'Ice'], icon: 'ellipse' },
  watch: { label: 'Smart watch', attrs: ['vision', 'passing'], names: ['Pulse', 'Radar', 'Compass', 'Scope'], icon: 'watch' },
};

export interface CaseDef {
  id: string;
  label: string;
  price: number;
  odds: Record<Rarity, number>;
}

export const CASES: CaseDef[] = [
  { id: 'bronze', label: 'Bronze case', price: 2000, odds: { common: 70, rare: 25, epic: 5, legendary: 0 } },
  { id: 'silver', label: 'Silver case', price: 8000, odds: { common: 0, rare: 60, epic: 32, legendary: 8 } },
  { id: 'gold', label: 'Gold case', price: 25000, odds: { common: 0, rare: 0, epic: 60, legendary: 40 } },
];

function bag(game: Game) {
  const c = game.career!;
  c.equipment = c.equipment ?? [];
  c.equipped = c.equipped ?? {};
  return { list: c.equipment, on: c.equipped };
}

export function equippedItem(game: Game, slot: Slot): EquipItem | undefined {
  const { list, on } = bag(game);
  return list.find((i) => i.id === on[slot]);
}

function wear(game: Game, item: EquipItem, sign: 1 | -1) {
  const p = careerPlayer(game);
  p.attrs[item.attr] = clamp(p.attrs[item.attr] + sign * item.bonus, 1, 99);
}

// Puts a piece on, taking off whatever was in its slot.
export function equip(game: Game, itemId: string): string {
  const { list, on } = bag(game);
  const item = list.find((i) => i.id === itemId);
  if (!item) return 'You do not have that.';
  const current = equippedItem(game, item.slot);
  if (current?.id === item.id) return `${item.name} is already on.`;
  if (current) wear(game, current, -1);
  wear(game, item, 1);
  on[item.slot] = item.id;
  return `${item.name} on: ${item.attr} +${item.bonus}.`;
}

export function sell(game: Game, itemId: string): string {
  const { list, on } = bag(game);
  const item = list.find((i) => i.id === itemId);
  if (!item) return 'You do not have that.';
  if (on[item.slot] === item.id) return 'Take it off before selling it.';
  game.career!.equipment = list.filter((i) => i.id !== itemId);
  game.career!.money += RARITY[item.rarity].sell;
  return `Sold ${item.name} for ${formatMoney(RARITY[item.rarity].sell)}.`;
}

// Opens a case: pays, rolls a piece, and puts it on if it beats what is in
// its slot. Keepers roll gloves more often; outfield players never do.
export function openCase(game: Game, caseId: string): { ok: boolean; text: string; item?: EquipItem; equipped?: boolean } {
  const c = game.career!;
  const def = CASES.find((x) => x.id === caseId);
  if (!def) return { ok: false, text: 'Unknown case.' };
  if (c.money < def.price) return { ok: false, text: `You need ${formatMoney(def.price)}.` };
  c.money -= def.price;
  const rng = new Rng(game.world.rngState);
  const rarity = rng.weighted(Object.keys(def.odds) as Rarity[], Object.values(def.odds));
  const keeper = careerPlayer(game).position === 'GK';
  const slots = (Object.keys(SLOTS) as Slot[]).filter((s) => (keeper ? s !== 'shinpads' : s !== 'gloves'));
  const slot = keeper && rng.chance(0.4) ? 'gloves' : rng.pick(slots);
  const attr = rng.pick(SLOTS[slot].attrs);
  const name = `${RARITY[rarity].label} ${rng.pick(SLOTS[slot].names)} ${SLOTS[slot].label.toLowerCase()}`;
  const item: EquipItem = { id: `eq${game.world.season}${game.world.week}${rng.int(0, 1e6)}`, slot, name, rarity, attr, bonus: RARITY[rarity].bonus };
  game.world.rngState = rng.state;
  const { list } = bag(game);
  list.push(item);
  const current = equippedItem(game, slot);
  const better = !current || current.bonus < item.bonus;
  if (better) equip(game, item.id);
  return { ok: true, text: better ? `${item.name}! On now: ${attr} +${item.bonus}.` : `${item.name}. Your current one is as good; keep it or sell it.`, item, equipped: better };
}
