// Real national teams. Fields: code | name | confederation | strength |
// domestic league level | home colour | away colour | name group | domestic
// clubs, biggest first. Strength sets the level of generated players for
// the nation; database players sit on top of that. Nations with a simulated
// league in leagues/ list no clubs here.

export interface NationSeed {
  code: string;
  name: string;
  conf: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
  strength: number;
  leagueLevel: number;
  colors: [string, string];
  names: string;
  clubs: string[];
}

const RAW = `
ENG|England|UEFA|72|0|#ffffff|#cf081f|english|
ESP|Spain|UEFA|72|0|#c60b1e|#ffc400|spanish|
FRA|France|UEFA|72|0|#002395|#ffffff|french|
GER|Germany|UEFA|71|0|#ffffff|#000000|german|
ITA|Italy|UEFA|69|0|#0066cc|#ffffff|italian|
POR|Portugal|UEFA|70|0|#c8102e|#006600|portuguese|
NED|Netherlands|UEFA|68|0|#ff6600|#000000|dutch|
BEL|Belgium|UEFA|64|68|#e30613|#000000|dutch|Club Brugge,Anderlecht,Union SG,Genk,Gent,Royal Antwerp,Standard Liege,Cercle Brugge,Mechelen,Charleroi
CRO|Croatia|UEFA|63|62|#ff0000|#ffffff|slavic|Dinamo Zagreb,Hajduk Split,Rijeka,Osijek,Lokomotiva Zagreb,Varazdin,Gorica,Istra 1961
SUI|Switzerland|UEFA|62|62|#ff0000|#ffffff|german|Young Boys,Basel,Servette,Lugano,Zurich,St. Gallen,Luzern,Grasshoppers
DEN|Denmark|UEFA|62|62|#c8102e|#ffffff|nordic|Copenhagen,Midtjylland,Brondby,Nordsjaelland,AGF,Silkeborg,Randers,Viborg
AUT|Austria|UEFA|62|63|#ed2939|#ffffff|german|Red Bull Salzburg,Sturm Graz,Rapid Wien,Austria Wien,LASK,Wolfsberger AC,Hartberg,Altach
SCO|Scotland|UEFA|58|66|#0065bd|#ffffff|english|Celtic,Rangers,Hearts,Aberdeen,Hibernian,Dundee United,Motherwell,St Mirren
WAL|Wales|UEFA|56|48|#c8102e|#ffffff|english|The New Saints,Connah's Quay Nomads,Bala Town,Penybont,Caernarfon Town,Cardiff Met,Barry Town,Haverfordwest County
NIR|Northern Ireland|UEFA|52|48|#00843d|#ffffff|english|Linfield,Larne,Glentoran,Cliftonville,Crusaders,Coleraine,Dungannon Swifts,Portadown
IRL|Republic of Ireland|UEFA|56|50|#169b62|#ffffff|english|Shamrock Rovers,Shelbourne,Bohemians,Derry City,St Patrick's Athletic,Dundalk,Sligo Rovers,Galway United
NOR|Norway|UEFA|61|60|#ba0c2f|#ffffff|nordic|Bodo/Glimt,Molde,Rosenborg,Brann,Viking,Lillestrom,Valerenga,Sarpsborg 08
SWE|Sweden|UEFA|60|58|#006aa7|#fecc00|nordic|Malmo FF,Djurgarden,AIK,Hammarby,IFK Goteborg,Hacken,Elfsborg,Mjallby
FIN|Finland|UEFA|52|50|#ffffff|#002f6c|nordic|HJK,KuPS,SJK,Ilves,Inter Turku,FC Lahti,Haka,VPS
POL|Poland|UEFA|60|60|#ffffff|#dc143c|polish|Legia Warsaw,Lech Poznan,Rakow Czestochowa,Jagiellonia,Pogon Szczecin,Wisla Krakow,Gornik Zabrze,Cracovia
CZE|Czechia|UEFA|59|62|#d7141a|#ffffff|czech|Slavia Prague,Sparta Prague,Viktoria Plzen,Banik Ostrava,Mlada Boleslav,Sigma Olomouc,Slovacko,Jablonec
SVK|Slovakia|UEFA|56|55|#0b4ea2|#ffffff|czech|Slovan Bratislava,Spartak Trnava,DAC Dunajska Streda,Zilina,Ruzomberok,Podbrezova,Trencin,Kosice
SRB|Serbia|UEFA|60|62|#c6363c|#ffffff|slavic|Red Star Belgrade,Partizan,TSC Backa Topola,Vojvodina,Cukaricki,Radnicki Nis,Novi Pazar,Spartak Subotica
BIH|Bosnia and Herzegovina|UEFA|55|52|#002395|#fecb00|slavic|Zrinjski Mostar,Borac Banja Luka,Sarajevo,Zeljeznicar,Velez Mostar,Siroki Brijeg,Tuzla City,Sloga Doboj
SVN|Slovenia|UEFA|55|52|#ffffff|#005ce5|slavic|Olimpija Ljubljana,Celje,Maribor,Koper,Mura,Bravo,Domzale,Radomlje
TUR|Turkey|UEFA|62|70|#e30a17|#ffffff|turkish|Galatasaray,Fenerbahce,Besiktas,Trabzonspor,Basaksehir,Samsunspor,Goztepe,Eyupspor,Kasimpasa,Konyaspor
UKR|Ukraine|UEFA|60|60|#ffd500|#005bbb|ukrainian|Shakhtar Donetsk,Dynamo Kyiv,Polissya Zhytomyr,Kryvbas,Oleksandriya,Rukh Lviv,Zorya Luhansk,Karpaty Lviv
GRE|Greece|UEFA|58|64|#0d5eaf|#ffffff|greek|Olympiacos,PAOK,Panathinaikos,AEK Athens,Aris,Asteras Tripolis,OFI Crete,Volos
HUN|Hungary|UEFA|57|56|#ce2939|#ffffff|hungarian|Ferencvaros,Puskas Akademia,Paks,Debrecen,Gyor,MTK Budapest,Ujpest,Zalaegerszeg
ROU|Romania|UEFA|56|56|#fcd116|#002b7f|romanian|FCSB,CFR Cluj,Universitatea Craiova,Rapid Bucharest,Dinamo Bucharest,Farul Constanta,Universitatea Cluj,Sepsi
ALB|Albania|UEFA|54|48|#e41e20|#000000|albanian|Partizani,Egnatia,Tirana,Vllaznia,Skenderbeu,Dinamo Tirana,Teuta,Kukesi
GEO|Georgia|UEFA|56|50|#ffffff|#ff0000|georgian|Dinamo Tbilisi,Dinamo Batumi,Torpedo Kutaisi,Iberia 1999,Dila Gori,Saburtalo,Samgurali,Gagra
KOS|Kosovo|UEFA|53|46|#244aa5|#ffffff|albanian|Ballkani,Drita,Prishtina,Llapi,Gjilani,Malisheva,Dukagjini,Feronikeli
MKD|North Macedonia|UEFA|53|46|#d20000|#ffe600|slavic|Shkendija,Vardar,Struga,Rabotnicki,Shkupi,Tikves,Sileks,Bregalnica
ISL|Iceland|UEFA|53|48|#02529c|#ffffff|nordic|Vikingur Reykjavik,Breidablik,Valur,KR Reykjavik,Stjarnan,FH,Vestri,KA Akureyri
BRA|Brazil|CONMEBOL|70|74|#ffdf00|#009c3b|portuguese|Flamengo,Palmeiras,Botafogo,Sao Paulo,Fluminense,Atletico Mineiro,Corinthians,Internacional,Gremio,Cruzeiro,Santos,Vasco da Gama,Bahia,Fortaleza,Bragantino,Vitoria
ARG|Argentina|CONMEBOL|68|70|#75aadb|#ffffff|latam|River Plate,Boca Juniors,Racing Club,Independiente,San Lorenzo,Estudiantes,Velez Sarsfield,Talleres,Lanus,Rosario Central,Huracan,Argentinos Juniors
URU|Uruguay|CONMEBOL|62|60|#5cbfeb|#ffffff|latam|Penarol,Nacional,Defensor Sporting,Liverpool Montevideo,Danubio,Montevideo Wanderers,Racing Montevideo,Boston River
COL|Colombia|CONMEBOL|62|60|#fcd116|#003893|latam|Atletico Nacional,Millonarios,America de Cali,Junior,Independiente Medellin,Deportivo Cali,Santa Fe,Once Caldas
ECU|Ecuador|CONMEBOL|61|60|#ffdd00|#034ea2|latam|LDU Quito,Independiente del Valle,Barcelona SC,Emelec,Aucas,Universidad Catolica,El Nacional,Delfin
PAR|Paraguay|CONMEBOL|58|56|#d52b1e|#ffffff|latam|Olimpia,Cerro Porteno,Libertad,Guarani,Nacional Asuncion,Sportivo Luqueno,Sportivo Ameliano,2 de Mayo
CHI|Chile|CONMEBOL|57|57|#d52b1e|#ffffff|latam|Colo-Colo,Universidad de Chile,Universidad Catolica,Palestino,Coquimbo Unido,Cobresal,Huachipato,Audax Italiano
PER|Peru|CONMEBOL|55|55|#ffffff|#d91023|latam|Universitario,Alianza Lima,Sporting Cristal,Melgar,Cienciano,Cusco FC,Sport Huancayo,ADT
VEN|Venezuela|CONMEBOL|55|52|#7b1e2c|#ffffff|latam|Caracas FC,Deportivo Tachira,Universidad Central,Carabobo,Monagas,Academia Puerto Cabello,Metropolitanos,Zamora
BOL|Bolivia|CONMEBOL|50|50|#007934|#ffffff|latam|Bolivar,The Strongest,Always Ready,Blooming,Oriente Petrolero,Jorge Wilstermann,Aurora,San Antonio Bulo Bulo
USA|United States|CONCACAF|62|66|#ffffff|#0a3161|english|Inter Miami,LA Galaxy,LAFC,Columbus Crew,FC Cincinnati,Seattle Sounders,Philadelphia Union,New York Red Bulls,Atlanta United,Orlando City,Nashville SC,Vancouver Whitecaps
MEX|Mexico|CONCACAF|61|66|#006847|#ffffff|latam|Club America,Monterrey,Tigres UANL,Cruz Azul,Guadalajara,Toluca,Pumas UNAM,Pachuca,Leon,Santos Laguna
CAN|Canada|CONCACAF|59|55|#ff0000|#ffffff|english|Forge FC,Cavalry FC,Pacific FC,Atletico Ottawa,York United,HFX Wanderers,Valour FC,Vancouver FC
CRC|Costa Rica|CONCACAF|54|52|#ce1126|#002b7f|latam|Saprissa,Alajuelense,Herediano,Cartagines,San Carlos,Puntarenas,Liberia,Perez Zeledon
PAN|Panama|CONCACAF|54|48|#da121a|#ffffff|latam|Plaza Amador,Tauro,CAI,Independiente,San Miguelito,Alianza,Sporting San Miguelito,Arabe Unido
JAM|Jamaica|CONCACAF|54|46|#fed100|#009b3a|caribbean|Mount Pleasant,Cavalier,Harbour View,Waterhouse,Arnett Gardens,Portmore United,Dunbeholden,Tivoli Gardens
HON|Honduras|CONCACAF|52|48|#00bce4|#ffffff|latam|Olimpia,Motagua,Real Espana,Marathon,Olancho,Genesis,Lobos UPNFM,Victoria
MAR|Morocco|CAF|64|60|#c1272d|#006233|arabic|Wydad Casablanca,Raja Casablanca,AS FAR,RS Berkane,FUS Rabat,Maghreb Fes,Hassania Agadir,Ittihad Tanger
SEN|Senegal|CAF|62|50|#ffffff|#00853f|francafrican|Generation Foot,Jaraaf,Teungueth,Casa Sports,Diambars,AS Pikine,US Goree,Linguere
NGA|Nigeria|CAF|61|50|#008751|#ffffff|westafrican|Enyimba,Rangers International,Rivers United,Remo Stars,Kano Pillars,Shooting Stars,Plateau United,Kwara United
EGY|Egypt|CAF|60|62|#ce1126|#ffffff|arabic|Al Ahly,Zamalek,Pyramids,Al Masry,Future FC,Ismaily,ENPPI,Smouha
CIV|Ivory Coast|CAF|61|50|#f77f00|#009e60|francafrican|ASEC Mimosas,Africa Sports,Stade d'Abidjan,SOA,San Pedro,Stella Club,Sporting Gagnoa,Racing Abidjan
ALG|Algeria|CAF|60|56|#ffffff|#006233|arabic|MC Alger,CR Belouizdad,JS Kabylie,USM Alger,ES Setif,CS Constantine,MC Oran,Paradou AC
GHA|Ghana|CAF|59|50|#ffffff|#006b3f|westafrican|Asante Kotoko,Hearts of Oak,Medeama,Dreams FC,Aduana,Bechem United,Nations FC,Berekum Chelsea
CMR|Cameroon|CAF|58|50|#007a5e|#ce1126|francafrican|Coton Sport,Canon Yaounde,Union Douala,Colombe,Fovu Club,Dynamo Douala,Bamboutos,Victoria United
MLI|Mali|CAF|58|48|#14b53a|#fcd116|francafrican|Djoliba,Stade Malien,Real Bamako,AS Bamako,Onze Createurs,Binga FC,USFAS,Afrique Football Elite
TUN|Tunisia|CAF|57|56|#e70013|#ffffff|arabic|Esperance de Tunis,Club Africain,Etoile du Sahel,CS Sfaxien,US Monastir,Stade Tunisien,CA Bizertin,Olympique Beja
COD|DR Congo|CAF|57|52|#007fff|#ce1021|francafrican|TP Mazembe,AS Vita Club,DCMP,Saint-Eloi Lupopo,Maniema Union,Sanga Balende,Don Bosco,Renaissance
RSA|South Africa|CAF|56|56|#ffb81c|#007749|southafrican|Mamelodi Sundowns,Orlando Pirates,Kaizer Chiefs,Stellenbosch,SuperSport United,Cape Town City,AmaZulu,Sekhukhune United
GUI|Guinea|CAF|55|46|#ce1126|#009460|francafrican|Horoya AC,Hafia FC,Kaloum Star,Milo FC,Wakriya,Loubha,CI Kamsar,SAN FC
CPV|Cape Verde|CAF|54|44|#003893|#ffffff|portuguese|Sporting Praia,Mindelense,Academica Mindelo,Derby,Batuque,Boavista Praia,Travadores,Benfica Praia
JPN|Japan|AFC|63|62|#000555|#ffffff|japanese|Vissel Kobe,Kawasaki Frontale,Yokohama F. Marinos,Urawa Reds,Kashima Antlers,Sanfrecce Hiroshima,Gamba Osaka,FC Tokyo,Machida Zelvia,Nagoya Grampus
KOR|South Korea|AFC|60|60|#cd2e3a|#ffffff|korean|Ulsan HD,Jeonbuk Motors,Pohang Steelers,FC Seoul,Gwangju FC,Gangwon FC,Suwon FC,Daejeon Hana Citizen
IRN|Iran|AFC|57|56|#ffffff|#da0000|persian|Persepolis,Esteghlal,Sepahan,Tractor,Foolad,Zob Ahan,Gol Gohar,Malavan
AUS|Australia|AFC|57|56|#ffcd00|#00843d|english|Melbourne Victory,Sydney FC,Central Coast Mariners,Melbourne City,Western Sydney Wanderers,Adelaide United,Brisbane Roar,Perth Glory
KSA|Saudi Arabia|AFC|56|74|#006c35|#ffffff|arabic|Al Hilal,Al Nassr,Al Ittihad,Al Ahli,Al Qadsiah,Al Ettifaq,Al Shabab,Al Taawoun,Neom,Al Fateh
QAT|Qatar|AFC|54|62|#8a1538|#ffffff|arabic|Al Sadd,Al Duhail,Al Rayyan,Al Gharafa,Al Arabi,Al Wakrah,Qatar SC,Umm Salal
UZB|Uzbekistan|AFC|56|52|#ffffff|#1eb53a|centralasian|Pakhtakor,Nasaf,Navbahor,AGMK,Neftchi Fergana,Bunyodkor,Sogdiana,Lokomotiv Tashkent
IRQ|Iraq|AFC|52|50|#ffffff|#007a3d|arabic|Al Shorta,Al Zawraa,Al Quwa Al Jawiya,Al Talaba,Erbil,Duhok,Naft Al Wasat,Al Karkh
JOR|Jordan|AFC|52|46|#ffffff|#ce1126|arabic|Al Faisaly,Al Wehdat,Al Hussein,Al Ramtha,Shabab Al Ordon,Sahab,Al Salt,Ma'an
CHN|China|AFC|50|56|#de2910|#ffde00|chinese|Shanghai Port,Shanghai Shenhua,Shandong Taishan,Chengdu Rongcheng,Beijing Guoan,Zhejiang FC,Tianjin Jinmen Tiger,Wuhan Three Towns
NZL|New Zealand|OFC|50|50|#ffffff|#000000|english|Auckland City,Wellington Olympic,Christchurch United,Auckland United,Eastern Suburbs,Birkenhead United,Waitakere United,Western Springs
`;

