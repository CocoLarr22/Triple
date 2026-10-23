/* Triple — données fixes : aliments, recettes, ravitaillement, magasins.
   Tes données personnelles (sorties, pesées, repas cochés, prix corrigés) ne sont jamais ici : elles restent sur ton téléphone. */
window.RC_DATA = (function () {
  "use strict";

  /* Aliment : nom, rayon, n = [kcal, protéines, glucides, lipides] pour 100 g (ou 100 ml),
     r = rôle pour ajuster les portions (c : féculents et sucres, p : protéines, f : matières grasses, v : fixe),
     piece = poids d'une pièce (g), liquid = vendu au litre, p = prix estimé (€/kg, €/L ou €/pièce), stock = déjà au placard. */
  var FOOD = {
    avoine:     { fr: "Flocons d'avoine", rayon: "Féculents", n: [370, 13.5, 59, 7], r: "c", p: 1.7 },
    riz:        { fr: "Riz basmati", rayon: "Féculents", n: [355, 8, 78, 0.8], r: "c", raw: 1, p: 2.4 },
    pates:      { fr: "Pâtes", rayon: "Féculents", n: [355, 12.5, 71, 1.5], r: "c", raw: 1, p: 1.4 },
    pdt:        { fr: "Pommes de terre", rayon: "Féculents", n: [80, 2, 17, 0.1], r: "c", p: 1.3 },
    patdouce:   { fr: "Patates douces", rayon: "Féculents", n: [86, 1.6, 20, 0.1], r: "c", p: 2.6 },
    semoule:    { fr: "Semoule", rayon: "Féculents", n: [360, 12, 73, 1.5], r: "c", raw: 1, p: 1.9 },
    quinoa:     { fr: "Quinoa", rayon: "Féculents", n: [368, 14, 64, 6], r: "c", raw: 1, p: 6.5 },
    pain:       { fr: "Pain complet tranché", rayon: "Féculents", n: [245, 9, 41, 3.5], r: "c", p: 3.2 },
    galettes:   { fr: "Galettes de riz", rayon: "Féculents", n: [380, 8, 80, 3], r: "c", p: 6.5 },
    tortilla:   { fr: "Wraps de blé", rayon: "Féculents", n: [300, 8, 50, 7], r: "c", piece: 60, p: 4.5 },
    lentilles:  { fr: "Lentilles cuites", rayon: "Conserves", n: [116, 9, 17, 0.4], r: "c", p: 2.9 },
    poischiches:{ fr: "Pois chiches cuits", rayon: "Conserves", n: [140, 7, 20, 2.5], r: "c", p: 2.5 },
    hrouges:    { fr: "Haricots rouges cuits", rayon: "Conserves", n: [110, 8, 15, 0.5], r: "c", p: 2.4 },
    mais:       { fr: "Maïs doux", rayon: "Conserves", n: [90, 3, 17, 1.2], r: "c", p: 3.5 },
    passata:    { fr: "Tomates concassées", rayon: "Conserves", n: [35, 1.5, 6, 0.2], r: "v", p: 1.9 },
    thon:       { fr: "Thon au naturel", rayon: "Conserves", n: [115, 26, 0, 1], r: "p", p: 16 },

    poulet:     { fr: "Blanc de poulet", rayon: "Viandes & poissons", n: [110, 23, 0, 1.8], r: "p", p: 9.9 },
    dinde:      { fr: "Escalopes de dinde", rayon: "Viandes & poissons", n: [107, 24, 0, 1.2], r: "p", p: 10.5 },
    hache:      { fr: "Bœuf haché 5 %", rayon: "Viandes & poissons", n: [125, 21, 0, 5], r: "p", p: 12.5 },
    jambon:     { fr: "Jambon blanc", rayon: "Viandes & poissons", n: [110, 20, 1, 3], r: "p", p: 11 },
    saumon:     { fr: "Pavés de saumon", rayon: "Viandes & poissons", n: [200, 20, 0, 13], r: "p", p: 19 },
    cabillaud:  { fr: "Dos de cabillaud surgelé", rayon: "Viandes & poissons", n: [80, 18, 0, 0.7], r: "p", p: 13 },
    oeuf:       { fr: "Œufs", rayon: "Frais", n: [140, 12.5, 0.7, 9.6], r: "p", piece: 55, p: 0.28, unit: "pièce" },

    skyr:       { fr: "Skyr nature", rayon: "Frais", n: [60, 10.5, 4, 0.2], r: "p", p: 3.8 },
    fblanc:     { fr: "Fromage blanc 0 %", rayon: "Frais", n: [47, 7.5, 4, 0.2], r: "p", p: 2.3 },
    yaourt:     { fr: "Yaourt nature", rayon: "Frais", n: [60, 4, 5, 3], r: "p", piece: 125, p: 1.7 },
    lait:       { fr: "Lait demi-écrémé", rayon: "Frais", n: [46, 3.3, 4.8, 1.6], r: "p", liquid: true, p: 1.05 },
    vegetal:    { fr: "Boisson végétale soja", rayon: "Frais", n: [40, 3.3, 2.5, 1.8], r: "p", liquid: true, p: 1.9, altOnly: true },
    emmental:   { fr: "Emmental râpé", rayon: "Frais", n: [380, 28, 0, 30], r: "f", p: 9.5 },
    mozza:      { fr: "Mozzarella", rayon: "Frais", n: [160, 20, 1, 9], r: "p", p: 8 },

    hverts:     { fr: "Haricots verts surgelés", rayon: "Légumes", n: [30, 2, 4, 0.2], r: "v", p: 2.2 },
    brocoli:    { fr: "Brocolis surgelés", rayon: "Légumes", n: [34, 3, 3, 0.4], r: "v", p: 2.5 },
    poelee:     { fr: "Poêlée de légumes surgelée", rayon: "Légumes", n: [40, 2, 6, 0.8], r: "v", p: 2.8 },
    epinards:   { fr: "Épinards surgelés", rayon: "Légumes", n: [25, 3, 1, 0.4], r: "v", p: 2.2 },
    poivrons:   { fr: "Poivrons surgelés", rayon: "Légumes", n: [30, 1.2, 5, 0.3], r: "v", p: 3.2 },
    courgette:  { fr: "Courgettes", rayon: "Légumes", n: [17, 1.2, 2.5, 0.3], r: "v", p: 2.3 },
    carottes:   { fr: "Carottes", rayon: "Légumes", n: [36, 0.8, 7, 0.2], r: "v", p: 1.4 },
    tcerises:   { fr: "Tomates cerises", rayon: "Légumes", n: [20, 1, 3, 0.2], r: "v", p: 4.5 },
    champi:     { fr: "Champignons émincés", rayon: "Légumes", n: [22, 3, 0.5, 0.3], r: "v", p: 4 },

    banane:     { fr: "Bananes", rayon: "Fruits", n: [90, 1.1, 20, 0.3], r: "c", piece: 120, p: 1.9 },
    pomme:      { fr: "Pommes", rayon: "Fruits", n: [52, 0.3, 12, 0.2], r: "c", piece: 150, p: 2.4 },
    clem:       { fr: "Clémentines", rayon: "Fruits", n: [47, 0.9, 11, 0.3], r: "c", piece: 70, p: 2.9 },
    frouges:    { fr: "Fruits rouges surgelés", rayon: "Fruits", n: [45, 1, 8, 0.3], r: "c", p: 5 },
    dattes:     { fr: "Dattes", rayon: "Fruits", n: [280, 2.5, 66, 0.4], r: "c", piece: 8, p: 7 },
    amandes:    { fr: "Amandes", rayon: "Fruits", n: [600, 22, 7, 52], r: "f", p: 14 },
    noix:       { fr: "Cerneaux de noix", rayon: "Fruits", n: [690, 15, 7, 65], r: "f", p: 18 },
    pb:         { fr: "Beurre de cacahuète", rayon: "Épicerie", n: [610, 25, 12, 50], r: "f", p: 8.5 },

    huile:      { fr: "Huile d'olive", rayon: "Épicerie", n: [900, 0, 0, 100], r: "f", liquid: true, p: 9 },
    miel:       { fr: "Miel", rayon: "Épicerie", n: [320, 0, 80, 0], r: "c", p: 9.5 },
    confiture:  { fr: "Confiture", rayon: "Épicerie", n: [250, 0.5, 60, 0.1], r: "c", p: 4 },
    sucre:      { fr: "Sucre (ou maltodextrine)", rayon: "Épicerie", n: [400, 0, 100, 0], r: "c", p: 1.2 },
    soja:       { fr: "Sauce soja", rayon: "Épicerie", n: [60, 8, 6, 0], r: "v", liquid: true, p: 6 },
    coco:       { fr: "Lait de coco léger", rayon: "Épicerie", n: [70, 0.8, 2, 6.5], r: "f", liquid: true, p: 4.5 },
    cacao:      { fr: "Cacao non sucré", rayon: "Épicerie", n: [380, 20, 15, 22], r: "v", p: 10 },
    choco:      { fr: "Chocolat noir 70 %", rayon: "Épicerie", n: [580, 8, 33, 42], r: "f", p: 11 },

    gel:        { fr: "Gels énergétiques", rayon: "Ravitaillement", n: [300, 0, 78, 0], r: "v", piece: 32, p: 1.2, unit: "pièce" },
    barre:      { fr: "Barres de céréales", rayon: "Ravitaillement", n: [400, 6, 68, 9], r: "v", piece: 30, p: 0.4, unit: "pièce" },
    sel:        { fr: "Sel", rayon: "Épicerie", n: [0, 0, 0, 0], r: "v", stock: true }
  };
  var RAYONS = ["Féculents", "Viandes & poissons", "Frais", "Légumes", "Fruits", "Conserves", "Épicerie", "Ravitaillement"];

  /* Magasins : indice de prix par rapport à un hard-discount (estimation). */
  var STORES = [
    { id: "lidl", name: "Lidl", k: 1 }, { id: "aldi", name: "Aldi", k: 0.99 }, { id: "leclerc", name: "E.Leclerc", k: 1.05 },
    { id: "auchan", name: "Auchan", k: 1.08 }, { id: "intermarche", name: "Intermarché", k: 1.1 }, { id: "superu", name: "Super U", k: 1.1 },
    { id: "carrefour", name: "Carrefour", k: 1.12 }, { id: "monoprix", name: "Monoprix", k: 1.3 }
  ];
  var SPICES = ["Paprika", "Curry ou garam masala", "Cumin", "Herbes de Provence", "Ail en poudre", "Cannelle", "Bouillon cube", "Sel, poivre"];

  /* Ravitaillement : glucides par unité et aliments à acheter. */
  var RAVITO = {
    iso:    { label: "Bidon boisson maison", one: "bidon", many: "bidons", c: 30, buy: [["sucre", 30]], how: "500 ml d'eau + 30 g de sucre (ou maltodextrine) + 1 pincée de sel + un trait de citron." },
    gel:    { label: "Gel", one: "gel", many: "gels", c: 25, buy: [["gel", 32]], how: "Avec quelques gorgées d'eau." },
    barre:  { label: "Barre de céréales", one: "barre", many: "barres", c: 20, buy: [["barre", 30]], how: "À croquer en roulant, par petits morceaux." },
    banane: { label: "Banane", one: "banane", many: "bananes", c: 25, buy: [["banane", 120]], how: "Idéale en début de sortie." },
    dattes: { label: "Dattes (4)", one: "poignée de dattes", many: "poignées de dattes", c: 22, buy: [["dattes", 32]], how: "4 dattes dénoyautées dans un sachet." }
  };


  /* Remplacements quand tu n'aimes pas un aliment, du plus proche au moins proche. Les grammes sont recalculés :
     mêmes protéines pour les viandes, poissons et laitiers, mêmes glucides pour les féculents et les fruits,
     même poids pour les légumes. Un aliment au cœur d'une recette (champ core) n'est jamais remplacé : la recette est masquée. */
  var ALT = {
    poulet: ["dinde", "cabillaud", "thon", "hache", "saumon"], dinde: ["poulet", "cabillaud", "hache", "thon"], hache: ["dinde", "poulet"],
    saumon: ["cabillaud", "poulet", "dinde"], cabillaud: ["saumon", "poulet", "dinde"], thon: ["poulet", "dinde", "cabillaud"],
    riz: ["pates", "semoule", "quinoa", "pdt"], pates: ["riz", "semoule", "quinoa"], semoule: ["riz", "quinoa", "pates"], quinoa: ["riz", "semoule", "pates"],
    pdt: ["patdouce", "riz", "pates"], patdouce: ["pdt", "riz"],
    lentilles: ["poischiches", "hrouges"], poischiches: ["lentilles", "hrouges"], hrouges: ["poischiches", "lentilles"],
    hverts: ["brocoli", "poelee", "courgette", "epinards", "carottes"], brocoli: ["hverts", "poelee", "courgette", "epinards"],
    poelee: ["hverts", "brocoli", "courgette", "poivrons"], epinards: ["brocoli", "hverts", "courgette"], courgette: ["poelee", "brocoli", "champi", "hverts"],
    poivrons: ["poelee", "courgette", "carottes"], carottes: ["courgette", "poivrons", "hverts"], champi: ["courgette", "poelee", "brocoli"], tcerises: ["carottes", "poivrons"],
    skyr: ["fblanc", "yaourt"], fblanc: ["skyr", "yaourt"], yaourt: ["skyr", "fblanc"], lait: ["vegetal"], coco: ["yaourt", "lait"],
    banane: ["pomme", "clem"], pomme: ["banane", "clem"], clem: ["pomme", "banane"], frouges: ["banane", "pomme"], dattes: ["banane", "pomme"],
    amandes: ["noix"], noix: ["amandes"], miel: ["confiture", "sucre"], confiture: ["miel"], sucre: ["miel"], emmental: ["mozza"], mozza: ["emmental"]
  };
  /* Mots utilisés dans les noms de recettes, pour renommer une recette adaptée (« Poulet, riz » devient « Dinde, riz »). */
  var WORD = {
    poulet: ["poulet"], dinde: ["dinde"], hache: ["bœuf"], saumon: ["saumon"], cabillaud: ["cabillaud"], thon: ["thon"],
    riz: ["riz"], pates: ["pâtes"], semoule: ["semoule"], quinoa: ["quinoa"], pdt: ["pommes de terre"], patdouce: ["patates douces"],
    lentilles: ["lentilles"], poischiches: ["pois chiches"], hrouges: ["haricots rouges"], hverts: ["haricots verts"], brocoli: ["brocolis"],
    poelee: ["légumes"], epinards: ["épinards"], courgette: ["courgettes"], poivrons: ["poivrons"], carottes: ["carottes"], champi: ["champignons"],
    tcerises: ["tomates cerises", "tomates"], skyr: ["skyr"], fblanc: ["fromage blanc"], yaourt: ["yaourt"], banane: ["banane"], pomme: ["pomme"],
    clem: ["clémentines"], frouges: ["fruits rouges"], dattes: ["dattes"], amandes: ["amandes"], noix: ["noix"], miel: ["miel"], confiture: ["confiture"],
    pb: ["beurre de cacahuète"], oeuf: ["œufs", "œuf"], jambon: ["jambon"], mozza: ["mozza"], mais: ["maïs"], cacao: ["chocolat"], avoine: ["avoine"],
    galettes: ["galettes de riz"], tortilla: ["wraps"], coco: ["coco"], lait: ["lait"], emmental: ["emmental"], soja: ["soja"]
  };
  /* Rappel de cuisson quand un aliment en remplace un autre. */
  var COOK = {
    riz: "11 à 12 min dans l'eau salée", pates: "9 à 10 min dans l'eau salée", semoule: "5 min à couvert dans le même volume d'eau bouillante",
    quinoa: "rincé, puis 12 min dans l'eau", pdt: "15 min à l'eau ou 12 min au micro-ondes", patdouce: "en cubes, 25 min au four à 210 °C",
    poulet: "6 à 8 min à la poêle", dinde: "6 min à la poêle", hache: "5 min à la poêle", cabillaud: "15 min au four à 200 °C",
    saumon: "12 min au four à 200 °C", thon: "égoutté, sans cuisson", lentilles: "déjà cuites, à réchauffer", poischiches: "déjà cuits, à réchauffer",
    hrouges: "déjà cuits, à réchauffer", brocoli: "6 min au micro-ondes", hverts: "6 min au micro-ondes", epinards: "5 min à la poêle",
    courgette: "5 min à la poêle", poelee: "8 min à la poêle", champi: "5 min à la poêle", poivrons: "5 min à la poêle"
  };

  var MOMENTS = [
    { k: "pd", label: "Petit-déjeuner", short: "Petit-déj" },
    { k: "midi", label: "Déjeuner", short: "Midi" },
    { k: "coll", label: "Collation", short: "Collation" },
    { k: "soir", label: "Dîner", short: "Soir" }
  ];

  /* Recettes. Ingrédient : [clé, grammes, libellé]. Les grammes s'ajustent chaque jour à ta séance. */
  /* Air fryer Ninja CRISPi (modèle européen FN101EU, verre, 4-en-1). Pas de réglage de température : on choisit un mode
     (Frire sans huile, Rôtir, Recroustiller, Garder au chaud) et une durée. « Frire sans huile » chauffe comme un four à 200 °C environ.
     Temps de départ pour une portion, d'après les tableaux de cuisson du Crispi ; t : [min, max] en minutes. Pas de préchauffage. */
  var AIRFRY = {
    poulet: { nm: "le poulet", cut: "en dés de 2 cm, avec l'huile et les épices", t: [10, 12], tip: "remue à mi-cuisson" },
    dinde: { nm: "la dinde", cut: "en lanières, avec l'huile et les épices", t: [8, 10], tip: "remue à mi-cuisson" },
    saumon: { nm: "le saumon", cut: "peau dessous", t: [8, 10], tip: "sans le retourner" },
    cabillaud: { nm: "le cabillaud", cut: "encore surgelé, un filet d'huile et des herbes", t: [12, 14], tip: "cuit quand il s'effeuille" },
    pdt: { nm: "les pommes de terre", cut: "en cubes de 2 cm, 1 c. à c. d'huile", t: [18, 20], tip: "remue 2 fois" },
    patdouce: { nm: "les patates douces", cut: "en cubes de 2 cm, avec l'huile, le paprika et le sel", t: [14, 16], tip: "remue à mi-cuisson, surveille les 2 dernières minutes" },
    brocoli: { nm: "les brocolis", cut: "encore surgelés, un filet d'huile", t: [10, 12], tip: "remue à mi-cuisson" },
    hverts: { nm: "les haricots verts", cut: "encore surgelés, un filet d'huile", t: [8, 10], tip: "remue à mi-cuisson" },
    courgette: { nm: "la courgette", cut: "en dés, un filet d'huile", t: [8, 10], tip: "remue à mi-cuisson" },
    champi: { nm: "les champignons", cut: "émincés, un filet d'huile", t: [6, 8], tip: "remue à mi-cuisson" },
    poivrons: { nm: "les poivrons", cut: "encore surgelés", t: [10, 12], tip: "remue à mi-cuisson" },
    carottes: { nm: "les carottes", cut: "en rondelles, un filet d'huile", t: [12, 14], tip: "remue à mi-cuisson" },
    poelee: { nm: "la poêlée de légumes", cut: "encore surgelée, un filet d'huile", t: [12, 15], tip: "remue 2 fois" },
    pain: { nm: "le pain", cut: "en tranches", t: [3, 4], tip: "surveille la dernière minute" }
  };
  /* Plats courants pour noter un repas pris ailleurs (chez la famille, au resto). Valeurs estimées pour une portion normale :
     k kcal, c glucides, p protéines, f lipides (g). L'alcool compte dans les kcal mais pas dans les macros ; qty : se compte à l'unité (2 bières). */
  var DISHES = [
    { id: "lasagnes", grp: "Plats", nm: "Lasagnes bolognaise", por: "350 g", k: 460, c: 42, p: 25, f: 21 },
    { id: "patesbolo", grp: "Plats", nm: "Pâtes bolognaise", por: "350 g", k: 460, c: 60, p: 21, f: 14 },
    { id: "carbo", grp: "Plats", nm: "Pâtes carbonara", por: "350 g", k: 600, c: 63, p: 25, f: 28 },
    { id: "gratinpates", grp: "Plats", nm: "Gratin de pâtes", por: "350 g", k: 600, c: 60, p: 25, f: 28 },
    { id: "pizza", grp: "Plats", nm: "Pizza", por: "1 individuelle", k: 750, c: 90, p: 30, f: 27 },
    { id: "burger", grp: "Plats", nm: "Burger + frites", por: "1 menu", k: 840, c: 82, p: 29, f: 42 },
    { id: "steakfrites", grp: "Plats", nm: "Steak + frites", por: "1 assiette", k: 780, c: 64, p: 36, f: 41 },
    { id: "pouletpdt", grp: "Plats", nm: "Poulet rôti + pommes de terre", por: "1 assiette", k: 600, c: 45, p: 40, f: 27 },
    { id: "poissonriz", grp: "Plats", nm: "Poisson + riz + légumes", por: "1 assiette", k: 550, c: 65, p: 35, f: 14 },
    { id: "couscous", grp: "Plats", nm: "Couscous viande-légumes", por: "450 g", k: 650, c: 75, p: 35, f: 22 },
    { id: "blanquette", grp: "Plats", nm: "Blanquette + riz", por: "400 g", k: 600, c: 60, p: 35, f: 22 },
    { id: "bourguignon", grp: "Plats", nm: "Bœuf bourguignon + pâtes", por: "450 g", k: 650, c: 55, p: 40, f: 25 },
    { id: "hachis", grp: "Plats", nm: "Hachis parmentier", por: "350 g", k: 480, c: 35, p: 25, f: 26 },
    { id: "chili", grp: "Plats", nm: "Chili con carne + riz", por: "450 g", k: 620, c: 80, p: 30, f: 18 },
    { id: "paella", grp: "Plats", nm: "Paella", por: "400 g", k: 600, c: 70, p: 30, f: 20 },
    { id: "raclette", grp: "Plats", nm: "Raclette", por: "1 repas", k: 1150, c: 55, p: 60, f: 75 },
    { id: "tartiflette", grp: "Plats", nm: "Tartiflette", por: "350 g", k: 700, c: 45, p: 28, f: 45 },
    { id: "quiche", grp: "Plats", nm: "Quiche + salade", por: "1 part", k: 470, c: 27, p: 14, f: 33 },
    { id: "crepes", grp: "Plats", nm: "Galettes complètes", por: "2 galettes", k: 700, c: 60, p: 35, f: 35 },
    { id: "salade", grp: "Plats", nm: "Salade composée", por: "1 grand bol", k: 500, c: 45, p: 25, f: 22 },
    { id: "soupe", grp: "Plats", nm: "Soupe, pain & fromage", por: "1 repas", k: 500, c: 55, p: 20, f: 22 },
    { id: "sandwich", grp: "Plats", nm: "Sandwich jambon-beurre", por: "1", k: 550, c: 70, p: 25, f: 18 },
    { id: "sushis", grp: "Plats", nm: "Sushis et makis", por: "12 pièces", k: 500, c: 80, p: 20, f: 8 },
    { id: "kebab", grp: "Plats", nm: "Kebab + frites", por: "1", k: 1100, c: 110, p: 45, f: 52 },
    { id: "rizcuit", grp: "Accompagnements", nm: "Riz cuit", por: "1 assiette (200 g)", k: 260, c: 56, p: 5, f: 1 },
    { id: "patescuites", grp: "Accompagnements", nm: "Pâtes cuites", por: "1 assiette (250 g)", k: 380, c: 75, p: 13, f: 2 },
    { id: "frites", grp: "Accompagnements", nm: "Frites", por: "150 g", k: 420, c: 50, p: 5, f: 22 },
    { id: "legumes", grp: "Accompagnements", nm: "Légumes", por: "200 g", k: 70, c: 10, p: 3, f: 1 },
    { id: "viande", grp: "Accompagnements", nm: "Viande ou poisson", por: "150 g", k: 250, c: 0, p: 35, f: 12 },
    { id: "pain", grp: "Accompagnements", nm: "Pain", por: "¼ de baguette", k: 160, c: 32, p: 5, f: 1 },
    { id: "fromage", grp: "Accompagnements", nm: "Fromage", por: "30 g", k: 110, c: 0, p: 7, f: 9 },
    { id: "gateau", grp: "Desserts", nm: "Part de gâteau ou de tarte", por: "1 part", k: 350, c: 45, p: 4, f: 17 },
    { id: "creme", grp: "Desserts", nm: "Crème dessert", por: "1 pot", k: 150, c: 22, p: 4, f: 5 },
    { id: "glace", grp: "Desserts", nm: "Glace", por: "2 boules", k: 200, c: 25, p: 3, f: 10 },
    { id: "yaourtfruits", grp: "Desserts", nm: "Yaourt aux fruits", por: "1 pot", k: 120, c: 18, p: 4, f: 3 },
    { id: "fruit", grp: "Desserts", nm: "Fruit", por: "1", k: 80, c: 19, p: 1, f: 0 },
    { id: "chocolat", grp: "Desserts", nm: "Chocolat", por: "2 carrés", k: 110, c: 11, p: 2, f: 7 },
    { id: "croissant", grp: "Petit-déjeuner", nm: "Croissant", por: "1", k: 230, c: 25, p: 5, f: 12 },
    { id: "painchoc", grp: "Petit-déjeuner", nm: "Pain au chocolat", por: "1", k: 280, c: 30, p: 5, f: 16 },
    { id: "cereales", grp: "Petit-déjeuner", nm: "Bol de céréales et lait", por: "1 bol", k: 300, c: 50, p: 10, f: 6 },
    { id: "tartines", grp: "Petit-déjeuner", nm: "Tartines beurre-confiture", por: "2", k: 350, c: 55, p: 7, f: 11 },
    { id: "jus", grp: "Petit-déjeuner", nm: "Jus d'orange", por: "25 cl", k: 110, c: 25, p: 2, f: 0 },
    /* Boissons : alc = grammes d'alcool (volume × degré × 0,79). L'alcool apporte 7 kcal par gramme, compté dans k. */
    { id: "biere25", grp: "Boissons", nm: "Bière blonde", por: "25 cl", k: 110, c: 9, p: 1, f: 0, alc: 10, qty: 1 },
    { id: "biere33", grp: "Boissons", nm: "Bière blonde", por: "33 cl", k: 145, c: 12, p: 1, f: 0, alc: 13, qty: 1 },
    { id: "pinte", grp: "Boissons", nm: "Pinte", por: "50 cl", k: 215, c: 18, p: 2, f: 0, alc: 20, qty: 1 },
    { id: "ipa", grp: "Boissons", nm: "Bière forte ou IPA", por: "33 cl, 7 %", k: 190, c: 15, p: 2, f: 0, alc: 18, qty: 1 },
    { id: "biere0", grp: "Boissons", nm: "Bière sans alcool", por: "33 cl", k: 75, c: 16, p: 1, f: 0, alc: 0, qty: 1 },
    { id: "cidre", grp: "Boissons", nm: "Cidre", por: "25 cl", k: 100, c: 10, p: 0, f: 0, alc: 9, qty: 1 },
    { id: "vin", grp: "Boissons", nm: "Verre de vin", por: "12 cl", k: 85, c: 1, p: 0, f: 0, alc: 12, qty: 1 },
    { id: "champagne", grp: "Boissons", nm: "Coupe de champagne", por: "12 cl", k: 90, c: 2, p: 0, f: 0, alc: 11, qty: 1 },
    { id: "pastis", grp: "Boissons", nm: "Pastis", por: "2 cl + eau", k: 60, c: 2, p: 0, f: 0, alc: 7, qty: 1 },
    { id: "alcoolfort", grp: "Boissons", nm: "Whisky, rhum, vodka", por: "4 cl", k: 90, c: 0, p: 0, f: 0, alc: 13, qty: 1 },
    { id: "cocktail", grp: "Boissons", nm: "Cocktail (spritz, mojito…)", por: "1 verre", k: 170, c: 18, p: 0, f: 0, alc: 12, qty: 1 },
    { id: "soda", grp: "Boissons", nm: "Soda", por: "33 cl", k: 140, c: 35, p: 0, f: 0, qty: 1 },
    { id: "chips", grp: "Apéro", nm: "Chips", por: "1 bol (30 g)", k: 160, c: 15, p: 2, f: 10, qty: 1 },
    { id: "cacahuetes", grp: "Apéro", nm: "Cacahuètes", por: "1 poignée (30 g)", k: 180, c: 4, p: 7, f: 15, qty: 1 },
    { id: "olives", grp: "Apéro", nm: "Olives", por: "10 olives", k: 55, c: 1, p: 0, f: 6, qty: 1 },
    { id: "biscuitsapero", grp: "Apéro", nm: "Biscuits apéritif", por: "1 bol (30 g)", k: 150, c: 18, p: 3, f: 7, qty: 1 },
    { id: "saucisson", grp: "Apéro", nm: "Saucisson", por: "30 g", k: 125, c: 0, p: 8, f: 10, qty: 1 },
    { id: "charcuterie", grp: "Apéro", nm: "Planche de charcuterie", por: "1 part (60 g)", k: 230, c: 1, p: 14, f: 19, qty: 1 },
    { id: "fromagecubes", grp: "Apéro", nm: "Fromage en dés", por: "30 g", k: 110, c: 0, p: 7, f: 9, qty: 1 },
    { id: "toasts", grp: "Apéro", nm: "Toasts (rillettes, tapenade…)", por: "3 toasts", k: 200, c: 15, p: 4, f: 14, qty: 1 },
    { id: "feuilletes", grp: "Apéro", nm: "Feuilletés ou pizzas apéro", por: "4 pièces", k: 250, c: 22, p: 5, f: 15, qty: 1 },
    { id: "guacamole", grp: "Apéro", nm: "Chips tortilla et guacamole", por: "1 bol", k: 250, c: 22, p: 3, f: 17, qty: 1 }
  ];
  /* Recette : af = aliments à cuire au CRISPi, ou un réglage propre à la recette ({ label, t, tip }). */
  var RECIPES = {
    pd: [
      { id: "pd-porridge", core: ["avoine"], name: "Porridge banane, cannelle & amandes", ing: [["avoine", 80, "80 g"], ["lait", 250, "250 ml"], ["banane", 120, "1"], ["amandes", 15, "15 g"], ["miel", 10, "1 c. à c."]],
        steps: ["Cuis l'avoine dans le lait 3 à 4 min en remuant (ou 2 min au micro-ondes en 2 fois).", "Ajoute une pincée de cannelle et la banane en rondelles.", "Amandes concassées et miel par-dessus."] },
      { id: "pd-overnight", core: ["avoine"], name: "Overnight oats skyr & fruits rouges", ing: [["avoine", 70, "70 g"], ["lait", 150, "150 ml"], ["skyr", 150, "150 g"], ["frouges", 100, "100 g"], ["miel", 10, "1 c. à c."]],
        steps: ["La veille, mélange l'avoine, le lait, le skyr et le miel dans un bocal.", "Ajoute les fruits rouges encore surgelés : ils décongèlent pendant la nuit.", "Le matin, mélange et mange froid."], batch: "Prépare 3 bocaux d'un coup : ils tiennent 3 jours au frigo." },
      { id: "pd-tartines", af: ["pain"], core: ["pain", "oeuf"], name: "Tartines miel & œufs brouillés", ing: [["pain", 100, "3 tranches"], ["miel", 20, "1 c. à s."], ["oeuf", 110, "2"], ["clem", 140, "2"]],
        steps: ["Toaste le pain et tartine de miel.", "Brouille les œufs à la poêle antiadhésive, sel et poivre.", "Clémentines à côté."] },
      { id: "pd-pancakes", core: ["avoine", "oeuf"], name: "Pancakes avoine-banane", ing: [["avoine", 80, "80 g"], ["oeuf", 110, "2"], ["banane", 120, "1"], ["lait", 150, "150 ml"], ["miel", 15, "1 c. à s."]],
        steps: ["Mixe l'avoine, les œufs, la banane et le lait avec une pincée de cannelle.", "Cuis 4 ou 5 pancakes à la poêle antiadhésive, 2 min par face.", "Miel par-dessus."], batch: "La pâte se garde 2 jours au frigo." },
      { id: "pd-rizaulait", core: ["riz"], name: "Riz au lait vanillé & banane", tag: "Veille de sortie longue", ing: [["riz", 70, "70 g cru"], ["lait", 400, "400 ml"], ["sucre", 15, "1 c. à s."], ["banane", 120, "1"]],
        steps: ["Cuis le riz dans le lait à feu doux 25 min en remuant souvent, avec la vanille si tu en as.", "Sucre en fin de cuisson.", "Se mange tiède ou froid, avec la banane."], batch: "Fais-en une grande casserole : 3 jours au frigo." },
      { id: "pd-bowlfb", name: "Bowl fromage blanc, avoine grillée & pomme", ing: [["fblanc", 250, "250 g"], ["avoine", 60, "60 g"], ["pomme", 150, "1"], ["noix", 15, "15 g"], ["miel", 10, "1 c. à c."]],
        steps: ["Fais griller l'avoine 3 min à la poêle sèche.", "Coupe la pomme en dés.", "Fromage blanc, avoine, pomme, noix et miel."] },
      { id: "pd-omelette", af: ["pain"], core: ["oeuf"], name: "Omelette jambon & tartines", tag: "Jour de repos", ing: [["oeuf", 165, "3"], ["jambon", 40, "1 tranche"], ["pain", 80, "2 tranches"], ["pomme", 150, "1"]],
        steps: ["Bats les œufs avec sel et poivre, ajoute le jambon en morceaux.", "Cuis dans une poêle chaude, plie quand le dessus est presque pris.", "Pain grillé et pomme à côté."] },
      { id: "pd-painperdu", core: ["pain", "oeuf"], name: "Pain perdu banane", ing: [["pain", 120, "4 tranches"], ["oeuf", 110, "2"], ["lait", 120, "120 ml"], ["banane", 120, "1"], ["miel", 10, "1 c. à c."]],
        steps: ["Fouette les œufs, le lait et une pincée de cannelle.", "Trempe le pain 10 s de chaque côté.", "Dore 2 min par face, puis banane en rondelles et miel."] }
    ],
    plat: [
      { id: "pl-poulriz", af: ["poulet", "hverts"], name: "Poulet paprika, riz & haricots verts", ing: [["riz", 100, "100 g cru"], ["poulet", 150, "150 g"], ["hverts", 200, "200 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Cuis le riz 11 à 12 min dans l'eau salée.", "Saisis le poulet en dés 6 à 8 min dans l'huile avec paprika, ail et sel.", "Haricots verts 6 min au micro-ondes ou à la poêle.", "Mets en boîte : riz, poulet, légumes."], batch: "Pour 3 boîtes, multiplie tout par 3 : 3 jours au frigo." },
      { id: "pl-bolo", core: ["passata"], name: "Pâtes bolognaise express", ing: [["pates", 120, "120 g crues"], ["hache", 130, "130 g"], ["passata", 200, "200 g"], ["carottes", 80, "1"], ["emmental", 15, "15 g"], ["huile", 5, "1 c. à c."]],
        steps: ["Cuis les pâtes al dente.", "Dore le haché dans l'huile avec la carotte râpée, 5 min.", "Ajoute les tomates, herbes de Provence, sel : 10 min à feu doux.", "Sers avec l'emmental."], tag: "Veille de sortie longue" },
      { id: "pl-saumon", af: ["pdt", "saumon", "brocoli"], name: "Saumon, pommes de terre & brocolis", ing: [["pdt", 350, "350 g"], ["saumon", 130, "1 pavé"], ["brocoli", 200, "200 g"], ["huile", 5, "1 c. à c."]],
        steps: ["Cuis les pommes de terre en morceaux 15 min à l'eau (ou 12 min au micro-ondes, couvertes).", "Saumon 12 min au four à 200 °C ou 4 min par face à la poêle.", "Brocolis 6 min au micro-ondes, un filet d'huile et du sel."] },
      { id: "pl-curry", name: "Curry poulet-pois chiches & riz", ing: [["riz", 90, "90 g cru"], ["poulet", 120, "120 g"], ["poischiches", 100, "100 g"], ["coco", 100, "100 ml"], ["epinards", 100, "100 g"]],
        steps: ["Cuis le riz.", "Saisis le poulet en dés 5 min avec 2 c. à c. de curry.", "Ajoute pois chiches, lait de coco et épinards : 8 min à feu doux.", "Sel, et sers sur le riz."], batch: "Se congèle très bien." },
      { id: "pl-patesthon", af: ["courgette"], name: "Pâtes thon, tomates & courgettes", ing: [["pates", 110, "110 g crues"], ["thon", 120, "1 boîte"], ["passata", 150, "150 g"], ["courgette", 150, "1 petite"], ["huile", 10, "1 c. à s."]],
        steps: ["Cuis les pâtes.", "Fais revenir la courgette en dés 5 min dans l'huile avec ail et origan.", "Ajoute les tomates 5 min, puis le thon émietté hors du feu.", "Mélange avec les pâtes."] },
      { id: "pl-chili", core: ["passata"], name: "Chili bœuf-haricots rouges & riz", ing: [["riz", 90, "90 g cru"], ["hache", 120, "120 g"], ["hrouges", 120, "120 g"], ["passata", 150, "150 g"], ["poivrons", 100, "100 g"], ["mais", 50, "50 g"]],
        steps: ["Cuis le riz.", "Dore le haché 5 min avec cumin, paprika et ail.", "Ajoute poivrons, tomates, haricots et maïs : 15 min à feu doux.", "Sers sur le riz."], batch: "Encore meilleur réchauffé le lendemain." },
      { id: "pl-cabillaud", af: ["poelee", "cabillaud"], name: "Cabillaud, semoule & légumes", ing: [["semoule", 100, "100 g"], ["cabillaud", 180, "1 dos"], ["poelee", 250, "250 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Verse le même volume d'eau bouillante salée sur la semoule, couvre 5 min puis égrène.", "Cabillaud 15 min au four à 200 °C avec un filet d'huile et des herbes.", "Poêlée de légumes 8 min à la poêle."] },
      { id: "pl-dinde", af: ["patdouce", "dinde", "hverts"], name: "Dinde, patates douces rôties & haricots verts", ing: [["patdouce", 350, "350 g"], ["dinde", 150, "150 g"], ["hverts", 150, "150 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Coupe les patates douces en cubes, mélange avec l'huile, paprika et sel.", "Four 25 min à 210 °C.", "Saisis la dinde en lanières 6 min.", "Haricots verts au micro-ondes."] },
      { id: "pl-wok", name: "Wok de poulet soja-miel & riz", ing: [["riz", 100, "100 g cru"], ["poulet", 150, "150 g"], ["poelee", 250, "250 g"], ["soja", 15, "1 c. à s."], ["miel", 10, "1 c. à c."], ["huile", 5, "1 c. à c."]],
        steps: ["Cuis le riz.", "Saisis le poulet en lanières 5 min dans l'huile très chaude.", "Ajoute les légumes 5 min, puis soja et miel 2 min pour caraméliser.", "Sers sur le riz."] },
      { id: "pl-dahl", core: ["lentilles"], name: "Dahl de lentilles, riz & œuf", ing: [["lentilles", 200, "200 g"], ["riz", 70, "70 g cru"], ["oeuf", 110, "2"], ["coco", 80, "80 ml"], ["epinards", 100, "100 g"]],
        steps: ["Cuis le riz, et les œufs 9 min à l'eau bouillante (durs).", "Chauffe lentilles, lait de coco, épinards et 1 c. à c. de curry 10 min.", "Sers avec le riz et les œufs coupés en deux."] },
      { id: "pl-quinoa", af: ["poulet"], name: "Salade quinoa, poulet & tomates cerises", ing: [["quinoa", 90, "90 g cru"], ["poulet", 140, "140 g"], ["tcerises", 150, "12"], ["mais", 50, "50 g"], ["huile", 10, "1 c. à s."]],
        steps: ["Rince le quinoa et cuis-le 12 min, refroidis-le.", "Saisis le poulet en dés et laisse tiédir.", "Mélange tout avec l'huile, un peu de citron, sel et poivre.", "Se mange froid : parfait sans micro-ondes."] },
      { id: "pl-risotto", af: ["poulet", "champi"], core: ["riz"], name: "Risotto express champignons & poulet", ing: [["riz", 100, "100 g cru"], ["poulet", 130, "130 g"], ["champi", 150, "150 g"], ["emmental", 20, "20 g"], ["huile", 5, "1 c. à c."]],
        steps: ["Dore le poulet en dés et les champignons 5 min dans l'huile.", "Ajoute le riz, nacre 1 min, puis 300 ml de bouillon chaud en 3 fois, 15 min en remuant.", "Hors du feu, ajoute l'emmental."] },
      { id: "pl-wraps", af: ["dinde"], core: ["tortilla"], name: "Wraps dinde, crudités & sauce skyr", ing: [["tortilla", 180, "3 wraps"], ["dinde", 140, "140 g"], ["carottes", 80, "1"], ["tcerises", 100, "8"], ["skyr", 60, "60 g"]],
        steps: ["Saisis la dinde en lanières 6 min avec paprika.", "Sauce : skyr, ail en poudre, sel, poivre.", "Garnis les wraps : sauce, dinde, carotte râpée, tomates.", "Roule serré et emballe dans du papier alu."] },
      { id: "pl-tortilla", core: ["oeuf", "pdt"], name: "Tortilla de pommes de terre & courgettes", ing: [["pdt", 300, "300 g"], ["oeuf", 165, "3"], ["courgette", 150, "1 petite"], ["huile", 10, "1 c. à s."]],
        steps: ["Cuis les pommes de terre en fines tranches 10 min au micro-ondes, couvertes.", "Fais revenir la courgette en dés dans l'huile 5 min.", "Ajoute pommes de terre et œufs battus, cuis 8 min à feu doux à couvert.", "Retourne avec une assiette et cuis 3 min de l'autre côté."] },
      { id: "pl-parmentier", af: [{ label: "Monte le hachis directement dans le récipient en verre, puis gratine", t: [6, 8], tip: "surveille le fromage" }], core: ["pdt"], name: "Hachis parmentier léger", ing: [["pdt", 350, "350 g"], ["hache", 130, "130 g"], ["carottes", 100, "1 grosse"], ["lait", 50, "50 ml"], ["emmental", 15, "15 g"]],
        steps: ["Cuis les pommes de terre et écrase-les avec le lait chaud, sel, muscade.", "Dore le haché avec la carotte râpée 6 min.", "Plat : viande, purée, emmental. Four 15 min à 200 °C."], batch: "Prépare un grand plat pour 3 repas." }
    ],
    coll: [
      { id: "co-skyr", name: "Skyr, banane & miel", ing: [["skyr", 150, "150 g"], ["banane", 120, "1"], ["miel", 10, "1 c. à c."]],
        steps: ["Banane en rondelles sur le skyr, filet de miel."] },
      { id: "co-tartinepb", core: ["pain"], name: "Tartines beurre de cacahuète & banane", tag: "Avant la séance", ing: [["pain", 70, "2 tranches"], ["pb", 20, "1 c. à s."], ["banane", 120, "1"]],
        steps: ["Tartine le beurre de cacahuète, banane en rondelles par-dessus.", "Idéal 1 h 30 à 2 h avant une séance."] },
      { id: "co-galettes", core: ["galettes"], name: "Galettes de riz, miel & fromage blanc", tag: "Avant la séance", ing: [["galettes", 30, "3"], ["miel", 15, "1 c. à s."], ["fblanc", 150, "150 g"]],
        steps: ["Galettes de riz avec le miel.", "Fromage blanc à côté."] },
      { id: "co-smoothie", name: "Smoothie récup chocolat-banane", tag: "Après la séance", ing: [["lait", 300, "300 ml"], ["banane", 120, "1"], ["avoine", 30, "30 g"], ["cacao", 10, "1 c. à s."]],
        steps: ["Mixe tout 30 s.", "À boire dans l'heure qui suit une séance clé ou une sortie longue."] },
      { id: "co-pomme", name: "Pomme & amandes", tag: "Jour de repos", ing: [["pomme", 150, "1"], ["amandes", 20, "20 g"]],
        steps: ["Simple et rassasiant les jours sans séance."] },
      { id: "co-dattes", name: "Fromage blanc, dattes & noix", ing: [["fblanc", 200, "200 g"], ["dattes", 40, "5"], ["noix", 10, "10 g"]],
        steps: ["Dattes dénoyautées coupées sur le fromage blanc, noix concassées."] },
      { id: "co-yaourt", name: "Yaourt, avoine & clémentines", ing: [["yaourt", 125, "1 pot"], ["avoine", 40, "40 g"], ["clem", 140, "2"], ["miel", 10, "1 c. à c."]],
        steps: ["Avoine et miel dans le yaourt, clémentines à côté."] },
      { id: "co-gateauriz", core: ["riz", "oeuf"], name: "Gâteaux de riz maison", tag: "À emporter", ing: [["riz", 60, "60 g cru"], ["lait", 200, "200 ml"], ["sucre", 15, "1 c. à s."], ["oeuf", 55, "1"]],
        steps: ["Cuis le riz dans le lait 20 min à feu doux avec le sucre.", "Hors du feu, ajoute l'œuf battu.", "Verse dans un moule, four 20 min à 180 °C, coupe en carrés une fois froid.", "Emballés dans de l'alu, ils se glissent dans une poche de maillot."], batch: "Une plaque fait 6 carrés : 4 jours au frigo." }
    ]
  };

  return { ALT: ALT, WORD: WORD, COOK: COOK, AIRFRY: AIRFRY, DISHES: DISHES, FOOD: FOOD, RAYONS: RAYONS, STORES: STORES, SPICES: SPICES, RAVITO: RAVITO, MOMENTS: MOMENTS, RECIPES: RECIPES };
})();
