import { Game, Message, MessageAction, MessageKind } from './types';

const MAX_MESSAGES = 100;

export function addMessage(game: Game, kind: MessageKind, title: string, body: string, action?: MessageAction): Message {
  const msg: Message = {
    id: `m${game.world.nextId++}`,
    season: game.world.season,
    week: game.world.week,
    kind,
    title,
    body,
    read: false,
    action,
  };
  game.inbox.unshift(msg);
  // Drop the oldest messages that need no answer so saves stay small.
  if (game.inbox.length > MAX_MESSAGES) {
    const open = game.inbox.filter((m) => m.action && !m.action.resolved);
    const rest = game.inbox.filter((m) => !(m.action && !m.action.resolved)).slice(0, MAX_MESSAGES - open.length);
    game.inbox = [...open, ...rest].sort((a, b) => b.season * 100 + b.week - (a.season * 100 + a.week));
  }
  return msg;
}

export function expireOffers(game: Game): void {
  for (const m of game.inbox) {
    const a = m.action;
    if (!a || a.resolved || a.weeksLeft === undefined) continue;
    a.weeksLeft--;
    if (a.weeksLeft < 0) a.resolved = 'expired';
  }
}

export function openOffers(game: Game): Message[] {
  return game.inbox.filter((m) => m.action && !m.action.resolved);
}

export function hasOpen(game: Game, type: MessageAction['type'], playerId?: string): boolean {
  return game.inbox.some((m) => m.action && !m.action.resolved && m.action.type === type && (!playerId || m.action.playerId === playerId));
}

export function unreadCount(game: Game): number {
  return game.inbox.filter((m) => !m.read).length;
}
