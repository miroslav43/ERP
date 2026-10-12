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
      "Cultivarea cerealelor (excluzând orezul), plantelor leguminoase și a plantelor oleaginoase",
  },
  { cod: "0112", denumire: "Cultivarea orezului" },
  {
    cod: "0113",
    denumire: "Cultivarea legumelor și a pepenilor, a rădăcinoaselor și tuberculiferelor",
  },
  { cod: "0114", denumire: "Cultivarea trestiei de zahăr" },
  { cod: "0115", denumire: "Cultivarea tutunului" },
  { cod: "0116", denumire: "Cultivarea plantelor pentru fibre textile" },
  { cod: "0119", denumire: "Cultivarea altor plante din culturi nepermanente" },
  { cod: "0121", denumire: "Cultivarea strugurilor" },
  { cod: "0122", denumire: "Cultivarea fructelor tropicale și subtropicale" },
  { cod: "0123", denumire: "Cultivarea fructelor citrice" },
  { cod: "0124", denumire: "Cultivarea fructelor semințoase și sâmburoase" },
  {
    cod: "0125",
    denumire:
      "Cultivarea altor pomi fructiferi, a arbuștilor fructiferi, căpșunilor și a nuciferelor",
  },
  { cod: "0126", denumire: "Cultivarea fructelor oleaginoase" },
  { cod: "0127", denumire: "Cultivarea plantelor pentru prepararea băuturilor" },
  {
    cod: "0128",
    denumire:
      "Cultivarea condimentelor, plantelor aromatice, medicinale și a plantelor de uz farmaceutic",
  },
  { cod: "0129", denumire: "Cultivarea altor plante permanente" },
  { cod: "0130", denumire: "Cultivarea plantelor pentru înmulțire" },
  { cod: "0141", denumire: "Creșterea bovinelor de lapte" },
  { cod: "0142", denumire: "Creșterea altor bovine" },
  { cod: "0143", denumire: "Creșterea cailor și a altor cabaline" },
  { cod: "0144", denumire: "Creșterea cămilelor și a camelidelor" },
  { cod: "0145", denumire: "Creșterea ovinelor și caprinelor" },
  { cod: "0146", denumire: "Creșterea porcinelor" },
  { cod: "0147", denumire: "Creșterea păsărilor" },
  { cod: "0148", denumire: "Creșterea altor animale" },
  {
    cod: "0150",
    denumire: "Activități în ferme mixte (cultura vegetală combinată cu creșterea animalelor)",
  },
  { cod: "0161", denumire: "Activități auxiliare pentru producția vegetală" },
  { cod: "0162", denumire: "Activități auxiliare pentru creșterea animalelor" },
  { cod: "0163", denumire: "Activități după recoltare și pregătirea semințelor" },
  {
    cod: "0170",
    denumire:
      "Vânătoare, capturarea cu capcane a vânatului și activități de servicii anexe vânătorii",
  },
  { cod: "0210", denumire: "Silvicultură și alte activități forestiere" },
  { cod: "0220", denumire: "Exploatarea forestieră" },
  { cod: "0230", denumire: "Colectarea produselor forestiere nelemnoase din flora spontană" },
  { cod: "0240", denumire: "Activități de servicii anexe silviculturii" },
  { cod: "0311", denumire: "Pescuitul maritim" },
  { cod: "0312", denumire: "Pescuitul în ape dulci" },
  { cod: "0321", denumire: "Acvacultura maritimă" },
  { cod: "0322", denumire: "Acvacultura în ape dulci" },
  { cod: "0330", denumire: "Activități anexe pescuitului și acvaculturii" },
  { cod: "0510", denumire: "Extracția cărbunelui superior (PCS=>23865 kJ/kg)" },
  { cod: "0520", denumire: "Extracția cărbunelui inferior (PCS<23865 kJ/kg)" },
  { cod: "0610", denumire: "Extracția petrolului brut" },
  { cod: "0620", denumire: "Extracția gazelor naturale" },
  { cod: "0710", denumire: "Extracția minereurilor feroase" },
  { cod: "0721", denumire: "Extracția minereurilor de uraniu și toriu" },
  { cod: "0729", denumire: "Extracția altor minereuri metalifere neferoase" },
  {
    cod: "0811",
    denumire:
      "Extracția pietrei ornamentale și a pietrei pentru construcții, extracția pietrei calcaroase, ghipsului, cretei și a ardeziei",
  },
  { cod: "0812", denumire: "Extracția pietrișului și nisipului; extracția argilei și caolinului" },
  {
    cod: "0891",
    denumire: "Extracția mineralelor pentru industria chimică și a îngrășămintelor naturale",
  },
  { cod: "0892", denumire: "Extracția turbei" },
  { cod: "0893", denumire: "Extracția sării" },
  { cod: "0899", denumire: "Alte activități extractive n.c.a." },
  {
    cod: "0910",
    denumire: "Activități de servicii anexe extracției petrolului brut și gazelor naturale",
  },
  { cod: "0990", denumire: "Activități de servicii anexe pentru extracția mineralelor" },
  { cod: "1011", denumire: "Prelucrarea și conservarea cărnii" },
  { cod: "1012", denumire: "Prelucrarea și conservarea cărnii de pasăre" },
  { cod: "1013", denumire: "Fabricarea produselor din carne (inclusiv din carne de pasăre)" },
  { cod: "1020", denumire: "Prelucrarea și conservarea peștelui, crustaceelor și moluștelor" },
  { cod: "1031", denumire: "Prelucrarea și conservarea cartofilor" },
  { cod: "1032", denumire: "Fabricarea sucurilor de fructe și legume" },
  { cod: "1039", denumire: "Prelucrarea și conservarea fructelor și legumelor n.c.a." },
  { cod: "1041", denumire: "Fabricarea uleiurilor și grăsimilor" },
  { cod: "1042", denumire: "Fabricarea margarinei și a altor produse comestibile similare" },
  { cod: "1051", denumire: "Fabricarea produselor lactate și a brânzeturilor" },
  { cod: "1052", denumire: "Fabricarea înghețatei" },
  { cod: "1061", denumire: "Fabricarea produselor de morărit" },
  { cod: "1062", denumire: "Fabricarea amidonului și a produselor din amidon" },
  {
    cod: "1071",
    denumire: "Fabricarea pâinii; fabricarea prăjiturilor și a produselor proaspete de patiserie",
  },
  {
    cod: "1072",
    denumire:
      "Fabricarea biscuiților și pișcoturilor; fabricarea prăjiturilor și a produselor conservate de patiserie",
  },
  {
    cod: "1073",
    denumire:
      "Fabricarea macaroanelor, tăițeilor, cuș-cuș-ului și a altor produse făinoase similar",
  },
  { cod: "1081", denumire: "Fabricarea zahărului" },
  {
    cod: "1082",
    denumire: "Fabricarea produselor din cacao, a ciocolatei și a produselor zaharoase",
  },
  { cod: "1083", denumire: "Prelucrarea ceaiului și cafelei" },
  { cod: "1084", denumire: "Fabricarea condimentelor și ingredientelor" },
  { cod: "1085", denumire: "Fabricarea de mâncărururi preparate" },
  {
    cod: "1086",
    denumire: "Fabricarea preparatelor alimentare omogenizate și alimentelor dietetice",
  },
  { cod: "1089", denumire: "Fabricarea altor produse alimentare n.c.a." },
  { cod: "1091", denumire: "Fabricarea preparatelor pentru hrana animalelor de fermă" },
  { cod: "1092", denumire: "Fabricarea preparatelor pentru hrana animalelor de companie" },
  { cod: "1101", denumire: "Distilarea, rafinarea și mixarea băuturilor alcoolice" },
  { cod: "1102", denumire: "Fabricarea vinurilor din struguri" },
  { cod: "1103", denumire: "Fabricarea cidrului și a altor vinuri din fructe" },
  { cod: "1104", denumire: "Fabricarea altor băuturi nedistilate, obținute prin fermentare" },
  { cod: "1105", denumire: "Fabricarea berii" },
  { cod: "1106", denumire: "Fabricarea malțului" },
  {
    cod: "1107",
    denumire:
      "Producția de băuturi răcoritoare nealcoolice; producția de ape minerale și alte ape îmbuteliate",
  },
  { cod: "1200", denumire: "Fabricarea produselor din tutun" },
  { cod: "1310", denumire: "Pregătirea fibrelor și filarea fibrelor textile" },
  { cod: "1320", denumire: "Producția de țesături" },
  { cod: "1330", denumire: "Finisarea materialelor textile" },
  { cod: "1391", denumire: "Fabricarea de metraje prin tricotare sau croșetare" },
  {
    cod: "1392",
    denumire:
      "Fabricarea de articole confecționate din textile (excluzând îmbrăcămintea și lenjeria de corp)",
  },
  { cod: "1393", denumire: "Fabricarea de covoare și mochete" },
  { cod: "1394", denumire: "Fabricarea de odgoane, frânghii, sfori și plase" },
  {
    cod: "1395",
    denumire:
      "Fabricarea de textile nețesute și articole din acestea, cu excepția confecțiilor de îmbrăcăminte",
  },
  { cod: "1396", denumire: "Fabricarea de articole tehnice și industriale din textile" },
  { cod: "1399", denumire: "Fabricarea altor articole textile n.c.a." },
  { cod: "1410", denumire: "Fabricarea articolelor de îmbrăcăminte prin tricotare sau croșetare" },
  { cod: "1421", denumire: "Fabricarea articolelor de îmbrăcăminte" },
  { cod: "1422", denumire: "Fabricarea de articole de lenjerie de corp" },
  { cod: "1423", denumire: "Fabricarea de articole de îmbrăcăminte pentru lucru" },
  { cod: "1424", denumire: "Fabricarea articolelor de îmbrăcăminte din piele și blană" },
  { cod: "1429", denumire: "Fabricarea altor articole de îmbrăcăminte și accesorii n.c.a." },
  { cod: "1511", denumire: "Tăbăcirea și finisarea pieilor; prepararea și vopsirea blănurilor" },
  {
    cod: "1512",
    denumire: "Fabricarea articolelor de voiaj și marochinărie și a articolelor de harnașament",
  },
  { cod: "1520", denumire: "Fabricarea încălțămintei" },
  { cod: "1611", denumire: "Tăierea și rindeluirea lemnului" },
  { cod: "1612", denumire: "Prelucrarea și finisarea lemnului" },
  { cod: "1621", denumire: "Fabricarea de furnire și a panourilor din lemn" },
  { cod: "1622", denumire: "Fabricarea parchetului asamblat în panouri" },
  {
    cod: "1623",
    denumire: "Fabricarea altor elemente de dulgherie și tâmplărie, pentru construcții",
  },
  { cod: "1624", denumire: "Fabricarea ambalajelor din lemn" },
  { cod: "1625", denumire: "Fabricarea de uși și ferestre din lemn" },
  { cod: "1626", denumire: "Fabricarea de combustibili solizi din biomasă vegetală" },
  { cod: "1627", denumire: "Finisarea articolelor din lemn" },
  {
    cod: "1628",
    denumire:
      "Fabricarea altor produse din lemn; fabricarea articolelor din plută, paie și din alte materiale vegetale împletite",
  },
  { cod: "1711", denumire: "Fabricarea celulozei" },
  { cod: "1712", denumire: "Fabricarea hârtiei și cartonului" },
  {
    cod: "1721",
    denumire: "Fabricarea hârtiei și cartonului ondulat și a ambalajelor din hârtie și carton",
  },
  {
    cod: "1722",
    denumire: "Fabricarea produselor de uz gospodăresc și sanitar, din hârtie sau carton",
  },
  { cod: "1723", denumire: "Fabricarea articolelor de papetărie" },
  { cod: "1724", denumire: "Fabricarea tapetului" },
  { cod: "1725", denumire: "Fabricarea altor articole din hârtie și carton n.c.a." },
  { cod: "1811", denumire: "Tipărirea ziarelor" },
  { cod: "1812", denumire: "Alte activități de tipărire n.c.a." },
  { cod: "1813", denumire: "Servicii pregătitoare pentru pretipărire" },
  { cod: "1814", denumire: "Legătorie și servicii conexe" },
  { cod: "1820", denumire: "Reproducerea înregistrărilor" },
  { cod: "1910", denumire: "Fabricarea produselor de cocserie" },
  { cod: "1920", denumire: "Fabricarea produselor obținute din prelucrarea țițeiului" },
  { cod: "2011", denumire: "Fabricarea gazelor industriale" },
  { cod: "2012", denumire: "Fabricarea coloranților și a pigmenților" },
  { cod: "2013", denumire: "Fabricarea altor produse chimice anorganice, de bază" },
  { cod: "2014", denumire: "Fabricarea altor produse chimice organice, de bază" },
  { cod: "2015", denumire: "Fabricarea îngrășămintelor și produselor azotoase" },
  { cod: "2016", denumire: "Fabricarea materialelor plastice în forme primare" },
  { cod: "2017", denumire: "Fabricarea cauciucului sintetic în forme primare" },
  {
    cod: "2020",
    denumire:
      "Fabricarea pesticidelor și a altor produse agrochimice Fabricarea vopselelor, lacurilor, cernelii tipografice și masticurilor",
  },
  {
    cod: "2030",
    denumire: "Fabricarea vopselelor, lacurilor, cernelii tipografice și masticurilor",
  },
  { cod: "2041", denumire: "Fabricarea săpunurilor, detergenților și a produselor de întreținere" },
  { cod: "2042", denumire: "Fabricarea parfumurilor și a produselor cosmetice (de toaletă)" },
  { cod: "2051", denumire: "Fabricarea biocombustibililor lichizi" },
  { cod: "2059", denumire: "Fabricarea altor produse chimice n.c.a." },
  { cod: "2060", denumire: "Fabricarea fibrelor sintetice și artificiale" },
  { cod: "2110", denumire: "Fabricarea produselor farmaceutice de bază" },
  { cod: "2120", denumire: "Fabricarea preparatelor farmaceutice" },
  {
    cod: "2211",
    denumire: "Fabricarea anvelopelor și a camerelor de aer; reșaparea și refacerea anvelopelor",
  },
  { cod: "2212", denumire: "Fabricarea altor produse din cauciuc" },
  {
    cod: "2221",
    denumire: "Fabricarea plăcilor, foliilor, tuburilor și profilelor din material plastic",
  },
  { cod: "2222", denumire: "Fabricarea articolelor de ambalaj din material plastic" },
  { cod: "2223", denumire: "Fabricarea de uși și ferestre din material plastic" },
  { cod: "2224", denumire: "Fabricarea articolelor din material plastic pentru construcții" },
  { cod: "2225", denumire: "Prelucrarea și finisarea articolelor din material plastic" },
  { cod: "2226", denumire: "Fabricarea altor produse din material plastic" },
  { cod: "2311", denumire: "Fabricarea sticlei plate" },
  { cod: "2312", denumire: "Prelucrarea și fasonarea sticlei plate" },
  { cod: "2313", denumire: "Fabricarea articolelor din sticlă" },
  { cod: "2314", denumire: "Fabricarea fibrelor din sticlă" },
  { cod: "2315", denumire: "Fabricarea de sticlărie tehnică" },
  { cod: "2320", denumire: "Fabricarea de produse refractare" },
  { cod: "2331", denumire: "Fabricarea plăcilor și dalelor din ceramică" },
  {
    cod: "2332",
    denumire:
      "Fabricarea cărămizilor, țiglelor și altor produse pentru construcții, din argilă arsă",
  },
  { cod: "2341", denumire: "Fabricarea articolelor ceramice pentru uz gospodăresc și ornamental" },
  { cod: "2342", denumire: "Fabricarea de obiecte sanitare din ceramică" },
  { cod: "2343", denumire: "Fabricarea izolatorilor și pieselor izolante din ceramică" },
  { cod: "2344", denumire: "Fabricarea altor produse tehnice din ceramică" },
  { cod: "2345", denumire: "Fabricarea altor produse ceramice n.c.a." },
  { cod: "2351", denumire: "Fabricarea cimentului" },
  { cod: "2352", denumire: "Fabricarea varului și ipsosului" },
  { cod: "2361", denumire: "Fabricarea produselor din beton pentru construcții" },
  { cod: "2362", denumire: "Fabricarea produselor din ipsos pentru construcții" },
  { cod: "2363", denumire: "Fabricarea betonului" },
  { cod: "2364", denumire: "Fabricarea mortarului" },
  { cod: "2365", denumire: "Fabricarea produselor din azbociment" },
  { cod: "2366", denumire: "Fabricarea altor articole din beton, ciment și ipsos" },
  { cod: "2370", denumire: "Tăierea, fasonarea și finisarea pietrei" },
  { cod: "2391", denumire: "Fabricarea de produse abrazive" },
  { cod: "2399", denumire: "Fabricarea altor produse din minerale nemetalice, n.c.a." },
  { cod: "2410", denumire: "Producția de metale feroase sub forme primare și de feroaliaje" },
  {
    cod: "2420",
    denumire: "Producția de tuburi, țevi, profile tubulare și accesorii pentru acestea, din oțel",
  },
  { cod: "2431", denumire: "Tragere la rece a barelor" },
  { cod: "2432", denumire: "Laminare la rece a benzilor înguste" },
  { cod: "2433", denumire: "Producția de profile obținute la rece" },
  { cod: "2434", denumire: "Trefilarea firelor la rece" },
  { cod: "2441", denumire: "Producția metalelor prețioase" },
  { cod: "2442", denumire: "Metalurgia aluminiului" },
  { cod: "2443", denumire: "Producția plumbului, zincului și cositorului" },
  { cod: "2444", denumire: "Metalurgia cuprului" },
  { cod: "2445", denumire: "Producția altor metale neferoase" },
  { cod: "2446", denumire: "Prelucrarea combustibililor nucleari" },
  { cod: "2451", denumire: "Turnarea fontei" },
  { cod: "2452", denumire: "Turnarea oțelului" },
  { cod: "2453", denumire: "Turnarea metalelor neferoase ușoare" },
  { cod: "2454", denumire: "Turnarea altor metale neferoase" },
  {
    cod: "2511",
    denumire: "Fabricarea de construcții metalice și părți componente ale structurilor metalice",
  },
  { cod: "2512", denumire: "Fabricarea de uși și ferestre din metal" },
  {
    cod: "2521",
    denumire:
      "Producția de radiatoare și cazane pentru încălzire central; producția de generatoare de abur și boilere",
  },
  { cod: "2522", denumire: "Producția de rezervoare, cisterne și containere metalice" },
  { cod: "2530", denumire: "Fabricarea armamentului și muniției" },
  {
    cod: "2540",
    denumire:
      "Fabricarea produselor metalice obținute prin deformare plastică; metalurgia pulberilor",
  },
  { cod: "2551", denumire: "Acoperirea metalelor" },
  { cod: "2552", denumire: "Tratamente termice ale metalelor" },
  { cod: "2553", denumire: "Operațiuni de mecanică generală" },
  { cod: "2561", denumire: "Fabricarea produselor de tăiat" },
  { cod: "2562", denumire: "Fabricarea articolelor de feronerie" },
  { cod: "2563", denumire: "Fabricarea uneltelor" },
  {
    cod: "2591",
    denumire: "Fabricarea de recipienți, containere și alte produse similare din oțel",
  },
  { cod: "2592", denumire: "Fabricarea ambalajelor metalice ușoare" },
  {
    cod: "2593",
    denumire: "Fabricarea articolelor din fire metalice; fabricarea de lanțuri și arcuri",
  },
  {
    cod: "2594",
    denumire:
      "Fabricarea de șuruburi, buloane și alte articole filetate; fabricarea de nituri și șaibe",
  },
  { cod: "2599", denumire: "Fabricarea altor articole din metal n.c.a." },
  { cod: "2611", denumire: "Fabricarea componentelor electronice" },
  { cod: "2612", denumire: "Fabricarea subansamblurilor electronice (module)" },
  { cod: "2620", denumire: "Fabricarea calculatoarelor și a echipamentelor periferice" },
  { cod: "2630", denumire: "Fabricarea echipamentelor de comunicații" },
  { cod: "2640", denumire: "Fabricarea produselor electronice de larg consum" },
  {
    cod: "2651",
    denumire:
      "Fabricarea de instrumente și dispozitive pentru măsură, verificare, control, navigație",
  },
  {
    cod: "2652",
    denumire:
      "Producția de ceasuri Fabricarea de echipamente pentru radiologie, electrodiagnostic și electroterapie",
  },
  {
    cod: "2660",
    denumire: "Fabricarea de echipamente pentru radiologie, electrodiagnostic și electroterapie",
  },
  {
    cod: "2670",
    denumire:
      "Fabricarea de instrumente optice, suporți magnetici și optici; fabricarea de echipamente fotografice",
  },
  {
    cod: "2711",
    denumire: "Fabricarea motoarelor, generatoarelor și transformatoarelor electrice",
  },
  { cod: "2712", denumire: "Fabricarea aparatelor de distribuție și control a electricității" },
  { cod: "2720", denumire: "Fabricarea de acumulatori și baterii" },
  { cod: "2731", denumire: "Fabricarea de cabluri cu fibră optică" },
  { cod: "2732", denumire: "Fabricarea altor fire și cabluri electrice și electronice" },
  {
    cod: "2733",
    denumire:
      "Fabricarea dispozitivelor de conexiune pentru fire și cabluri electrice și electronice",
  },
  { cod: "2740", denumire: "Fabricarea de echipamente electrice de iluminat" },
  { cod: "2751", denumire: "Fabricarea de aparate electrocasnice" },
  { cod: "2752", denumire: "Fabricarea de echipamente casnice neelectrice" },
  { cod: "2790", denumire: "Fabricarea altor echipamente electrice" },
  {
    cod: "2811",
    denumire:
      "Fabricarea de motoare și turbine (cu excepția celor pentru avioane, autovehicule și motociclete.)",
  },
  { cod: "2812", denumire: "Fabricarea de motoare hidraulice" },
  { cod: "2813", denumire: "Fabricarea de pompe și compresoare" },
  { cod: "2814", denumire: "Fabricarea de articole de robinetărie" },
  {
    cod: "2815",
    denumire:
      "Fabricarea lagărelor, angrenajelor, cutiilor de viteză și a elementelor mecanice de transmisie",
  },
  { cod: "2821", denumire: "Fabricarea cuptoarelor, furnalelor și arzătoarelor" },
  { cod: "2822", denumire: "Fabricarea echipamentelor de ridicat și manipulat" },
  {
    cod: "2823",
    denumire:
      "Fabricarea mașinilor și echipamentelor de birou (exceptând fabricarea calculatoarelor și a echipamentelor periferice)",
  },
  { cod: "2824", denumire: "Fabricarea mașinilor-unelte portabile acționate electric" },
  {
    cod: "2825",
    denumire:
      "Fabricarea echipamentelor de ventilație și frigorifice, exceptând echipamentele de uz casnic",
  },
  { cod: "2829", denumire: "Fabricarea altor mașini și utilaje de utilizare generală n.c.a." },
  {
    cod: "2830",
    denumire: "Fabricarea masinilor și utilajelor pentru agricultură și exploatări forestiere",
  },
  {
    cod: "2841",
    denumire: "Fabricarea utilajelor și a mașinilor-unelte pentru prelucrarea metalului",
  },
  { cod: "2842", denumire: "Fabricarea altor mașini-unelte n.c.a." },
  { cod: "2891", denumire: "Fabricarea utilajelor pentru metalurgie" },
  { cod: "2892", denumire: "Fabricarea utilajelor pentru extracție și construcții" },
  {
    cod: "2893",
    denumire:
      "Fabricarea utilajelor pentru prelucrarea produselor alimentare, băuturilor și tutunului",
  },
  {
    cod: "2894",
    denumire: "Fabricarea utilajelor pentru industria textilă, a îmbrăcămintei și a pielăriei",
  },
  { cod: "2895", denumire: "Fabricarea utilajelor pentru industria hârtiei și cartonului" },
  {
    cod: "2896",
    denumire: "Fabricarea utilajelor pentru prelucrarea maselor plastice și a cauciucului",
  },
  {
    cod: "2897",
    denumire:
      "Fabricarea mașinilor și utilajelor pentru fabricația aditivă (care utilizează tehnologia de fabricație aditivă)",
  },
  { cod: "2899", denumire: "Fabricarea altor mașini și utilaje specifice n.c.a." },
  { cod: "2910", denumire: "Fabricarea autovehiculelor de transport rutier" },
  {
    cod: "2920",
    denumire: "Producția de caroserii pentru autovehicule; fabricarea de remorci și semiremorci",
  },
  {
    cod: "2931",
    denumire:
      "Fabricarea de echipamente electrice și electronice pentru autovehicule și pentru motoare de autovehicule",
  },
  {
    cod: "2932",
    denumire:
      "Fabricarea altor piese și accesorii pentru autovehicule și pentru motoare de autovehicule",
  },
  { cod: "3011", denumire: "Construcția de nave civile și structuri plutitoare" },
  { cod: "3012", denumire: "Construcția de ambarcațiuni sportive și de agrement" },
  { cod: "3013", denumire: "Construcția de nave și vase militare" },
  { cod: "3020", denumire: "Fabricarea materialului rulant" },
  { cod: "3031", denumire: "Fabricarea de aeronave și nave spațiale, civile" },
  { cod: "3032", denumire: "Fabricarea de aeronave și nave spațiale, militare" },
  { cod: "3040", denumire: "Fabricarea vehiculelor militare de luptă" },
  { cod: "3091", denumire: "Fabricarea de motociclete" },
  { cod: "3092", denumire: "Fabricarea de biciclete și de de vehicule pentru invalizi" },
  { cod: "3099", denumire: "Fabricarea altor mijloace de transport n.c.a." },
  { cod: "3100", denumire: "Fabricarea de mobilă" },
  { cod: "3211", denumire: "Baterea monedelor" },
  {
    cod: "3212",
    denumire: "Fabricarea bijuteriilor și articolelor similare din metale și pietre prețioase",
  },
  { cod: "3213", denumire: "Fabricarea imitațiilor de bijuterii și articole similare" },
  { cod: "3220", denumire: "Fabricarea instrumentelor muzicale" },
  { cod: "3230", denumire: "Fabricarea articolelor pentru sport" },
  { cod: "3240", denumire: "Fabricarea jocurilor și jucăriilor" },
  {
    cod: "3250",
    denumire: "Fabricarea de dispozitive, aparate și instrumente medicale stomatologice",
  },
  { cod: "3291", denumire: "Fabricarea măturilor și periilor" },
  { cod: "3299", denumire: "Fabricarea altor produse manufacturiere n.c.a." },
  { cod: "3311", denumire: "Repararea și întreținerea articolelor fabricate din metal" },
  { cod: "3312", denumire: "Repararea și întreținerea mașinilor" },
  { cod: "3313", denumire: "Repararea și întreținerea echipamentelor electronice și optice" },
  { cod: "3314", denumire: "Repararea și întreținerea echipamentelor electrice" },
  { cod: "3315", denumire: "Repararea și întreținerea navelor și bărcilor, civile" },
  { cod: "3316", denumire: "Repararea și întreținerea aeronavelor și navelor spațiale, civile" },
  {
    cod: "3317",
    denumire: "Repararea și întreținerea altor echipamente civile de transport n.c.a.",
  },
  {
    cod: "3318",
    denumire:
      "Repararea și întreținerea vehiculelor militare de luptă, a navelor, vaselor, aeronavelor și navelor spațiale, militare",
  },
  { cod: "3319", denumire: "Repararea și întreținerea altor echipamente" },
  { cod: "3320", denumire: "Instalarea mașinilor și echipamentelor industriale" },
  { cod: "3511", denumire: "Producția de energie electrică din resurse neregenerabile" },
  { cod: "3512", denumire: "Producția de energie electrică din resurse regenerabile" },
  { cod: "3513", denumire: "Transportul energiei electrice" },
  { cod: "3514", denumire: "Distribuția energiei electrice" },
  { cod: "3515", denumire: "Comercializarea energiei electrice" },
  { cod: "3516", denumire: "Depozitarea energiei electrice" },
  { cod: "3521", denumire: "Producția gazelor" },
  { cod: "3522", denumire: "Distribuția combustibililor gazoși, prin conducte" },
  { cod: "3523", denumire: "Comercializarea combustibililor gazoși, prin conducte" },
  { cod: "3524", denumire: "Depozitarea gazelor, ca parte a serviciilor de furnizare" },
  { cod: "3530", denumire: "Furnizarea de abur și aer condiționat" },
  {
    cod: "3540",
    denumire:
      "Activități ale agenților și brokerilor din domeniul energiei electrice și a gazelor naturale",
  },
  { cod: "3600", denumire: "Captarea, tratarea și distribuția apei" },
  { cod: "3700", denumire: "Colectarea și epurarea apelor uzate" },
  { cod: "3811", denumire: "Colectarea deșeurilor nepericuloase" },
  { cod: "3812", denumire: "Colectarea deșeurilor periculoase" },
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
  { cod: "3900", denumire: "Activități și servicii de decontaminare" },
  { cod: "4100", denumire: "Lucrări de construcții a clădirilor rezidențiale și nerezidențiale" },
  { cod: "4211", denumire: "Lucrări de construcții a drumurilor și autostrăzilor" },
  { cod: "4212", denumire: "Lucrări de construcții a căilor ferate de suprafață și subterane." },
  { cod: "4213", denumire: "Construcția de poduri și tuneluri" },
  { cod: "4221", denumire: "Lucrări de construcții a proiectelor utilitare pentru fluide" },
  {
    cod: "4222",
    denumire:
      "Lucrări de construcții a proiectelor utilitare pentru electricitate și telecomunicații",
  },
  { cod: "4291", denumire: "Construcții hidrotehnice" },
  { cod: "4299", denumire: "Lucrări de construcții a altor proiecte inginerești n.c.a." },
  { cod: "4311", denumire: "Lucrări de demolare a construcțiilor" },
  { cod: "4312", denumire: "Lucrări de pregătire a terenului" },
  { cod: "4313", denumire: "Lucrări de foraj și sondaj pentru construcții" },
  { cod: "4321", denumire: "Lucrări de instalații electrice" },
  { cod: "4322", denumire: "Lucrări de instalații sanitare, de încălzire și de aer condiționat" },
  { cod: "4323", denumire: "Lucrări de izolații" },
  { cod: "4324", denumire: "Alte lucrări de instalații pentru construcții" },
  { cod: "4331", denumire: "Lucrări de ipsoserie" },
  { cod: "4332", denumire: "Lucrări de tâmplărie și dulgherie" },
  { cod: "4333", denumire: "Lucrări de pardosire și placare a pereților" },
  { cod: "4334", denumire: "Lucrări de vopsitorie, zugrăveli și montări de geamuri" },
  { cod: "4335", denumire: "Alte lucrări de finisare" },
  { cod: "4341", denumire: "Lucrări de învelitori, șarpante și terase la construcții" },
  { cod: "4342", denumire: "Alte lucrări speciale de construcții pentru clădiri" },
  { cod: "4350", denumire: "Lucrări speciale de construcții pentru proiecte de geniu civil" },
  { cod: "4360", denumire: "Servicii de intermediere pentru lucrări speciale de construcții" },
  { cod: "4391", denumire: "Activități de zidărie" },
  { cod: "4399", denumire: "Alte lucrări speciale de construcții n.c.a." },
  {
    cod: "4611",
    denumire:
      "Intermedieri în comerțul cu materii prime agricole, animale vii, materii prime textile și cu semifabricate",
  },
  {
    cod: "4612",
    denumire:
      "Intermedieri în comerțul cu combustibili, minereuri, metale și produse chimice pentru industrie",
  },
  {
    cod: "4613",
    denumire: "Intermedieri în comerțul cu material lemnos și materiale de construcții",
  },
  {
    cod: "4614",
    denumire: "Intermedieri în comerțul cu mașini, echipamente industriale, nave și avioane",
  },
  { cod: "4615", denumire: "Intermedieri în comerțul cu mobilă, articole de menaj și de fierărie" },
  {
    cod: "4616",
    denumire:
      "Intermedieri în comerțul cu textile, confecții din blană, încălțăminte și articole din piele",
  },
  { cod: "4617", denumire: "Intermedieri în comerțul cu produse alimentare, băuturi și tutun" },
  {
    cod: "4618",
    denumire:
      "Intermedieri în comerțul specializat în vânzarea produselor cu caracter specific, n.c.a.",
  },
  { cod: "4619", denumire: "Intermedieri în comerțul cu produse diverse" },
  {
    cod: "4621",
    denumire: "Comerț cu ridicata al cerealelor, semințelor, furajelor și tutunului neprelucrat",
  },
  { cod: "4622", denumire: "Comerț cu ridicata al florilor și al plantelor" },
  { cod: "4623", denumire: "Comerț cu ridicata al animalelor vii" },
  {
    cod: "4624",
    denumire: "Comerț cu ridicata al blănurilor, pieilor brute și al pieilor prelucrate",
  },
  { cod: "4631", denumire: "Comerț cu ridicata al fructelor și legumelor" },
  {
    cod: "4632",
    denumire:
      "Comerț cu ridicata al cărnii și produselor din carne, pește și produse din pește, crustacee și moluște",
  },
  {
    cod: "4633",
    denumire:
      "Comerț cu ridicata al produselor lactate, ouălor, uleiurilor și grăsimilor comestibile",
  },
  { cod: "4634", denumire: "Comerț cu ridicata al băuturilor" },
  { cod: "4635", denumire: "Comerț cu ridicata al produselor din tutun" },
  { cod: "4636", denumire: "Comerț cu ridicata al zahărului, ciocolatei și produselor zaharoase" },
  { cod: "4637", denumire: "Comerț cu ridicata cu cafea, ceai, cacao și condimente" },
  { cod: "4638", denumire: "Comerț cu ridicata specializat al altor alimente" },
  {
    cod: "4639",
    denumire: "Comerț cu ridicata nespecializat de produse alimentare, băuturi și tutun",
  },
  { cod: "4641", denumire: "Comerț cu ridicata al produselor textile" },
  { cod: "4642", denumire: "Comerț cu ridicata al îmbrăcămintei și încălțămintei" },
  {
    cod: "4643",
    denumire:
      "Comerț cu ridicata al aparatelor electrice de uz gospodăresc, al aparatelor de radio și televizoarelor",
  },
  {
    cod: "4644",
    denumire: "Comerț cu ridicata al produselor din ceramică, sticlărie, și produse de întreținere",
  },
  { cod: "4645", denumire: "Comerț cu ridicata al produselor cosmetice și de parfumerie" },
  { cod: "4646", denumire: "Comerț cu ridicata al produselor farmaceutice și medicale" },
  {
    cod: "4647",
    denumire:
      "Comerț cu ridicata al mobilei (inclusiv de birou și pentru magazine), covoarelor și a articolelor de iluminat",
  },
  { cod: "4648", denumire: "Comerț cu ridicata al ceasurilor și bijuteriilor" },
  { cod: "4649", denumire: "Comerț cu ridicata al altor bunuri de uz gospodăresc" },
  {
    cod: "4650",
    denumire: "Comerț cu ridicata al echipamentului informatic și de telecomunicații",
  },
  {
    cod: "4661",
    denumire: "Comerț cu ridicata al mașinilor agricole, echipamentelor și furniturilor",
  },
  { cod: "4662", denumire: "Comerț cu ridicata al mașinilor-unelte" },
  {
    cod: "4663",
    denumire: "Comerț cu ridicata al mașinilor pentru industria minieră și construcții",
  },
  { cod: "4664", denumire: "Comerț cu ridicata al altor mașini și echipamente" },
  { cod: "4671", denumire: "Comerț cu ridicata al autovehiculelor" },
  { cod: "4672", denumire: "Comerț cu ridicata al pieselor și accesoriilor pentru autovehicule" },
  {
    cod: "4673",
    denumire:
      "Comerț cu ridicata al motocicletelor; comerț cu ridicata al pieselor și accesoriilor pentru motociclete",
  },
  {
    cod: "4681",
    denumire:
      "Comerț cu ridicata al combustibililor solizi, lichizi și gazoși și al produselor derivate",
  },
  { cod: "4682", denumire: "Comerț cu ridicata al metalelor și minereurilor metalice" },
  {
    cod: "4683",
    denumire:
      "Comerț cu ridicata al materialului lemnos și a materialelor de construcție și echipamentelor sanitare",
  },
  {
    cod: "4684",
    denumire:
      "Comerț cu ridicata al echipamentelor și furniturilor de fierărie pentru instalații sanitare și de încălzire",
  },
  { cod: "4685", denumire: "Comerț cu ridicata al produselor chimice" },
  { cod: "4686", denumire: "Comerț cu ridicata al altor produse intermediare" },
  { cod: "4687", denumire: "Comerț cu ridicata al deșeurilor și resturilor" },
  { cod: "4689", denumire: "Comerț cu ridicata specializat al altor produse n.c.a." },
  { cod: "4690", denumire: "Comerț cu ridicata nespecializat" },
  {
    cod: "4711",
    denumire:
      "Comerț cu amănuntul nespecializat, cu vânzare predominantă de produse alimentare, băuturi și tutun",
  },
  {
    cod: "4712",
    denumire: "Comerț cu amănuntul nespecializat, cu vânzare predominantă de produse nealimentare",
  },
  { cod: "4721", denumire: "Comerț cu amănuntul al fructelor și legumelor proaspete" },
  { cod: "4722", denumire: "Comerț cu amănuntul al cărnii și al produselor din carne" },
  { cod: "4723", denumire: "Comerț cu amănuntul al peștelui, crustaceelor și moluștelor" },
  {
    cod: "4724",
    denumire: "Comerț cu amănuntul al pâinii, produselor de patiserie și produselor zaharoase",
  },
  { cod: "4725", denumire: "Comerț cu amănuntul al băuturilor" },
  { cod: "4726", denumire: "Comerț cu amănuntul al produselor din tutun" },
  { cod: "4727", denumire: "Comerț cu amănuntul al altor produse alimentare" },
  { cod: "4730", denumire: "Comerț cu amănuntul al carburanților pentru autovehicule" },
  {
    cod: "4740",
    denumire: "Comerț cu amănuntul al echipamentului informatic și de telecomunicații",
  },
  { cod: "4751", denumire: "Comerț cu amănuntul al textilelor" },
  {
    cod: "4752",
    denumire:
      "Comerț cu amănuntul al articolelor de fierărie, al materialelor de construcții, al articolelor din sticlă și a celor pentru vopsit",
  },
  {
    cod: "4753",
    denumire:
      "Comerț cu amănuntul al covoarelor, carpetelor, tapetelor și a altor acoperitoare de podea",
  },
  { cod: "4754", denumire: "Comerț cu amănuntul al articolelor și aparatelor electrocasnice" },
  {
    cod: "4755",
    denumire:
      "Comerț cu amănuntul al mobilei, al articolelor de iluminat și al altor articole de uz casnic n.c.a.",
  },
  { cod: "4761", denumire: "Comerț cu amănuntul al cărților" },
  { cod: "4762", denumire: "Comerț cu amănuntul al ziarelor și articolelor de papetărie" },
  { cod: "4763", denumire: "Comerț cu amănuntul al echipamentelor sportive" },
  { cod: "4764", denumire: "Comerț cu amănuntul al jocurilor și jucăriilor" },
  { cod: "4769", denumire: "Comerț cu amănuntul de bunuri culturale și recreative n.c.a." },
  { cod: "4771", denumire: "Comerț cu amănuntul al îmbrăcămintei" },
  { cod: "4772", denumire: "Comerț cu amănuntul al încălțămintei și articolelor din piele" },
  { cod: "4773", denumire: "Comerț cu amănuntul al produselor farmaceutice" },
  { cod: "4774", denumire: "Comerț cu amănuntul al articolelor medicale și ortopedice" },
  { cod: "4775", denumire: "Comerț cu amănuntul al produselor cosmetice și de parfumerie" },
  {
    cod: "4776",
    denumire:
      "Comerț cu amănuntul al florilor, plantelor și semințelor; comerț cu amănuntul al animalelor de companie și a hranei pentru acestea",
  },
  { cod: "4777", denumire: "Comerț cu amănuntul al ceasurilor și bijuteriilor" },
  { cod: "4778", denumire: "Comerț cu amănuntul al altor bunuri noi" },
  { cod: "4779", denumire: "Comerț cu amănuntul al bunurilor de ocazie" },
  { cod: "4781", denumire: "Comerț cu amănuntul al autovehiculelor" },
  { cod: "4782", denumire: "Comerț cu amănuntul al pieselor și accesoriilor pentru autovehicule" },
  {
    cod: "4783",
    denumire:
      "Comerț cu amănuntul al motocicletelor; comerț cu amănuntul al pieselor și accesoriilor pentru motociclete",
  },
  { cod: "4791", denumire: "Intermedieri în comerțul cu amănuntul nespecializat" },
  { cod: "4792", denumire: "Intermedieri în comerțul cu amănuntul specializat" },
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
  { cod: "5010", denumire: "Transporturi maritime și costiere de pasageri" },
  { cod: "5020", denumire: "Transporturi maritime și costiere de marfă" },
  { cod: "5030", denumire: "Transportul de pasageri pe căi navigabile interioare" },
  { cod: "5040", denumire: "Transportul de marfă pe căi navigabile interioare" },
  { cod: "5110", denumire: "Transporturi aeriene de pasageri" },
  { cod: "5121", denumire: "Transporturi aeriene de marfă" },
  { cod: "5122", denumire: "Transporturi spațiale" },
  { cod: "5210", denumire: "Depozitări" },
  { cod: "5221", denumire: "Activități de servicii anexe pentru transporturi terestre" },
  { cod: "5222", denumire: "Activități de servicii anexe transporturilor pe apă" },
  { cod: "5223", denumire: "Activități de servicii anexe transporturilor aeriene" },
  { cod: "5224", denumire: "Manipulări" },
  { cod: "5225", denumire: "Activități de servicii logistice pentru transporturi" },
  { cod: "5226", denumire: "Alte activități anexe transporturilor" },
  { cod: "5231", denumire: "Activități de intermediere pentru transportul de marfă" },
  { cod: "5232", denumire: "Activități de intermediere pentru transportul de pasageri" },
  {
    cod: "5310",
    denumire: "Activități poștale desfășurate sub obligativitatea serviciului universal",
  },
  { cod: "5320", denumire: "Alte activități poștale și de curier" },
  { cod: "5330", denumire: "Servicii de intermediere pentru activități poștale și de curier" },
  { cod: "5510", denumire: "Hoteluri și alte facilități de cazare similare" },
  { cod: "5520", denumire: "Facilități de cazare pentru vacanțe și perioade de scurtă durată" },
  { cod: "5530", denumire: "Parcuri pentru rulote, campinguri și tabere" },
  { cod: "5540", denumire: "Intermedieri pentru servicii de cazare" },
  { cod: "5590", denumire: "Alte servicii de cazare" },
  { cod: "5611", denumire: "Restaurante" },
  { cod: "5612", denumire: "Activități ale unităților mobile de alimentație" },
  { cod: "5621", denumire: "Activități de alimentație (catering) pentru evenimente" },
  { cod: "5622", denumire: "Alte servicii de alimentație n.c.a." },
  { cod: "5630", denumire: "Baruri și alte activități de servire a băuturilor" },
  {
    cod: "5640",
    denumire: "Intermedieri pentru servicii de alimentație și de servire a băuturilor",
  },
  { cod: "5811", denumire: "Activități de editare a cărților" },
  { cod: "5812", denumire: "Activități de editare a ziarelor" },
  { cod: "5813", denumire: "Activități de editare a revistelor și periodicelor" },
  { cod: "5819", denumire: "Alte activități de editare" },
  { cod: "5821", denumire: "Activități de editare a jocurilor de calculator" },
  { cod: "5829", denumire: "Activități de editare a altor produse software" },
  {
    cod: "5911",
    denumire: "Activități de producție cinematografică, video și de programe de televiziune",
  },
  {
    cod: "5912",
    denumire: "Activități post-producție cinematografică, video și de programe de televiziune",
  },
  {
    cod: "5913",
    denumire:
      "Activități de distribuție a filmelor cinematografice, video și a programelor de televiziune",
  },
  { cod: "5914", denumire: "Proiecția de filme cinematografice" },
  {
    cod: "5920",
    denumire: "Activități de realizare a înregistrărilor audio și activități de editare muzicală",
  },
  {
    cod: "6010",
    denumire: "Activități radiodifuziune, activități de distribuție de programe audio",
  },
  {
    cod: "6020",
    denumire:
      "Activități de difuzare a programelor de televiziune, activități de distribuție de programe video",
  },
  { cod: "6031", denumire: "Activități ale agențiilor de știri" },
  { cod: "6039", denumire: "Activități de distribuție a altor conținuturi" },
  {
    cod: "6110",
    denumire:
      "Activități de telecomunicații prin rețele cu cablu, prin rețele fără cablu și prin satelit",
  },
  {
    cod: "6120",
    denumire:
      "Activități de revânzare a serviciilor de telecomunicații și servicii de intermediere pentru telecomunicații",
  },
  { cod: "6190", denumire: "Alte activități de telecomunicații" },
  {
    cod: "6210",
    denumire: "Activități de realizare a soft-ului la comandă (software orientat client)",
  },
  {
    cod: "6220",
    denumire:
      "Activități de consultanță în tehnologia informației și de management (gestiune și exploatare) a mijloacelor de calcul",
  },
  { cod: "6290", denumire: "Alte activități de servicii privind tehnologia informației" },
  {
    cod: "6310",
    denumire: "Prelucrarea datelor, administrarea paginilor web și activități conexe",
  },
  { cod: "6391", denumire: "Activități ale portalurilor web" },
  { cod: "6392", denumire: "Alte activități de servicii informaționale n.c. a" },
  { cod: "6411", denumire: "Activități ale băncii centrale (naționale)" },
  { cod: "6419", denumire: "Alte activități de intermedieri monetare" },
  { cod: "6421", denumire: "Activități ale holding-urilor" },
  { cod: "6422", denumire: "Activități ale canalelor de finanțare" },
  {
    cod: "6431",
    denumire:
      "Activități ale fondurilor de investiții de pe piața monetară și ale fondurilor de investiții din afara pieței monetare",
  },
  { cod: "6432", denumire: "Fonduri mutuale și alte entități financiare similare" },
  { cod: "6491", denumire: "Leasing financiar" },
  { cod: "6492", denumire: "Alte activități de creditare" },
  {
    cod: "6499",
    denumire:
      "Alte intermedieri financiare n.c.a., exceptând activități de asigurări și fonduri de pensii",
  },
  { cod: "6511", denumire: "Activități de asigurări de viață" },
  { cod: "6512", denumire: "Alte activități de asigurări (exceptând asigurările de viață)" },
  { cod: "6520", denumire: "Activități de reasigurare" },
  {
    cod: "6530",
    denumire:
      "Activități ale fondurilor de pensii (cu excepția celor din sistemul public de asigurări sociale)",
  },
  { cod: "6611", denumire: "Administrarea piețelor financiare" },
  { cod: "6612", denumire: "Activități de intermediere a tranzacțiilor financiare" },
  {
    cod: "6619",
    denumire:
      "Activități auxiliare intermedierilor financiare, exceptând activități de asigurări și fonduri de pensii",
  },
  { cod: "6621", denumire: "Activități de evaluare a riscului de asigurare și a pagubelor" },
  { cod: "6622", denumire: "Activități ale agenților și broker-ilor de asigurări" },
  { cod: "6629", denumire: "Alte activități auxiliare de asigurări și fonduri de pensii" },
  { cod: "6630", denumire: "Activități de administrare a fondurilor" },
  { cod: "6811", denumire: "Cumpărarea și vânzarea de bunuri imobiliare proprii" },
  { cod: "6812", denumire: "Dezvoltare (promovare) imobiliară" },
  {
    cod: "6820",
    denumire: "Închirierea și subînchirierea bunurilor imobiliare proprii sau închiriate",
  },
  { cod: "6831", denumire: "Servicii de intermediere a tranzacțiilor imobiliare" },
  {
    cod: "6832",
    denumire: "Alte activități pentru tranzacții imobiliare pe bază de comision sau contract",
  },
  { cod: "6910", denumire: "Activități juridice" },
  {
    cod: "6920",
    denumire: "Activități de contabilitate și audit financiar; consultanță în domeniul fiscal",
  },
  {
    cod: "7010",
    denumire: "Activități ale direcțiilor(centralelor), birourilor administrative centralizate",
  },
  { cod: "7020", denumire: "Activități de consultanță în afaceri și management" },
  { cod: "7111", denumire: "Activități de arhitectură" },
  { cod: "7112", denumire: "Activități de inginerie și consultanță tehnică legate de acestea" },
  { cod: "7120", denumire: "Activități de testări și analize tehnice" },
  { cod: "7210", denumire: "Cercetare-dezvoltare în științe naturale și inginerie" },
  { cod: "7220", denumire: "Cercetare-dezvoltare în științe sociale și umaniste" },
  { cod: "7311", denumire: "Activități ale agențiilor de publicitate" },
  { cod: "7312", denumire: "Servicii de reprezentare media" },
  { cod: "7320", denumire: "Activități de studiere a pieței și de sondare a opiniei publice" },
  { cod: "7330", denumire: "Activități în domeniul relațiilor publice și al comunicării" },
  { cod: "7411", denumire: "Activități de design industrial și vestimentar" },
  { cod: "7412", denumire: "Design grafic și activități de comunicare vizuală" },
  { cod: "7413", denumire: "Activități de design de interior" },
  { cod: "7414", denumire: "Alte activități de design specializat" },
  { cod: "7420", denumire: "Activități fotografice" },
  { cod: "7430", denumire: "Activități de traducere scrisă și orală (interpreți)" },
  {
    cod: "7491",
    denumire: "Activități de brokeraj în materie de brevete și servicii de marketing",
  },
  { cod: "7499", denumire: "Alte activități profesionale, stiințifice și tehnice n.c.a." },
  { cod: "7500", denumire: "Activități veterinare" },
  {
    cod: "7711",
    denumire: "Activități de închiriere și leasing cu autoturisme și autovehicule rutiere ușoare",
  },
  { cod: "7712", denumire: "Activități de închiriere și leasing cu autovehicule rutiere grele" },
  {
    cod: "7721",
    denumire: "Activități de închiriere și leasing cu bunuri recreaționale și echipament sportiv",
  },
  {
    cod: "7722",
    denumire: "Activități de închiriere și leasing cu alte bunuri personale și gospodărești n.c.a.",
  },
  {
    cod: "7731",
    denumire: "Activități de închiriere și leasing cu mașini și echipamente agricole",
  },
  {
    cod: "7732",
    denumire: "Activități de închiriere și leasing cu mașini și echipamente pentru construcții",
  },
  {
    cod: "7733",
    denumire:
      "Activități de închiriere și leasing cu mașini și echipamente de birou (inclusiv calculatoare)",
  },
  {
    cod: "7734",
    denumire: "Activități de închiriere și leasing cu echipamente de transport pe apă",
  },
  {
    cod: "7735",
    denumire: "Activități de închiriere și leasing cu echipamente de transport aerian",
  },
  {
    cod: "7739",
    denumire:
      "Activități de închirierea și leasing cu alte mașini, echipamente și bunuri tangibile n.c.a.",
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
  { cod: "7810", denumire: "Activități ale agențiilor de plasare a forței de muncă" },
  {
    cod: "7820",
    denumire:
      "Activități ale agențiilor de plasare temporară a forței de muncă și furnizarea altor resurse umane",
  },
  { cod: "7911", denumire: "Activități ale agențiilor turistice" },
  { cod: "7912", denumire: "Activități ale tur-operatorilor" },
  {
    cod: "7990",
    denumire:
      "Alte servicii de rezervare și asistență turistică 80 Activități de investigații și protecție",
  },
  { cod: "8001", denumire: "Activități de investigații și servicii private de protecție" },
  { cod: "8009", denumire: "Alte activități de protecție n.c.a." },
  { cod: "8110", denumire: "Activități de servicii suport combinate" },
  { cod: "8121", denumire: "Activități generale de curățenie a clădirilor" },
  { cod: "8122", denumire: "Activități specializate de curățenie" },
  { cod: "8123", denumire: "Alte activități de curățenie" },
  { cod: "8130", denumire: "Activități de înteținere peisagistică" },
  { cod: "8210", denumire: "Activități de secretariat și servicii suport" },
  { cod: "8220", denumire: "Activități ale centrelor de intermediere telefonică (call center)" },
  { cod: "8230", denumire: "Activități de organizare a expozițiilor, târgurilor și congreselor" },
  {
    cod: "8240",
    denumire: "Activități de intermediere pentru servicii suport pentru întreprinderi n.c.a.",
  },
  {
    cod: "8291",
    denumire:
      "Activități ale agențiilor de colectare și a birourilor (oficiilor) de raportare a creditului",
  },
  { cod: "8292", denumire: "Activități de ambalare" },
  { cod: "8299", denumire: "Alte activități de servicii suport pentru întreprinderi n.c.a." },
  { cod: "8411", denumire: "Activități de administrație publică generală" },
  {
    cod: "8412",
    denumire:
      "Reglementarea activităților organismelor care prestează servicii în domeniul îngrijirii sănătății, învățământului, culturii și al altor activități sociale, exceptând protecția socială",
  },
  { cod: "8413", denumire: "Reglementarea și eficientizarea activităților economice" },
  { cod: "8421", denumire: "Activități de afaceri externe" },
  { cod: "8422", denumire: "Activități de apărare națională" },
  { cod: "8423", denumire: "Activități de justiție" },
  { cod: "8424", denumire: "Activități de ordine publică și de protecție civilă" },
  { cod: "8425", denumire: "Activități de luptă împotriva incendiilor și de prevenire a acestora" },
  { cod: "8430", denumire: "Activități de protecție socială obligatorie" },
  { cod: "8510", denumire: "Învățământ preșcolar" },
  { cod: "8520", denumire: "Învățământ primar" },
  { cod: "8531", denumire: "Învățământ secundar general" },
  { cod: "8532", denumire: "Învățământ secundar, tehnic sau profesional" },
  { cod: "8533", denumire: "Învățământ post-secundar, non-universitar" },
  { cod: "8540", denumire: "Învățământ superior universitar" },
  { cod: "8551", denumire: "Învățământ în domeniul sportiv și recreațional" },
  {
    cod: "8552",
    denumire: "Învățământ în domeniul cultural (muzică, teatru, dans, arte plastice, etc.)",
  },
  { cod: "8553", denumire: "Școli de conducere (pilotaj)" },
  { cod: "8559", denumire: "Alte forme de învățământ n.c.a." },
  {
    cod: "8561",
    denumire: "Activități de intermediere pentru cursuri și tutori (îndrumători, profesori)",
  },
  { cod: "8569", denumire: "Activități de servicii suport pentru învățământ" },
  { cod: "8610", denumire: "Activități de asistență spitalicească" },
  { cod: "8621", denumire: "Activități de asistență medicală generală" },
  { cod: "8622", denumire: "Activități de asistență medicală specializată" },
  { cod: "8623", denumire: "Activități de asistență stomatologică" },
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
  { cod: "8699", denumire: "Alte activități referitoare la sănătatea umană n.c.a." },
  { cod: "8710", denumire: "Activități ale centrelor de îngrijire medicală" },
  {
    cod: "8720",
    denumire: "Activități ale centrelor de recuperare pshică și de dezintoxicare, exclusiv spitale",
  },
  {
    cod: "8730",
    denumire:
      "Activități ale căminelor de bătrâni și ale căminelor pentru persoane cu dizabilități aflate în incapacitate de a se îngriji singure",
  },
  { cod: "8791", denumire: "Activități de intermediere pentru servicii de îngrijire la domiciliu" },
  { cod: "8799", denumire: "Alte activități de asistență socială, cu cazare n.c.a." },
  {
    cod: "8810",
    denumire:
      "Activități de asistență socială, fără cazare, pentru bătrâni și pentru persoane cu dizabilități aflate în incapacitate de a se îngriji singure",
  },
  { cod: "8891", denumire: "Activități de îngrijire zilnică pentru copii" },
  { cod: "8899", denumire: "Alte activități de asistență socială, fără cazare, n.c.a." },
  { cod: "9011", denumire: "Activități de creație literară și compoziție muzicală" },
  { cod: "9012", denumire: "Activități de creație în domeniul artelor vizuale" },
  { cod: "9013", denumire: "Alte activități de creație artistică" },
  { cod: "9020", denumire: "Activități de interpretare artistică (spectacole)" },
  { cod: "9031", denumire: "Activități de gestionare a sălilor și amplasamentelor de spectacole" },
  { cod: "9039", denumire: "Alte activități suport pentru creație și interpretare artistică" },
  { cod: "9111", denumire: "Activități ale bibliotecilor" },
  { cod: "9112", denumire: "Activități ale arhivelor" },
  { cod: "9121", denumire: "Activități ale muzeelor și colecțiilor" },
  { cod: "9122", denumire: "Activități ale siturilor și monumentelor istorice" },
  {
    cod: "9130",
    denumire:
      "Activități de conservare, restaurare și alte activități suport pentru patrimoniul cultural",
  },
  { cod: "9141", denumire: "Activități ale grădinilor botanice și zoologice" },
  { cod: "9142", denumire: "Activități ale rezervațiilor naturale" },
  { cod: "9200", denumire: "Activități de jocuri de noroc și pariuri" },
  { cod: "9311", denumire: "Activități ale bazelor sportive" },
  { cod: "9312", denumire: "Activități ale cluburilor sportive" },
  { cod: "9313", denumire: "Activități ale centrelor de fitness" },
  { cod: "9319", denumire: "Alte activități sportive n.c.a" },
  { cod: "9321", denumire: "Activități ale parcurilor tematice și de distracții" },
  { cod: "9329", denumire: "Alte activități recreative și distractive n.c.a." },
  { cod: "9411", denumire: "Activități ale organizațiilor economice și patronale" },
  { cod: "9412", denumire: "Activități ale organizațiilor profesionale" },
  { cod: "9420", denumire: "Activități ale sindicatelor salariaților" },
  { cod: "9491", denumire: "Activități ale organizațiilor religioase" },
  { cod: "9492", denumire: "Activități ale organizațiilor politice" },
  { cod: "9499", denumire: "Activități ale altor organizații n.c.a." },
  {
    cod: "9510",
    denumire: "Repararea și întreținerea calculatoarelor și a echipamentelor de comunicații",
  },
  { cod: "9521", denumire: "Repararea și întreținerea aparatelor electronice de uz casnic" },
  {
    cod: "9522",
    denumire:
      "Repararea și întreținerea dispozitivelor de uz gospodăresc și a echipamentelor pentru casă și grădină",
  },
  { cod: "9523", denumire: "Repararea și întreținerea încălțămintei și a articolelor din piele" },
  { cod: "9524", denumire: "Repararea și întreținerea mobilei și a furniturilor casnice" },
  { cod: "9525", denumire: "Repararea și întreținerea ceasurilor și a bijuteriilor" },
  {
    cod: "9529",
    denumire: "Repararea și întreținerea articolelor de uz personal și gospodăresc n.c.a.",
  },
  { cod: "9531", denumire: "Repararea și întreținerea autovehiculelor" },
  { cod: "9532", denumire: "Repararea și întreținerea motocicletelor" },
  {
    cod: "9540",
    denumire:
      "Servicii de intermediere pentru repararea și întreținerea calculatoarelor, a articolelor personale și de uz gospodăresc, a autovehiculelor și motocicletelor",
  },
  { cod: "9610", denumire: "Spălarea și curățarea articolelor textile și a produselor din blană" },
  { cod: "9621", denumire: "Activități de coafură și frizerie" },
  { cod: "9622", denumire: "Activități de tratament și înfrumusețare" },
  { cod: "9623", denumire: "Activități ale centrelor spa, saunelor și bailor de abur" },
  { cod: "9630", denumire: "Activități de pompe funebre și similare" },
  { cod: "9640", denumire: "Activități de intermediere pentru servicii personale" },
  { cod: "9691", denumire: "Activități de servicii personale la domiciliu" },
  { cod: "9699", denumire: "Alte servicii personale n.c.a." },
  {
    cod: "9700",
    denumire: "Activități ale gospodăriilor private în calitate de angajator de personal casnic",
  },
  {
    cod: "9810",
    denumire:
      "Activități ale gospodăriilor private de producere de bunuri destinate consumului propriu",
  },
  {
    cod: "9820",
    denumire:
      "Activități ale gospodăriilor private de producere de servicii pentru scopuri proprii",
  },
  { cod: "9900", denumire: "Activități ale organizațiilor și organismelor extrateritoriale" },
];

/** Verificare O(1) că un cod există în nomenclator. */
export const CODURI_CAEN_VALIDE: ReadonlySet<string> = new Set(NOMENCLATOR_CAEN.map((c) => c.cod));
