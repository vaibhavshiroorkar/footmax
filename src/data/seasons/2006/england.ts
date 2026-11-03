import { LeagueSeed, club } from '../../pack';

export const ENGLAND: LeagueSeed[] = [
  { id: 'ENG1', nation: 'ENG', tier: 1, name: 'Premier League', clubs: [] },
  { id: 'ENG2', nation: 'ENG', tier: 2, name: 'Championship', parent: 'ENG1', swap: 3, clubs: [] },
];
void club;
