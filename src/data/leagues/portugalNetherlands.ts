import { LeagueSeed, club } from '../pack';

// Squads as of the 2025/26 season. Ratings are estimates.

export const PORTUGAL: LeagueSeed[] = [
  {
    id: 'POR1',
    nation: 'POR',
    tier: 1,
    name: 'Liga Portugal',
    clubs: [
      club('Benfica', 'SLB', 85, '#e83030', '#ffffff', `Anatoliy Trubin GK UKR 01 82; Nicolas Otamendi DEF ARG 88 78; Antonio Silva DEF POR 03 80; Tomas Araujo DEF POR 02 77; Samuel Dahl DEF SWE 03 75; Amar Dedic DEF BIH 02 77; Fredrik Aursnes MID NOR 95 80; Richard Rios MID COL 00 79; Leandro Barreiro MID LUX 00 76; Enzo Barrenechea MID ARG 01 77; Georgiy Sudakov MID UKR 02 80; Andreas Schjelderup FWD NOR 04 76; Dodi Lukebakio FWD BEL 97 78; Gianluca Prestianni FWD ARG 06 73; Vangelis Pavlidis FWD GRE 98 81; Franjo Ivanovic FWD CRO 03 75`),
      club('FC Porto', 'FCP', 84, '#003893', '#ffffff', `Diogo Costa GK POR 99 84; Jan Bednarek DEF POL 96 77; Jakub Kiwior DEF POL 00 78; Nehuen Perez DEF ARG 00 77; Alberto Costa DEF POR 03 75; Martim Fernandes DEF POR 06 75; Francisco Moura DEF POR 99 75; Alan Varela MID ARG 01 80; Victor Froholdt MID DEN 06 76; Gabri Veiga MID ESP 02 79; Rodrigo Mora MID POR 07 78; !Pepe FWD BRA 97 77; Borja Sainz FWD ESP 01 77; William Gomes FWD BRA 06 74; Samu Aghehowa FWD ESP 04 79; Deniz Gul FWD SWE 04 73`),
      club('Sporting CP', 'SCP', 85, '#008057', '#ffffff', `Rui Silva GK POR 94 80; Ousmane Diomande DEF CIV 03 81; Goncalo Inacio DEF POR 01 81; Zeno Debast DEF BEL 03 78; Eduardo Quaresma DEF POR 02 76; Maximiliano Araujo DEF URU 00 78; Ivan Fresneda DEF ESP 04 74; Morten Hjulmand MID DEN 99 82; Hidemasa Morita MID JPN 95 79; Giorgi Kochorashvili MID GEO 99 75; Francisco Trincao FWD POR 99 82; !Pote FWD POR 98 80; Geovany Quenda FWD POR 07 77; Geny Catamo FWD MOZ 01 74; Luis Suarez FWD COL 97 80; Fotis Ioannidis FWD GRE 00 78`),
      club('SC Braga', 'SCB', 78, '#d71920', '#ffffff', `Lukas Hornicek GK CZE 02 75; Sikou Niakate DEF MLI 99 74; Gustaf Lagerbielke DEF SWE 00 74; Victor Gomez DEF ESP 00 73; Joao Moutinho MID POR 86 74; Rodrigo Zalazar MID URU 99 79; Ricardo Horta FWD POR 94 79; Amine El Ouazzani FWD MAR 01 74; Fran Navarro FWD ESP 98 74; Gabri Martinez FWD ESP 03 72`),
      club('Vitoria Guimaraes', 'VSC', 72, '#ffffff', '#000000', `Charles GK BRA 94 73; Mikel Villanueva DEF VEN 93 71; Tiago Silva MID POR 93 72; Samu Silva MID POR 03 70; Nelson Oliveira FWD POR 91 71`),
      club('Santa Clara', 'SCL', 66, '#e30613', '#ffffff', `Gabriel Batista GK BRA 98 72; Luis Rocha DEF POR 93 69; Adriano Firmino MID BRA 01 69; Vinicius Lopes FWD BRA 99 70`),
      club('Famalicao', 'FAM', 66, '#0d2c6c', '#ffffff', `Lazar Carevic GK MNE 99 70; Justin de Haas DEF NED 00 70; Gustavo Sa MID POR 04 72; Mathias de Amorim MID FRA 98 69; Sorriso FWD BRA 01 70`),
      club('Estoril Praia', 'EST', 64, '#ffd700', '#003e7e', `Joel Robles GK ESP 90 70; Ferro DEF POR 97 69; Jordan Holsgrove MID SCO 99 69; Yanis Begraoui FWD MAR 01 72`),
      club('Casa Pia', 'CPA', 61, '#000000', '#ffffff', `Patrick Sequeira GK CRC 99 69; Jose Fonte DEF POR 83 66; Larrazabal MID ESP 01 67; Cassiano FWD BRA 89 66`),
      club('Moreirense', 'MOR', 60, '#00843d', '#ffffff', `Andre Ferreira GK POR 96 68; Marcelo DEF POR 93 66; Alanzinho MID BRA 03 67; Guilherme Schettine FWD BRA 95 67`),
      club('Rio Ave', 'RAV', 61, '#00843d', '#ffffff', `Cezary Miszta GK POL 01 69; Andreas Ntoi DEF GRE 01 67; Brandon Aguilera MID CRC 03 68; Clayton FWD BRA 98 69`),
      club('Arouca', 'ARO', 60, '#ffd700', '#003e7e', `Nico Mantl GK GER 00 69; Jose Fontan DEF ESP 00 67; Pablo Gozalbez MID ESP 01 68; Ivo Rodrigues FWD POR 95 68`),
      club('Gil Vicente', 'GIL', 61, '#e30613', '#003e7e', `Andrew GK BRA 01 70; Jonathan Buatu DEF ANG 93 67; Luis Esteves MID POR 01 68; Pablo FWD BRA 01 69`),
      club('CD Nacional', 'NAC', 58, '#000000', '#ffffff', `Lucas Franca GK BRA 96 67; Jose Gomes DEF POR 99 65; Daniel Penha MID BRA 98 66; Jesus Ramirez FWD VEN 98 67`),
      club('Estrela Amadora', 'EAM', 58, '#e30613', '#00843d', `Renan Ribeiro GK BRA 90 67; Pedro Sa DEF POR 93 64; Ianis Stoica FWD ROU 03 66`),
      club('AVS', 'AVS', 56, '#ffd700', '#000000', `Guillermo Ochoa GK MEX 85 70; Tunde Akinsola FWD NGA 99 65`),
      club('Alverca', 'ALV', 57, '#e30613', '#ffffff', `Matheus Mendes GK BRA 99 67; Sandro Lima FWD BRA 90 65`),
      club('Tondela', 'TON', 56, '#00843d', '#ffd700', `Bernardo Fontes GK POR 01 66; Hugo Felix MID POR 04 65`),
    ],
  },
];

