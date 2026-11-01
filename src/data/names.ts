// Name pools for generated (non-database) players, grouped by language.
// Nations point at a group in nations.ts.

export interface NameGroup {
  first: string[];
  last: string[];
}

const g = (first: string, last: string): NameGroup => ({ first: first.split(' '), last: last.split(' ') });

export const NAME_GROUPS: Record<string, NameGroup> = {
  english: g(
    'Jack Harry Oliver George Charlie James Alfie Callum Lewis Jordan Ryan Josh Kieran Tom Ben Sam Luke Jamie Connor Ethan Liam Mason Tyler Owen',
    'Smith Jones Taylor Brown Wilson Evans Thomas Walker Wright Robinson Hughes Green Hall Wood Clarke Turner Hill Cooper Ward Morris Price Bennett Shaw Mills Fletcher Barnes Holt Kerr Reid Murray',
  ),
  spanish: g(
    'Pablo Alejandro Diego Javier Sergio Adrian Alvaro Marcos Raul Ivan Carlos Miguel Hugo Mario Dani Iker Unai Jorge Ruben Victor Mateo Nico Gonzalo Fran',
    'Garcia Martinez Lopez Sanchez Perez Gomez Fernandez Ruiz Diaz Moreno Alonso Romero Navarro Torres Dominguez Vazquez Ramos Gil Serrano Molina Ortega Castro Ortiz Delgado Morales Suarez Herrera Medina',
  ),
  latam: g(
    'Matias Santiago Facundo Lautaro Thiago Agustin Nicolas Joaquin Franco Emiliano Brian Cristian Jhon Kevin Luis Andres Juan Jose Sebastian Maximiliano Gaston Bryan Yeferson Wilmar',
    'Gonzalez Rodriguez Fernandez Gomez Martinez Diaz Alvarez Romero Sosa Benitez Acosta Ramirez Cabrera Vargas Rojas Mendoza Quintero Valencia Castillo Mosquera Caicedo Palacios Arboleda Cuero Zapata Vera',
  ),
  portuguese: g(
    'Joao Pedro Gabriel Lucas Mateus Rafael Guilherme Gustavo Vitor Bruno Diogo Rodrigo Tiago Andre Rui Nuno Goncalo Francisco Thiago Caio Matheus Felipe Danilo Igor',
    'Silva Santos Oliveira Souza Costa Pereira Ferreira Almeida Lima Carvalho Gomes Ribeiro Martins Rocha Alves Barbosa Mendes Cardoso Teixeira Nascimento Moreira Pinto Lopes Araujo Correia Nunes',
  ),
  french: g(
    'Lucas Hugo Theo Nathan Enzo Louis Mathis Yanis Kylian Rayan Adrien Maxime Clement Antoine Bastien Corentin Florian Romain Quentin Benjamin Noah Jules Malo Lenny',
    'Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard Andre Mercier Blanc Guerin Boyer Faure',
  ),
  german: g(
    'Lukas Leon Felix Jonas Maximilian Paul Niklas Tim Jan Florian Tobias Moritz Fabian Kevin Marcel Julian Philipp David Noah Elias Luca Finn Dominik Sebastian',
    'Muller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Schroder Neumann Schwarz Braun Zimmermann Kruger Hartmann Lange Werner Krause Lehmann Kaiser Fuchs Vogel',
  ),
  italian: g(
    'Lorenzo Alessandro Matteo Leonardo Francesco Andrea Gabriele Riccardo Tommaso Davide Federico Giuseppe Marco Luca Simone Nicolo Pietro Samuele Daniele Filippo Giacomo Mattia Stefano Christian',
    'Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti DeLuca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferri Galli',
  ),
  dutch: g(
    'Daan Sem Lucas Milan Levi Luuk Jesse Thijs Bram Lars Ruben Stijn Tim Jens Niels Bas Joey Kevin Wout Arne Jelle Sven Teun Yannick',
    'DeJong Jansen DeVries VanDenBerg VanDijk Bakker Janssen Visser Smit Meijer DeBoer Mulder DeGroot Bos Vos Peters Hendriks VanLeeuwen Dekker Brouwer DeWit Dijkstra Smits Willems Maes Claes Peeters',
  ),
  nordic: g(
    'Oscar William Lucas Elias Emil Oliver Noah Filip Viktor Anton Mathias Jonas Rasmus Magnus Andreas Kristian Sander Henrik Mikkel Jesper Isak Hugo Erik Alexander',
    'Hansen Johansen Olsen Larsen Andersen Pedersen Nilsen Kristiansen Jensen Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Lindberg Berg Dahl Holm Strand Lund Bakke Haugen Moe',
  ),
  slavic: g(
    'Luka Marko Ivan Stefan Nikola Filip Lazar Petar Milos Dusan Ante Josip Mateo Domagoj Dejan Nemanja Aleksandar Mihajlo Vanja Bogdan Andrija Tin Duje Edin',
    'Petrovic Jovanovic Nikolic Markovic Ilic Pavlovic Kovacevic Horvat Babic Maric Juric Knezevic Vukovic Popovic Lukic Radic Matic Simic Stojanovic Milinkovic Vlasic Brozovic Sucic Dzeko Hodzic',
  ),
  polish: g(
    'Jakub Kacper Szymon Mateusz Bartosz Michal Kamil Piotr Pawel Krzysztof Adam Dawid Lukasz Tomasz Wojciech Patryk Filip Maciej Sebastian Hubert Oskar Igor Przemyslaw Jan',
    'Nowak Kowalski Wisniewski Wojcik Kowalczyk Kaminski Lewandowski Zielinski Szymanski Wozniak Dabrowski Kozlowski Jankowski Mazur Krawczyk Piotrowski Grabowski Pawlowski Michalski Krol Wieczorek Jablonski Wrobel Majewski',
  ),
  czech: g(
    'Jakub Jan Tomas Adam Matej Ondrej Lukas David Filip Vojtech Martin Patrik Michal Petr Marek Dominik Stanislav Juraj Milan Pavel Ladislav Vaclav Tadeas Robert',
    'Novak Svoboda Novotny Dvorak Cerny Prochazka Kucera Vesely Horak Nemec Pokorny Marek Hajek Jelinek Kral Ruzicka Benes Fiala Sedlacek Dolezal Zeman Kolar Hrosovsky Duda',
  ),
  ukrainian: g(
    'Oleksandr Andriy Dmytro Mykola Vitaliy Serhiy Yevhen Artem Bohdan Taras Viktor Roman Illia Mykhailo Oleh Yaroslav Denys Vladyslav Heorhiy Maksym Ruslan Volodymyr Pavlo Anatoliy',
    'Shevchenko Kovalenko Bondarenko Tkachenko Kravchenko Oliynyk Shevchuk Polishchuk Lysenko Melnyk Boyko Savchenko Rudenko Moroz Marchenko Petrenko Klymenko Pavlenko Yarmolenko Zinchenko Malinovskyi Sudakov Mykolenko Tsyhankov',
  ),
  turkish: g(
    'Mehmet Mustafa Ahmet Ali Emre Burak Yusuf Kerem Arda Baris Cengiz Hakan Ozan Okay Kaan Enes Salih Ismail Cenk Mert Yunus Berkay Eren Irfan',
    'Yilmaz Kaya Demir Sahin Celik Yildiz Yildirim Ozturk Aydin Ozdemir Arslan Dogan Kilic Aslan Cetin Kara Koc Kurt Ozkan Simsek Polat Ozcan Korkmaz Akturkoglu Kahveci',
  ),
  greek: g(
    'Giorgos Dimitris Konstantinos Nikos Ioannis Christos Panagiotis Vasilis Thanasis Kostas Andreas Stelios Petros Michalis Fotis Sotiris Anastasios Lazaros Manolis Tasos',
    'Papadopoulos Papadakis Georgiou Nikolaidis Karagiannis Vlachos Papanikolaou Pappas Oikonomou Christodoulou Makris Antoniou Ioannidis Dimitriou Konstantinou Bakasetas Pavlidis Mavropanos Tzolis Masouras',
  ),
  hungarian: g(
    'Bence Mate Mark Adam Levente Daniel Dominik Balazs Gergo Krisztian Zsolt Tamas Peter Laszlo Roland Attila Denes Milos Kevin Barnabas',
    'Nagy Kovacs Toth Szabo Horvath Varga Kiss Molnar Nemeth Farkas Balogh Papp Takacs Juhasz Lakatos Meszaros Olah Simon Racz Fekete Szoboszlai Sallai Orban Gulacsi',
  ),
  romanian: g(
    'Andrei Alexandru Mihai Ionut Stefan Razvan Florin Gabriel Cristian Bogdan Vlad Nicolae Darius Denis Valentin Dragos Marius Adrian Radu Dennis',
    'Popescu Ionescu Popa Stan Dumitru Stoica Gheorghe Matei Ciobanu Rusu Munteanu Constantin Moldovan Marin Lazar Dinu Toma Nedelcu Man Dragusin Hagi Stanciu Mihaila Racovitan',
  ),
  albanian: g(
    'Arber Ardian Ermal Klaus Elseid Nedim Taulant Kristjan Armando Berat Ylber Mirlind Jasir Arlind Endrit Florian Rey Ardit Qazim Kastriot',
    'Hysaj Asllani Broja Bajrami Djimsiti Ramadani Berisha Hoxha Shala Gashi Krasniqi Muriqi Rrahmani Xhaka Zeqiri Kryeziu Sejdiu Daku Laci Manaj',
  ),
  georgian: g(
    'Giorgi Luka Levan Nika Otar Zuriko Saba Guram Davit Irakli Lasha Budu Khvicha Georges Gabriel Anzor Beka Jaba Nodar Tornike',
    'Kvaratskhelia Mikautadze Mamardashvili Chakvetadze Kochorashvili Kiteishvili Lobjanidze Kashia Kvirkvelia Zivzivadze Davitashvili Gocholeishvili Tsitaishvili Lochoshvili Kakabadze Shengelia Gvelesiani Mekvabishvili Altunashvili Beridze',
  ),
  arabic: g(
    'Mohamed Ahmed Youssef Omar Ali Hamza Karim Mahmoud Khalid Salem Abdullah Faisal Saud Nasser Yasser Ayoub Ismael Achraf Sofiane Riyad Hakim Bilal Anas Amine',
    'Hassan Ibrahim Mansour Saleh Haddad Khalil Nasser Rahman Aziz Amrani Benali Belkacem Bensaid ElKarouani Ziyech Saiss Boufal Mahrez Bennacer Feghouli AlDawsari AlShahrani AlFaraj AlBuraikan AlGhannam Ounahi',
  ),
  westafrican: g(
    'Emmanuel Samuel Victor Kelechi Ademola Chidera Wilfred Ola Bright Kwame Kofi Kwadwo Yaw Thomas Jordan Daniel Mohammed Joseph Moses Ahmed Paul Calvin Frank Tariq',
    'Okafor Nwankwo Osimhen Iheanacho Ndidi Lookman Chukwueze Onyeka Aribo Bassey Ekong Mensah Owusu Asante Boateng Ayew Partey Kudus Semenyo Salisu Djiku Amartey Fatawu Opoku Adjei',
  ),
  francafrican: g(
    'Moussa Ibrahima Cheikh Sadio Idrissa Amadou Mamadou Lamine Pape Ismaila Abdou Seko Franck Sebastien Wilfried Serge Simon Yves Nicolas Christian Andre Jean Eric Bryan',
    'Diallo Ndiaye Diop Fall Sarr Sow Mane Gueye Kouyate Camara Toure Traore Coulibaly Konate Kone Doumbia Bamba Kessie Fofana Haller Aboubakar Anguissa Mbeumo Onana Toko Ekambi Ngamaleu Doucoure Bissouma',
  ),
  southafrican: g(
    'Thabo Sipho Themba Lyle Percy Teboho Ronwen Siyabonga Bongani Mothobi Aubrey Khuliso Evidence Oswin Relebohile Mihlali Iqraam Grant Thapelo Fagrie',
    'Mokoena Zwane Foster Tau Williams Mvala Modiba Makgopa Mudau Ngcobo Dlamini Khumalo Nkosi Mabaso Maseko Appollis Mayambela Rayners Kekana Sibisi',
  ),
  japanese: g(
    'Takumi Kaoru Daichi Ritsu Wataru Takefusa Junya Ayase Kyogo Hidemasa Ko Yukinari Daizen Takehiro Hiroki Yuto Shogo Keito Kota Reo Kento Sota Haruto Yuki',
    'Mitoma Kubo Endo Doan Minamino Ito Ueda Furuhashi Morita Itakura Taniguchi Tomiyasu Maeda Nakamura Sugawara Suzuki Tanaka Watanabe Yamamoto Kobayashi Sato Takahashi Hashioka Machida',
  ),
  korean: g(
    'Heung-min Min-jae Kang-in Hee-chan Woo-yeong Gue-sung In-beom Jae-sung Seung-ho Young-woo Tae-hwan Jin-su Seol Hyeon-gyu Ji-sung Dong-gyeong Jun-ho Seung-woo Hyun-woo Ui-jo',
    'Son Kim Lee Hwang Cho Jeong Park Choi Kang Yoon Jang Lim Han Oh Seo Shin Kwon Hong Ahn Song',
  ),
  persian: g(
    'Mehdi Ali Alireza Sardar Saeid Hossein Saman Milad Ehsan Morteza Ramin Majid Omid Karim Shoja Sadegh Mohammad Amir Reza Payam',
    'Taremi Azmoun Jahanbakhsh Beiranvand Ezatolahi Hosseini Ghoddos Gholizadeh Pouraliganji Kanaani Rezaeian Mohammadi Hajsafi Nourollahi Ansari Karimi Rahimi Jafari Moharrami Khalilzadeh',
  ),
  chinese: g(
    'Wei Lei Hao Jun Yang Peng Bin Tao Chen Long Xin Bowen Jiahao Zihao Yuning Haoran Xiaodong Shuai Zhiyuan Junjie',
    'Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo Lin He Gao Wu',
  ),
  centralasian: g(
    'Eldor Abbosbek Jaloliddin Otabek Abdukodir Oston Khojimat Jamshid Rustam Sherzod Akmal Dilshod Bobur Islom Azizbek Umar Odil Farrukh Sardor Ulugbek',
    'Shomurodov Fayzullaev Masharipov Shukurov Khusanov Urunov Erkinov Iskanderov Ashurmatov Nasrullaev Abdikholikov Hamrobekov Sayfiev Alikulov Tursunov Nazarov Rakhimov Karimov Yusupov Usmonov',
  ),
  caribbean: g(
    'Leon Michail Bobby Demarai Kasey Ethan Damion Amari Andre Dexter Jamal Kaheim Shamar Javain Romario Cory Tyreek Daniel Joel Kevon',
    'Bailey Antonio Reid Gray Palmer Pinnock Lowe Bell Blake Lembikisa Nicholson Dixon Burke Leigh Hector Campbell Brown Richards Williams Gordon',
  ),
};
