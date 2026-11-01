import { OtherClubsSeed, club } from './pack';

// Real clubs outside the simulated leagues. Their players exist in the
// world (transfers, national teams) but the clubs play no league games
// unless a career or manager game starts in that nation, which builds the
// domestic league around them. Squads as of 2025/26; ratings are estimates.

export const OTHER_CLUBS: OtherClubsSeed[] = [
  {
    nation: 'KSA',
    clubs: [
      club('Al Hilal', 'HIL', 82, '#0055a5', '#ffffff', `Yassine Bounou GK MAR 91 84; Kalidou Koulibaly DEF SEN 91 80; Joao Cancelo DEF POR 94 82; Theo Hernandez DEF FRA 97 84; Hassan Tambakti DEF KSA 99 72; Ali Al Bulaihi DEF KSA 89 70; Ruben Neves MID POR 97 82; Sergej Milinkovic-Savic MID SRB 95 82; Mohamed Kanno MID KSA 94 73; Nasser Al Dawsari MID KSA 98 71; !Malcom FWD BRA 97 80; Darwin Nunez FWD URU 99 81; Marcos Leonardo FWD BRA 03 77; Salem Al Dawsari FWD KSA 91 77`),
      club('Al Nassr', 'NAS', 80, '#ffd700', '#0033a0', `!Bento GK BRA 99 79; Nawaf Al Aqidi GK KSA 00 70; Inigo Martinez DEF ESP 91 80; Mohamed Simakan DEF FRA 00 79; Sultan Al Ghannam DEF KSA 94 72; Marcelo Brozovic MID CRO 92 80; Joao Felix FWD POR 99 79; Kingsley Coman FWD FRA 96 81; Sadio Mane FWD SEN 92 80; Cristiano Ronaldo FWD POR 85 84; Abdulrahman Ghareeb FWD KSA 97 71; Ayman Yahya FWD KSA 01 70`),
      club('Al Ittihad', 'ITT', 79, '#ffd700', '#000000', `Predrag Rajkovic GK SRB 95 79; Danilo Pereira DEF POR 91 76; N'Golo Kante MID FRA 91 82; !Fabinho MID BRA 93 79; Houssem Aouar MID ALG 98 77; Abdulrahman Al Oboud MID KSA 95 70; Moussa Diaby FWD FRA 99 80; Steven Bergwijn FWD NED 97 77; Karim Benzema FWD FRA 87 83`),
      club('Al Ahli', 'AHL', 79, '#00843d', '#ffffff', `Edouard Mendy GK SEN 92 80; Merih Demiral DEF TUR 98 80; Roger Ibanez DEF BRA 98 79; Franck Kessie MID CIV 96 80; Enzo Millot MID FRA 02 78; Riyad Mahrez FWD ALG 91 80; !Galeno FWD BRA 97 79; Ivan Toney FWD ENG 96 81; Firas Al Buraikan FWD KSA 00 72`),
      club('Al Qadsiah', 'QAD', 72, '#e30613', '#ffd700', `Koen Casteels GK BEL 92 78; !Nacho DEF ESP 90 77; Julian Quinones FWD MEX 97 76; Mateo Retegui FWD ITA 99 80`),
      club('Al Ettifaq', 'ETT', 70, '#00843d', '#e30613', `Georginio Wijnaldum MID NED 90 76; Moussa Dembele FWD FRA 96 75`),
    ],
  },
  {
    nation: 'USA',
    clubs: [
      club('Inter Miami', 'MIA', 74, '#f7b5cd', '#231f20', `Jordi Alba DEF ESP 89 76; Sergio Busquets MID ESP 88 76; Rodrigo De Paul MID ARG 94 80; Lionel Messi FWD ARG 87 86; Luis Suarez FWD URU 87 77; Tadeo Allende FWD ARG 99 74`),
      club('LAFC', 'LAF', 72, '#000000', '#c39e6d', `Hugo Lloris GK FRA 86 77; Timothy Tillman MID USA 99 72; !Son Heung-min FWD KOR 92 83; Denis Bouanga FWD GAB 94 79`),
      club('LA Galaxy', 'LAG', 70, '#00245d', '#ffd200', `Marco Reus MID GER 89 76; Riqui Puig MID ESP 99 77; Joseph Paintsil FWD GHA 97 74`),
      club('FC Cincinnati', 'CIN', 69, '#003087', '#fe5000', `Matt Miazga DEF USA 95 71; !Evander MID BRA 98 77`),
      club('Vancouver Whitecaps', 'VAN', 69, '#ffffff', '#00245e', `Thomas Muller MID GER 89 76; Brian White FWD USA 96 72`),
      club('Atlanta United', 'ATL', 67, '#80000a', '#000000', `Miguel Almiron MID PAR 94 74`),
    ],
  },
  {
    nation: 'BRA',
    clubs: [
      club('Flamengo', 'FLA', 77, '#e30613', '#000000', `Agustin Rossi GK ARG 95 77; Leo Ortiz DEF BRA 96 76; !Danilo DEF BRA 91 74; Alex Sandro DEF BRA 91 73; !Jorginho MID ITA 91 77; Erick Pulgar MID CHI 94 74; Giorgian de Arrascaeta MID URU 94 80; Jorge Carrascal MID COL 98 76; Samuel Lino FWD BRA 99 76; Gonzalo Plata FWD ECU 00 76; Bruno Henrique FWD BRA 90 74; !Pedro FWD BRA 97 78`),
      club('Palmeiras', 'PAL', 76, '#006437', '#ffffff', `!Weverton GK BRA 87 76; Gustavo Gomez DEF PAR 93 78; Joaquin Piquerez DEF URU 98 77; Andreas Pereira MID BRA 96 77; Raphael Veiga MID BRA 95 76; Vitor Roque FWD BRA 05 78; Jose Manuel Lopez FWD ARG 00 76; Facundo Torres FWD URU 00 76`),
      club('Botafogo', 'BOT', 73, '#000000', '#ffffff', `John Victor GK BRA 96 74; Alex Telles DEF BRA 92 73; Marlon Freitas MID BRA 95 73; Jefferson Savarino FWD VEN 96 75; Arthur Cabral FWD BRA 98 73`),
      club('Santos', 'SAN', 70, '#ffffff', '#000000', `Gabriel Brazao GK BRA 00 72; Alvaro Barreal MID ARG 00 71; !Neymar FWD BRA 92 80`),
      club('Corinthians', 'COR', 72, '#ffffff', '#000000', `Hugo Souza GK BRA 99 74; Rodrigo Garro MID ARG 97 76; Memphis Depay FWD NED 94 78; Yuri Alberto FWD BRA 01 74`),
      club('Fluminense', 'FLU', 71, '#7a0026', '#00613c', `!Fabio GK BRA 80 72; Thiago Silva DEF BRA 84 75; !Ganso MID BRA 89 71; German Cano FWD ARG 88 72`),
      club('Sao Paulo', 'SAO', 71, '#ffffff', '#e30613', `!Rafael GK BRA 89 73; !Oscar MID BRA 91 74; Lucas Moura FWD BRA 92 75; Jonathan Calleri FWD ARG 93 73`),
      club('Atletico Mineiro', 'CAM', 71, '#000000', '#ffffff', `!Everson GK BRA 90 73; Gustavo Scarpa MID BRA 94 74; !Hulk FWD BRA 86 76`),
      club('Internacional', 'INT', 70, '#e30613', '#ffffff', `Sergio Rochet GK URU 93 74; Alan Patrick MID BRA 91 74; Enner Valencia FWD ECU 89 73`),
      club('Cruzeiro', 'CRU', 71, '#0047ab', '#ffffff', `Cassio Ramos GK BRA 87 72; Matheus Pereira MID BRA 96 76; Kaio Jorge FWD BRA 02 75; Gabriel Barbosa FWD BRA 96 74`),
      club('Vasco da Gama', 'VAS', 68, '#000000', '#ffffff', `Philippe Coutinho MID BRA 92 75; Pablo Vegetti FWD ARG 88 73`),
    ],
  },
  {
    nation: 'ARG',
    clubs: [
      club('River Plate', 'RIV', 74, '#ffffff', '#e30613', `Franco Armani GK ARG 86 75; Gonzalo Montiel DEF ARG 97 75; German Pezzella DEF ARG 91 74; Marcos Acuna DEF ARG 91 74; Juan Fernando Quintero MID COL 93 75; Maximiliano Salas FWD ARG 97 74; Sebastian Driussi FWD ARG 96 74; Miguel Borja FWD COL 93 74`),
      club('Boca Juniors', 'BOC', 73, '#0033a0', '#ffd700', `Agustin Marchesin GK ARG 88 73; Marcos Rojo DEF ARG 90 71; Leandro Paredes MID ARG 94 78; Ander Herrera MID ESP 89 72; Miguel Merentiel FWD URU 96 74; Exequiel Zeballos FWD ARG 02 73; Edinson Cavani FWD URU 87 73`),
      club('Racing Club', 'RAC', 70, '#75aadb', '#ffffff', `Gabriel Arias GK CHI 87 72; Santiago Sosa MID ARG 99 71; Adrian Martinez FWD ARG 92 73`),
    ],
  },
  {
    nation: 'TUR',
    clubs: [
      club('Galatasaray', 'GAL', 79, '#a90432', '#fdb912', `Ugurcan Cakir GK TUR 96 79; Davinson Sanchez DEF COL 96 79; Abdulkerim Bardakci DEF TUR 94 76; Wilfried Singo DEF CIV 00 77; Lucas Torreira MID URU 96 79; Gabriel Sara MID BRA 99 78; Mario Lemina MID GAB 93 75; Leroy Sane FWD GER 96 81; Baris Alper Yilmaz FWD TUR 00 79; Yunus Akgun FWD TUR 00 75; Victor Osimhen FWD NGA 98 85; Mauro Icardi FWD ARG 93 78`),
      club('Fenerbahce', 'FEN', 78, '#ffed00', '#00205b', `!Ederson GK BRA 93 83; Milan Skriniar DEF SVK 95 80; Nelson Semedo DEF POR 93 76; Jayden Oosterwolde DEF NED 01 74; !Fred MID BRA 93 77; Edson Alvarez MID MEX 97 78; Marco Asensio MID ESP 96 79; !Talisca MID BRA 94 77; Kerem Akturkoglu FWD TUR 98 79; Youssef En-Nesyri FWD MAR 97 79; Jhon Duran FWD COL 03 79; Dorgeles Nene FWD MLI 02 74`),
      club('Besiktas', 'BJK', 75, '#000000', '#ffffff', `Mert Gunok GK TUR 89 74; Gabriel Paulista DEF BRA 90 72; Wilfred Ndidi MID NGA 96 77; Orkun Kokcu MID TUR 00 80; Rafa Silva MID POR 93 78; Cengiz Under FWD TUR 97 74; Ernest Muci FWD ALB 01 74; Tammy Abraham FWD ENG 97 76`),
      club('Trabzonspor', 'TRA', 71, '#7a1e3a', '#5cbfeb', `Andre Onana GK CMR 96 79; Paul Onuachu FWD NGA 94 74; Anthony Nwakaeme FWD NGA 89 71`),
      club('Basaksehir', 'IBFK', 69, '#f58220', '#002a5c', `Abbosbek Fayzullaev MID UZB 03 72; Eldor Shomurodov FWD UZB 95 74; Davie Selke FWD GER 95 71`),
    ],
  },
  {
    nation: 'SCO',
    clubs: [
      club('Celtic', 'CEL', 75, '#018749', '#ffffff', `Kasper Schmeichel GK DEN 86 77; Cameron Carter-Vickers DEF USA 97 77; Alistair Johnston DEF CAN 98 75; Liam Scales DEF IRL 98 72; Callum McGregor MID SCO 93 77; Reo Hatate MID JPN 97 77; Arne Engels MID BEL 03 75; Daizen Maeda FWD JPN 97 79; Benjamin Nygren FWD SWE 01 74; Kelechi Iheanacho FWD NGA 96 74`),
      club('Rangers', 'RAN', 73, '#1b458f', '#ffffff', `Jack Butland GK ENG 93 75; John Souttar DEF SCO 96 72; James Tavernier DEF ENG 91 74; Nicolas Raskin MID BEL 01 75; Mohamed Diomande MID CIV 01 75; Vaclav Cerny FWD CZE 97 74; Djeidi Gassama FWD FRA 03 72`),
      club('Hearts', 'HEA', 66, '#7a1e3a', '#ffffff', `Lawrence Shankland FWD SCO 95 70`),
    ],
  },
  {
    nation: 'BEL',
    clubs: [
      club('Club Brugge', 'CLU', 76, '#0047ab', '#000000', `Simon Mignolet GK BEL 88 75; Joel Ordonez DEF ECU 04 75; Brandon Mechele DEF BEL 93 73; Raphael Onyedika MID NGA 01 77; Hans Vanaken MID BEL 92 76; Hugo Vetlesen MID NOR 00 74; Christos Tzolis FWD GRE 02 79; Carlos Forbs FWD POR 04 75; Romeo Vermant FWD BEL 04 72`),
      club('Anderlecht', 'AND', 72, '#5c2d91', '#ffffff', `Colin Coosemans GK BEL 92 71; Jan-Carlo Simic DEF SRB 05 72; Yari Verschaeren MID BEL 01 74; Luis Vazquez FWD ARG 01 72`),
      club('Union SG', 'USG', 72, '#ffd700', '#0047ab', `Anouar Ait El Hadj MID BEL 02 72; Promise David FWD CAN 01 74`),
      club('Genk', 'GNK', 72, '#0047ab', '#ffffff', `Hendrik Van Crombrugge GK BEL 93 73; Bryan Heynen MID BEL 97 72; Jarne Steuckers MID BEL 02 72`),
    ],
  },
  {
    nation: 'MEX',
    clubs: [
      club('Club America', 'AME', 73, '#ffd700', '#0033a0', `Luis Angel Malagon GK MEX 97 73; Israel Reyes DEF MEX 00 72; Alvaro Fidalgo MID ESP 97 75; Brian Rodriguez FWD URU 00 73; Alejandro Zendejas FWD USA 98 72; Henry Martin FWD MEX 92 72`),
      club('Monterrey', 'MTY', 73, '#002d72', '#ffffff', `Sergio Ramos DEF ESP 86 77; Sergio Canales MID ESP 91 76; Oliver Torres MID ESP 94 73; Lucas Ocampos FWD ARG 94 75; Anthony Martial FWD FRA 95 75; German Berterame FWD MEX 98 74`),
      club('Tigres UANL', 'TIG', 72, '#fdb913', '#002d72', `Nahuel Guzman GK ARG 86 72; Juan Brunetta MID ARG 97 74; Angel Correa FWD ARG 95 76; Andre-Pierre Gignac FWD FRA 85 72`),
      club('Cruz Azul', 'CAZ', 71, '#0047ab', '#ffffff', `Kevin Mier GK COL 00 73; Erik Lira MID MEX 00 72; Ignacio Rivero MID URU 92 72; Jose Paradela MID ARG 98 73`),
      club('Toluca', 'TOL', 71, '#e30613', '#ffffff', `Marcel Ruiz MID MEX 00 72; Alexis Vega FWD MEX 97 74; !Paulinho FWD POR 92 74`),
      club('Guadalajara', 'GDL', 69, '#e30613', '#0033a0', `Roberto Alvarado MID MEX 98 72`),
    ],
  },
  {
    nation: 'EGY',
    clubs: [
      club('Al Ahly', 'AHY', 73, '#e30613', '#ffffff', `Mohamed El Shenawy GK EGY 88 74; Yasser Ibrahim DEF EGY 93 70; Emam Ashour MID EGY 98 74; Mohamed Ali Ben Romdhane MID TUN 99 73; !Trezeguet FWD EGY 94 74; Ahmed Sayed Zizo FWD EGY 95 74`),
      club('Pyramids', 'PYR', 69, '#0a2240', '#ffffff', `Fiston Mayele FWD COD 94 73`),
    ],
  },
  {
    nation: 'QAT',
    clubs: [
      club('Al Sadd', 'SAD', 70, '#ffffff', '#000000', `Romain Saiss DEF MAR 90 72; Akram Afif FWD QAT 96 77; Roberto Firmino FWD BRA 91 76; Rafa Mujica FWD ESP 98 72`),
      club('Al Duhail', 'DUH', 68, '#7a1e3a', '#ffffff', `Luis Alberto MID ESP 92 76; Krzysztof Piatek FWD POL 95 73`),
      club('Al Rayyan', 'RAY', 67, '#e30613', '#ffffff', `Roger Guedes FWD BRA 96 74; Aleksandar Mitrovic FWD SRB 94 77`),
      club('Al Gharafa', 'GHA', 66, '#ffd700', '#0047ab', `!Joselu FWD ESP 90 74; Florinel Coman FWD ROU 98 72`),
      club('Al Arabi', 'ARB', 64, '#e30613', '#ffffff', `Pablo Sarabia MID ESP 92 74`),
    ],
  },
  {
    nation: 'GRE',
    clubs: [
      club('Olympiacos', 'OLY', 74, '#e30613', '#ffffff', `Konstantinos Tzolakis GK GRE 02 75; Panagiotis Retsos DEF GRE 98 72; Lorenzo Pirola DEF ITA 02 73; !Chiquinho MID POR 95 76; Santiago Hezze MID ARG 01 74; Daniel Podence FWD POR 95 76; Gelson Martins FWD POR 95 75; Ayoub El Kaabi FWD MAR 93 78; Mehdi Taremi FWD IRN 92 78`),
      club('PAOK', 'PAO', 72, '#000000', '#ffffff', `Jiri Pavlenka GK CZE 92 74; Giannis Konstantelias MID GRE 03 76; Dimitrios Pelkas MID GRE 93 73; Andrija Zivkovic FWD SRB 96 75; Fedor Chalov FWD RUS 98 73`),
      club('Panathinaikos', 'PAN', 71, '#00843d', '#ffffff', `Alban Lafont GK FRA 99 75; Filip Djuricic MID SRB 92 73; Facundo Pellistri FWD URU 01 74; Anass Zaroury FWD MAR 00 72; Karol Swiderski FWD POL 97 72`),
      club('AEK Athens', 'AEK', 71, '#ffd700', '#000000', `Orbelin Pineda MID MEX 96 74; Mijat Gacinovic MID SRB 95 72; Luka Jovic FWD SRB 97 73`),
    ],
  },
  {
    nation: 'CRO',
    clubs: [
      club('Dinamo Zagreb', 'DIN', 70, '#0047ab', '#ffffff', `Ivan Nevistic GK CRO 98 72; Kevin Theophile-Catherine DEF FRA 89 70; Josip Misic MID CRO 94 71; Sandro Kulenovic FWD CRO 00 71; Dion Drena Beljo FWD CRO 02 70`),
      club('Hajduk Split', 'HAJ', 68, '#ffffff', '#0047ab', `Ivan Rakitic MID CRO 88 72; Marko Livaja FWD CRO 93 72`),
    ],
  },
  {
    nation: 'SRB',
    clubs: [club('Red Star Belgrade', 'CZV', 70, '#e30613', '#ffffff', `Rade Krunic MID BIH 93 72; Mirko Ivanic MID MNE 93 72; Timi Max Elsnik MID SVN 98 71; Bruno Duarte FWD BRA 96 71`)],
  },
  {
    nation: 'AUT',
    clubs: [
      club('Red Bull Salzburg', 'RBS', 72, '#ffffff', '#e30613', `Alexander Schlager GK AUT 96 72; Stefan Lainer DEF AUT 92 71; Mads Bidstrup MID DEN 01 73; Maurits Kjaergaard MID DEN 03 74; Kerim Alajbegovic FWD BIH 07 70`),
      club('Sturm Graz', 'STU', 69, '#000000', '#ffffff', `Otar Kiteishvili MID GEO 96 73`),
    ],
  },
  {
    nation: 'SUI',
    clubs: [
      club('Basel', 'BAS', 70, '#e30613', '#0047ab', `Marwin Hitz GK SUI 87 70; Xherdan Shaqiri MID SUI 91 74; Albian Ajeti FWD SUI 97 71`),
      club('Young Boys', 'YB', 70, '#ffd700', '#000000', `Marvin Keller GK SUI 02 71; Loris Benito DEF SUI 92 70; Christian Fassnacht FWD SUI 93 71`),
    ],
  },
  {
    nation: 'DEN',
    clubs: [
      club('Copenhagen', 'FCK', 70, '#ffffff', '#0047ab', `Dominik Kotarski GK CRO 00 72; Gabriel Pereira DEF BRA 01 72; Viktor Claesson MID SWE 92 71; Jordan Larsson FWD SWE 97 72; Youssoufa Moukoko FWD GER 04 72; Mohamed Elyounoussi FWD NOR 94 71`),
      club('Midtjylland', 'FCM', 70, '#000000', '#e30613', `Elias Rafn Olafsson GK ISL 00 73; Aral Simsir FWD TUR 02 73; Dario Osorio FWD CHI 04 72`),
    ],
  },
  {
    nation: 'NOR',
    clubs: [club('Bodo/Glimt', 'BOD', 70, '#ffd700', '#000000', `Nikita Haikin GK NOR 95 72; Patrick Berg MID NOR 97 73; Jens Petter Hauge FWD NOR 99 74; Kasper Hogh FWD DEN 00 74; Ole Didrik Blomberg FWD NOR 00 70`)],
  },
  {
    nation: 'CZE',
    clubs: [
      club('Slavia Prague', 'SLA', 70, '#e30613', '#ffffff', `Jindrich Stanek GK CZE 96 74; David Zima DEF CZE 00 72; Lukas Provod MID CZE 96 74; Tomas Chory FWD CZE 95 73; Mojmir Chytil FWD CZE 99 72`),
      club('Sparta Prague', 'SPA', 70, '#7a1e3a', '#ffffff', `Asger Sorensen DEF DEN 96 70; Kaan Kairinen MID FIN 98 72; Lukas Haraslin FWD SVK 96 74; Veljko Birmancevic FWD SRB 98 72`),
    ],
  },
  {
    nation: 'UKR',
    clubs: [
      club('Shakhtar Donetsk', 'SHA', 70, '#f58220', '#000000', `Dmytro Riznyk GK UKR 99 73; Valeriy Bondar DEF UKR 99 74; Mykola Matviyenko DEF UKR 96 73; Oleh Ocheretko MID UKR 03 71; Kauan Elias FWD BRA 04 71`),
      club('Dynamo Kyiv', 'DYN', 68, '#ffffff', '#0047ab', `Georgiy Bushchan GK UKR 94 72; Volodymyr Brazhko MID UKR 02 71; Andriy Yarmolenko FWD UKR 89 70; Vladyslav Kabaev FWD UKR 95 70`),
    ],
  },
  {
    nation: 'POL',
    clubs: [
      club('Legia Warsaw', 'LEG', 66, '#ffffff', '#00843d', `Kacper Tobiasz GK POL 02 70; Bartosz Kapustka MID POL 96 70`),
      club('Lech Poznan', 'LPO', 66, '#0047ab', '#ffffff', `Joel Pereira DEF POR 96 69; Mikael Ishak FWD SWE 93 72`),
    ],
  },
  {
    nation: 'HUN',
    clubs: [club('Ferencvaros', 'FTC', 66, '#00843d', '#ffffff', `Denes Dibusz GK HUN 90 70; Barnabas Varga FWD HUN 94 71`)],
  },
  {
    nation: 'RSA',
    clubs: [
      club('Mamelodi Sundowns', 'SUN', 65, '#ffd700', '#00843d', `Ronwen Williams GK RSA 92 72; Teboho Mokoena MID RSA 97 72; Lucas Ribeiro FWD BRA 98 72; Iqraam Rayners FWD RSA 95 70`),
      club('Orlando Pirates', 'ORL', 62, '#000000', '#ffffff', `Relebohile Mofokeng FWD RSA 04 70`),
    ],
  },
  {
    nation: 'JPN',
    clubs: [club('Vissel Kobe', 'VIS', 66, '#7a1e3a', '#ffffff', `Yuya Osako FWD JPN 90 70; Yoshinori Muto FWD JPN 92 70`)],
  },
  {
    nation: 'KOR',
    clubs: [
      club('Ulsan HD', 'ULS', 65, '#0047ab', '#ffd700', `!Jo Hyeon-woo GK KOR 91 71`),
      club('Jeonbuk Motors', 'JEO', 65, '#00843d', '#ffffff', `!Lee Seung-woo FWD KOR 98 68`),
    ],
  },
  {
    nation: 'COL',
    clubs: [club('Atletico Nacional', 'ATN', 66, '#00843d', '#ffffff', `David Ospina GK COL 88 70; Alfredo Morelos FWD COL 96 70`)],
  },
  {
    nation: 'URU',
    clubs: [club('Penarol', 'PEN', 66, '#ffd700', '#000000', `Leonardo Fernandez MID URU 98 70`)],
  },
];