export const NATION_SEEDS: NationSeed[] = RAW.trim()
  .split('\n')
  .map((line) => {
    const [code, name, conf, strength, level, c1, c2, names, clubs] = line.split('|');
    return {
      code,
      name,
      conf: conf as NationSeed['conf'],
      strength: Number(strength),
      leagueLevel: Number(level),
      colors: [c1, c2] as [string, string],
      names,
      clubs: clubs ? clubs.split(',') : [],
    };
  });

// Nations that only appear as a player's nationality. They have no league
// and take no part in tournaments, but players keep their real nationality.
export const MINOR_NATIONS: Record<string, string> = {
  ARM: 'Armenia',
  MNE: 'Montenegro',
  EQG: 'Equatorial Guinea',
  ANG: 'Angola',
  ZAM: 'Zambia',
  IDN: 'Indonesia',
  TOG: 'Togo',
  GAM: 'Gambia',
  BFA: 'Burkina Faso',
  GAB: 'Gabon',
  ZIM: 'Zimbabwe',
  HAI: 'Haiti',
  MOZ: 'Mozambique',
  LUX: 'Luxembourg',
  CUW: 'Curacao',
  SUR: 'Suriname',
  KEN: 'Kenya',
  BEN: 'Benin',
  RUS: 'Russia',
  ISR: 'Israel',
  CTA: 'Central African Republic',
  GNB: 'Guinea-Bissau',
  LBR: 'Liberia',
};
