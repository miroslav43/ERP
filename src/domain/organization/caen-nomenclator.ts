// src/domain/organization/caen-nomenclator.ts
// Nomenclatorul CAEN Rev.3 — doar nivelul de clasă (cod pe 4 cifre), singurul
// selectabil ca "cod CAEN" real la înregistrarea unei firme. Generat o
// singură dată dintr-un PDF oficial (CAEN-Rev.3_structura-completa.pdf),
// extras cu `pdftotext -table -enc UTF-8` (modul -table, NU -layout — -layout
// are o eroare de aliniere cod/denumire pe acest document, verificată pe 17
// clase unde amesteca text din clasa următoare, ex. codul 1105 "Fabricarea
// berii" ajungea atribuit greșit la 1106). Nu re-rulați generarea fără motiv:
// nomenclatorul se schimbă doar la modificări legislative.

export type CodCaen = Readonly<{
  /** 4 cifre — singurul nivel selectabil. */
  cod: string;
  denumire: string;
}>;

export const NOMENCLATOR_CAEN: readonly CodCaen[] = [
  {
    cod: "0111",
    denumire:
      "Cultivarea cerealelor (excluzând orezul), plantelor leguminoase şi a plantelor oleaginoase",
  },
  { cod: "0112", denumire: "Cultivarea orezului" },
  {
    cod: "0113",
    denumire: "Cultivarea legumelor şi a pepenilor, a rădăcinoaselor şi tuberculiferelor",
  },
  { cod: "0114", denumire: "Cultivarea trestiei de zahăr" },
  { cod: "0115", denumire: "Cultivarea tutunului" },
  { cod: "0116", denumire: "Cultivarea plantelor pentru fibre textile" },
  { cod: "0119", denumire: "Cultivarea altor plante din culturi nepermanente" },
  { cod: "0121", denumire: "Cultivarea strugurilor" },
  { cod: "0122", denumire: "Cultivarea fructelor tropicale şi subtropicale" },
  { cod: "0123", denumire: "Cultivarea fructelor citrice" },
  { cod: "0124", denumire: "Cultivarea fructelor seminţoase şi sâmburoase" },
  {
    cod: "0125",
    denumire:
      "Cultivarea altor pomi fructiferi, a arbuştilor fructiferi, căpşunilor şi a nuciferelor",
  },
  { cod: "0126", denumire: "Cultivarea fructelor oleaginoase" },
  { cod: "0127", denumire: "Cultivarea plantelor pentru prepararea băuturilor" },
  {
    cod: "0128",
    denumire:
      "Cultivarea condimentelor, plantelor aromatice, medicinale şi a plantelor de uz farmaceutic",
  },
  { cod: "0129", denumire: "Cultivarea altor plante permanente" },
  { cod: "0130", denumire: "Cultivarea plantelor pentru înmulţire" },
  { cod: "0141", denumire: "Creşterea bovinelor de lapte" },
  { cod: "0142", denumire: "Creşterea altor bovine" },
  { cod: "0143", denumire: "Creşterea cailor şi a altor cabaline" },
  { cod: "0144", denumire: "Creşterea cămilelor şi a camelidelor" },
  { cod: "0145", denumire: "Creşterea ovinelor şi caprinelor" },
  { cod: "0146", denumire: "Creşterea porcinelor" },
  { cod: "0147", denumire: "Creşterea păsărilor" },
  { cod: "0148", denumire: "Creşterea altor animale" },
  {
    cod: "0150",
    denumire: "Activităţi în ferme mixte (cultura vegetală combinată cu creşterea animalelor)",
  },
  { cod: "0161", denumire: "Activităţi auxiliare pentru producţia vegetală" },
  { cod: "0162", denumire: "Activităţi auxiliare pentru creşterea animalelor" },
  { cod: "0163", denumire: "Activităţi după recoltare și pregătirea semințelor" },
  {
    cod: "0170",
    denumire:
      "Vânătoare, capturarea cu capcane a vânatului şi activităţi de servicii anexe vânătorii",
  },
  { cod: "0210", denumire: "Silvicultură şi alte activităţi forestiere" },
  { cod: "0220", denumire: "Exploatarea forestieră" },
  { cod: "0230", denumire: "Colectarea produselor forestiere nelemnoase din flora spontană" },
  { cod: "0240", denumire: "Activităţi de servicii anexe silviculturii" },
  { cod: "0311", denumire: "Pescuitul maritim" },
  { cod: "0312", denumire: "Pescuitul în ape dulci" },
  { cod: "0321", denumire: "Acvacultura maritimă" },
  { cod: "0322", denumire: "Acvacultura în ape dulci" },
  { cod: "0330", denumire: "Activităţi anexe pescuitului şi acvaculturii" },
  { cod: "0510", denumire: "Extracţia cărbunelui superior (PCS=>23865 kJ/kg)" },
  { cod: "0520", denumire: "Extracţia cărbunelui inferior (PCS<23865 kJ/kg)" },
  { cod: "0610", denumire: "Extracţia petrolului brut" },
  { cod: "0620", denumire: "Extracţia gazelor naturale" },
  { cod: "0710", denumire: "Extracţia minereurilor feroase" },
  { cod: "0721", denumire: "Extracţia minereurilor de uraniu şi toriu" },
  { cod: "0729", denumire: "Extracţia altor minereuri metalifere neferoase" },
  {
    cod: "0811",
    denumire:
      "Extracţia pietrei ornamentale şi a pietrei pentru construcţii, extracţia pietrei calcaroase, ghipsului, cretei şi a ardeziei",
  },
  { cod: "0812", denumire: "Extracţia pietrişului şi nisipului; extracţia argilei şi caolinului" },
  {
    cod: "0891",
    denumire: "Extracţia mineralelor pentru industria chimică şi a îngrăşămintelor naturale",
  },
  { cod: "0892", denumire: "Extracţia turbei" },
  { cod: "0893", denumire: "Extracţia sării" },
  { cod: "0899", denumire: "Alte activităţi extractive n.c.a." },
  {
    cod: "0910",
    denumire: "Activităţi de servicii anexe extracţiei petrolului brut şi gazelor naturale",
  },
  { cod: "0990", denumire: "Activităţi de servicii anexe pentru extracţia mineralelor" },
  { cod: "1011", denumire: "Prelucrarea şi conservarea cărnii" },
  { cod: "1012", denumire: "Prelucrarea şi conservarea cărnii de pasăre" },
  { cod: "1013", denumire: "Fabricarea produselor din carne (inclusiv din carne de pasăre)" },
  { cod: "1020", denumire: "Prelucrarea şi conservarea peştelui, crustaceelor şi moluştelor" },
  { cod: "1031", denumire: "Prelucrarea şi conservarea cartofilor" },
  { cod: "1032", denumire: "Fabricarea sucurilor de fructe şi legume" },
  { cod: "1039", denumire: "Prelucrarea şi conservarea fructelor şi legumelor n.c.a." },
  { cod: "1041", denumire: "Fabricarea uleiurilor şi grăsimilor" },
  { cod: "1042", denumire: "Fabricarea margarinei şi a altor produse comestibile similare" },
  { cod: "1051", denumire: "Fabricarea produselor lactate şi a brânzeturilor" },
  { cod: "1052", denumire: "Fabricarea îngheţatei" },
  { cod: "1061", denumire: "Fabricarea produselor de morărit" },
  { cod: "1062", denumire: "Fabricarea amidonului şi a produselor din amidon" },
  {
    cod: "1071",
    denumire: "Fabricarea pâinii; fabricarea prăjiturilor şi a produselor proaspete de patiserie",
  },
  {
    cod: "1072",
    denumire:
      "Fabricarea biscuiţilor şi pişcoturilor; fabricarea prăjiturilor şi a produselor conservate de patiserie",
  },
  {
    cod: "1073",
    denumire:
      "Fabricarea macaroanelor, tăiţeilor, cuş-cuş-ului şi a altor produse făinoase similar",
  },
  { cod: "1081", denumire: "Fabricarea zahărului" },
  {
    cod: "1082",
    denumire: "Fabricarea produselor din cacao, a ciocolatei şi a produselor zaharoase",
  },
  { cod: "1083", denumire: "Prelucrarea ceaiului şi cafelei" },
  { cod: "1084", denumire: "Fabricarea condimentelor şi ingredientelor" },
  { cod: "1085", denumire: "Fabricarea de mâncărururi preparate" },
  {
    cod: "1086",
    denumire: "Fabricarea preparatelor alimentare omogenizate şi alimentelor dietetice",
  },
  { cod: "1089", denumire: "Fabricarea altor produse alimentare n.c.a." },
  { cod: "1091", denumire: "Fabricarea preparatelor pentru hrana animalelor de fermă" },
  { cod: "1092", denumire: "Fabricarea preparatelor pentru hrana animalelor de companie" },
  { cod: "1101", denumire: "Distilarea, rafinarea şi mixarea băuturilor alcoolice" },
  { cod: "1102", denumire: "Fabricarea vinurilor din struguri" },
  { cod: "1103", denumire: "Fabricarea cidrului şi a altor vinuri din fructe" },
  { cod: "1104", denumire: "Fabricarea altor băuturi nedistilate, obţinute prin fermentare" },
  { cod: "1105", denumire: "Fabricarea berii" },
  { cod: "1106", denumire: "Fabricarea malţului" },
  {
    cod: "1107",
    denumire:
      "Producţia de băuturi răcoritoare nealcoolice; producţia de ape minerale şi alte ape îmbuteliate",
  },
  { cod: "1200", denumire: "Fabricarea produselor din tutun" },
  { cod: "1310", denumire: "Pregătirea fibrelor şi filarea fibrelor textile" },
  { cod: "1320", denumire: "Producţia de ţesături" },
  { cod: "1330", denumire: "Finisarea materialelor textile" },
  { cod: "1391", denumire: "Fabricarea de metraje prin tricotare sau croşetare" },
  {
    cod: "1392",
    denumire:
      "Fabricarea de articole confecționate din textile (excluzând îmbrăcămintea și lenjeria de corp)",
  },
  { cod: "1393", denumire: "Fabricarea de covoare şi mochete" },
  { cod: "1394", denumire: "Fabricarea de odgoane, frânghii, sfori şi plase" },
  {
    cod: "1395",
    denumire:
      "Fabricarea de textile neţesute şi articole din acestea, cu excepţia confecţiilor de îmbrăcăminte",
  },
  { cod: "1396", denumire: "Fabricarea de articole tehnice şi industriale din textile" },
  { cod: "1399", denumire: "Fabricarea altor articole textile n.c.a." },
  { cod: "1410", denumire: "Fabricarea articolelor de îmbrăcăminte prin tricotare sau croşetare" },
  { cod: "1421", denumire: "Fabricarea articolelor de îmbrăcăminte" },
  { cod: "1422", denumire: "Fabricarea de articole de lenjerie de corp" },
  { cod: "1423", denumire: "Fabricarea de articole de îmbrăcăminte pentru lucru" },
  { cod: "1424", denumire: "Fabricarea articolelor de îmbrăcăminte din piele și blană" },
  { cod: "1429", denumire: "Fabricarea altor articole de îmbrăcăminte şi accesorii n.c.a." },
  { cod: "1511", denumire: "Tăbăcirea şi finisarea pieilor; prepararea şi vopsirea blănurilor" },
  {
    cod: "1512",
    denumire: "Fabricarea articolelor de voiaj şi marochinărie şi a articolelor de harnaşament",
  },
  { cod: "1520", denumire: "Fabricarea încălţămintei" },
  { cod: "1611", denumire: "Tăierea şi rindeluirea lemnului" },
  { cod: "1612", denumire: "Prelucrarea și finisarea lemnului" },
  { cod: "1621", denumire: "Fabricarea de furnire şi a panourilor din lemn" },
  { cod: "1622", denumire: "Fabricarea parchetului asamblat în panouri" },
  {
    cod: "1623",
    denumire: "Fabricarea altor elemente de dulgherie şi tâmplărie, pentru construcţii",
  },
  { cod: "1624", denumire: "Fabricarea ambalajelor din lemn" },
  { cod: "1625", denumire: "Fabricarea de uși și ferestre din lemn" },
  { cod: "1626", denumire: "Fabricarea de combustibili solizi din biomasă vegetală" },
  { cod: "1627", denumire: "Finisarea articolelor din lemn" },
  {
    cod: "1628",
    denumire:
      "Fabricarea altor produse din lemn; fabricarea articolelor din plută, paie şi din alte materiale vegetale împletite",
  },
  { cod: "1711", denumire: "Fabricarea celulozei" },
  { cod: "1712", denumire: "Fabricarea hârtiei şi cartonului" },
  {
    cod: "1721",
    denumire: "Fabricarea hârtiei şi cartonului ondulat şi a ambalajelor din hârtie şi carton",
  },
  {
    cod: "1722",
    denumire: "Fabricarea produselor de uz gospodăresc şi sanitar, din hârtie sau carton",
  },
  { cod: "1723", denumire: "Fabricarea articolelor de papetărie" },
  { cod: "1724", denumire: "Fabricarea tapetului" },
  { cod: "1725", denumire: "Fabricarea altor articole din hârtie şi carton n.c.a." },
  { cod: "1811", denumire: "Tipărirea ziarelor" },
  { cod: "1812", denumire: "Alte activităţi de tipărire n.c.a." },
  { cod: "1813", denumire: "Servicii pregătitoare pentru pretipărire" },
  { cod: "1814", denumire: "Legătorie şi servicii conexe" },
  { cod: "1820", denumire: "Reproducerea înregistrărilor" },
  { cod: "1910", denumire: "Fabricarea produselor de cocserie" },
  { cod: "1920", denumire: "Fabricarea produselor obţinute din prelucrarea ţiţeiului" },
  { cod: "2011", denumire: "Fabricarea gazelor industriale" },
  { cod: "2012", denumire: "Fabricarea coloranţilor şi a pigmenţilor" },
  { cod: "2013", denumire: "Fabricarea altor produse chimice anorganice, de bază" },
  { cod: "2014", denumire: "Fabricarea altor produse chimice organice, de bază" },
  { cod: "2015", denumire: "Fabricarea îngrăşămintelor şi produselor azotoase" },
  { cod: "2016", denumire: "Fabricarea materialelor plastice în forme primare" },
  { cod: "2017", denumire: "Fabricarea cauciucului sintetic în forme primare" },
  {
    cod: "2020",
    denumire:
      "Fabricarea pesticidelor şi a altor produse agrochimice Fabricarea vopselelor, lacurilor, cernelii tipografice şi masticurilor",
  },
  {
    cod: "2030",
    denumire: "Fabricarea vopselelor, lacurilor, cernelii tipografice şi masticurilor",
  },
  { cod: "2041", denumire: "Fabricarea săpunurilor, detergenţilor şi a produselor de întreţinere" },
  { cod: "2042", denumire: "Fabricarea parfumurilor şi a produselor cosmetice (de toaletă)" },
  { cod: "2051", denumire: "Fabricarea biocombustibililor lichizi" },
  { cod: "2059", denumire: "Fabricarea altor produse chimice n.c.a." },
  { cod: "2060", denumire: "Fabricarea fibrelor sintetice şi artificiale" },
  { cod: "2110", denumire: "Fabricarea produselor farmaceutice de bază" },
  { cod: "2120", denumire: "Fabricarea preparatelor farmaceutice" },
  {
    cod: "2211",
    denumire: "Fabricarea anvelopelor şi a camerelor de aer; reşaparea şi refacerea anvelopelor",
  },
  { cod: "2212", denumire: "Fabricarea altor produse din cauciuc" },
  {
    cod: "2221",
    denumire: "Fabricarea plăcilor, foliilor, tuburilor şi profilelor din material plastic",
  },
  { cod: "2222", denumire: "Fabricarea articolelor de ambalaj din material plastic" },
  { cod: "2223", denumire: "Fabricarea de uși și ferestre din material plastic" },
  { cod: "2224", denumire: "Fabricarea articolelor din material plastic pentru construcţii" },
  { cod: "2225", denumire: "Prelucrarea și finisarea articolelor din material plastic" },
  { cod: "2226", denumire: "Fabricarea altor produse din material plastic" },
  { cod: "2311", denumire: "Fabricarea sticlei plate" },
  { cod: "2312", denumire: "Prelucrarea şi fasonarea sticlei plate" },
  { cod: "2313", denumire: "Fabricarea articolelor din sticlă" },
  { cod: "2314", denumire: "Fabricarea fibrelor din sticlă" },
  { cod: "2315", denumire: "Fabricarea de sticlărie tehnică" },
  { cod: "2320", denumire: "Fabricarea de produse refractare" },
  { cod: "2331", denumire: "Fabricarea plăcilor şi dalelor din ceramică" },
  {
    cod: "2332",
    denumire:
      "Fabricarea cărămizilor, ţiglelor şi altor produse pentru construcţii, din argilă arsă",
  },
  { cod: "2341", denumire: "Fabricarea articolelor ceramice pentru uz gospodăresc şi ornamental" },
  { cod: "2342", denumire: "Fabricarea de obiecte sanitare din ceramică" },
  { cod: "2343", denumire: "Fabricarea izolatorilor şi pieselor izolante din ceramică" },
  { cod: "2344", denumire: "Fabricarea altor produse tehnice din ceramică" },
  { cod: "2345", denumire: "Fabricarea altor produse ceramice n.c.a." },
  { cod: "2351", denumire: "Fabricarea cimentului" },
  { cod: "2352", denumire: "Fabricarea varului şi ipsosului" },
  { cod: "2361", denumire: "Fabricarea produselor din beton pentru construcţii" },
  { cod: "2362", denumire: "Fabricarea produselor din ipsos pentru construcţii" },
  { cod: "2363", denumire: "Fabricarea betonului" },
  { cod: "2364", denumire: "Fabricarea mortarului" },
  { cod: "2365", denumire: "Fabricarea produselor din azbociment" },
  { cod: "2366", denumire: "Fabricarea altor articole din beton, ciment şi ipsos" },
  { cod: "2370", denumire: "Tăierea, fasonarea şi finisarea pietrei" },
  { cod: "2391", denumire: "Fabricarea de produse abrazive" },
  { cod: "2399", denumire: "Fabricarea altor produse din minerale nemetalice, n.c.a." },
  { cod: "2410", denumire: "Producţia de metale feroase sub forme primare şi de feroaliaje" },
  {
    cod: "2420",
    denumire: "Producţia de tuburi, ţevi, profile tubulare şi accesorii pentru acestea, din oţel",
  },
  { cod: "2431", denumire: "Tragere la rece a barelor" },
  { cod: "2432", denumire: "Laminare la rece a benzilor înguste" },
  { cod: "2433", denumire: "Producţia de profile obţinute la rece" },
  { cod: "2434", denumire: "Trefilarea firelor la rece" },
  { cod: "2441", denumire: "Producţia metalelor preţioase" },
  { cod: "2442", denumire: "Metalurgia aluminiului" },
  { cod: "2443", denumire: "Producţia plumbului, zincului şi cositorului" },
  { cod: "2444", denumire: "Metalurgia cuprului" },
  { cod: "2445", denumire: "Producţia altor metale neferoase" },
  { cod: "2446", denumire: "Prelucrarea combustibililor nucleari" },
  { cod: "2451", denumire: "Turnarea fontei" },
  { cod: "2452", denumire: "Turnarea oţelului" },
  { cod: "2453", denumire: "Turnarea metalelor neferoase uşoare" },
  { cod: "2454", denumire: "Turnarea altor metale neferoase" },
  {
    cod: "2511",
    denumire: "Fabricarea de construcţii metalice şi părţi componente ale structurilor metalice",
  },
  { cod: "2512", denumire: "Fabricarea de uşi şi ferestre din metal" },
  {
    cod: "2521",
    denumire:
      "Producţia de radiatoare şi cazane pentru încălzire central; producția de generatoare de abur și boilere",
  },
  { cod: "2522", denumire: "Producţia de rezervoare, cisterne şi containere metalice" },
  { cod: "2530", denumire: "Fabricarea armamentului şi muniţiei" },
  {
    cod: "2540",
    denumire:
      "Fabricarea produselor metalice obţinute prin deformare plastică; metalurgia pulberilor",
  },
  { cod: "2551", denumire: "Acoperirea metalelor" },
  { cod: "2552", denumire: "Tratamente termice ale metalelor" },
  { cod: "2553", denumire: "Operaţiuni de mecanică generală" },
  { cod: "2561", denumire: "Fabricarea produselor de tăiat" },
  { cod: "2562", denumire: "Fabricarea articolelor de feronerie" },
  { cod: "2563", denumire: "Fabricarea uneltelor" },
  {
    cod: "2591",
    denumire: "Fabricarea de recipienţi, containere şi alte produse similare din oţel",
  },
  { cod: "2592", denumire: "Fabricarea ambalajelor metalice uşoare" },
  {
    cod: "2593",
    denumire: "Fabricarea articolelor din fire metalice; fabricarea de lanţuri şi arcuri",
  },
  {
    cod: "2594",
    denumire:
      "Fabricarea de şuruburi, buloane şi alte articole filetate; fabricarea de nituri şi şaibe",
  },
  { cod: "2599", denumire: "Fabricarea altor articole din metal n.c.a." },
  { cod: "2611", denumire: "Fabricarea componentelor electronice" },
  { cod: "2612", denumire: "Fabricarea subansamblurilor electronice (module)" },
  { cod: "2620", denumire: "Fabricarea calculatoarelor şi a echipamentelor periferice" },
  { cod: "2630", denumire: "Fabricarea echipamentelor de comunicaţii" },
  { cod: "2640", denumire: "Fabricarea produselor electronice de larg consum" },
  {
    cod: "2651",
    denumire:
      "Fabricarea de instrumente şi dispozitive pentru măsură, verificare, control, navigaţie",
  },
  {
    cod: "2652",
    denumire:
      "Producţia de ceasuri Fabricarea de echipamente pentru radiologie, electrodiagnostic şi electroterapie",
  },
  {
    cod: "2660",
    denumire: "Fabricarea de echipamente pentru radiologie, electrodiagnostic şi electroterapie",
  },
  {
    cod: "2670",
    denumire:
      "Fabricarea de instrumente optice, suporți magnetici și optici; fabricarea de echipamente fotografice",
  },
  {
    cod: "2711",
    denumire: "Fabricarea motoarelor, generatoarelor şi transformatoarelor electrice",
  },
  { cod: "2712", denumire: "Fabricarea aparatelor de distribuţie şi control a electricităţii" },
  { cod: "2720", denumire: "Fabricarea de acumulatori şi baterii" },
  { cod: "2731", denumire: "Fabricarea de cabluri cu fibră optică" },
  { cod: "2732", denumire: "Fabricarea altor fire şi cabluri electrice şi electronice" },
  {
    cod: "2733",
    denumire:
      "Fabricarea dispozitivelor de conexiune pentru fire şi cabluri electrice şi electronice",
  },
  { cod: "2740", denumire: "Fabricarea de echipamente electrice de iluminat" },
  { cod: "2751", denumire: "Fabricarea de aparate electrocasnice" },
  { cod: "2752", denumire: "Fabricarea de echipamente casnice neelectrice" },
  { cod: "2790", denumire: "Fabricarea altor echipamente electrice" },
  {
    cod: "2811",
    denumire:
      "Fabricarea de motoare şi turbine (cu excepţia celor pentru avioane, autovehicule şi motociclete.)",
  },
  { cod: "2812", denumire: "Fabricarea de motoare hidraulice" },
  { cod: "2813", denumire: "Fabricarea de pompe şi compresoare" },
  { cod: "2814", denumire: "Fabricarea de articole de robinetărie" },
  {
    cod: "2815",
    denumire:
      "Fabricarea lagărelor, angrenajelor, cutiilor de viteză şi a elementelor mecanice de transmisie",
  },
  { cod: "2821", denumire: "Fabricarea cuptoarelor, furnalelor şi arzătoarelor" },
  { cod: "2822", denumire: "Fabricarea echipamentelor de ridicat şi manipulat" },
  {
    cod: "2823",
    denumire:
      "Fabricarea maşinilor şi echipamentelor de birou (exceptând fabricarea calculatoarelor şi a echipamentelor periferice)",
  },
  { cod: "2824", denumire: "Fabricarea maşinilor-unelte portabile acţionate electric" },
  {
    cod: "2825",
    denumire:
      "Fabricarea echipamentelor de ventilaţie şi frigorifice, exceptând echipamentele de uz casnic",
  },
  { cod: "2829", denumire: "Fabricarea altor maşini şi utilaje de utilizare generală n.c.a." },
  {
    cod: "2830",
    denumire: "Fabricarea masinilor şi utilajelor pentru agricultură şi exploatări forestiere",
  },
  {
    cod: "2841",
    denumire: "Fabricarea utilajelor şi a maşinilor-unelte pentru prelucrarea metalului",
  },
  { cod: "2842", denumire: "Fabricarea altor maşini-unelte n.c.a." },
  { cod: "2891", denumire: "Fabricarea utilajelor pentru metalurgie" },
  { cod: "2892", denumire: "Fabricarea utilajelor pentru extracţie şi construcţii" },
  {
    cod: "2893",
    denumire:
      "Fabricarea utilajelor pentru prelucrarea produselor alimentare, băuturilor şi tutunului",
  },
  {
    cod: "2894",
    denumire: "Fabricarea utilajelor pentru industria textilă, a îmbrăcămintei şi a pielăriei",
  },
  { cod: "2895", denumire: "Fabricarea utilajelor pentru industria hârtiei şi cartonului" },
  {
    cod: "2896",
    denumire: "Fabricarea utilajelor pentru prelucrarea maselor plastice şi a cauciucului",
  },
  {
    cod: "2897",
    denumire:
      "Fabricarea mașinilor și utilajelor pentru fabricația aditivă (care utilizează tehnologia de fabricație aditivă)",
  },
  { cod: "2899", denumire: "Fabricarea altor maşini şi utilaje specifice n.c.a." },
  { cod: "2910", denumire: "Fabricarea autovehiculelor de transport rutier" },
  {
    cod: "2920",
    denumire: "Producţia de caroserii pentru autovehicule; fabricarea de remorci şi semiremorci",
  },
  {
    cod: "2931",
    denumire:
      "Fabricarea de echipamente electrice şi electronice pentru autovehicule şi pentru motoare de autovehicule",
  },
  {
    cod: "2932",
    denumire:
      "Fabricarea altor piese şi accesorii pentru autovehicule şi pentru motoare de autovehicule",
  },
  { cod: "3011", denumire: "Construcţia de nave civile şi structuri plutitoare" },
  { cod: "3012", denumire: "Construcţia de ambarcaţiuni sportive şi de agrement" },
  { cod: "3013", denumire: "Construcţia de nave și vase militare" },
  { cod: "3020", denumire: "Fabricarea materialului rulant" },
  { cod: "3031", denumire: "Fabricarea de aeronave şi nave spaţiale, civile" },
  { cod: "3032", denumire: "Fabricarea de aeronave şi nave spaţiale, militare" },
  { cod: "3040", denumire: "Fabricarea vehiculelor militare de luptă" },
  { cod: "3091", denumire: "Fabricarea de motociclete" },
  { cod: "3092", denumire: "Fabricarea de biciclete şi de de vehicule pentru invalizi" },
  { cod: "3099", denumire: "Fabricarea altor mijloace de transport n.c.a." },
  { cod: "3100", denumire: "Fabricarea de mobilă" },
  { cod: "3211", denumire: "Baterea monedelor" },
  {
    cod: "3212",
    denumire: "Fabricarea bijuteriilor şi articolelor similare din metale şi pietre preţioase",
  },
  { cod: "3213", denumire: "Fabricarea imitaţiilor de bijuterii şi articole similare" },
  { cod: "3220", denumire: "Fabricarea instrumentelor muzicale" },
  { cod: "3230", denumire: "Fabricarea articolelor pentru sport" },
  { cod: "3240", denumire: "Fabricarea jocurilor şi jucăriilor" },
  {
    cod: "3250",
    denumire: "Fabricarea de dispozitive, aparate şi instrumente medicale stomatologice",
  },
  { cod: "3291", denumire: "Fabricarea măturilor şi periilor" },
  { cod: "3299", denumire: "Fabricarea altor produse manufacturiere n.c.a." },
  { cod: "3311", denumire: "Repararea și întreținerea articolelor fabricate din metal" },
  { cod: "3312", denumire: "Repararea și întreținerea maşinilor" },
  { cod: "3313", denumire: "Repararea și întreținerea echipamentelor electronice şi optice" },
  { cod: "3314", denumire: "Repararea și întreținerea echipamentelor electrice" },
  { cod: "3315", denumire: "Repararea şi întreţinerea navelor şi bărcilor, civile" },
  { cod: "3316", denumire: "Repararea şi întreţinerea aeronavelor şi navelor spaţiale, civile" },
  {
    cod: "3317",
    denumire: "Repararea şi întreţinerea altor echipamente civile de transport n.c.a.",
  },
  {
    cod: "3318",
    denumire:
      "Repararea şi întreţinerea vehiculelor militare de luptă, a navelor, vaselor, aeronavelor şi navelor spaţiale, militare",
  },
  { cod: "3319", denumire: "Repararea și întreținerea altor echipamente" },
  { cod: "3320", denumire: "Instalarea maşinilor şi echipamentelor industriale" },
  { cod: "3511", denumire: "Producţia de energie electrică din resurse neregenerabile" },
  { cod: "3512", denumire: "Producţia de energie electrică din resurse regenerabile" },
  { cod: "3513", denumire: "Transportul energiei electrice" },
  { cod: "3514", denumire: "Distribuţia energiei electrice" },
  { cod: "3515", denumire: "Comercializarea energiei electrice" },
  { cod: "3516", denumire: "Depozitarea energiei electrice" },
  { cod: "3521", denumire: "Producţia gazelor" },
  { cod: "3522", denumire: "Distribuţia combustibililor gazoşi, prin conducte" },
  { cod: "3523", denumire: "Comercializarea combustibililor gazoşi, prin conducte" },
  { cod: "3524", denumire: "Depozitarea gazelor, ca parte a serviciilor de furnizare" },
  { cod: "3530", denumire: "Furnizarea de abur şi aer condiţionat" },
  {
    cod: "3540",
    denumire:
      "Activități ale agenților și brokerilor din domeniul energiei electrice și a gazelor naturale",
  },
  { cod: "3600", denumire: "Captarea, tratarea şi distribuţia apei" },
  { cod: "3700", denumire: "Colectarea şi epurarea apelor uzate" },
  { cod: "3811", denumire: "Colectarea deşeurilor nepericuloase" },
  { cod: "3812", denumire: "Colectarea deşeurilor periculoase" },
  { cod: "3821", denumire: "Recuperarea materialelor reciclabile" },
  {
    cod: "3822",
    denumire:
      "Producția de energie (electrică sau termică) prin tratarea deșeurilor (inclusiv prin incinerare)",
  },
  { cod: "3823", denumire: "Alte activități de tartare a deșeurilor" },
  { cod: "3831", denumire: "Incinerarea deșeurilor fără producție de energie" },
  {
    cod: "3832",
    denumire: "Activități ale gropilor de gunoi sau a depozitelor permanente de deșeuri",
  },
  { cod: "3833", denumire: "Alte activități de eliminare a deșeurilor" },
  { cod: "3900", denumire: "Activităţi şi servicii de decontaminare" },
  { cod: "4100", denumire: "Lucrări de construcţii a clădirilor rezidenţiale şi nerezidenţiale" },
  { cod: "4211", denumire: "Lucrări de construcţii a drumurilor şi autostrăzilor" },
  { cod: "4212", denumire: "Lucrări de construcţii a căilor ferate de suprafaţă şi subterane." },
  { cod: "4213", denumire: "Construcţia de poduri şi tuneluri" },
  { cod: "4221", denumire: "Lucrări de construcţii a proiectelor utilitare pentru fluide" },
  {
    cod: "4222",
    denumire:
      "Lucrări de construcţii a proiectelor utilitare pentru electricitate şi telecomunicaţii",
  },
  { cod: "4291", denumire: "Construcţii hidrotehnice" },
  { cod: "4299", denumire: "Lucrări de construcţii a altor proiecte inginereşti n.c.a." },
  { cod: "4311", denumire: "Lucrări de demolare a construcţiilor" },
  { cod: "4312", denumire: "Lucrări de pregătire a terenului" },
  { cod: "4313", denumire: "Lucrări de foraj şi sondaj pentru construcţii" },
  { cod: "4321", denumire: "Lucrări de instalaţii electrice" },
  { cod: "4322", denumire: "Lucrări de instalaţii sanitare, de încălzire şi de aer condiţionat" },
  { cod: "4323", denumire: "Lucrări de izolații" },
  { cod: "4324", denumire: "Alte lucrări de instalaţii pentru construcţii" },
  { cod: "4331", denumire: "Lucrări de ipsoserie" },
  { cod: "4332", denumire: "Lucrări de tâmplărie şi dulgherie" },
  { cod: "4333", denumire: "Lucrări de pardosire şi placare a pereţilor" },
  { cod: "4334", denumire: "Lucrări de vopsitorie, zugrăveli şi montări de geamuri" },
  { cod: "4335", denumire: "Alte lucrări de finisare" },
  { cod: "4341", denumire: "Lucrări de învelitori, şarpante şi terase la construcţii" },
  { cod: "4342", denumire: "Alte lucrări speciale de construcţii pentru clădiri" },
  { cod: "4350", denumire: "Lucrări speciale de construcţii pentru proiecte de geniu civil" },
  { cod: "4360", denumire: "Servicii de intermediere pentru lucrări speciale de construcţii" },
  { cod: "4391", denumire: "Activități de zidărie" },
  { cod: "4399", denumire: "Alte lucrări speciale de construcții n.c.a." },
  {
    cod: "4611",
    denumire:
      "Intermedieri în comerţul cu materii prime agricole, animale vii, materii prime textile şi cu semifabricate",
  },
  {
    cod: "4612",
    denumire:
      "Intermedieri în comerţul cu combustibili, minereuri, metale şi produse chimice pentru industrie",
  },
  {
    cod: "4613",
    denumire: "Intermedieri în comerţul cu material lemnos şi materiale de construcţii",
  },
  {
    cod: "4614",
    denumire: "Intermedieri în comerţul cu maşini, echipamente industriale, nave şi avioane",
  },
  { cod: "4615", denumire: "Intermedieri în comerţul cu mobilă, articole de menaj şi de fierărie" },
  {
    cod: "4616",
    denumire:
      "Intermedieri în comerţul cu textile, confecţii din blană, încălţăminte şi articole din piele",
  },
  { cod: "4617", denumire: "Intermedieri în comerţul cu produse alimentare, băuturi şi tutun" },
  {
    cod: "4618",
    denumire:
      "Intermedieri în comerţul specializat în vânzarea produselor cu caracter specific, n.c.a.",
  },
  { cod: "4619", denumire: "Intermedieri în comerţul cu produse diverse" },
  {
    cod: "4621",
    denumire: "Comerţ cu ridicata al cerealelor, seminţelor, furajelor şi tutunului neprelucrat",
  },
  { cod: "4622", denumire: "Comerţ cu ridicata al florilor şi al plantelor" },
  { cod: "4623", denumire: "Comerţ cu ridicata al animalelor vii" },
  {
    cod: "4624",
    denumire: "Comerţ cu ridicata al blănurilor, pieilor brute şi al pieilor prelucrate",
  },
  { cod: "4631", denumire: "Comerţ cu ridicata al fructelor şi legumelor" },
  {
    cod: "4632",
    denumire:
      "Comerţ cu ridicata al cărnii şi produselor din carne, peşte şi produse din pește, crustacee şi moluşte",
  },
  {
    cod: "4633",
    denumire:
      "Comerţ cu ridicata al produselor lactate, ouălor, uleiurilor şi grăsimilor comestibile",
  },
  { cod: "4634", denumire: "Comerţ cu ridicata al băuturilor" },
  { cod: "4635", denumire: "Comerţ cu ridicata al produselor din tutun" },
  { cod: "4636", denumire: "Comerţ cu ridicata al zahărului, ciocolatei şi produselor zaharoase" },
  { cod: "4637", denumire: "Comerţ cu ridicata cu cafea, ceai, cacao şi condimente" },
  { cod: "4638", denumire: "Comerţ cu ridicata specializat al altor alimente" },
  {
    cod: "4639",
    denumire: "Comerţ cu ridicata nespecializat de produse alimentare, băuturi şi tutun",
  },
  { cod: "4641", denumire: "Comerţ cu ridicata al produselor textile" },
  { cod: "4642", denumire: "Comerţ cu ridicata al îmbrăcămintei şi încălţămintei" },
  {
    cod: "4643",
    denumire:
      "Comerţ cu ridicata al aparatelor electrice de uz gospodăresc, al aparatelor de radio şi televizoarelor",
  },
  {
    cod: "4644",
    denumire: "Comerţ cu ridicata al produselor din ceramică, sticlărie, şi produse de întreţinere",
  },
  { cod: "4645", denumire: "Comerţ cu ridicata al produselor cosmetice şi de parfumerie" },
  { cod: "4646", denumire: "Comerţ cu ridicata al produselor farmaceutice și medicale" },
  {
    cod: "4647",
    denumire:
      "Comerţ cu ridicata al mobilei (inclusiv de birou și pentru magazine), covoarelor şi a articolelor de iluminat",
  },
  { cod: "4648", denumire: "Comerţ cu ridicata al ceasurilor şi bijuteriilor" },
  { cod: "4649", denumire: "Comerţ cu ridicata al altor bunuri de uz gospodăresc" },
  {
    cod: "4650",
    denumire: "Comerţ cu ridicata al echipamentului informatic şi de telecomunicaţii",
  },
  {
    cod: "4661",
    denumire: "Comerţ cu ridicata al maşinilor agricole, echipamentelor şi furniturilor",
  },
  { cod: "4662", denumire: "Comerţ cu ridicata al maşinilor-unelte" },
  {
    cod: "4663",
    denumire: "Comerţ cu ridicata al maşinilor pentru industria minieră şi construcţii",
  },
  { cod: "4664", denumire: "Comerţ cu ridicata al altor maşini şi echipamente" },
  { cod: "4671", denumire: "Comerţ cu ridicata al autovehiculelor" },
  { cod: "4672", denumire: "Comerţ cu ridicata al pieselor şi accesoriilor pentru autovehicule" },
  {
    cod: "4673",
    denumire:
      "Comerţ cu ridicata al motocicletelor; comerț cu ridicata al pieselor şi accesoriilor pentru motociclete",
  },
  {
    cod: "4681",
    denumire:
      "Comerţ cu ridicata al combustibililor solizi, lichizi şi gazoşi şi al produselor derivate",
  },
  { cod: "4682", denumire: "Comerţ cu ridicata al metalelor şi minereurilor metalice" },
  {
    cod: "4683",
    denumire:
      "Comerţ cu ridicata al materialului lemnos şi a materialelor de construcţie şi echipamentelor sanitare",
  },
  {
    cod: "4684",
    denumire:
      "Comerţ cu ridicata al echipamentelor şi furniturilor de fierărie pentru instalaţii sanitare şi de încălzire",
  },
  { cod: "4685", denumire: "Comerţ cu ridicata al produselor chimice" },
  { cod: "4686", denumire: "Comerţ cu ridicata al altor produse intermediare" },
  { cod: "4687", denumire: "Comerţ cu ridicata al deşeurilor şi resturilor" },
  { cod: "4689", denumire: "Comerţ cu ridicata specializat al altor produse n.c.a." },
  { cod: "4690", denumire: "Comerţ cu ridicata nespecializat" },
  {
    cod: "4711",
    denumire:
      "Comerţ cu amănuntul nespecializat, cu vânzare predominantă de produse alimentare, băuturi şi tutun",
  },
  {
    cod: "4712",
    denumire: "Comerţ cu amănuntul nespecializat, cu vânzare predominantă de produse nealimentare",
  },
  { cod: "4721", denumire: "Comerţ cu amănuntul al fructelor şi legumelor proaspete" },
  { cod: "4722", denumire: "Comerţ cu amănuntul al cărnii şi al produselor din carne" },
  { cod: "4723", denumire: "Comerţ cu amănuntul al peştelui, crustaceelor şi moluştelor" },
  {
    cod: "4724",
    denumire: "Comerţ cu amănuntul al pâinii, produselor de patiserie şi produselor zaharoase",
  },
  { cod: "4725", denumire: "Comerţ cu amănuntul al băuturilor" },
  { cod: "4726", denumire: "Comerţ cu amănuntul al produselor din tutun" },
  { cod: "4727", denumire: "Comerţ cu amănuntul al altor produse alimentare" },
  { cod: "4730", denumire: "Comerţ cu amănuntul al carburanţilor pentru autovehicule" },
  {
    cod: "4740",
    denumire: "Comerţ cu amănuntul al echipamentului informatic şi de telecomunicaţii",
  },
  { cod: "4751", denumire: "Comerţ cu amănuntul al textilelor" },
  {
    cod: "4752",
    denumire:
      "Comerţ cu amănuntul al articolelor de fierărie, al materialelor de construcții, al articolelor din sticlă şi a celor pentru vopsit",
  },
  {
    cod: "4753",
    denumire:
      "Comerţ cu amănuntul al covoarelor, carpetelor, tapetelor şi a altor acoperitoare de podea",
  },
  { cod: "4754", denumire: "Comerţ cu amănuntul al articolelor şi aparatelor electrocasnice" },
  {
    cod: "4755",
    denumire:
      "Comerţ cu amănuntul al mobilei, al articolelor de iluminat şi al altor articole de uz casnic n.c.a.",
  },
  { cod: "4761", denumire: "Comerţ cu amănuntul al cărţilor" },
  { cod: "4762", denumire: "Comerţ cu amănuntul al ziarelor şi articolelor de papetărie" },
  { cod: "4763", denumire: "Comerţ cu amănuntul al echipamentelor sportive" },
  { cod: "4764", denumire: "Comerţ cu amănuntul al jocurilor şi jucăriilor" },
  { cod: "4769", denumire: "Comerţ cu amănuntul de bunuri culturale şi recreative n.c.a." },
  { cod: "4771", denumire: "Comerţ cu amănuntul al îmbrăcămintei" },
  { cod: "4772", denumire: "Comerţ cu amănuntul al încălţămintei şi articolelor din piele" },
  { cod: "4773", denumire: "Comerţ cu amănuntul al produselor farmaceutice" },
  { cod: "4774", denumire: "Comerţ cu amănuntul al articolelor medicale şi ortopedice" },
  { cod: "4775", denumire: "Comerţ cu amănuntul al produselor cosmetice şi de parfumerie" },
  {
    cod: "4776",
    denumire:
      "Comerţ cu amănuntul al florilor, plantelor şi seminţelor; comerţ cu amănuntul al animalelor de companie şi a hranei pentru acestea",
  },
  { cod: "4777", denumire: "Comerţ cu amănuntul al ceasurilor şi bijuteriilor" },
  { cod: "4778", denumire: "Comerţ cu amănuntul al altor bunuri noi" },
  { cod: "4779", denumire: "Comerţ cu amănuntul al bunurilor de ocazie" },
  { cod: "4781", denumire: "Comerţ cu amănuntul al autovehiculelor" },
  { cod: "4782", denumire: "Comerţ cu amănuntul al pieselor şi accesoriilor pentru autovehicule" },
  {
    cod: "4783",
    denumire:
      "Comerţ cu amănuntul al motocicletelor; comerț cu amănuntul al pieselor şi accesoriilor pentru motociclete",
  },
  { cod: "4791", denumire: "Intermedieri în comerţul cu amănuntul nespecializat" },
  { cod: "4792", denumire: "Intermedieri în comerţul cu amănuntul specializat" },
  { cod: "4911", denumire: "Transport de pasageri pe căi ferate grele/magistrale" },
  { cod: "4912", denumire: "Alte transporturi de pasageri pe căi ferate ușoare" },
  { cod: "4920", denumire: "Transporturi de marfă pe calea ferată" },
  { cod: "4931", denumire: "Transporturi terestre de pasageri, pe bază de grafic" },
  { cod: "4932", denumire: "Transporturi terestre de pasageri, ocazionale" },
  {
    cod: "4933",
    denumire: "Transporturi terestre de pasageri cu vehicule cu șofer, pe bază de comandă",
  },
  { cod: "4934", denumire: "Transporturi de pasageri cu funiculare, teleferice și schilifturi" },
  { cod: "4939", denumire: "Alte transporturi terestre de călători n.c.a." },
  { cod: "4941", denumire: "Transporturi rutiere de mărfuri" },
  { cod: "4942", denumire: "Servicii de mutare" },
  { cod: "4950", denumire: "Transporturi prin conducte" },
  { cod: "5010", denumire: "Transporturi maritime şi costiere de pasageri" },
  { cod: "5020", denumire: "Transporturi maritime şi costiere de marfă" },
  { cod: "5030", denumire: "Transportul de pasageri pe căi navigabile interioare" },
  { cod: "5040", denumire: "Transportul de marfă pe căi navigabile interioare" },
  { cod: "5110", denumire: "Transporturi aeriene de pasageri" },
  { cod: "5121", denumire: "Transporturi aeriene de marfă" },
  { cod: "5122", denumire: "Transporturi spaţiale" },
  { cod: "5210", denumire: "Depozitări" },
  { cod: "5221", denumire: "Activităţi de servicii anexe pentru transporturi terestre" },
  { cod: "5222", denumire: "Activităţi de servicii anexe transporturilor pe apă" },
  { cod: "5223", denumire: "Activităţi de servicii anexe transporturilor aeriene" },
  { cod: "5224", denumire: "Manipulări" },
  { cod: "5225", denumire: "Activități de servicii logistice pentru transporturi" },
  { cod: "5226", denumire: "Alte activităţi anexe transporturilor" },
  { cod: "5231", denumire: "Activităţi de intermediere pentru transportul de marfă" },
  { cod: "5232", denumire: "Activităţi de intermediere pentru transportul de pasageri" },
  {
    cod: "5310",
    denumire: "Activităţi poştale desfăşurate sub obligativitatea serviciului universal",
  },
  { cod: "5320", denumire: "Alte activităţi poştale şi de curier" },
  { cod: "5330", denumire: "Servicii de intermediere pentru activităţi poştale şi de curier" },
  { cod: "5510", denumire: "Hoteluri şi alte facilităţi de cazare similare" },
  { cod: "5520", denumire: "Facilităţi de cazare pentru vacanţe şi perioade de scurtă durată" },
  { cod: "5530", denumire: "Parcuri pentru rulote, campinguri şi tabere" },
  { cod: "5540", denumire: "Intermedieri pentru servicii de cazare" },
  { cod: "5590", denumire: "Alte servicii de cazare" },
  { cod: "5611", denumire: "Restaurante" },
  { cod: "5612", denumire: "Activități ale unităților mobile de alimentație" },
  { cod: "5621", denumire: "Activităţi de alimentaţie (catering) pentru evenimente" },
  { cod: "5622", denumire: "Alte servicii de alimentaţie n.c.a." },
  { cod: "5630", denumire: "Baruri şi alte activităţi de servire a băuturilor" },
  {
    cod: "5640",
    denumire: "Intermedieri pentru servicii de alimentație și de servire a băuturilor",
  },
  { cod: "5811", denumire: "Activităţi de editare a cărţilor" },
  { cod: "5812", denumire: "Activităţi de editare a ziarelor" },
  { cod: "5813", denumire: "Activităţi de editare a revistelor şi periodicelor" },
  { cod: "5819", denumire: "Alte activităţi de editare" },
  { cod: "5821", denumire: "Activităţi de editare a jocurilor de calculator" },
  { cod: "5829", denumire: "Activităţi de editare a altor produse software" },
  {
    cod: "5911",
    denumire: "Activităţi de producţie cinematografică, video şi de programe de televiziune",
  },
  {
    cod: "5912",
    denumire: "Activităţi post-producţie cinematografică, video şi de programe de televiziune",
  },
  {
    cod: "5913",
    denumire:
      "Activităţi de distribuţie a filmelor cinematografice, video şi a programelor de televiziune",
  },
  { cod: "5914", denumire: "Proiecţia de filme cinematografice" },
  {
    cod: "5920",
    denumire: "Activităţi de realizare a înregistrărilor audio şi activităţi de editare muzicală",
  },
  {
    cod: "6010",
    denumire: "Activităţi radiodifuziune, activități de distribuție de programe audio",
  },
  {
    cod: "6020",
    denumire:
      "Activităţi de difuzare a programelor de televiziune, activități de distribuție de programe video",
  },
  { cod: "6031", denumire: "Activităţi ale agenţiilor de ştiri" },
  { cod: "6039", denumire: "Activități de distribuție a altor conținuturi" },
  {
    cod: "6110",
    denumire:
      "Activităţi de telecomunicaţii prin reţele cu cablu, prin rețele fără cablu și prin satelit",
  },
  {
    cod: "6120",
    denumire:
      "Activități de revânzare a serviciilor de telecomunicații și servicii de intermediere pentru telecomunicații",
  },
  { cod: "6190", denumire: "Alte activităţi de telecomunicaţii" },
  {
    cod: "6210",
    denumire: "Activităţi de realizare a soft-ului la comandă (software orientat client)",
  },
  {
    cod: "6220",
    denumire:
      "Activităţi de consultanţă în tehnologia informaţiei și de management (gestiune şi exploatare) a mijloacelor de calcul",
  },
  { cod: "6290", denumire: "Alte activităţi de servicii privind tehnologia informaţiei" },
  {
    cod: "6310",
    denumire: "Prelucrarea datelor, administrarea paginilor web şi activităţi conexe",
  },
  { cod: "6391", denumire: "Activităţi ale portalurilor web" },
  { cod: "6392", denumire: "Alte activităţi de servicii informaţionale n.c. a" },
  { cod: "6411", denumire: "Activităţi ale băncii centrale (naţionale)" },
  { cod: "6419", denumire: "Alte activităţi de intermedieri monetare" },
  { cod: "6421", denumire: "Activităţi ale holding-urilor" },
  { cod: "6422", denumire: "Activităţi ale canalelor de finanțare" },
  {
    cod: "6431",
    denumire:
      "Activități ale fondurilor de investiții de pe piața monetară și ale fondurilor de investiții din afara pieței monetare",
  },
  { cod: "6432", denumire: "Fonduri mutuale şi alte entităţi financiare similare" },
  { cod: "6491", denumire: "Leasing financiar" },
  { cod: "6492", denumire: "Alte activităţi de creditare" },
  {
    cod: "6499",
    denumire:
      "Alte intermedieri financiare n.c.a., exceptând activităţi de asigurări şi fonduri de pensii",
  },
  { cod: "6511", denumire: "Activităţi de asigurări de viaţă" },
  { cod: "6512", denumire: "Alte activităţi de asigurări (exceptând asigurările de viaţă)" },
  { cod: "6520", denumire: "Activităţi de reasigurare" },
  {
    cod: "6530",
    denumire:
      "Activităţi ale fondurilor de pensii (cu excepţia celor din sistemul public de asigurări sociale)",
  },
  { cod: "6611", denumire: "Administrarea pieţelor financiare" },
  { cod: "6612", denumire: "Activităţi de intermediere a tranzacţiilor financiare" },
  {
    cod: "6619",
    denumire:
      "Activităţi auxiliare intermedierilor financiare, exceptând activităţi de asigurări şi fonduri de pensii",
  },
  { cod: "6621", denumire: "Activităţi de evaluare a riscului de asigurare şi a pagubelor" },
  { cod: "6622", denumire: "Activităţi ale agenţilor şi broker-ilor de asigurări" },
  { cod: "6629", denumire: "Alte activităţi auxiliare de asigurări şi fonduri de pensii" },
  { cod: "6630", denumire: "Activităţi de administrare a fondurilor" },
  { cod: "6811", denumire: "Cumpărarea şi vânzarea de bunuri imobiliare proprii" },
  { cod: "6812", denumire: "Dezvoltare (promovare) imobiliară" },
  {
    cod: "6820",
    denumire: "Închirierea şi subînchirierea bunurilor imobiliare proprii sau închiriate",
  },
  { cod: "6831", denumire: "Servicii de intermediere a tranzacțiilor imobiliare" },
  {
    cod: "6832",
    denumire: "Alte activități pentru tranzacții imobiliare pe bază de comision sau contract",
  },
  { cod: "6910", denumire: "Activităţi juridice" },
  {
    cod: "6920",
    denumire: "Activităţi de contabilitate şi audit financiar; consultanţă în domeniul fiscal",
  },
  {
    cod: "7010",
    denumire: "Activităţi ale direcţiilor(centralelor), birourilor administrative centralizate",
  },
  { cod: "7020", denumire: "Activităţi de consultanţă în afaceri și management" },
  { cod: "7111", denumire: "Activităţi de arhitectură" },
  { cod: "7112", denumire: "Activităţi de inginerie şi consultanţă tehnică legate de acestea" },
  { cod: "7120", denumire: "Activităţi de testări şi analize tehnice" },
  { cod: "7210", denumire: "Cercetare-dezvoltare în ştiinţe naturale şi inginerie" },
  { cod: "7220", denumire: "Cercetare-dezvoltare în ştiinţe sociale şi umaniste" },
  { cod: "7311", denumire: "Activităţi ale agenţiilor de publicitate" },
  { cod: "7312", denumire: "Servicii de reprezentare media" },
  { cod: "7320", denumire: "Activităţi de studiere a pieţei şi de sondare a opiniei publice" },
  { cod: "7330", denumire: "Activităţi în domeniul relaţiilor publice şi al comunicării" },
  { cod: "7411", denumire: "Activități de design industrial și vestimentar" },
  { cod: "7412", denumire: "Design grafic și activități de comunicare vizuală" },
  { cod: "7413", denumire: "Activități de design de interior" },
  { cod: "7414", denumire: "Alte activităţi de design specializat" },
  { cod: "7420", denumire: "Activităţi fotografice" },
  { cod: "7430", denumire: "Activităţi de traducere scrisă şi orală (interpreţi)" },
  {
    cod: "7491",
    denumire: "Activități de brokeraj în materie de brevete și servicii de marketing",
  },
  { cod: "7499", denumire: "Alte activităţi profesionale, stiinţifice şi tehnice n.c.a." },
  { cod: "7500", denumire: "Activităţi veterinare" },
  {
    cod: "7711",
    denumire: "Activităţi de închiriere şi leasing cu autoturisme şi autovehicule rutiere uşoare",
  },
  { cod: "7712", denumire: "Activităţi de închiriere şi leasing cu autovehicule rutiere grele" },
  {
    cod: "7721",
    denumire: "Activităţi de închiriere şi leasing cu bunuri recreaţionale şi echipament sportiv",
  },
  {
    cod: "7722",
    denumire: "Activităţi de închiriere şi leasing cu alte bunuri personale şi gospodăreşti n.c.a.",
  },
  {
    cod: "7731",
    denumire: "Activităţi de închiriere şi leasing cu maşini şi echipamente agricole",
  },
  {
    cod: "7732",
    denumire: "Activităţi de închiriere şi leasing cu maşini şi echipamente pentru construcţii",
  },
  {
    cod: "7733",
    denumire:
      "Activităţi de închiriere şi leasing cu maşini şi echipamente de birou (inclusiv calculatoare)",
  },
  {
    cod: "7734",
    denumire: "Activităţi de închiriere şi leasing cu echipamente de transport pe apă",
  },
  {
    cod: "7735",
    denumire: "Activităţi de închiriere şi leasing cu echipamente de transport aerian",
  },
  {
    cod: "7739",
    denumire:
      "Activităţi de închirierea şi leasing cu alte maşini, echipamente şi bunuri tangibile n.c.a.",
  },
  {
    cod: "7740",
    denumire:
      "Leasing cu bunuri intangibile (cu excepția lucrărilor care fac obiectul drepturilor de autor)",
  },
  {
    cod: "7751",
    denumire:
      "Servicii de intermediere pentru închirierea și leasingul autoturismelor, autorulotelor și remorcilor",
  },
  {
    cod: "7752",
    denumire:
      "Servicii de intermediere pentru închirierea și leasingul altor bunuri corporale și bunuri intangibile (exceptând financiare)",
  },
  { cod: "7810", denumire: "Activităţi ale agenţiilor de plasare a forţei de muncă" },
  {
    cod: "7820",
    denumire:
      "Activități ale agențiilor de plasare temporară a forței de muncă și furnizarea altor resurse umane",
  },
  { cod: "7911", denumire: "Activităţi ale agenţiilor turistice" },
  { cod: "7912", denumire: "Activităţi ale tur-operatorilor" },
  {
    cod: "7990",
    denumire:
      "Alte servicii de rezervare şi asistenţă turistică 80 Activităţi de investigaţii şi protecţie",
  },
  { cod: "8001", denumire: "Activități de investigații și servicii private de protecție" },
  { cod: "8009", denumire: "Alte activități de protecție n.c.a." },
  { cod: "8110", denumire: "Activităţi de servicii suport combinate" },
  { cod: "8121", denumire: "Activităţi generale de curăţenie a clădirilor" },
  { cod: "8122", denumire: "Activităţi specializate de curăţenie" },
  { cod: "8123", denumire: "Alte activităţi de curăţenie" },
  { cod: "8130", denumire: "Activităţi de înteţinere peisagistică" },
  { cod: "8210", denumire: "Activităţi de secretariat şi servicii suport" },
  { cod: "8220", denumire: "Activităţi ale centrelor de intermediere telefonică (call center)" },
  { cod: "8230", denumire: "Activităţi de organizare a expoziţiilor, târgurilor şi congreselor" },
  {
    cod: "8240",
    denumire: "Activități de intermediere pentru servicii suport pentru întreprinderi n.c.a.",
  },
  {
    cod: "8291",
    denumire:
      "Activităţi ale agenţiilor de colectare şi a birourilor (oficiilor) de raportare a creditului",
  },
  { cod: "8292", denumire: "Activităţi de ambalare" },
  { cod: "8299", denumire: "Alte activităţi de servicii suport pentru întreprinderi n.c.a." },
  { cod: "8411", denumire: "Activități de administraţie publică generală" },
  {
    cod: "8412",
    denumire:
      "Reglementarea activităţilor organismelor care prestează servicii în domeniul îngrijirii sănătăţii, învăţământului, culturii şi al altor activităţi sociale, exceptând protecţia socială",
  },
  { cod: "8413", denumire: "Reglementarea şi eficientizarea activităţilor economice" },
  { cod: "8421", denumire: "Activităţi de afaceri externe" },
  { cod: "8422", denumire: "Activităţi de apărare naţională" },
  { cod: "8423", denumire: "Activităţi de justiţie" },
  { cod: "8424", denumire: "Activităţi de ordine publică şi de protecţie civilă" },
  { cod: "8425", denumire: "Activităţi de luptă împotriva incendiilor şi de prevenire a acestora" },
  { cod: "8430", denumire: "Activităţi de protecţie socială obligatorie" },
  { cod: "8510", denumire: "Învăţământ preşcolar" },
  { cod: "8520", denumire: "Învăţământ primar" },
  { cod: "8531", denumire: "Învăţământ secundar general" },
  { cod: "8532", denumire: "Învăţământ secundar, tehnic sau profesional" },
  { cod: "8533", denumire: "Învăţământ post-secundar, non-universitar" },
  { cod: "8540", denumire: "Învăţământ superior universitar" },
  { cod: "8551", denumire: "Învăţământ în domeniul sportiv şi recreaţional" },
  {
    cod: "8552",
    denumire: "Învăţământ în domeniul cultural (muzică, teatru, dans, arte plastice, etc.)",
  },
  { cod: "8553", denumire: "Şcoli de conducere (pilotaj)" },
  { cod: "8559", denumire: "Alte forme de învăţământ n.c.a." },
  {
    cod: "8561",
    denumire: "Activități de intermediere pentru cursuri și tutori (îndrumători, profesori)",
  },
  { cod: "8569", denumire: "Activităţi de servicii suport pentru învăţământ" },
  { cod: "8610", denumire: "Activităţi de asistenţă spitalicească" },
  { cod: "8621", denumire: "Activităţi de asistenţă medicală generală" },
  { cod: "8622", denumire: "Activităţi de asistenţă medicală specializată" },
  { cod: "8623", denumire: "Activităţi de asistenţă stomatologică" },
  {
    cod: "8691",
    denumire: "Servicii de diagnostic imagistic și activități ale laboratoarelor medicale",
  },
  { cod: "8692", denumire: "Transportul pacienților cu ambulanța" },
  {
    cod: "8693",
    denumire: "Activități ale psihologilor și psihoterapeuților, cu excepția medicilor",
  },
  { cod: "8694", denumire: "Activități ale infirmierelor și moașelor" },
  { cod: "8695", denumire: "Activități de fizioterapie" },
  { cod: "8696", denumire: "Activități de medicină tradițională, complementară și alternativă" },
  {
    cod: "8697",
    denumire:
      "Servicii de intermediere pentru servicii medicale, stomatologice și pentru alte servicii referitoare la sănătatea umană",
  },
  { cod: "8699", denumire: "Alte activităţi referitoare la sănătatea umană n.c.a." },
  { cod: "8710", denumire: "Activităţi ale centrelor de îngrijire medicală" },
  {
    cod: "8720",
    denumire: "Activităţi ale centrelor de recuperare pshică şi de dezintoxicare, exclusiv spitale",
  },
  {
    cod: "8730",
    denumire:
      "Activităţi ale căminelor de bătrâni şi ale căminelor pentru persoane cu dizabilități aflate în incapacitate de a se îngriji singure",
  },
  { cod: "8791", denumire: "Activități de intermediere pentru servicii de îngrijire la domiciliu" },
  { cod: "8799", denumire: "Alte activităţi de asistenţă socială, cu cazare n.c.a." },
  {
    cod: "8810",
    denumire:
      "Activităţi de asistenţă socială, fără cazare, pentru bătrâni şi pentru persoane cu dizabilități aflate în incapacitate de a se îngriji singure",
  },
  { cod: "8891", denumire: "Activităţi de îngrijire zilnică pentru copii" },
  { cod: "8899", denumire: "Alte activităţi de asistenţă socială, fără cazare, n.c.a." },
  { cod: "9011", denumire: "Activități de creație literară și compoziție muzicală" },
  { cod: "9012", denumire: "Activități de creație în domeniul artelor vizuale" },
  { cod: "9013", denumire: "Alte activități de creație artistică" },
  { cod: "9020", denumire: "Activităţi de interpretare artistică (spectacole)" },
  { cod: "9031", denumire: "Activităţi de gestionare a sălilor și amplasamentelor de spectacole" },
  { cod: "9039", denumire: "Alte activităţi suport pentru creație și interpretare artistică" },
  { cod: "9111", denumire: "Activităţi ale bibliotecilor" },
  { cod: "9112", denumire: "Activităţi ale arhivelor" },
  { cod: "9121", denumire: "Activități ale muzeelor și colecțiilor" },
  { cod: "9122", denumire: "Activități ale siturilor și monumentelor istorice" },
  {
    cod: "9130",
    denumire:
      "Activități de conservare, restaurare și alte activități suport pentru patrimoniul cultural",
  },
  { cod: "9141", denumire: "Activităţi ale grădinilor botanice și zoologice" },
  { cod: "9142", denumire: "Activităţi ale rezervaţiilor naturale" },
  { cod: "9200", denumire: "Activităţi de jocuri de noroc şi pariuri" },
  { cod: "9311", denumire: "Activităţi ale bazelor sportive" },
  { cod: "9312", denumire: "Activităţi ale cluburilor sportive" },
  { cod: "9313", denumire: "Activităţi ale centrelor de fitness" },
  { cod: "9319", denumire: "Alte activităţi sportive n.c.a" },
  { cod: "9321", denumire: "Activități ale parcurilor tematice și de distracţii" },
  { cod: "9329", denumire: "Alte activităţi recreative şi distractive n.c.a." },
  { cod: "9411", denumire: "Activităţi ale organizaţiilor economice şi patronale" },
  { cod: "9412", denumire: "Activităţi ale organizaţiilor profesionale" },
  { cod: "9420", denumire: "Activităţi ale sindicatelor salariaţilor" },
  { cod: "9491", denumire: "Activităţi ale organizaţiilor religioase" },
  { cod: "9492", denumire: "Activităţi ale organizaţiilor politice" },
  { cod: "9499", denumire: "Activităţi ale altor organizaţii n.c.a." },
  {
    cod: "9510",
    denumire: "Repararea și întreținerea calculatoarelor şi a echipamentelor de comunicaţii",
  },
  { cod: "9521", denumire: "Repararea și întreținerea aparatelor electronice de uz casnic" },
  {
    cod: "9522",
    denumire:
      "Repararea și întreținerea dispozitivelor de uz gospodăresc şi a echipamentelor pentru casă şi grădină",
  },
  { cod: "9523", denumire: "Repararea și întreținerea încălţămintei şi a articolelor din piele" },
  { cod: "9524", denumire: "Repararea și întreținerea mobilei şi a furniturilor casnice" },
  { cod: "9525", denumire: "Repararea și întreținerea ceasurilor şi a bijuteriilor" },
  {
    cod: "9529",
    denumire: "Repararea și întreținerea articolelor de uz personal şi gospodăresc n.c.a.",
  },
  { cod: "9531", denumire: "Repararea și întreținerea autovehiculelor" },
  { cod: "9532", denumire: "Repararea și întreținerea motocicletelor" },
  {
    cod: "9540",
    denumire:
      "Servicii de intermediere pentru repararea și întreținerea calculatoarelor, a articolelor personale și de uz gospodăresc, a autovehiculelor și motocicletelor",
  },
  { cod: "9610", denumire: "Spălarea şi curăţarea articolelor textile şi a produselor din blană" },
  { cod: "9621", denumire: "Activități de coafură şi frizerie" },
  { cod: "9622", denumire: "Activități de tratament și înfrumusețare" },
  { cod: "9623", denumire: "Activități ale centrelor spa, saunelor și bailor de abur" },
  { cod: "9630", denumire: "Activităţi de pompe funebre şi similare" },
  { cod: "9640", denumire: "Activități de intermediere pentru servicii personale" },
  { cod: "9691", denumire: "Activități de servicii personale la domiciliu" },
  { cod: "9699", denumire: "Alte servicii personale n.c.a." },
  {
    cod: "9700",
    denumire: "Activităţi ale gospodăriilor private în calitate de angajator de personal casnic",
  },
  {
    cod: "9810",
    denumire:
      "Activităţi ale gospodăriilor private de producere de bunuri destinate consumului propriu",
  },
  {
    cod: "9820",
    denumire:
      "Activităţi ale gospodăriilor private de producere de servicii pentru scopuri proprii",
  },
  { cod: "9900", denumire: "Activităţi ale organizaţiilor şi organismelor extrateritoriale" },
];

/** Verificare O(1) că un cod există în nomenclator. */
export const CODURI_CAEN_VALIDE: ReadonlySet<string> = new Set(NOMENCLATOR_CAEN.map((c) => c.cod));
