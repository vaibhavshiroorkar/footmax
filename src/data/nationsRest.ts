// The rest of FIFA's 211 members, in the same format as nations.ts. Small
// nations get short club lists; their leagues are padded with generated
// clubs when a career starts there. Club lists for the smallest leagues
// are best guesses and can be edited in a data pack.

export const RAW_REST = `
RUS|Russia|UEFA|60|64|#ffffff|#0039a6|russian|Zenit,Krasnodar,Spartak Moscow,CSKA Moscow,Lokomotiv Moscow,Dynamo Moscow,Rostov,Rubin Kazan,Akhmat Grozny,Krylia Sovetov
ISR|Israel|UEFA|55|55|#ffffff|#0038b8|hebrew|Maccabi Tel Aviv,Hapoel Beer Sheva,Maccabi Haifa,Beitar Jerusalem,Hapoel Tel Aviv,Hapoel Haifa,Maccabi Netanya,Bnei Sakhnin
BUL|Bulgaria|UEFA|51|52|#ffffff|#00966e|slavic|Ludogorets,CSKA Sofia,Levski Sofia,Lokomotiv Plovdiv,Cherno More,Botev Plovdiv,Arda Kardzhali,Slavia Sofia
MNE|Montenegro|UEFA|51|44|#c40308|#d4af37|slavic|Buducnost Podgorica,Decic,Sutjeska,Mornar Bar,Jedinstvo Bijelo Polje,Petrovac,Mladost DG,Arsenal Tivat
ARM|Armenia|UEFA|50|44|#d90012|#0033a0|armenian|Pyunik,Ararat-Armenia,Noah,Urartu,Alashkert,Ararat Yerevan,Shirak,Van
BLR|Belarus|UEFA|49|48|#c8313e|#ffffff|russian|BATE Borisov,Dinamo Minsk,Shakhtyor Soligorsk,Neman Grodno,Torpedo-BelAZ,Isloch,Dinamo Brest,Slavia Mozyr
KAZ|Kazakhstan|UEFA|48|50|#00afca|#fec50c|centralasian|Astana,Kairat,Tobol,Ordabasy,Aktobe,Elimai,Zhetysu,Kaisar
AZE|Azerbaijan|UEFA|47|52|#00b5e2|#ef3340|centralasian|Qarabag,Sabah,Neftchi Baku,Zira,Turan Tovuz,Sumgayit,Araz-Naxcivan,Kapaz
LUX|Luxembourg|UEFA|47|40|#ed2939|#00a1de|french|F91 Dudelange,Differdange 03,Progres Niederkorn,Swift Hesperange,Union Titus Petange,Racing Union,Fola Esch,Jeunesse Esch
CYP|Cyprus|UEFA|46|54|#002b7f|#ffffff|greek|APOEL,Omonia,Pafos FC,AEK Larnaca,Aris Limassol,Apollon Limassol,Anorthosis,AEL Limassol
LTU|Lithuania|UEFA|44|42|#fdb913|#006a44|baltic|Zalgiris Vilnius,Kauno Zalgiris,Hegelmann,Suduva,Panevezys,Dziugas,Banga,Siauliai
EST|Estonia|UEFA|43|40|#0072ce|#ffffff|baltic|Flora Tallinn,FCI Levadia,Paide Linnameeskond,Nomme Kalju,Tammeka Tartu,Narva Trans,Kuressaare,Harju JK
LVA|Latvia|UEFA|43|42|#9e3039|#ffffff|baltic|RFS,Riga FC,Valmiera,Auda,Liepaja,Daugavpils,Jelgava,Super Nova
MDA|Moldova|UEFA|42|40|#0046ae|#ffd200|romanian|Sheriff Tiraspol,Petrocub,Milsami Orhei,Zimbru Chisinau,Dacia Buiucani,Spartanii,Balti,Floresti
FRO|Faroe Islands|UEFA|41|38|#ffffff|#0065bd|nordic|KI Klaksvik,HB Torshavn,Vikingur Gota,B36 Torshavn,NSI Runavik,EB/Streymur,07 Vestur,Skala
MLT|Malta|UEFA|40|38|#ffffff|#cf142b|italian|Hamrun Spartans,Floriana,Birkirkara,Valletta,Hibernians,Sliema Wanderers,Marsaxlokk,Gzira United
AND|Andorra|UEFA|36|32|#0018a8|#fedf00|spanish|Inter Club d'Escaldes,Atletic Club d'Escaldes,FC Santa Coloma,UE Santa Coloma,UE Engordany,Penya Encarnada,CE Carroi,FC Ordino
LIE|Liechtenstein|UEFA|35|30|#002b7f|#ce1126|german|FC Vaduz,USV Eschen/Mauren,FC Balzers,FC Triesen,FC Schaan,FC Ruggell,FC Triesenberg
GIB|Gibraltar|UEFA|34|32|#ffffff|#da000c|english|Lincoln Red Imps,St Joseph's,Europa FC,Glacis United,Manchester 62,Bruno's Magpies,Lions Gibraltar,Mons Calpe
SMR|San Marino|UEFA|28|28|#5eb6e4|#ffffff|italian|Virtus,La Fiorita,Tre Penne,Tre Fiori,Folgore,Cosmos,Murata,Libertas
HAI|Haiti|CONCACAF|50|40|#00209f|#d21034|french|Violette AC,Racing Club Haitien,Don Bosco,Cavaly,Arcahaie,Baltimore SC,AS Capoise,Tempete
CUW|Curacao|CONCACAF|50|38|#002b7f|#f9e814|dutch|Scherpenheuvel,Jong Holland,Centro Dominguito,Inter Willemstad,Centro Barber,Hubentut Fortuna,Undeba,Vesta
GUA|Guatemala|CONCACAF|50|46|#4997d0|#ffffff|latam|Comunicaciones,Municipal,Xelaju,Antigua GFC,Coban Imperial,Malacateco,Mixco,Guastatoya
SLV|El Salvador|CONCACAF|48|44|#0047ab|#ffffff|latam|Alianza,FAS,Aguila,Isidro Metapan,Luis Angel Firpo,Platense,Municipal Limeno,Once Deportivo
SUR|Suriname|CONCACAF|47|38|#377e3f|#ffffff|dutch|Robinhood,Inter Moengotapoe,Transvaal,Leo Victor,Voorwaarts,SNL,Notch,Broki
TRI|Trinidad and Tobago|CONCACAF|47|40|#da1a35|#000000|caribbean|Defence Force,W Connection,Central FC,Police FC,AC Port of Spain,La Horquetta Rangers,Club Sando,Morvant Caledonia
NCA|Nicaragua|CONCACAF|44|38|#0067c6|#ffffff|latam|Real Esteli,Managua FC,Diriangen,Walter Ferretti,Deportivo Ocotal,Matagalpa,Juventus Managua,Jalapa
DOM|Dominican Republic|CONCACAF|43|36|#002d62|#ce1126|latam|Cibao FC,Atletico Pantoja,Moca FC,Atlantico FC,O&M FC,Delfines del Este,Jarabacoa,San Cristobal
CUB|Cuba|CONCACAF|42|36|#002a8f|#cf142b|latam|Santiago de Cuba,Pinar del Rio,Villa Clara,Cienfuegos,Camaguey,Industriales,Guantanamo,Las Tunas
GUY|Guyana|CONCACAF|40|32|#009e49|#fcd116|caribbean|Fruta Conquerors,Defence Force,Slingerz,Western Tigers,Santos FC,Den Amstel,Police FC,Pele FC
PUR|Puerto Rico|CONCACAF|38|32|#ed0a3f|#0050f0|latam|Metropolitan FA,Bayamon FC,Puerto Rico Sol,Academia Quintana,GPS Puerto Rico,Don Bosco PR,Caguas Sporting,Mayaguez FC
BER|Bermuda|CONCACAF|38|30|#cf142b|#ffffff|caribbean|PHC Zebras,Robin Hood,North Village,Dandy Town,Somerset Trojans,BAA Wanderers,Flanders,X-Roads
SKN|Saint Kitts and Nevis|CONCACAF|37|28|#009e49|#ce1126|caribbean|St Paul's United,Cayon Rockets,Village Superstars,Newtown United,Conaree,Garden Hotspurs,Sandy Point,St Peters
ATG|Antigua and Barbuda|CONCACAF|36|28|#ce1126|#000000|caribbean|Parham,Grenades,Old Road,Liberta,SAP,Swetes,Hoppers,Five Islands
LCA|Saint Lucia|CONCACAF|36|28|#66ccff|#fcd116|caribbean|Northern United,Platinum,Survivals,Gros Islet,Mabouya Valley,Micoud,Vieux Fort South,Canaries
BLZ|Belize|CONCACAF|36|32|#003f87|#ce1126|caribbean|Verdes FC,Port Layola,Altitude FC,Wagiya,Police United,Belmopan Bandits,Dangriga FC,San Pedro Pirates
GRN|Grenada|CONCACAF|36|28|#ce1126|#fcd116|caribbean|Paradise FC,Hurricanes,Eagles Super Strikers,Hard Rock,Queens Park Rangers,Fontenoy United,Camerhogne,Mount Rich
VIN|Saint Vincent and the Grenadines|CONCACAF|35|28|#0072c6|#fcd116|caribbean|Hope International,System 3,Avenues United,Camdonia Chelsea,Pastures,Bequia United,Sion Hill,Largo Height
BRB|Barbados|CONCACAF|35|28|#00267f|#ffc726|caribbean|Weymouth Wales,Paradise,Brittons Hill,Notre Dame,Empire,Pride of Gall Hill,Ellerton,Rendezvous
DMA|Dominica|CONCACAF|33|26|#006b3f|#fcd116|caribbean|South East,Bath Estate,Harlem United,Dublanc,Middleham United,Exodus,Petite Savanne,Northern Bombers
ARU|Aruba|CONCACAF|33|26|#418fde|#fbe122|dutch|Dakota,Nacional,Britannia,Racing Club Aruba,Estrella,Riverplate,La Fama,Bubali
BAH|Bahamas|CONCACAF|30|24|#00abc9|#000000|caribbean|Bears FC,Dynamos,Western Warriors,Renegades,Cavalier,United FC,Future Stars,Baha Juniors
CAY|Cayman Islands|CONCACAF|30|24|#cf142b|#ffffff|caribbean|Scholars International,Elite SC,Bodden Town,Roma United,Latinos FC,Future SC,Sunset FC,Academy SC
VIR|US Virgin Islands|CONCACAF|28|22|#0055a4|#fcd116|caribbean|Helenites,Raymix,Unique FC,Rovers FC,Prankton United,Free Will,Positive Vibes,LRVI
VGB|British Virgin Islands|CONCACAF|27|22|#008000|#ffffff|caribbean|Islanders,One Love United,Sugar Boys,Old Madrid,Virgin Gorda United,Panthers,Wolues,Rebels
TCA|Turks and Caicos Islands|CONCACAF|26|22|#ffffff|#002868|caribbean|Academy Eagles,Beaches FC,SWA Sharks,Teachers FC,Blue Hills,Flamingo,Cheshire Hall,Provo United
MSR|Montserrat|CONCACAF|25|20|#00aa4f|#ffffff|caribbean|Royal Montserrat Police,Ideal SC,Little Bay,Salem,Brades,Davy Hill,Look Out,St Peters MSR
AIA|Anguilla|CONCACAF|24|20|#ff7300|#0039a6|caribbean|Roaring Lions,Kicks United,Uprising,Attackers,Lymers,Salsa Ballers,Doc's United,Diamond FC
BFA|Burkina Faso|CAF|56|44|#009e49|#ffffff|francafrican|ASFA Yennenga,Rahimo,AS Douanes,Salitas,USFA,Majestic,Vitesse,Etoile Filante
ZAM|Zambia|CAF|53|48|#198a00|#ffffff|southafrican|Power Dynamos,Zesco United,Zanaco,Red Arrows,Nkana,Green Eagles,Napsa Stars,Forest Rangers
GAB|Gabon|CAF|53|42|#009e60|#fcd116|francafrican|Mangasport,CF Mounana,AS Mangasport,Bouenguidi,US Bitam,Lambarene,Stade Mandji,Oyem AC
EQG|Equatorial Guinea|CAF|51|40|#3e9a00|#e32118|spanish|Akonangui,Cano Sport,Deportivo Mongomo,Leones Vegetarianos,Futuro Kings,Atletico Semu,Sony de Elat,Real Rebola
ANG|Angola|CAF|52|46|#cc092f|#000000|portuguese|Petro de Luanda,Primeiro de Agosto,Sagrada Esperanca,Interclube,Wiliete,Academica do Lobito,Kabuscorp,Desportivo da Huila
BEN|Benin|CAF|51|40|#008751|#fcd116|francafrican|Coton FC,Loto-Popo,Dragons de l'Oueme,ASPAC,Buffles du Borgou,AS Police,Hodio,Energie FC
UGA|Uganda|CAF|51|42|#fcdc04|#000000|eastafrican|Vipers,KCCA,SC Villa,Express FC,URA,Bul FC,Kitara,Police FC
GAM|Gambia|CAF|50|38|#ce1126|#ffffff|westafrican|Real de Banjul,Hawks,Fortune FC,Gamtel,Steve Biko,Wallidan,Brikama United,Elite United
TOG|Togo|CAF|50|40|#006a4e|#ffce00|francafrican|ASKO Kara,Dynamic Togolais,Maranatha,Semassi,Gomido,ASC Kara,Unisport,AS OTR
KEN|Kenya|CAF|50|44|#006600|#bb0000|eastafrican|Gor Mahia,AFC Leopards,Tusker,Kakamega Homeboyz,Police FC,Shabana,KCB,Bandari
MOZ|Mozambique|CAF|50|42|#007168|#fce100|portuguese|Black Bulls,Ferroviario Maputo,Costa do Sol,UD Songo,Ferroviario Beira,Chingale,Ferroviario Nampula,Matchedje
LBY|Libya|CAF|49|46|#000000|#e70013|arabic|Al Ittihad Tripoli,Al Ahli Tripoli,Al Ahli Benghazi,Al Nasr Benghazi,Al Hilal Benghazi,Al Madina,Abu Salim,Al Akhdar
ZIM|Zimbabwe|CAF|49|44|#fcd116|#006400|southafrican|Dynamos,Highlanders,CAPS United,FC Platinum,Ngezi Platinum,Manica Diamonds,Chicken Inn,Simba Bhora
MAD|Madagascar|CAF|49|40|#fc3d32|#007e3a|french|CFFA,Fosa Juniors,Elgeco Plus,Disciples,Zanakala,Tia Kitra,AS Adema,COSFAP
GNB|Guinea-Bissau|CAF|48|36|#ce1126|#fcd116|portuguese|Sporting Bissau,Benfica Bissau,UDIB,Cuntum,Portos de Bissau,Sport Bissau e Benfica,Mavegro,Nuno Tristao
NAM|Namibia|CAF|48|40|#003580|#009a44|southafrican|African Stars,Blue Waters,Black Africa,Tigers,Orlando Pirates NAM,Mighty Gunners,Young African,Eleven Arrows
MTN|Mauritania|CAF|48|40|#00a95c|#ffd700|arabic|FC Nouadhibou,ASC Concorde,Tevragh Zeina,ASC Kedia,FC Tidjikja,ASAC Concorde,Inter Nouakchott,Chemal
CGO|Congo|CAF|48|40|#009543|#fbde4a|francafrican|AS Otoho,Diables Noirs,CARA Brazzaville,Etoile du Congo,AC Leopards,Inter Club,Patronage Sainte-Anne,FC Kondzo
SLE|Sierra Leone|CAF|47|36|#1eb53a|#0072c6|westafrican|East End Lions,Bo Rangers,Mighty Blackpool,Kallon FC,FC Johansen,Diamond Stars,Central Parade,Ports Authority
TAN|Tanzania|CAF|47|46|#1eb53a|#00a3dd|eastafrican|Simba SC,Young Africans,Azam,Singida Black Stars,Coastal Union,Namungo,KMC,Tabora United
MWI|Malawi|CAF|46|40|#ce1126|#000000|southafrican|Nyasa Big Bullets,Silver Strikers,Mighty Wanderers,Civil Service United,Blue Eagles,Kamuzu Barracks,Moyale Barracks,Dedza Dynamos
RWA|Rwanda|CAF|46|40|#00a1de|#fad201|eastafrican|APR,Rayon Sports,Police FC,Kiyovu,AS Kigali,Mukura Victory,Gasogi United,Musanze
LBR|Liberia|CAF|46|34|#bf0a30|#002868|westafrican|LISCR,Watanga,Barrack Young Controllers,Mighty Barrolle,Invincible Eleven,Paynesville,Nimba United,Heaven Eleven
CTA|Central African Republic|CAF|45|34|#003082|#fcd116|francafrican|DFC8,Anges de Fatima,Olympic Real,Tempete Mocaf,Red Star Bangui,SCAF Tocages,AS Gbangre,Castel Foot
NIG|Niger|CAF|45|36|#e05206|#0db02b|francafrican|AS SONIDEP,AS Douanes Niamey,Sahel SC,AS Police,ASFAN,Olympic FC,Akokana,US Gendarmerie
COM|Comoros|CAF|45|32|#3a75c4|#ffffff|francafrican|US Zilimadjou,Volcan Club,Fomboni FC,Ngaya Club,Elan Club,Djabal Club,Belle Lumiere,Steal Nouvel
SDN|Sudan|CAF|45|44|#d21034|#ffffff|arabic|Al Hilal Omdurman,Al Merrikh,Al Ahli Wad Madani,Al Hilal Kadougli,Hay Al Arab,Al Ahli Khartoum,Al Amal Atbara,Al Khartoum
ETH|Ethiopia|CAF|44|40|#078930|#fcdd09|hornafrican|Saint George,Fasil Kenema,Ethiopian Coffee,Bahir Dar Kenema,Mekelle 70 Enderta,Hawassa City,Dire Dawa City,Wolkite City
BDI|Burundi|CAF|44|34|#ce1126|#1eb53a|eastafrican|Vital'O,Flambeau du Centre,Aigle Noir,Bumamuru,Musongati,Le Messager Ngozi,Inter Star,Rukinzo
BOT|Botswana|CAF|43|38|#75aadb|#000000|southafrican|Township Rollers,Gaborone United,Jwaneng Galaxy,Orapa United,Mochudi Centre Chiefs,Police XI,Morupule Wanderers,BDF XI
LES|Lesotho|CAF|41|34|#00209f|#009543|southafrican|Matlama,Bantu,LCS,Lioli,Linare,Lifofane,Swallows Lesotho,Liphakoe
SWZ|Eswatini|CAF|40|34|#3e5eb9|#ffd900|southafrican|Mbabane Swallows,Royal Leopards,Young Buffaloes,Green Mamba,Mbabane Highlanders,Manzini Wanderers,Moneni Pirates,Denver Sundowns
CHA|Chad|CAF|38|30|#002664|#fecb00|francafrican|Elect-Sport,Gazelle,Renaissance,AS CotonTchad,Tourbillon,Foullah Edifice,RFC Moundou,Postel 2000
SSD|South Sudan|CAF|38|30|#078930|#000000|eastafrican|Al Merreikh Juba,Atlabara,Al Hilal Wau,Jamus,Young Stars,Malakia,Gudele,Kator
MRI|Mauritius|CAF|36|30|#ea2839|#1a206d|french|Cercle de Joachim,Pamplemousses,Petite Riviere Noire,La Cure Sylvester,Roche Bois Bolton,Savanne,AS Port-Louis 2000,Bolton City
STP|Sao Tome and Principe|CAF|33|26|#12ad2b|#ffce00|portuguese|Agrosport,Sporting Praia Cruz,Vitoria Riboque,UDRA,6 de Setembro,Operarios,Trindade,Bairros Unidos
SEY|Seychelles|CAF|30|26|#003f87|#d62828|french|Foresters,La Passe,Cote d'Or,St Michel United,Light Stars,Northern Dynamo,Anse Reunion,Saint Louis Suns
DJI|Djibouti|CAF|30|26|#6ab2e7|#12ad2b|hornafrican|Arta/Solar7,Dikhil,Gendarmerie Nationale,AS Port,Hayableh,Djibouti Telecom,Ali Sabieh,Obock
SOM|Somalia|CAF|28|24|#4189dd|#ffffff|hornafrican|Elman,Horseed,Dekedaha,Heegan,Mogadishu City,Gaadiidka,Jeenyo United,Raadsan
ERI|Eritrea|CAF|30|24|#4189dd|#ea0437|hornafrican|Red Sea,Denden,Al Tahrir,Adulis,Akria,Edaga Hamus,Mai Temenai,Asmara Brewery
IDN|Indonesia|AFC|52|50|#ce1126|#ffffff|malay|Persib Bandung,Persija Jakarta,Borneo FC,Bali United,Persebaya Surabaya,PSM Makassar,Dewa United,Madura United
UAE|United Arab Emirates|AFC|52|60|#ffffff|#00732f|arabic|Al Ain,Shabab Al Ahli,Sharjah,Al Wahda,Al Jazira,Al Wasl,Al Nasr Dubai,Baniyas
OMA|Oman|AFC|50|44|#db161b|#ffffff|arabic|Al Seeb,Al Nahda,Dhofar,Al Shabab Oman,Al Nasr Salalah,Sur,Al Rustaq,Saham
BHR|Bahrain|AFC|48|44|#ce1126|#ffffff|arabic|Al Muharraq,Al Khaldiya,Al Riffa,Al Ahli Manama,East Riffa,Manama Club,Al Hidd,Sitra
SYR|Syria|AFC|48|42|#ce1126|#ffffff|arabic|Al Jaish,Al Fotuwa,Tishreen,Al Wahda Damascus,Al Karamah,Al Ittihad Aleppo,Hutteen,Al Taliya
PLE|Palestine|AFC|47|38|#000000|#ce1126|arabic|Jabal Al Mukaber,Shabab Al Khalil,Balata,Hilal Al Quds,Thaqafi Tulkarem,Markaz Shabab Al Amari,Shabab Al Dhahiriya,Ahli Al Khaleel
LBN|Lebanon|AFC|46|42|#ffffff|#ed1c24|arabic|Al Ansar,Al Ahed,Nejmeh,Safa,Shabab Al Sahel,Tadamon Sour,Racing Beirut,Bourj
KUW|Kuwait|AFC|45|46|#007a3d|#ffffff|arabic|Kuwait SC,Al Arabi,Al Qadsia,Al Salmiya,Kazma,Al Nasr Kuwait,Al Fahaheel,Al Tadamon
THA|Thailand|AFC|47|50|#ed1c24|#241d4f|thai|Buriram United,Bangkok United,Port FC,BG Pathum United,Muangthong United,Chonburi,Ratchaburi,Chiangrai United
VIE|Vietnam|AFC|47|46|#da251d|#ffff00|vietnamese|Thep Xanh Nam Dinh,Hanoi FC,The Cong-Viettel,Cong An Ha Noi,Hai Phong,Hoang Anh Gia Lai,Becamex Binh Duong,Thanh Hoa
KGZ|Kyrgyzstan|AFC|46|38|#e8112d|#ffef00|centralasian|Abdysh-Ata,Dordoi Bishkek,Alay Osh,Neftchi Kochkor-Ata,Muras United,Alga Bishkek,Ilbirs,Kaganat
TJK|Tajikistan|AFC|46|40|#cc0000|#ffffff|centralasian|Istiklol,Ravshan Kulob,Khujand,CSKA Pamir,Regar-TadAZ,Eskhata,Fayzkand,Istaravshan
PRK|North Korea|AFC|45|38|#ed1c27|#ffffff|korean|April 25,Hwaebul,Rimyongsu,Kigwancha,Sobaeksu,Amnokgang,Pyongyang City,Ryomyong
IND|India|AFC|42|46|#0055a4|#ff9933|southasian|Mohun Bagan,East Bengal,Bengaluru FC,Mumbai City,Goa,Kerala Blasters,Jamshedpur,Odisha FC,Chennaiyin,NorthEast United
PHI|Philippines|AFC|42|36|#0038a8|#ce1126|filipino|Kaya-Iloilo,Dynamic Herb Cebu,United City,Stallion Laguna,Mendiola,Davao Aguilas,One Taguig,Manila Digger
MAS|Malaysia|AFC|44|48|#ffcc00|#000066|malay|Johor Darul Tazim,Selangor,Sabah,Terengganu,Kuala Lumpur City,Penang,Kedah,Sri Pahang
TKM|Turkmenistan|AFC|42|36|#00843d|#ffffff|centralasian|Arkadag,Ahal,Altyn Asyr,Kopetdag,Nebitchi,Sagadam,Merw,Energetik
HKG|Hong Kong|AFC|40|38|#de2910|#ffffff|chinese|Kitchee,Eastern,Lee Man,Tai Po,Southern District,Rangers HK,North District,Kowloon City
SIN|Singapore|AFC|38|38|#ef3340|#ffffff|malay|Lion City Sailors,BG Tampines Rovers,Geylang International,Albirex Niigata Singapore,Hougang United,Balestier Khalsa,Tanjong Pagar United,Young Lions
TPE|Chinese Taipei|AFC|36|32|#000095|#ffffff|chinese|Taipower,Tainan City,Taichung Futuro,Hang Yuen,Ming Chuan University,Taipei Vikings,Leopard Cat,AC Taipei
AFG|Afghanistan|AFC|38|32|#000000|#d32011|persian|Shaheen Asmayee,Toofan Harirod,De Abasin Sape,Simorgh Alborz,Oqaban Hindukush,De Maiwand Atalan,Mawjhai Amu,De Spin Ghar Bazan
YEM|Yemen|AFC|38|32|#ce1126|#ffffff|arabic|Al Ahli Sanaa,Al Saqr,Al Wahda Sanaa,Al Tilal,Al Sha'ab Ibb,Al Hilal Al Sahili,Al Ittihad Ibb,Shaab Hadramaut
MYA|Myanmar|AFC|38|36|#fecb00|#34b233|thai|Shan United,Yangon United,Hantharwady United,Ayeyawady United,Rakhine United,Ispe,Mahar United,Yadanarbon
NEP|Nepal|AFC|36|30|#dc143c|#003893|southasian|Machhindra,Three Star Club,Manang Marshyangdi,Nepal Army,Nepal Police,Tribhuvan Army,Church Boys United,Friends Club
PAK|Pakistan|AFC|30|28|#01411c|#ffffff|southasian|WAPDA,Khan Research Laboratories,Pakistan Army,SA Gardens,Pakistan Navy,Sui Southern Gas,Karachi United,Muslim FC
SRI|Sri Lanka|AFC|30|28|#ffb700|#8d153a|southasian|Colombo FC,Renown SC,Ratnam SC,Blue Star,Army SC,Police SC,Air Force SC,Navy SC
MDV|Maldives|AFC|34|32|#d21034|#007e3a|southasian|Maziya,Club Eagles,TC Sports,Valencia Male,Victory SC,New Radiant,United Victory,Green Streets
CAM|Cambodia|AFC|34|34|#032ea1|#e00025|thai|Phnom Penh Crown,Preah Khan Reach Svay Rieng,Visakha,Boeung Ket,Angkor Tiger,Kirivong Sok Sen Chey,ISI Dangkor Senchey,Tiffy Army
BAN|Bangladesh|AFC|33|32|#006a4e|#f42a41|southasian|Bashundhara Kings,Abahani Dhaka,Mohammedan,Sheikh Russel,Dhaka Wanderers,Rahmatganj,Fortis,Brothers Union
MNG|Mongolia|AFC|32|28|#c4272f|#015197|centralasian|Ulaanbaatar City,Khaan Khuns Erchim,Deren,SP Falcons,Khoromkhon,Ulaanbaatar FC,Tuv Buganuud,BCH Lions
MAC|Macau|AFC|28|24|#00785e|#ffffff|chinese|Benfica de Macau,Chao Pak Kei,Ka I,Monte Carlo,Hang Sai,Policia,Sporting de Macau,Lai Chi
BHU|Bhutan|AFC|28|24|#ffcc33|#ff4e12|southasian|Paro FC,Thimphu City,Transport United,Ugyen Academy,Druk Lhayul,BFF Academy,Tsirang FC,Royal Thimphu College
LAO|Laos|AFC|30|26|#ce1126|#002868|thai|Young Elephants,Ezra,Master 7,Champasak United,Lao Police,Viengchanh,Luang Prabang FC,Lao Army
BRU|Brunei|AFC|26|24|#f7e017|#000000|malay|DPMM,Kasuka,Indera,MS ABDB,Kota Ranger,Rimba Star,Wijaya,Jerudong
TLS|Timor-Leste|AFC|26|22|#dc241f|#000000|malay|Karketu Dili,Boavista Timor,Lalenok United,Assalam,SLB Laulara,Ponta Leste,Academica Timor,Porto Taibesse
GUM|Guam|AFC|24|20|#00297b|#c62139|pacific|Rovers FC,Bank of Guam Strykers,Lions FC,Quality Distributors,Islanders FC,Wings FC,Guam Shipyard,Southern Cobras
FIJ|Fiji|OFC|38|36|#68bfe5|#ffffff|pacific|Rewa,Lautoka,Ba,Suva,Nadi,Labasa,Navua,Tailevu Naitasiri
SOL|Solomon Islands|OFC|36|34|#0051ba|#fcd116|pacific|Solomon Warriors,Central Coast,Henderson Eels,Kossa,Laugu United,Marist Fire,Isabel United,Real Kakamora
PNG|Papua New Guinea|OFC|33|30|#ce1126|#000000|pacific|Hekari United,Lae City,Gulf Komara,Morobe Wawens,Port Moresby Strikers,Madang FC,Tusbab Stallions,Toti City
NCL|New Caledonia|OFC|35|32|#0035ad|#ed4135|french|Hienghene Sport,AS Magenta,AS Tiga Sports,Lossi,AS Mont-Dore,Ne Drehu,Wetr,Gaitcha
TAH|Tahiti|OFC|34|32|#ef2b2d|#ffffff|french|AS Pirae,AS Venus,AS Central Sport,AS Tefana,AS Dragon,AS Manu-Ura,AS Tiare Tahiti,AS Vaipae
VAN|Vanuatu|OFC|33|30|#d21034|#009543|pacific|Galaxy FC,Ifira Black Bird,Tafea,Erakor Golden Star,Amicale,Tupuji Imere,Siaraga,Shepherds United
SAM|Samoa|OFC|26|22|#ce1126|#002b7f|pacific|Lupe o le Soaga,Vaipuna,Kiwi FC,Vaivase-Tai,Faatoia United,Moaula United,Lepea,Vailima Kiwi
TGA|Tonga|OFC|25|20|#c10000|#ffffff|pacific|Veitongo,Lotoha'apai United,Marist Prems,Ha'amoko United,Navutoka,Longoteme,Kolofo'ou,Popua
COK|Cook Islands|OFC|24|20|#00247d|#ffffff|pacific|Tupapa Maraerenga,Puaikura,Nikao Sokattak,Avatiu,Takuvaine,Titikaveka,Matavera,Arorangi
ASA|American Samoa|OFC|20|18|#002b7f|#ffffff|pacific|Pago Youth,Ilaoa and To'omata,PanSa,Utulei Youth,Vaiala Tongan,Fagatogo Blue,Royal Puma,Black Roses
`;
