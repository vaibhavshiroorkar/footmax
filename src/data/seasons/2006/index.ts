import { DataPack } from '../../pack';
import { ENGLAND } from './england';
import { SPAIN } from './spain';
import { ITALY } from './italy';
import { GERMANY } from './germany';
import { FRANCE } from './france';
import { PORTUGAL, NETHERLANDS } from './portugalNetherlands';
import { OTHER_CLUBS } from './otherClubs';

// The 2006/07 season: Italy are world champions, France the beaten
// finalists; Juventus, Napoli and Genoa are in Serie B (not simulated).
export const PACK: DataPack = {
  format: 'footmax-pack',
  version: 1,
  name: 'FootMax 2006/07',
  startYear: 2006,
  nationStrength: {
    ITA: 75, FRA: 74, BRA: 76, ARG: 74, GER: 73, ENG: 72, POR: 72, ESP: 72, NED: 70,
    CZE: 67, CRO: 65, UKR: 63, SWE: 64, MEX: 63, USA: 61, SUI: 62, TUR: 63, GRE: 62,
    SRB: 63, ROU: 62, DEN: 63, RUS: 63, POL: 60, NOR: 60, IRL: 60, SCO: 61, BEL: 60,
    BUL: 58, ISR: 59, AUS: 61, JPN: 61, KOR: 61, IRN: 58, KSA: 55, CIV: 64, GHA: 62,
    CMR: 63, NGA: 63, SEN: 61, EGY: 60, TUN: 59, MAR: 58, TOG: 53, ANG: 53, URU: 63,
    COL: 61, PAR: 61, ECU: 61, CHI: 59, PER: 56, AUT: 56, SVK: 58, SVN: 56, BIH: 55,
    FIN: 56, WAL: 55, NIR: 54, HUN: 54, MKD: 54, LTU: 52, LVA: 52, ALB: 52, QAT: 48,
    CRC: 57, TRI: 52, JAM: 52, HON: 55, CAN: 54, MLI: 58, ALG: 55, RSA: 56,
  },
  leagues: [...ENGLAND, ...SPAIN, ...ITALY, ...GERMANY, ...FRANCE, ...PORTUGAL, ...NETHERLANDS],
  otherClubs: OTHER_CLUBS,
};
