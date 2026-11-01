import { DataPack } from './pack';
import { ENGLAND } from './leagues/england';
import { SPAIN } from './leagues/spain';
import { ITALY } from './leagues/italy';
import { GERMANY } from './leagues/germany';
import { FRANCE } from './leagues/france';
import { NETHERLANDS, PORTUGAL } from './leagues/portugalNetherlands';
import { OTHER_CLUBS } from './otherClubs';

export const BUILTIN_PACK: DataPack = {
  format: 'footmax-pack',
  version: 1,
  name: 'FootMax 2025/26',
  leagues: [...ENGLAND, ...SPAIN, ...ITALY, ...GERMANY, ...FRANCE, ...PORTUGAL, ...NETHERLANDS],
  otherClubs: OTHER_CLUBS,
};