export const NETHERLANDS: LeagueSeed[] = [
  {
    id: 'NED1',
    nation: 'NED',
    tier: 1,
    name: 'Eredivisie',
    clubs: [
      club('PSV', 'PSV', 82, '#ed1c24', '#ffffff', `Matej Kovar GK CZE 00 77; Armando Obispo DEF NED 99 75; Ryan Flamingo DEF NED 02 77; Sergino Dest DEF USA 00 77; Mauro Junior DEF BRA 99 75; Joey Veerman MID NED 98 79; Jerdy Schouten MID NED 97 77; Ismael Saibari MID MAR 01 79; Paul Wanner MID GER 05 75; Guus Til MID NED 97 76; Ivan Perisic FWD CRO 89 76; Couhaib Driouech FWD MAR 02 74; Dennis Man FWD ROU 98 75; Ricardo Pepi FWD USA 03 76`),
      club('Ajax', 'AJA', 82, '#ffffff', '#d2122e', `Vitezslav Jaros GK CZE 01 76; Remko Pasveer GK NED 83 72; Josip Sutalo DEF CRO 00 77; Youri Baas DEF NED 03 76; Anton Gaaei DEF DEN 02 75; Owen Wijndal DEF NED 99 73; Kenneth Taylor MID NED 02 78; Davy Klaassen MID NED 93 74; Jorthy Mokio MID BEL 08 70; Oscar Gloukh MID ISR 04 77; Mika Godts FWD BEL 05 76; Steven Berghuis FWD NED 91 74; Wout Weghorst FWD NED 92 74; Kasper Dolberg FWD DEN 97 76`),
      club('Feyenoord', 'FEY', 81, '#ed1c24', '#ffffff', `Timon Wellenreuther GK GER 95 76; Tsuyoshi Watanabe DEF JPN 97 75; Gernot Trauner DEF AUT 92 74; Givairo Read DEF NED 06 74; Jordan Bos DEF AUS 02 74; Quinten Timber MID NED 01 78; Hwang In-beom MID KOR 96 78; Sem Steijn MID NED 01 76; Anis Hadj Moussa FWD ALG 02 77; Leo Sauer FWD SVK 05 72; Ayase Ueda FWD JPN 98 77; Gonzalo Borges FWD URU 01 72`),
      club('AZ Alkmaar', 'AZ', 76, '#e30613', '#ffffff', `Rome-Jayden Owusu-Oduro GK NED 04 74; Alexandre Penetra DEF POR 01 73; Wouter Goes DEF NED 04 73; Jordy Clasie MID NED 91 72; Sven Mijnans MID NED 00 76; Peer Koopmeiners MID NED 00 72; Ibrahim Sadiq FWD GHA 00 72; Troy Parrott FWD IRL 02 75; Mexx Meerdink FWD NED 03 72`),
      club('FC Twente', 'TWE', 75, '#e30613', '#ffffff', `Lars Unnerstall GK GER 90 75; Mees Hilgers DEF NED 01 74; Robin Propper DEF NED 93 72; Michel Vlap MID NED 97 74; Youri Regeer MID NED 03 72; Sayfallah Ltaief FWD TUN 00 73; Ricky van Wolfswinkel FWD NED 89 72; Daan Rots FWD NED 01 73`),
      club('FC Utrecht', 'UTR', 74, '#e30613', '#ffffff', `Vasilios Barkas GK GRE 94 74; Mike van der Hoorn DEF NED 92 71; Nick Viergever DEF NED 89 70; Alonzo Engwanda MID NED 04 70; Victor Jensen MID DEN 00 74; Yoann Cathline FWD FRA 02 74; David Min FWD NED 99 72`),
      club('Go Ahead Eagles', 'GAE', 68, '#e30613', '#ffd700', `Jari De Busser GK BEL 99 71; Joris Kramer DEF NED 96 68; Evert Linthorst MID NED 99 69; Mats Deijl DEF NED 97 69; Victor Edvardsen FWD SWE 96 71`),
      club('NEC Nijmegen', 'NEC', 67, '#e30613', '#00843d', `Stijn van Gassel GK NED 96 70; Philippe Sandler DEF NED 97 68; Kodai Sano MID JPN 03 72; Sami Ouaissa FWD MAR 04 69; Koki Ogawa FWD JPN 97 70`),
      club('SC Heerenveen', 'HEE', 66, '#0047ab', '#ffffff', `Andries Noppert GK NED 94 71; Sven van Beek DEF NED 94 67; Joris van Overeem MID NED 94 68; Ilias Sebaoui FWD NED 01 69`),
      club('PEC Zwolle', 'PEC', 62, '#0047ab', '#ffffff', `Tom de Graaff GK NED 04 67; Anselmo Garcia MacNulty DEF IRL 03 66; Dylan Vente FWD NED 99 68`),
      club('Sparta Rotterdam', 'SPA', 63, '#e30613', '#ffffff', `Nick Olij GK NED 95 70; Marvin Young DEF NED 97 66; Joshua Kitolano MID NOR 01 68; Tobias Lauritsen FWD NOR 97 69`),
      club('Fortuna Sittard', 'FOR', 62, '#ffd700', '#00843d', `Mattijs Branderhorst GK NED 93 68; Ivo Pinto DEF POR 90 66; Kristoffer Peterson FWD SWE 94 68`),
      club('FC Groningen', 'GRO', 63, '#00843d', '#ffffff', `Etienne Vaessen GK NED 95 69; Marco Rente DEF NED 97 66; Stije Resink MID NED 03 67; Thom van Bergen FWD NED 00 69`),
      club('Heracles Almelo', 'HER', 60, '#000000', '#ffffff', `Fabian de Keijzer GK NED 00 67; Damon Mirani DEF NED 96 65; Jizz Hornkamp FWD NED 98 67`),
      club('NAC Breda', 'NAC', 60, '#ffd700', '#000000', `Daniel Bielica GK POL 99 67; Boy Kemper DEF NED 96 64; Clint Leemans MID NED 95 66; Elias Mar Omarsson FWD ISL 97 67`),
      club('Excelsior', 'EXC', 57, '#e30613', '#000000', `Calvin Raatsie GK NED 02 64; Arthur Zagre DEF FRA 01 64; Noah Naujoks MID GER 02 65; Derensili Sanches Fernandes FWD NED 02 65`),
      club('FC Volendam', 'VOL', 56, '#f58220', '#ffffff', `Kayne van Oevelen GK BEL 03 65; Robert Muhren FWD NED 89 65`),
      club('Telstar', 'TEL', 54, '#ffffff', '#0047ab', `Ronald Koeman Jr GK NED 95 64; Danny Bakker MID NED 95 63`),
    ],
  },
];
