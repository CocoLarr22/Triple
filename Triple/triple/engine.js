/* Triple — moteur de calcul : charge, forme, plan d'entraînement, besoins nutritionnels.
   Fonctions pures, sans accès à la page : testables à part. */
(function (root) {
  "use strict";

  /* ================= dates ================= */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = s.slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(s, k) { var d = parseISO(s); d.setDate(d.getDate() + k); return iso(d); }
  function mondayOf(s) { var d = parseISO(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 864e5); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function round5(v) { return Math.round(v / 5) * 5; }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  /* ================= sports ================= */
  var SPORTS = ["natation", "velo", "course"];
  var RUN = { course: true };
  function sportOf(type) {
    type = String(type || "");
    /* Padel (et sports de raquette proches, si la montre n'a pas de profil Padel). */
    if (/Padel|Tennis|Squash|Racquet|Pickleball/i.test(type)) return "padel";
    if (/Swim/i.test(type)) return "natation";
    if (/Run/i.test(type)) return "course";
    if (/Ride|Velomobile|Handcycle/i.test(type)) return "velo";
    return "autre";
  }

  /* ================= charge & forme ================= */
  function loadsByDay(acts) {
    var m = {};
    acts.forEach(function (a) { if (a.load > 0) m[a.date] = (m[a.date] || 0) + a.load; });
    return m;
  }
  /* Série forme/fatigue jour par jour (modèle Banister, constantes 42 et 7 jours comme Intervals.icu).
     Les valeurs d'Intervals (wellness) servent d'ancrage quand elles existent. planned : charges prévues après today. */
  function fitnessSeries(acts, wellness, from, to, today, planned) {
    wellness = wellness || {}; planned = planned || {};
    var L = loadsByDay(acts), dates = Object.keys(L).concat(Object.keys(wellness)).sort();
    var start = dates.length ? dates[0] : from;
    if (daysBetween(start, to) > 400) start = addDays(to, -400);
    var ctl = 0, atl = 0, out = [];
    for (var d = start; d <= to; d = addDays(d, 1)) {
      var fut = d > today, load = fut ? (planned[d] || 0) : (L[d] || 0);
      ctl += (load - ctl) / 42; atl += (load - atl) / 7;
      var w = wellness[d];
      if (!fut && w && typeof w.ctl === "number" && typeof w.atl === "number") { ctl = w.ctl; atl = w.atl; }
      if (d >= from) out.push({ d: d, ctl: ctl, atl: atl, tsb: ctl - atl, load: load, fut: fut });
    }
    return out;
  }
  /* Zones de forme d'Intervals.icu, en % de la condition (CTL). */
  function formZone(tsb, ctl) {
    var p = tsb / Math.max(ctl, 1) * 100;
    if (p > 20) return { k: "transition", label: "Transition", hint: "Très reposé : la condition baisse si ça dure.", tone: "grey" };
    if (p > 5) return { k: "frais", label: "Frais", hint: "Prêt pour une grosse séance ou une course.", tone: "good" };
    if (p > -10) return { k: "neutre", label: "Zone neutre", hint: "Ni fatigué ni en progression marquée.", tone: "grey" };
    if (p > -30) return { k: "optimal", label: "Progression", hint: "Fatigue utile : c'est là que la condition monte.", tone: "good" };
    return { k: "risque", label: "Fatigue élevée", hint: "Risque de surmenage : allège 2 ou 3 jours.", tone: "bad" };
  }

  /* ================= historique ================= */
  function history(acts, before, days) {
    var from = addDays(before, -days), h = { natation: 0, velo: 0, course: 0, autre: 0 }, longRun = 0, longRide = 0, n = 0;
    acts.forEach(function (a) {
      if (a.date < from || a.date >= before) return;
      h[a.sport] = (h[a.sport] || 0) + (a.dur || 0) / 3600; n++;
      if (a.sport === "course") longRun = Math.max(longRun, a.dur / 60);
      if (a.sport === "velo") longRide = Math.max(longRide, a.dur / 60);
    });
    var wk = days / 7;
    return { n: n, hours: (h.natation + h.velo + h.course) / wk, natation: h.natation / wk, velo: h.velo / wk, course: h.course / wk,
      run: h.course / wk, longRun: longRun, longRide: longRide };
  }

  /* ================= zones & bibliothèque de séances ================= */
  var ZONES = {
    Z1: { lab: "Z1 · récupération", short: "récup", IF: 0.55 },
    Z2: { lab: "Z2 · endurance", short: "endurance", IF: 0.68 },
    Z3: { lab: "Z3 · tempo", short: "tempo", IF: 0.82 },
    SS: { lab: "Sweet spot", short: "sweet spot", IF: 0.9 },
    Z4: { lab: "Z4 · seuil", short: "seuil", IF: 0.98 },
    Z5: { lab: "Z5 · VMA / PMA", short: "très intense", IF: 1.1 },
    R:  { lab: "Récupération", short: "récup", IF: 0.4 }
  };
  var SWIM_LAB = { Z4: "Z4 · seuil (CSS)", Z5: "Z5 · vitesse" };
  /* Cibles écrites pour Intervals.icu : % de FTP, % de FC au seuil (LTHR) ou % de l'allure seuil. */
  var PCT = {
    power: { Z1: [45, 55], Z2: [56, 75], Z3: [76, 87], SS: [88, 94], Z4: [95, 105], Z5: [106, 120] },
    hrRide: { Z1: [70, 80], Z2: [81, 89], Z3: [90, 93], SS: [91, 94], Z4: [94, 99], Z5: [100, 103] },
    hrRun: { Z1: [75, 84], Z2: [85, 89], Z3: [90, 94], SS: [92, 95], Z4: [95, 99], Z5: [100, 104] },
    swim: { Z1: [80, 87], Z2: [88, 93], Z3: [94, 97], SS: [96, 98], Z4: [98, 102], Z5: [103, 108] }
  };
  /* Natation : secondes de plus (ou de moins) au 100 m que ton allure seuil (CSS). */
  var SWOFF = { Z1: 22, Z2: 10, Z3: 5, SS: 3, Z4: 1, Z5: -4 };

  /* Progression sur les 3 semaines de charge : [répétitions, minutes (ou mètres en natation) d'effort, récup]. */
  var KEYS = {
    ss:     { sport: "velo", title: "Sweet spot", z: "SS", prog: [[3, 10, 5], [3, 12, 5], [2, 20, 8]], cue: "Régulier",
              note: "Juste sous le seuil : dur mais tenable longtemps. Cadence 85 à 95 rpm, idéal sur home trainer ou une longue route plate." },
    seuilV: { sport: "velo", title: "Seuil", z: "Z4", prog: [[4, 8, 4], [3, 10, 5], [3, 12, 5]], cue: "Seuil",
              note: "L'effort maximal que tu pourrais tenir environ une heure. Régulier du début à la fin de chaque répétition." },
    force:  { sport: "velo", title: "Force en côte", z: "Z3", prog: [[5, 5, 3], [6, 5, 3], [5, 6, 3]], cue: "Gros braquet",
              note: "En côte, sur un gros braquet à 55-65 rpm, assis, buste immobile. Ça renforce aussi les jambes pour la course à pied." },
    pma:    { sport: "velo", title: "PMA", z: "Z5", prog: [[5, 3, 3], [6, 3, 3], [5, 4, 4]], cue: "Très intense",
              note: "Très intense : la dernière répétition doit être aussi forte que la première. Récupère en pédalant tout doux." },
    tempoV: { sport: "velo", title: "Tempo", z: "Z3", prog: [[2, 15, 5], [2, 20, 5], [3, 15, 5]], cue: "Soutenu",
              note: "Soutenu, respiration marquée, mais tu restes en contrôle." },
    vma:    { sport: "course", title: "VMA", z: "Z5", prog: [[8, 1, 1], [10, 1, 1], [6, 2, 2]], alt: [[5, 2, 2], [6, 2, 1.5], [4, 3, 2]], cue: "Vite", rest: "Trot",
              note: "Sur terrain plat. Termine l'échauffement par 3 ou 4 accélérations progressives. Les répétitions doivent rester régulières." },
    seuilC: { sport: "course", title: "Seuil", z: "Z4", prog: [[3, 8, 2], [3, 10, 2], [2, 15, 3]], cue: "Seuil", rest: "Trot",
              note: "Allure entre ton allure 10 km et semi-marathon : confortablement difficile." },
    tempoC: { sport: "course", title: "Tempo", z: "Z3", prog: [[1, 20, 0], [1, 25, 0], [1, 30, 0]], cue: "Tempo",
              note: "Allure marathon : soutenue mais tu pourrais dire quelques mots." },
    cotes:  { sport: "course", title: "Côtes", z: "Z5", zs: ["Z5", "Z4", "Z4"], prog: [[8, 1.5, 2], [6, 3, 2.5], [5, 4, 3]], cue: "Montée", rest: "Descente au trot",
              note: "Côte de 6 à 12 %, sur route. Monte en levant franchement les genoux et en poussant sur l'avant du pied : ça muscle le psoas et les fessiers. Récupère en redescendant au trot." },
    css:    { sport: "natation", swim: true, title: "Seuil natation", z: "Z4", prog: [[8, 100, 15], [10, 100, 15], [6, 200, 20]], cue: "Seuil",
              note: "Allure seuil (CSS) : la plus rapide que tu pourrais tenir sur 1 500 m. Vise le même temps sur chaque répétition." },
    vitN:   { sport: "natation", swim: true, title: "Vitesse natation", z: "Z5", prog: [[12, 50, 20], [16, 50, 20], [8, 100, 30]], cue: "Vite",
              note: "Rapide mais avec une nage propre : allonge la coulée et ne te crispe pas." }
  };
  var NOTES = {
    endu: { velo: "Aisance respiratoire : tu dois pouvoir parler en phrases complètes.", course: "Allure facile, tu pourrais tenir une conversation.", natation: "Nage relâchée et régulière. Les éducatifs comptent autant que les longueurs." },
    recup: { velo: "Tout petit braquet, jambes qui tournent : c'est de la récupération.", course: "Très lent. Si tu as mal aux jambes, remplace par du repos.", natation: "Très souple, idéal pour délasser les jambes après une grosse séance." },
    long: { velo: "Mange dès la première heure et bois régulièrement. Reste en endurance, même dans les bosses.", course: "Sur route, allure facile du début à la fin. Bois et mange au-delà d'1 h 15.", natation: "Nage régulière, sans t'arrêter longtemps au mur." },
    rappel: { velo: "Semaine de récupération : quelques accélérations pour garder du rythme, sans se fatiguer.", course: "Semaine de récupération : quelques lignes droites pour garder du rythme.", natation: "Semaine de récupération : quelques sprints courts pour garder du rythme." },
    longHiver: "Sortie longue d'hiver : pars en milieu de journée pour profiter de la lumière, avec éclairage, gants et coupe-vent. Mange dès la première heure. S'il fait trop mauvais, fais 1 h 30 à 2 h sur home trainer à la place.",
    trail: "Une fois par cycle, ta sortie longue se fait sur chemins : terrain plus souple, chevilles et montées sollicitées. Reste facile, marche dans les fortes pentes et descends sans forcer pour ne pas entamer la séance suivante."
  };
  var TITLES = {
    endu: { velo: "Endurance", course: "Footing", natation: "Endurance & technique" },
    recup: { velo: "Récupération active", course: "Footing récup", natation: "Natation récup" },
    long: { velo: "Sortie longue", course: "Sortie longue", natation: "Nage longue" },
    rappel: { velo: "Endurance + rappels", course: "Footing + lignes droites", natation: "Technique + sprints" }
  };

  function step(min, z, txt) { return [min, z, txt || ""]; }
  function blk(name, reps, steps) { return { name: name, reps: reps, steps: steps }; }
  function blocksMin(bl) { return sum(bl.map(function (b) { return b.reps * sum(b.steps.map(function (x) { return x[0]; })); })); }
  function metersLabel(m) { return m >= 1000 ? String(Math.floor(m / 1000)) + " " + pad3(m % 1000) + " m" : m + " m"; }
  function pad3(n) { return ("00" + n).slice(-3); }

  /* Natation : séances écrites en mètres ; la durée vient de ton allure seuil (css, secondes au 100 m). */
  function swimSession(kind, dur, wk, css) {
    css = css || 120;
    function sw(m, z, txt) { return [m * (css + SWOFF[z]) / 6000, z, txt || "", m]; }
    function rst(sec) { return [sec / 60, "R", "", 0]; }
    var K = KEYS[kind], wu = [blk("Échauffement", 1, [sw(300, "Z1", "Nages variées")]), blk("Éducatifs", 4, [sw(50, "Z1", "Éducatif"), rst(15)])];
    var cd = blk("Retour au calme", 1, [sw(200, "Z1", "Souple")]), blocks, sub;
    if (K && K.swim) {
      var p = K.prog[clamp(wk, 1, 3) - 1], reps = p[0], dist = p[1], r = p[2];
      var main = function (n) { return blk("Corps de séance", n, [sw(dist, K.z, K.cue), rst(r)]); };
      while (reps > 4 && blocksMin(wu.concat([main(reps), cd])) > dur + 3) reps--;
      blocks = wu.concat([main(reps)]);
      var extra = dur - blocksMin(blocks.concat([cd])), t200 = (200 * (css + SWOFF.Z2) / 100 + 20) / 60, nE = Math.floor(extra / t200);
      if (nE >= 1) blocks.push(blk("Aérobie", nE, [sw(200, "Z2", "Endurance"), rst(20)]));
      blocks.push(cd);
      sub = reps + " × " + dist + " m " + ZONES[K.z].short + " · récup " + r + " s";
    } else {
      var easy = kind === "recup", unit = easy || dur < 40 ? 200 : 400, z = easy ? "Z1" : "Z2", rr = easy ? 20 : 30;
      var tail = kind === "rappel" ? [blk("Sprints", 6, [sw(25, "Z5", "Vite"), rst(20)])] : [];
      var tUnit = (unit * (css + SWOFF[z]) / 100 + rr) / 60;
      var n = Math.max(1, Math.round((dur - blocksMin(wu.concat(tail, [cd]))) / tUnit));
      blocks = wu.concat([blk("Corps de séance", n, [sw(unit, z, easy ? "Souple" : "Endurance"), rst(rr)])], tail, [cd]);
      sub = n + " × " + unit + " m " + ZONES[z].short + (kind === "rappel" ? " + 6 × 25 m vite" : "");
      kind = kind === "tech" ? "endu" : kind;
    }
    var meters = sum(blocks.map(function (b) { return b.reps * sum(b.steps.map(function (x) { return x[3] || 0; })); }));
    return { sport: "natation", kind: kind, title: K ? K.title : TITLES[kind].natation, sub: sub + " · " + metersLabel(meters), key: !!K, blocks: blocks, dist: meters };
  }
  function keySession(kind, dur, wk, round, css) {
    var K = KEYS[kind]; if (K.swim) return swimSession(kind, dur, wk, css);
    var p = ((round % 2 && K.alt) ? K.alt : K.prog)[clamp(wk, 1, 3) - 1];
    var reps = p[0], work = p[1], rest = p[2], z = K.zs ? K.zs[clamp(wk, 1, 3) - 1] : K.z;
    var wu = 15, cd = 10;
    function total() { return wu + reps * (work + rest) + cd; }
    if (total() > dur + 3) { wu = 10; cd = 8; }
    while (total() > dur + 3 && reps > 2) reps--;
    var extra = dur - total(), blocks = [];
    blocks.push(blk("Échauffement", 1, [step(wu, "Z2")]));
    var main = [step(work, z, K.cue)];
    if (rest > 0) main.push(step(rest, "Z1", K.rest || "Récup"));
    blocks.push(blk("Corps de séance", reps, main));
    if (extra >= 5) blocks.push(blk("Fin en endurance", 1, [step(extra, "Z2")]));
    blocks.push(blk("Retour au calme", 1, [step(cd + (extra > 0 && extra < 5 ? extra : 0), "Z1")]));
    var sub = (reps > 1 ? reps + " × " : "") + durLabel(work) + " " + ZONES[z].short + (rest ? " · récup " + durLabel(rest) : "");
    return { sport: K.sport, kind: kind, title: K.title, sub: sub, key: true, blocks: blocks };
  }
  function easySession(kind, sport, dur, css) {
    if (sport === "natation") return swimSession(kind === "endu" || kind === "long" ? "tech" : kind, dur, 2, css);
    var blocks;
    if (kind === "recup") blocks = [blk("", 1, [step(dur, "Z1")])];
    else if (kind === "rappel") {
      var r = sport === "velo" ? [5, 1, 2] : [6, 0.34, 1], body = Math.max(10, dur - 15 - r[0] * (r[1] + r[2]));
      blocks = [blk("Endurance", 1, [step(Math.round(body * 0.6), "Z2")]),
        blk("Rappels", r[0], [step(r[1], sport === "velo" ? "Z4" : "Z5", "Accélération"), step(r[2], "Z1", "Récup")]),
        blk("Fin", 1, [step(Math.round(body * 0.4) + 15, "Z2")])];
    } else blocks = [blk("", 1, [step(dur, "Z2")])];
    var sub = kind === "recup" ? "Z1 · très facile" : kind === "rappel" ? (sport === "velo" ? "avec 5 × 1 min appuyées" : "avec 6 × 20 s vives") : "Z2 · endurance";
    return { sport: sport, kind: kind, title: TITLES[kind][sport], sub: sub, key: false, blocks: blocks };
  }
  function sessionMinutes(s) { return blocksMin(s.blocks); }
  function sessionLoad(s) {
    return Math.round(sum(s.blocks.map(function (b) { return b.reps * sum(b.steps.map(function (x) { var f = ZONES[x[1]].IF; return x[0] / 60 * f * f * 100; })); })));
  }
  function durLabel(m) {
    if (m < 1) return Math.round(m * 60) + " s";
    if (m < 60) { var mm = Math.floor(m), ss = Math.round((m - mm) * 60); return ss ? mm + " min " + pad(ss) : mm + " min"; }
    var h = Math.floor(m / 60), r = Math.round(m - h * 60);
    return h + " h" + (r ? " " + pad(r) : "");
  }
  function paceLabel(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ":" + pad(sec % 60); }

  /* Texte de séance au format Intervals.icu (converti ensuite en séance structurée pour Garmin). */
  function icuText(s, z) {
    z = z || {};
    function dur(m) {
      if (m < 1) return Math.round(m * 60) + "s";
      var mm = Math.floor(m), ss = Math.round((m - mm) * 60);
      return mm + "m" + (ss ? pad(ss) : "");
    }
    function target(zone) {
      if (s.sport === "natation") { var w = PCT.swim[zone]; return w[0] + "-" + w[1] + "% Pace"; }
      if (s.sport === "velo" && z.power) { var p = PCT.power[zone]; return p[0] + "-" + p[1] + "%"; }
      if (RUN[s.sport] && zone === "Z5" && z.pace) return "Z5 Pace";
      var h = (s.sport === "velo" ? PCT.hrRide : PCT.hrRun)[zone]; return h[0] + "-" + h[1] + "% LTHR";
    }
    function line(x) {
      if (x[1] === "R") return "- " + Math.round(x[0] * 60) + "s intensity=rest";
      var amount = x[3] ? x[3] + "mtr" : dur(x[0]);
      return "- " + (x[2] ? x[2] + " " : "") + amount + " " + target(x[1]);
    }
    var out = s.note ? [s.note, ""] : [];
    s.blocks.forEach(function (b) {
      var head = (b.name || "") + (b.reps > 1 ? (b.name ? " " : "") + b.reps + "x" : "");
      if (head) out.push(head);
      b.steps.forEach(function (x) { out.push(line(x)); });
      out.push("");
    });
    return out.join("\n").trim();
  }
  /* Cible lisible dans l'appli : zone + valeurs absolues si les seuils sont connus. */
  function targetLabel(sport, zone, z) {
    z = z || {};
    if (sport === "padel") return zone === "Z1" ? "Tranquille" : "À ton rythme";
    if (zone === "R") return "Récupération au mur";
    var lab = (sport === "natation" && SWIM_LAB[zone]) || ZONES[zone].lab, ext = [];
    if (sport === "natation") {
      if (z.css) { var w = PCT.swim[zone]; ext.push(paceLabel(z.css * 100 / w[1]) + "-" + paceLabel(z.css * 100 / w[0]) + "/100 m"); }
      return lab + (ext.length ? " · " + ext.join(" · ") : "");
    }
    if (sport === "velo" && z.ftp) { var p = PCT.power[zone]; ext.push(Math.round(z.ftp * p[0] / 100) + "-" + Math.round(z.ftp * p[1] / 100) + " W"); }
    var lt = sport === "velo" ? z.lthrRide : z.lthrRun;
    if (lt) { var h = (sport === "velo" ? PCT.hrRide : PCT.hrRun)[zone]; ext.push(Math.round(lt * h[0] / 100) + "-" + Math.round(lt * h[1] / 100) + " bpm"); }
    return lab + (ext.length ? " · " + ext.join(" · ") : "");
  }
  /* Une étape telle qu'affichée : quantité (durée ou distance) et cible. */
  function stepView(sport, x, z) {
    if (x[1] === "R") return { du: Math.round(x[0] * 60) + " s", tg: "Récupération au mur", rest: true };
    return { du: x[3] ? x[3] + " m" : durLabel(x[0]), tg: targetLabel(sport, x[1], z), rest: false };
  }

  /* ================= plan de la semaine ================= */
  var SHARES = {
    equilibre: { natation: 0.22, velo: 0.48, course: 0.3 },
    natation: { natation: 0.38, velo: 0.38, course: 0.24 },
    velo: { natation: 0.17, velo: 0.63, course: 0.2 },
    course: { natation: 0.17, velo: 0.38, course: 0.45 }
  };
  var ROT = { equilibre: ["velo", "natation", "course"], natation: ["natation", "velo", "natation", "course"], velo: ["velo", "natation", "velo", "course"], course: ["course", "velo", "course", "natation"] };
  var THEMES = {
    velo: { label: "Bloc seuil vélo", short: "Seuil vélo", goal: "Monter ta puissance au seuil : des séries longues et régulières à vélo." },
    course: { label: "Bloc vitesse course", short: "Vitesse course", goal: "Gagner en vitesse sur route : VMA, côtes et allure seuil." },
    natation: { label: "Bloc natation", short: "Natation", goal: "Nager plus vite : séries à ton allure seuil (CSS) et travail de vitesse, avec le vélo et la course en entretien." }
  };
  var FACT = [1.1, 1.18, 1.26, 0.7];

  function themeOf(ctx, wIdx) {
    var on = SPORTS.filter(function (s) { return ctx.sports[s]; });
    var rot = (ROT[ctx.prio] || ROT.equilibre).filter(function (s) { return ctx.sports[s]; });
    if (!rot.length) rot = on;
    var cycle = Math.floor(wIdx / 4);
    return { theme: rot[cycle % rot.length], round: Math.floor(cycle / rot.length), cycle: cycle };
  }
  /* ================= saison : les triathlons ont lieu l'été ================= */
  /* md = mois × 100 + jour. vol : volume relatif ; brick : course enchaînée (min) en semaines 1, 2, 3 du cycle. */
  var PHASES = [
    { k: "foncier", label: "Foncier d'hiver", short: "Foncier", from: 1101, to: 229, vol: 1, nKeys: 2, brick: [0, 10, 0],
      goal: "Construire le moteur : beaucoup d'endurance, de la technique en natation, de la force à vélo et des côtes en course. Peu d'intensité très haute." },
    { k: "developpement", label: "Développement", short: "Dév.", from: 301, to: 430, vol: 1, nKeys: 2, brick: [10, 15, 20],
      goal: "Monter en intensité : du seuil dans les trois sports, des sorties longues qui s'allongent et des enchaînements plus réguliers." },
    { k: "specifique", label: "Préparation spécifique", short: "Spécif.", from: 501, to: 615, vol: 1, nKeys: 2, brick: [15, 20, 25],
      goal: "Se rapprocher de la course : allures de course, enchaînements chaque semaine, natation en eau libre dès que l'eau le permet." },
    { k: "saison", label: "Saison des triathlons", short: "Saison", from: 616, to: 831, vol: 0.95, nKeys: 2, brick: [15, 20, 20],
      goal: "Garder la forme entre les courses : de l'intensité courte, des enchaînements, et de la récupération avant chaque course." },
    { k: "transition", label: "Transition", short: "Trans.", from: 901, to: 1031, vol: 0.85, nKeys: 1, brick: [0, 0, 0],
      goal: "Souffler après la saison : de la variété, peu de contraintes, puis une remise en route en douceur avant l'hiver." }
  ];
  function phaseOf(date) {
    var md = +date.slice(5, 7) * 100 + +date.slice(8, 10);
    for (var i = 0; i < PHASES.length; i++) { var p = PHASES[i]; if (p.from <= p.to ? md >= p.from && md <= p.to : md >= p.from || md <= p.to) return p; }
    return PHASES[0];
  }
  /* Date de fin de la phase en cours (pour l'afficher). */
  function phaseEnd(date) {
    var p = phaseOf(date), y = +date.slice(0, 4), m = Math.floor(p.to / 100), d = p.to % 100;
    if (p.to === 229) { d = new Date(y, 2, 0).getDate(); }
    var end = y + "-" + pad(m) + "-" + pad(d);
    return end < date.slice(0, 10) ? (y + 1) + "-" + pad(m) + "-" + pad(p.to === 229 ? new Date(y + 1, 2, 0).getDate() : d) : end;
  }
  /* Position dans la saison (0 = 1er novembre, 1 = 31 octobre) pour la frise. */
  function seasonPos(date) {
    var y = +date.slice(0, 4), start = (+date.slice(5, 7) >= 11 ? y : y - 1) + "-11-01";
    return clamp(daysBetween(start, date) / 365, 0, 1);
  }

  function keysFor(theme, sp, round, runBase, phase) {
    if (phase === "foncier") {
      if (theme === "velo") return [round % 2 ? "force" : "ss", sp.course ? "cotes" : "css"];
      if (theme === "course") return ["cotes", sp.velo ? "tempoV" : "tempoC"];
      return ["css", "vitN"];
    }
    if (phase === "specifique" || phase === "saison") {
      if (theme === "velo") return ["seuilV", sp.course ? "seuilC" : "css"];
      if (theme === "course") return [round % 2 ? "vma" : "seuilC", sp.velo ? "seuilV" : "tempoC"];
      return ["css", sp.velo ? "seuilV" : "vitN"];
    }
    if (theme === "velo") return [round % 2 ? "seuilV" : "ss", sp.course ? "tempoC" : sp.natation ? "css" : "pma"];
    if (theme === "course") return [round % 2 ? "cotes" : "vma", runBase >= 3 || !sp.velo ? "seuilC" : "tempoV"];
    return ["css", "vitN"];
  }

  /* ================= objectifs : courses datées ================= */
  /* dur : durée estimée (min) ; IF : intensité moyenne ; long : sorties longues maximales (min) ;
     keys / alt : séances clés de la phase spécifique (les deux s'alternent d'un cycle à l'autre) ; parts : déroulé d'un triathlon. */
  var RACE_TYPES = {
    triS:    { label: "Triathlon S (sprint)", short: "Triathlon S", group: "Triathlon", kind: "tri", dur: 80, taper: 1, IF: 0.95, long: { velo: 120, course: 75 }, brick: [10, 15, 20],
               keys: ["seuilV", "seuilC"], alt: ["pma", "vma"], parts: [["natation", "750 m", 15], ["velo", "20 km", 40], ["course", "5 km", 25]] },
    triM:    { label: "Triathlon M (olympique)", short: "Triathlon M", group: "Triathlon", kind: "tri", dur: 150, taper: 2, IF: 0.9, long: { velo: 180, course: 90 }, brick: [15, 20, 30],
               keys: ["seuilV", "seuilC"], alt: ["ss", "tempoC"], parts: [["natation", "1,5 km", 30], ["velo", "40 km", 75], ["course", "10 km", 50]] },
    triL:    { label: "Triathlon L (70.3)", short: "Triathlon L", group: "Triathlon", kind: "tri", dur: 330, taper: 2, IF: 0.8, long: { velo: 240, course: 120 }, brick: [20, 30, 40],
               keys: ["tempoV", "tempoC"], alt: ["ss", "seuilC"], parts: [["natation", "1,9 km", 40], ["velo", "90 km", 170], ["course", "21,1 km", 120]] },
    triXL:   { label: "Triathlon XL (Ironman)", short: "Ironman", group: "Triathlon", kind: "tri", dur: 720, taper: 3, IF: 0.7, long: { velo: 330, course: 150 }, brick: [30, 45, 60],
               keys: ["tempoV", "tempoC"], alt: ["ss", "tempoC"], parts: [["natation", "3,8 km", 80], ["velo", "180 km", 360], ["course", "42,2 km", 270]] },
    run10:   { label: "Course 10 km", short: "10 km", group: "Course à pied", kind: "course", dur: 50, taper: 1, IF: 1, long: { course: 80 }, keys: ["vma", "seuilC"], alt: ["seuilC", "tempoC"] },
    runSemi: { label: "Semi-marathon", short: "Semi", group: "Course à pied", kind: "course", dur: 110, taper: 2, IF: 0.92, long: { course: 110 }, keys: ["seuilC", "tempoC"], alt: ["vma", "tempoC"] },
    runMara: { label: "Marathon", short: "Marathon", group: "Course à pied", kind: "course", dur: 240, taper: 3, IF: 0.82, long: { course: 165 }, keys: ["tempoC", "seuilC"], alt: ["tempoC", "seuilC"] },
    trail:   { label: "Trail", short: "Trail", group: "Course à pied", kind: "course", trail: true, taper: 2, IF: 0.75, keys: ["cotes", "tempoC"], alt: ["cotes", "seuilC"], needKm: true },
    cyclo:   { label: "Cyclosportive", short: "Cyclo", group: "Vélo", kind: "velo", taper: 1, IF: 0.75, keys: ["seuilV", "ss"], alt: ["force", "tempoV"], needKm: true }
  };
  function raceInfo(r) {
    var T = RACE_TYPES[r.type] || RACE_TYPES.triM, km = +r.km || 0, dp = +r.dplus || 0, dur = T.dur;
    /* Estimations pour un amateur : trail au kilomètre-effort (100 m de D+ = 1 km) à 8,5 km-effort/h ;
       vélo à 27 km/h sur un équivalent plat où 100 m de D+ valent 1,2 km. */
    if (r.type === "trail") dur = Math.round((km + dp / 100) / 8.5 * 60) || 180;
    if (r.type === "cyclo") dur = Math.round((km + dp * 0.012) / 27 * 60) || 240;
    var long = T.long || (T.kind === "velo" ? { velo: clamp(round5(dur * 0.85), 120, 360) } : { course: clamp(round5(dur * 0.7), 90, 210) });
    var taper = T.taper; if (!T.dur && dur >= 300) taper = 2;
    return { T: T, dur: dur, long: long, taper: taper };
  }
  /* Où en est-on par rapport à la prochaine course principale (A) ? */
  function racePlan(ctx) {
    var list = (ctx.races || []).filter(function (r) { return r.date && r.prio !== "B" && RACE_TYPES[r.type]; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var next = list.filter(function (r) { return r.date >= ctx.ws; })[0];
    var past = list.filter(function (r) { return r.date < ctx.ws && daysBetween(r.date, ctx.ws) <= 7; }).pop();
    if (past && !(next && daysBetween(ctx.ws, next.date) < 7)) return { mode: "after", race: past };
    if (!next) return null;
    var wTo = Math.floor(daysBetween(ctx.ws, next.date) / 7);
    if (wTo > 52) return null;
    var I = raceInfo(next), n = wTo - I.taper;
    /* Objectifs principaux rapprochés : les sorties longues visent la plus exigeante des courses des 10 semaines suivantes
       (un triathlon S en juin ne bride pas la préparation d'une cyclosportive en juillet). */
    list.forEach(function (r) {
      if (r.date <= next.date || daysBetween(next.date, r.date) > 70) return;
      var L = raceInfo(r).long, m = {};
      Object.keys(I.long).forEach(function (k) { m[k] = Math.max(I.long[k], L[k] || 0); });
      I = { T: I.T, dur: I.dur, long: m, taper: I.taper };
    });
    var phase = wTo === 0 ? "raceweek" : n < 0 ? "affutage" : n < 6 ? "specifique" : n < 14 ? "developpement" : "foncier";
    return { mode: "prep", race: next, info: I, wTo: wTo, n: n, phase: phase, wk: n >= 0 ? [3, 2, 1, 4][n % 4] : 1 };
  }
  var AFTER_PH = { k: "recup", label: "Récupération après la course", short: "Récup", vol: 0.85, nKeys: 0, brick: [0, 0, 0],
    goal: "Laisse le corps récupérer : séances courtes et faciles. Ensuite, un nouveau cycle commence." };
  function racePhase(rp) {
    var T = rp.info.T, tri = T.kind === "tri";
    if (rp.phase === "affutage") return { k: "affutage", label: "Affûtage", short: "Affût.", vol: rp.wTo >= 2 ? 0.8 : 0.65, nKeys: 1, brick: tri ? [10, 10, 10] : [0, 0, 0],
      goal: "On garde un peu d'intensité mais on baisse le volume : tu arrives frais le jour J." };
    if (rp.phase === "specifique") return { k: "specifique", label: "Spécifique · " + T.short, short: "Spécif.", vol: 1, nKeys: 2, brick: T.brick || [0, 0, 0],
      goal: tri ? "Se rapprocher de la course : séances à l'allure du jour J, enchaînement vélo-course chaque semaine, sorties longues qui s'approchent de la distance." :
        T.kind === "course" ? "Séances à l'allure de course et sortie longue qui s'approche de la durée de l'épreuve." :
        "Séances au seuil et sorties longues proches de la durée de la cyclosportive, avec du dénivelé." };
    if (rp.phase === "developpement") return { k: "developpement", label: "Développement", short: "Dév.", vol: 1, nKeys: 2, brick: tri ? [10, 15, 15] : [0, 0, 0],
      goal: "Monter en intensité : du seuil, et des sorties longues qui s'allongent vers ce que demande ta course." };
    return { k: "foncier", label: "Foncier", short: "Foncier", vol: 1, nKeys: 2, brick: tri ? [0, 10, 0] : [0, 0, 0],
      goal: "Construire le moteur : endurance, technique et force. L'intensité de course viendra plus tard." };
  }
  function zoneForIF(IF) { return IF >= 0.97 ? "Z4" : IF >= 0.88 ? "SS" : IF >= 0.78 ? "Z3" : "Z2"; }
  var SPN = { natation: "Natation", velo: "Vélo", course: "Course" };
  function raceSession(r) {
    var I = raceInfo(r), T = I.T, z = zoneForIF(T.IF);
    var blocks = T.parts ? T.parts.map(function (p) { return blk(SPN[p[0]] + " · " + p[1], 1, [step(p[2], z)]); }) :
      [blk(T.label + (r.km ? " · " + r.km + " km" : "") + (r.dplus ? " · " + r.dplus + " m D+" : ""), 1, [step(I.dur, z)])];
    return { sport: T.kind === "tri" ? "tri" : T.kind, kind: "race", race: true, raceId: r.id, prio: r.prio || "A", title: r.name || T.label,
      sub: T.label + " · environ " + durLabel(I.dur), key: true, blocks: blocks, note: "", dur: I.dur, load: Math.round(I.dur / 60 * T.IF * T.IF * 100) };
  }
  function openerSession(sport) {
    var blocks = sport === "natation" ? [blk("Échauffement", 1, [[6, "Z1", "Souple", 300]]), blk("Réveil", 4, [[1, "Z4", "Allure de course", 50], [0.33, "R", "", 0]]), blk("Retour au calme", 1, [[3, "Z1", "Souple", 150]])] :
      [blk("Échauffement", 1, [step(15, "Z2")]), blk("Réveil", 4, [step(1, "Z4", "Allure de course"), step(2, "Z1", "Récup")]), blk("Retour au calme", 1, [step(5, "Z1")])];
    return { sport: sport, kind: "opener", title: "Réveil musculaire", sub: "4 accélérations à l'allure de course", key: false, blocks: blocks,
      note: "Deux jours avant la course : quelques accélérations pour arriver vif, sans te fatiguer. Prépare ton matériel en rentrant." };
  }
  /* Semaine de la course principale : courte, facile, réveil musculaire l'avant-veille, repos la veille. */
  function generateRaceWeek(ctx, rp) {
    var r = rp.race, I = rp.info, rd = clamp(daysBetween(ctx.ws, r.date), 0, 6), sp = ctx.sports;
    var hc = history(ctx.acts, ctx.ws, 28), base = Math.max(hc.hours, (ctx.fallbackHours || 5) * 0.8), budget = base * 60 * 0.35;
    var res = { ws: ctx.ws, wIdx: 0, cycle: 0, wk: 0, rec: false, theme: I.T.kind, mode: "race", race: r, wTo: 0, phase: "course", phaseLabel: "Semaine de course",
      target: Math.round(budget), base: Math.round(base * 100) / 100, runBase: Math.round(hc.run * 100) / 100, hasHist: hc.hours >= 1, sessions: [] };
    var main = I.T.kind === "tri" ? (sp.velo ? "velo" : "course") : I.T.kind;
    var order = (I.T.kind === "tri" ? ["natation", "course", "velo"] : I.T.kind === "course" ? ["course", "natation", "velo"] : ["velo", "natation", "course"]).filter(function (s) { return sp[s]; });
    var plan = [{ i: rd, it: { kind: "race" } }], used = 0, k = 0;
    var oi = [rd - 2, rd - 3, rd - 1].filter(function (i) { return i >= 0 && (ctx.avail[i] || 0) >= 20; })[0];
    if (oi != null && sp[main]) plan.push({ i: oi, it: { kind: "opener", sport: main } });
    for (var i = rd - 2; i >= 0 && used < budget && order.length; i--) {
      if ((ctx.avail[i] || 0) < 20 || i === oi || i === rd - 1) continue;
      var s = order[k++ % order.length];
      if (s === "velo" && ctx.bikeWE && i < 5) { s = order.filter(function (x) { return x !== "velo"; })[0]; if (!s) continue; }
      var dur = Math.min(ctx.avail[i], s === "velo" ? 60 : s === "natation" ? 40 : 35);
      plan.push({ i: i, it: { sport: s, kind: "endu", dur: dur } }); used += dur;
    }
    if (rd + 2 <= 6 && (ctx.avail[rd + 2] || 0) >= 20 && order.length) plan.push({ i: rd + 2, it: { sport: sp.natation ? "natation" : sp.velo ? "velo" : order[0], kind: "recup", dur: 30 } });
    plan.sort(function (a, b) { return a.i - b.i; }).forEach(function (p) {
      var s;
      if (p.it.kind === "race") s = raceSession(r);
      else if (p.it.kind === "opener") s = openerSession(p.it.sport);
      else {
        s = easySession(p.it.kind, p.it.sport, p.it.dur, ctx.css);
        s.note = p.it.kind === "recup" ? "Deux jours après la course : un peu de nage ou de vélo tout doux pour délasser." : "Semaine de course : séance courte et facile, pour garder le rythme sans fatigue.";
      }
      s.date = addDays(ctx.ws, p.i); s.slot = 0;
      if (!s.race) { s.dur = Math.round(sessionMinutes(s)); s.load = sessionLoad(s); }
      res.sessions.push(s);
    });
    res.planned = sum(res.sessions.map(function (s) { return s.dur; }));
    res.load = sum(res.sessions.map(function (s) { return s.load; }));
    return res;
  }

  /* Padel : hors triathlon. En match amateur, la FC moyenne reste modérée (50 à 70 % de la FC max, VO2 autour de 24 ml/kg/min),
     mais les démarrages et les appuis latéraux fatiguent les jambes, et les blessures les plus fréquentes sont les entorses de cheville. */
  function padelSession(dur) {
    return { sport: "padel", kind: "padel", extra: true, title: "Padel", sub: "Hors triathlon · le plan s'adapte autour", key: false,
      blocks: [blk("Échauffement", 1, [step(10, "Z1", "Chevilles, épaules, pas chassés")]), blk("Match", 1, [step(Math.max(20, dur - 10), "Z2", "Échanges intermittents")])],
      note: "Échauffe bien les chevilles et l'épaule avant de jouer : au padel, les blessures les plus fréquentes sont les entorses de cheville. Bois entre les jeux. Au-delà d'1 h 30, prends un peu de glucides (30 à 60 g par heure). Le lendemain, pas de séance clé en course à pied : le plan en tient compte." };
  }

  /* Course enchaînée juste après le vélo : le geste propre au triathlon. */
  function brickSession(wk, dur) {
    var blocks;
    if (wk <= 1 || dur <= 10) blocks = [blk("", 1, [step(dur, "Z2", "Foulée courte")])];
    else if (wk === 2) blocks = [blk("Mise en route", 1, [step(5, "Z2")]), blk("Allure soutenue", 1, [step(dur - 5, "Z3", "Tempo")])];
    else blocks = [blk("Mise en route", 1, [step(5, "Z2")]), blk("Allure soutenue", 1, [step(dur - 8, "Z3", "Tempo")]), blk("Retour au calme", 1, [step(3, "Z1")])];
    var sub = (wk <= 1 || dur <= 10 ? "Z2" : "dont " + durLabel(dur - (wk === 2 ? 5 : 8)) + " tempo") + " · juste après le vélo";
    return { sport: "course", kind: "brick", brick: true, title: "Course enchaînée", sub: sub, key: false, blocks: blocks,
      note: "Enchaîne dès que tu poses le vélo : chaussures, et c'est parti, en moins de 2 minutes. Les premières minutes, les jambes sont lourdes : c'est exactement ce que cette séance entraîne. Cherche une foulée courte et rapide." };
  }

  /* ctx : { ws, avail[7] (min), prio, sports{natation,velo,course}, acts, planStart, fallbackHours, css (s/100 m),
     doubles (2 séances le même jour), bricks (enchaînements vélo-course), trail ("non" | "peu"),
     prevCycle{base, runBase, compliance} (heures), lastWeek{plannedMin, doneMin} } */
  var SWAP = { tempoC: "tempoV", seuilC: "seuilV", vma: "pma", cotes: "force" };
  var VSWAP = { ss: "tempoC", seuilV: "seuilC", force: "cotes", pma: "vma", tempoV: "tempoC" };
  var DARK = { 10: 1, 11: 1, 12: 1, 1: 1, 2: 1 };
  /* ctx.padel : { day (0 lundi … 6 dimanche), dur (min) }. Le padel prend sa place dans le créneau du jour (le reste sert s'il reste 45 min, sans natation :
     l'épaule a déjà travaillé). Il compte comme un jour dur : pas de séance clé ce jour-là, ni la veille ou le lendemain si possible, pas de séance clé
     ni de sortie longue en course à pied le lendemain. La semaine de triathlon baisse de la moitié de sa durée (15 % au plus) pour garder la même fatigue.
     Pas de padel en blessure, en reprise, en semaine de course ni le jour ou la veille d'une course de préparation (res.padelOff). */
  function generateWeek(ctx) {
    var pdl = ctx.padel && ctx.padel.dur > 0 && ctx.padel.day >= 0 && ctx.padel.day <= 6 ? ctx.padel : null;
    if (ctx.injury && (ctx.injury.mode === "blesse" || ctx.injury.mode === "reprise")) { var ri = generateInjury(ctx); if (pdl) ri.padelOff = "injury"; return ri; }
    var rp = racePlan(ctx);
    if (rp && rp.mode === "prep" && rp.wTo === 0) { var rw = generateRaceWeek(ctx, rp); if (pdl) rw.padelOff = "race"; return rw; }
    var pdlOff = null;
    if (pdl && (ctx.races || []).some(function (r) { var k = daysBetween(addDays(ctx.ws, pdl.day), r.date); return k === 0 || k === 1; })) { pdl = null; pdlOff = "race"; }
    if (pdl) {
      var c2 = {}; Object.keys(ctx).forEach(function (k) { c2[k] = ctx[k]; });
      c2.avail = ctx.avail.slice(); var left = (c2.avail[pdl.day] || 0) - pdl.dur; c2.avail[pdl.day] = left >= 45 ? left : 0;
      ctx = c2;
    }
    function pday(d) { return !!pdl && d.i === pdl.day; }
    var sp = ctx.sports, on = SPORTS.filter(function (s) { return sp[s]; });
    var ph = phaseOf(addDays(ctx.ws, 3));
    function bikeOK(i) { return !ctx.bikeWE || i >= 5; }
    var wIdx = Math.max(0, Math.floor(daysBetween(mondayOf(ctx.planStart), ctx.ws) / 7));
    var th = themeOf(ctx, wIdx), wk = wIdx % 4 + 1, rec = wk === 4, theme = th.theme, round = th.round, cycleNo = th.cycle + 1;
    /* Préparation vers une course : les cycles sont calés à rebours depuis l'affûtage. */
    var RI = null;
    if (rp && rp.mode === "prep") {
      RI = rp.info; ph = racePhase(rp);
      wk = rp.wk; rec = rp.n >= 0 && wk === 4;
      var cyc = Math.floor(Math.max(rp.n, 0) / 4); round = Math.floor(cyc / 2); cycleNo = 0;
      theme = RI.T.kind === "tri" ? (rp.phase === "specifique" || rp.phase === "affutage" ? (cyc % 2 ? "course" : "velo") : ["velo", "course", "natation"][cyc % 3]) : RI.T.kind;
      if (!sp[theme]) theme = on[0];
    } else if (rp && rp.mode === "after") { ph = AFTER_PH; wk = 4; rec = true; }
    var cycleStart = addDays(ctx.ws, -(wk - 1) * 7);
    var hc = history(ctx.acts, cycleStart, 28), h42 = history(ctx.acts, ctx.ws, 42);
    var A = sum(ctx.avail) / 60, hasHist = hc.hours >= 1;
    var trailing = hasHist ? hc.hours : (ctx.fallbackHours || 5), trailRun = hasHist ? hc.run : trailing * 0.3;
    /* Base du cycle : +6 % si le cycle précédent a été suivi à 80 % ou plus, sinon on repart de ce qui a été fait. */
    var pc = RI ? null : ctx.prevCycle, base = trailing, runBase = trailRun;
    if (pc && pc.base > 0) {
      var ok = pc.compliance >= 0.8;
      base = ok ? Math.max(pc.base * 1.06, trailing) : Math.max(trailing, pc.base * 0.9);
      runBase = ok ? Math.max((pc.runBase || 0) * 1.06, trailRun) : Math.max(trailRun, (pc.runBase || 0) * 0.9);
    }
    base = Math.min(base, A); runBase = Math.min(runBase, base);
    var target = base * FACT[wk - 1] * ph.vol;
    /* Recalage : si la semaine passée a été nettement moins remplie que prévu, on ne saute pas une marche. */
    var lw = ctx.lastWeek, adjusted = false;
    if (!rec && lw && lw.plannedMin > 0 && lw.doneMin < lw.plannedMin * 0.8) {
      var cap = Math.max(lw.doneMin / 60 * 1.15, base * 0.9);
      if (cap < target) { target = cap; adjusted = true; }
    }
    target = Math.min(A, Math.max(target, Math.min(A, 1.5)));
    var tMin = target * 60;
    if (pdl) tMin = Math.max(60, tMin - Math.min(pdl.dur * 0.5, tMin * 0.15));

    var res = { ws: ctx.ws, wIdx: wIdx, cycle: cycleNo, wk: wk, rec: rec, theme: theme, round: round, target: Math.round(tMin), adjusted: adjusted,
      base: Math.round(base * 100) / 100, runBase: Math.round(runBase * 100) / 100, hasHist: hasHist, phase: ph.k, phaseLabel: ph.label, phaseGoal: ph.goal,
      mode: rp ? rp.mode : null, race: rp ? rp.race : null, wTo: rp && rp.mode === "prep" ? rp.wTo : null, sessions: [] };
    if (pdlOff) res.padelOff = pdlOff;
    if (!on.length || !tMin) return res;

    /* répartition du temps par sport, avec un plafond prudent pour la course à pied */
    var sh = {}, S = SHARES[RI && RI.T.kind !== "tri" ? RI.T.kind : ctx.prio] || SHARES.equilibre, tot = 0;
    on.forEach(function (s) { sh[s] = S[s] + (s === theme ? 0.08 : 0); tot += sh[s]; });
    on.forEach(function (s) { sh[s] = sh[s] / tot * tMin; });
    var runCap = Math.max(45, (Math.max(runBase, 0.75) * FACT[wk - 1] + 0.25) * 60);
    if (sp.course && !sp.velo && !sp.natation) { tMin = Math.min(tMin, runCap); res.target = Math.round(tMin); runCap = tMin; }
    if (sp.course && sh.course > runCap) {
      var spill = sh.course - runCap, others = on.filter(function (s) { return s !== "course"; }), ot = sum(others.map(function (s) { return sh[s]; })) || 1;
      others.forEach(function (s) { sh[s] += spill * sh[s] / ot; }); sh.course = runCap;
    }
    var runLeft = sp.course ? runCap : 0;

    /* créneaux : en semaine légère on supprime d'abord les plus courts */
    var days = [];
    for (var i = 0; i < 7; i++) if ((ctx.avail[i] || 0) >= 20) days.push({ i: i, max: ctx.avail[i], items: [] });
    function kf() { return tMin / sum(days.map(function (d) { return d.max; })); }
    while ((kf() < 0.4 && days.length > 4 && ph.k !== "affutage") || days.length > 6) {
      var small = days.slice().sort(function (a, b) { return a.max - b.max || a.i - b.i; })[0];
      days.splice(days.indexOf(small), 1);
    }
    var kk = Math.min(1, kf());
    days.forEach(function (d) { d.dur = clamp(round5(d.max * kk), Math.min(30, d.max), d.max); });
    function dayTotal(d) { return sum(d.items.map(function (x) { return x.dur; })); }
    function isHard(x) { return !!KEYS[x.kind] || x.kind === "long"; }
    function hardOn(i) { return (!!pdl && i === pdl.day) || days.some(function (d) { return d.i === i && d.items.some(isHard); }); }
    function afterPadel(d) { return !!pdl && d.i === pdl.day + 1; }
    function runOn(i) { return days.some(function (d) { return d.i === i && d.items.some(function (x) { return RUN[x.sport] && x.kind !== "brick"; }); }); }

    /* sorties longues : elles passent en premier sur les plus grands créneaux, le reste du temps se répartit ensuite */
    var byLen = days.slice().sort(function (a, b) { return (pday(a) - pday(b)) || b.max - a.max || b.i - a.i; });
    var longRideDay = null, longRunDay = null;
    var maxLongRun = h42.longRun >= 30 ? clamp(h42.longRun * 1.1, 60, 210) : 75;
    var maxLongRide = h42.longRide >= 45 ? clamp(h42.longRide * 1.15, 90, 360) : 150;
    if (rec) { maxLongRun *= 0.75; maxLongRide *= 0.75; }
    if (ph.k === "foncier") maxLongRide = Math.min(maxLongRide, 180);
    if (RI) { if (RI.long.velo) maxLongRide = Math.min(maxLongRide, RI.long.velo); if (RI.long.course) maxLongRun = Math.min(maxLongRun, RI.long.course); }
    if (ph.k === "affutage") { maxLongRide *= 0.65; maxLongRun *= 0.65; }
    var rideC = byLen.filter(function (d) { return bikeOK(d.i) && d.max >= 90; });
    if (sp.velo && rideC.length && days.length >= 2) longRideDay = rideC[0];
    var cand = byLen.filter(function (d) { return d !== longRideDay && d.max >= 60 && !pday(d); }).sort(function (a, b) { return afterPadel(a) - afterPadel(b); });
    if (sp.course && cand.length && days.length >= 3) longRunDay = cand[0];
    if (longRideDay) longRideDay.items.push({ sport: "velo", kind: "long", dur: Math.max(60, Math.min(longRideDay.max, round5(maxLongRide), round5(Math.max(90, tMin * 0.4)))) });
    /* Enchaînement vélo-course après la sortie longue, en semaine de charge : il passe avant la sortie longue en course. */
    if (!rec && longRideDay && sp.course && ctx.bricks !== false) {
      var bd = Math.min(ph.brick[wk - 1], Math.max(10, Math.floor(runLeft * 0.25 / 5) * 5));
      if (bd && runLeft >= 50) {
        var ride = longRideDay.items[0]; ride.dur = Math.min(ride.dur, longRideDay.max - bd);
        longRideDay.items.push({ sport: "course", kind: "brick", dur: bd }); runLeft -= bd;
      }
    }
    if (longRunDay) {
      var lr = { sport: "course", kind: "long", dur: Math.max(45, Math.min(longRunDay.max, round5(maxLongRun), round5(runLeft * (runCap >= 150 ? 0.55 : 0.45)), round5(Math.max(60, tMin * 0.3)))) };
      /* Un peu de trail : une sortie longue sur chemins par cycle (2e semaine), le reste sur route. */
      if (RI && RI.T.trail) lr.trail = ph.k !== "foncier" || wk === 2;
      else if (ctx.trail === "peu" && wk === 2 && ph.k !== "specifique" && ph.k !== "saison" && ph.k !== "affutage") lr.trail = true;
      longRunDay.items.push(lr); runLeft -= lr.dur;
    }
    var restDays = days.filter(function (d) { return !d.items.length; }), restMax = sum(restDays.map(function (d) { return d.max; }));
    var remT = tMin - sum(days.map(dayTotal)), k2 = restMax ? clamp(remT / restMax, 0, 1) : 0;
    restDays.forEach(function (d) { d.dur = clamp(round5(d.max * k2), Math.min(30, d.max), d.max); });
    /* Semaine légère : on libère les plus petits créneaux plutôt que de faire des séances de 30 minutes partout. */
    while (restDays.length > 2 && k2 < 0.5 && ph.k !== "affutage") {
      /* Le jour du padel part en premier : il est déjà occupé. */
      var sm = restDays.slice().sort(function (a, b) { return (pday(b) - pday(a)) || a.max - b.max || a.i - b.i; })[0];
      restDays.splice(restDays.indexOf(sm), 1); days.splice(days.indexOf(sm), 1);
      restMax = sum(restDays.map(function (d) { return d.max; })); k2 = restMax ? clamp(remT / restMax, 0, 1) : 0;
      restDays.forEach(function (d) { d.dur = clamp(round5(d.max * k2), Math.min(30, d.max), d.max); });
    }
    /* séances clés : jamais deux jours durs d'affilée */
    var nKeys = rec ? 0 : Math.min(ph.nKeys, days.length >= 4 ? 2 : days.length >= 2 ? 1 : 0);
    var keyKinds = (RI && (ph.k === "specifique" || ph.k === "affutage") ? (round % 2 ? RI.T.alt : RI.T.keys) : keysFor(theme, sp, round, runBase, ph.k)).filter(function (k) { return sp[KEYS[k].sport] || (SWAP[k] && sp.velo); }).slice(0, nKeys);
    var free = days.filter(function (d) { return !d.items.length && d.max >= 40 && !pday(d); });
    function slotScore(d) {
      var s = -Math.abs(d.dur - 75) / 10;
      if (hardOn(d.i - 1) || hardOn(d.i + 1)) s -= 6;
      if (hardOn(d.i + 1)) s -= 4;
      return s;
    }
    var picks = [];
    if (keyKinds.length === 2 && free.length >= 2) {
      var best = null;
      for (var a = 0; a < free.length; a++) for (var b = a + 1; b < free.length; b++) {
        var gap = free[b].i - free[a].i, sc = slotScore(free[a]) + slotScore(free[b]) + Math.min(gap, 3) * 3 - (gap === 1 ? 40 : 0);
        if (!best || sc > best.sc) best = { sc: sc, p: [free[a], free[b]] };
      }
      picks = best.p;
      /* Deux créneaux collés seulement : une seule séance clé plutôt que deux jours durs d'affilée. */
      if (picks[1].i - picks[0].i === 1) { picks = [slotScore(picks[0]) >= slotScore(picks[1]) ? picks[0] : picks[1]]; keyKinds = keyKinds.slice(0, 1); }
    } else if (keyKinds.length && free.length) {
      picks = [free.slice().sort(function (a, b) { return slotScore(b) - slotScore(a); })[0]];
      keyKinds = keyKinds.slice(0, 1);
    } else keyKinds = [];
    picks.forEach(function (d, j) {
      var kind = keyKinds[j];
      /* Vélo seulement le week-end : la séance clé de vélo d'un jour de semaine passe en natation ou en course. */
      if (KEYS[kind].sport === "velo" && !bikeOK(d.i)) kind = sp.natation ? (keyKinds.indexOf("css") < 0 ? "css" : "vitN") : sp.course ? (VSWAP[kind] || "tempoC") : kind;
      if (RUN[KEYS[kind].sport] && (runLeft < 35 || !sp.course || afterPadel(d)) && sp.velo && bikeOK(d.i)) kind = SWAP[kind] || kind;
      /* Pas deux fois la même séance clé dans la semaine. */
      if (j > 0 && picks[0].items.some(function (x) { return x.kind === kind; })) kind = ({ seuilV: "tempoV", ss: "tempoV", tempoV: "ss", force: "ss", pma: "ss", seuilC: "tempoC", tempoC: "seuilC", vma: "tempoC", cotes: "tempoC", css: "vitN", vitN: "css" })[kind] || kind;
      var it = { sport: KEYS[kind].sport, kind: kind, dur: Math.min(d.max, Math.max(d.dur, 45)) };
      if (RUN[it.sport]) { it.dur = Math.min(it.dur, 80, Math.max(35, round5(runLeft))); runLeft -= it.dur; }
      if (it.sport === "natation") it.dur = Math.min(d.dur, 75);
      d.items.push(it);
    });

    /* autres créneaux : au moins 2 séances par sport, puis on comble le temps manquant de chaque sport */
    var used = {}, count = {}, minN = {};
    on.forEach(function (s) { used[s] = 0; count[s] = 0; minN[s] = (rec && s !== "natation") || (s === "velo" && ctx.bikeWE) ? 1 : 2; });
    function tally(it) { used[it.sport] += it.dur; if (it.kind !== "brick") count[it.sport]++; }
    days.forEach(function (d) { d.items.forEach(tally); });
    days.filter(function (d) { return !d.items.length; }).forEach(function (d) {
      var bestS = null, bestV = -Infinity;
      on.forEach(function (s) {
        if (RUN[s] && runLeft < 30 && on.length > 1) return;
        if (s === "velo" && !bikeOK(d.i)) return;
        /* Jour de padel : seulement du vélo facile en plus (les jambes et l'épaule ont déjà travaillé). */
        if (pday(d) && s !== "velo") return;
        var v = sh[s] - used[s];
        if (count[s] < minN[s]) v += 90;
        if (RUN[s] && (runOn(d.i - 1) || runOn(d.i + 1))) v -= 45;
        if (RUN[s] && d.dur > 75) v -= 15;
        if (s === "natation" && d.dur > 90) v -= 30;
        if (v > bestV) { bestV = v; bestS = s; }
      });
      if (!bestS && pday(d)) return;
      var s = bestS || on[0], it = { sport: s, kind: (hardOn(d.i - 1) && d.dur <= 60 && s !== "natation") ? "recup" : "endu", dur: d.dur };
      if (pday(d)) it.dur = Math.min(it.dur, 60);
      if (RUN[s]) { it.dur = Math.min(it.dur, theme === "course" ? 70 : 60); if (on.length > 1) it.dur = Math.min(it.dur, Math.max(30, round5(runLeft))); runLeft -= it.dur; }
      if (s === "natation") it.dur = Math.min(it.dur, rec ? 50 : 60);
      if (it.kind === "recup") it.dur = Math.min(it.dur, s === "velo" ? 60 : s === "natation" ? 45 : 40);
      d.items.push(it); tally(it);
    });
    /* 2 séances le même jour (si tu l'acceptes) pour garder 2 séances de chaque sport.
       S'il manque de la place, on raccourcit un peu la séance principale de ce jour-là. */
    function minDur(x) { return KEYS[x.kind] ? 45 : x.kind === "long" ? (x.sport === "velo" ? 90 : 60) : x.kind === "brick" ? x.dur : x.sport === "natation" ? x.dur : 30; }
    function shrinkable(d) { return sum(d.items.map(function (x) { return Math.max(0, x.dur - minDur(x)); })); }
    if (ctx.doubles) on.forEach(function (s) {
      for (var guard = 0; guard < 3 && count[s] < minN[s]; guard++) {
        if (RUN[s] && runLeft < 30) break;
        var need = 30;
        var c = days.filter(function (d) {
          if (!d.items.length || d.items.some(function (x) { return x.sport === s || x.second; })) return false;
          if (s === "velo" && !bikeOK(d.i)) return false;
          if (pday(d)) return false;
          if (d.max - dayTotal(d) + shrinkable(d) < need) return false;
          if (RUN[s] && (runOn(d.i - 1) || runOn(d.i + 1) || d.items.some(isHard))) return false;
          return true;
        }).map(function (d) {
          var sc = d.max - dayTotal(d) + shrinkable(d);
          if (d.items.some(function (x) { return x.kind === "long" && x.sport === "course"; })) sc -= 40;
          if (d.items.some(function (x) { return x.kind === "brick"; })) sc -= 60;
          return { d: d, sc: sc };
        }).sort(function (x, y) { return y.sc - x.sc; });
        if (!c.length) break;
        var d = c[0].d, room = d.max - dayTotal(d), cap = s === "natation" ? 45 : RUN[s] ? Math.min(40, runLeft) : 60;
        var dur = Math.floor(Math.min(cap, room + shrinkable(d)) / 5) * 5, cut = dur - room;
        d.items.forEach(function (x) { if (cut <= 0) return; var c2 = Math.min(cut, x.dur - minDur(x)); if (c2 > 0) { x.dur -= c2; used[x.sport] -= c2; cut -= c2; } });
        var it = { sport: s, kind: "endu", second: true, dur: dur };
        if (s === "natation") d.items.unshift(it); else d.items.push(it);
        tally(it); if (RUN[s]) runLeft -= it.dur;
      }
    });
    /* Deux natations faciles dans la semaine : la 2e devient technique + vitesse, pour varier. */
    var easySwims = [];
    days.forEach(function (d) { d.items.forEach(function (x) { if (x.sport === "natation" && x.kind === "endu") easySwims.push(x); }); });
    if (!rec && easySwims.length >= 2) { easySwims[1].kind = "rappel"; easySwims[1].vary = true; }
    if (rec && days.length >= 3) {
      var mids = [];
      days.forEach(function (d) { d.items.forEach(function (x) { if (x.kind === "endu" && !x.second) mids.push({ d: d, x: x }); }); });
      mids.sort(function (a, b) { return Math.abs(a.d.i - 2.5) - Math.abs(b.d.i - 2.5); });
      if (mids[0]) mids[0].x.kind = "rappel";
    }
    /* il manque du temps (course plafonnée) : on rallonge le vélo d'endurance */
    var missing = tMin - sum(days.map(dayTotal));
    if (missing > 20 && sp.velo) days.forEach(function (d) {
      if (pday(d)) return;
      d.items.forEach(function (x) {
        if (x.sport !== "velo" || (x.kind !== "endu" && x.kind !== "long") || missing <= 20) return;
        var lim = x.kind === "long" ? Math.max(x.dur, round5(maxLongRide)) : d.max;
        var add = round5(Math.min(lim - x.dur, d.max - dayTotal(d), missing)); if (add >= 10) { x.dur += add; missing -= add; }
      });
    });

    /* Courses de préparation (B) : la veille facile, le lendemain récupération. */
    (ctx.races || []).forEach(function (r) {
      if (r.prio !== "B" || !r.date || !RACE_TYPES[r.type]) return;
      var di = daysBetween(ctx.ws, r.date); if (di < 0 || di > 6) return;
      var d = days.filter(function (x) { return x.i === di; })[0];
      if (!d) { d = { i: di, max: 0, items: [] }; days.push(d); }
      d.items = [{ kind: "race", race: r }];
      days.forEach(function (x) {
        if (x.i === di - 1) x.items = x.items.filter(function (it) { return it.kind !== "brick" && it.kind !== "race"; }).slice(0, 1).map(function (it) { return { sport: it.sport, kind: "endu", dur: Math.min(it.dur, 40) }; });
        if (x.i === di + 1) x.items = x.items.filter(function (it) { return it.kind !== "race"; }).slice(0, 1).map(function (it) { return { sport: it.sport === "course" ? (sp.natation ? "natation" : "velo") : it.sport, kind: "recup", dur: Math.min(it.dur, 40) }; });
      });
    });

    /* construction des séances */
    days.sort(function (a, b) { return a.i - b.i; }).forEach(function (d) {
      d.items.forEach(function (it, j) {
        var s;
        if (it.kind === "brick") s = brickSession(wk, it.dur);
        else if (it.kind === "race") s = raceSession(it.race);
        else if (KEYS[it.kind]) s = keySession(it.kind, it.dur, ph.k === "affutage" ? 1 : wk, round, ctx.css);
        else s = easySession(it.kind === "long" ? "endu" : it.kind, it.sport, it.dur, ctx.css);
        if (it.kind === "long") { s.kind = "long"; s.long = true; s.title = TITLES.long[it.sport]; s.sub = "Z2 · endurance"; }
        if (it.kind !== "brick" && it.kind !== "race") s.note = KEYS[it.kind] ? KEYS[it.kind].note || "" : NOTES[s.kind === "long" ? "long" : s.kind][s.sport];
        if (it.trail) { s.trail = true; s.title = "Sortie longue trail"; s.sub = "Z2 · sur chemins"; s.note = NOTES.trail; }
        if (it.second) s.second = true;
        if (it.vary) s.note = "Technique d'abord, puis 6 sprints de 25 m pour garder de la vitesse sans te fatiguer.";
        /* Hiver : il fait nuit tôt en semaine. */
        var month = +addDays(ctx.ws, d.i).slice(5, 7), weekday = d.i < 5;
        if (DARK[month] && weekday && s.sport === "velo" && !s.race) { s.indoor = true; s.sub += " · home trainer"; s.note = (s.note ? s.note + " " : "") + "En semaine, fais-la sur home trainer : il fait nuit tôt."; }
        if (DARK[month] && weekday && s.sport === "course" && !s.race) s.note = (s.note ? s.note + " " : "") + "Il fait nuit tôt : frontale, gilet réfléchissant et parcours éclairé.";
        if (ph.k === "foncier" && s.sport === "velo" && s.long) s.note = NOTES.longHiver;
        s.date = addDays(ctx.ws, d.i); s.slot = j;
        if (!s.race) { s.dur = Math.round(sessionMinutes(s)); s.load = sessionLoad(s); }
        res.sessions.push(s);
      });
    });
    res.planned = sum(res.sessions.map(function (s) { return s.dur; }));
    if (pdl) {
      var ps = padelSession(pdl.dur); ps.date = addDays(ctx.ws, pdl.day); ps.slot = 9; ps.dur = Math.round(sessionMinutes(ps)); ps.load = sessionLoad(ps);
      res.sessions.push(ps); res.padel = true;
      res.sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.slot - b.slot; });
    }
    res.load = sum(res.sessions.map(function (s) { return s.load; }));
    return res;
  }
  /* ================= blessure & reprise ================= */
  var REPRISE_WEEKS = 6;
  var RFACT = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  /* Course de reprise, semaine par semaine : [durée de chaque sortie (min)]. La 1re sortie porte les côtes. */
  var RRUNS = [[25, 25], [30, 30], [40, 35], [40, 40], [45, 40, 50], [50, 45, 60]];
  var PSOAS = "Après la séance, 10 min de renfo : 2 × 12 montées de genou debout, 2 × 10 fentes marchées par jambe, 3 × 30 s de gainage.";
  function repriseHills(rw, dur) {
    var blocks, sub;
    if (rw <= 2) {
      var n = rw === 1 ? 4 : 6, body = Math.max(10, round5(dur - n * 1.5 - 5));
      blocks = [blk("Footing", 1, [step(body, "Z2", "Très facile")]), blk("Côte douce", n, [step(1 / 3, "Z3", "Genoux hauts"), step(7 / 6, "Z1", "Descente en marchant")]), blk("Retour au calme", 1, [step(5, "Z1", "Marche")])];
      sub = "facile + " + n + " × 20 s en côte douce";
    } else {
      var p = rw <= 4 ? [6, 40, 80] : [8, 60, 90];
      blocks = [blk("Échauffement", 1, [step(15, "Z2", "Sur le plat")]), blk("Côtes", p[0], [step(p[1] / 60, "Z4", "Genoux hauts"), step(p[2] / 60, "Z1", "Descente en marchant")]), blk("Retour au calme", 1, [step(10, "Z1")])];
      var extra = dur - sessionMinutes({ blocks: blocks });
      if (extra >= 5) blocks.splice(2, 0, blk("Endurance", 1, [step(round5(extra), "Z2")]));
      sub = p[0] + " × " + p[1] + " s en côte · descente en marchant";
    }
    return { sport: "course", kind: "reprise", title: rw <= 2 ? "Footing de reprise" : "Côtes de reprise", sub: sub, key: false, blocks: blocks,
      note: "Sur route, dans une côte de 5 à 8 %. Monte en levant franchement les genoux et en poussant sur l'avant du pied, buste droit : ça muscle le psoas et remonte le cardio, avec moins de chocs que le plat rapide. Redescends en marchant. Si la douleur revient, arrête la séance. " + PSOAS };
  }
  /* ctx.injury : { mode: "blesse" | "reprise", sports (blessé : sports encore possibles), rsports (reprise : sports repris), start (lundi de reprise) } */
  function generateInjury(ctx) {
    var inj = ctx.injury, sp = {};
    SPORTS.forEach(function (s) { sp[s] = !!(ctx.sports[s] && (inj.mode === "blesse" ? (inj.sports || {})[s] : !(inj.rsports && inj.rsports[s] === false))); });
    var on = SPORTS.filter(function (s) { return sp[s]; });
    var rw = inj.mode === "reprise" ? clamp(Math.floor(daysBetween(mondayOf(inj.start || ctx.ws), ctx.ws) / 7) + 1, 1, REPRISE_WEEKS) : 0;
    var hc = history(ctx.acts, ctx.ws, 28), A = sum(ctx.avail) / 60;
    var base = Math.max(hc.hours, (ctx.fallbackHours || 5) * 0.8);
    var target = Math.min(A, base * (inj.mode === "blesse" ? 0.7 : RFACT[rw - 1])), tMin = Math.max(Math.min(A, 1.5), target) * 60;
    var res = { ws: ctx.ws, wIdx: 0, cycle: 0, wk: rw || 1, rec: false, theme: inj.mode, mode: inj.mode, rw: rw, rweeks: REPRISE_WEEKS, target: Math.round(tMin),
      base: Math.round(base * 100) / 100, runBase: Math.round(hc.run * 100) / 100, hasHist: hc.hours >= 1, phase: phaseOf(addDays(ctx.ws, 3)).k, sessions: [] };
    if (!on.length) return res;
    function bikeOK(i) { return !ctx.bikeWE || i >= 5; }
    var days = [];
    for (var i = 0; i < 7; i++) if ((ctx.avail[i] || 0) >= 20) days.push({ i: i, max: ctx.avail[i], items: [] });
    function kf() { return tMin / sum(days.map(function (d) { return d.max; })); }
    /* Plutôt des séances courtes et fréquentes que longues : on garde au moins 4 jours, chacun d'au moins 30 min. */
    var keepN = Math.min(days.length, on.length > 1 ? 4 : 3);
    while (kf() < 0.6 && days.length > keepN) { var small = days.slice().sort(function (a, b) { return a.max - b.max || a.i - b.i; })[0]; days.splice(days.indexOf(small), 1); }
    var kk = Math.min(1, kf());
    days.forEach(function (d) { d.dur = clamp(round5(d.max * kk), Math.min(30, d.max), d.max); });

    /* course : séances fixées par la semaine de reprise, jamais deux jours de suite */
    var runs = !sp.course ? [] : inj.mode === "reprise" ? RRUNS[rw - 1].slice() : [30, 30];
    var runDays = [];
    runs.forEach(function (dur, j) {
      var c = days.filter(function (d) { return !d.items.length && d.max >= Math.min(dur, 25) && !runDays.some(function (r) { return Math.abs(r - d.i) <= 1; }); })
        .sort(function (a, b) { return (j === runs.length - 1 && runs.length === 3 ? b.max - a.max : Math.abs(a.max - dur) - Math.abs(b.max - dur)) || a.i - b.i; });
      if (!c.length) return;
      var d = c[0]; runDays.push(d.i);
      d.items.push({ sport: "course", kind: inj.mode === "reprise" && j === 0 ? "rhills" : "endu", dur: Math.min(dur, d.max), longR: runs.length === 3 && j === 2 });
    });
    /* natation et vélo en endurance ; à partir de la 3e semaine de reprise, une séance plus soutenue */
    var others = on.filter(function (s) { return s !== "course"; }), used = { natation: 0, velo: 0 }, count = { natation: 0, velo: 0 };
    var share = { natation: 0.4, velo: 0.6 };
    days.filter(function (d) { return !d.items.length; }).sort(function (a, b) { return b.dur - a.dur; }).forEach(function (d) {
      var best = null, bv = -Infinity;
      others.forEach(function (s) {
        if (s === "velo" && !bikeOK(d.i)) return;
        var v = share[s] * tMin - used[s] + (count[s] < 2 ? 60 : 0) - (s === "natation" && d.dur > 90 ? 40 : 0);
        if (v > bv) { bv = v; best = s; }
      });
      if (!best) return;
      var dur = best === "natation" ? Math.min(d.max, Math.max(30, Math.min(d.dur, 60))) : Math.min(d.dur, 60 + rw * 15 + (inj.mode === "blesse" ? 30 : 0));
      d.items.push({ sport: best, kind: "endu", dur: dur }); used[best] += dur; count[best]++;
    });
    if (inj.mode === "reprise" && rw >= 3) {
      var q = null;
      days.forEach(function (d) { d.items.forEach(function (x) { if (!q && x.kind === "endu" && x.sport !== "course" && x.dur >= 40 && !runDays.some(function (r) { return Math.abs(r - d.i) <= 1 && r !== d.i; })) q = x; }); });
      if (q) q.kind = q.sport === "natation" ? "css" : "ss";
    }
    days.sort(function (a, b) { return a.i - b.i; }).forEach(function (d) {
      d.items.forEach(function (it, j) {
        var s;
        if (it.kind === "rhills") s = repriseHills(rw, it.dur);
        else if (KEYS[it.kind]) { s = keySession(it.kind, it.dur, 1, 0, ctx.css); s.key = false; s.sub += " · modéré"; }
        else s = easySession("endu", it.sport, it.dur, ctx.css);
        if (it.sport === "course" && it.kind === "endu") {
          s.title = it.longR ? "Footing long de reprise" : "Footing de reprise";
          s.note = "Sur route plate, à une allure où tu peux parler. Si la douleur revient, marche et rentre." + (inj.mode === "reprise" && rw >= 3 ? "" : " Alterne 4 min de course et 1 min de marche si besoin.");
        }
        if (inj.mode === "blesse") s.note = (s.note ? s.note + " " : "") + "Période de blessure : reste en endurance facile et arrête si ça tire.";
        var month = +addDays(ctx.ws, d.i).slice(5, 7);
        if (DARK[month] && d.i < 5 && s.sport === "velo") { s.indoor = true; s.sub += " · home trainer"; }
        if (DARK[month] && d.i < 5 && s.sport === "course") s.note += " Il fait nuit tôt : frontale, gilet réfléchissant et parcours éclairé.";
        s.reprise = true; s.date = addDays(ctx.ws, d.i); s.slot = j; s.dur = Math.round(sessionMinutes(s)); s.load = sessionLoad(s);
        res.sessions.push(s);
      });
    });
    res.planned = sum(res.sessions.map(function (s) { return s.dur; }));
    res.load = sum(res.sessions.map(function (s) { return s.load; }));
    return res;
  }

  /* Version allégée d'une séance (fatigue) : endurance facile, 20 à 40 % plus courte. */
  function lighten(s, level, css) {
    var dur = round5(s.dur * (level === "fatigue" ? 0.6 : 0.8));
    var e = easySession(level === "fatigue" ? "recup" : "endu", s.sport, Math.max(30, dur), css);
    e.date = s.date; e.dur = Math.round(sessionMinutes(e)); e.load = sessionLoad(e); e.light = true;
    e.note = "Séance allégée : ta récupération n'était pas complète ce matin.";
    return e;
  }

  /* ================= récupération (données Garmin via Intervals) ================= */
  function stats(arr) { if (!arr.length) return null; var m = sum(arr) / arr.length; return { m: m, sd: Math.sqrt(sum(arr.map(function (x) { return (x - m) * (x - m); })) / arr.length) }; }
  function readiness(wellness, date) {
    var w = wellness[date]; if (!w) return null;
    var hrvs = [], rhrs = [];
    for (var k = 1; k <= 28; k++) { var x = wellness[addDays(date, -k)]; if (!x) continue; if (x.hrv > 0) hrvs.push(x.hrv); if (x.rhr > 0) rhrs.push(x.rhr); }
    var flags = [], H = stats(hrvs), R = stats(rhrs);
    if (w.hrv > 0 && H && hrvs.length >= 7 && w.hrv < H.m - Math.max(H.sd, H.m * 0.07)) flags.push("VFC basse (" + Math.round(w.hrv) + " ms, habituel " + Math.round(H.m) + ")");
    if (w.rhr > 0 && R && rhrs.length >= 7 && w.rhr >= R.m + 4) flags.push("FC de repos haute (" + Math.round(w.rhr) + ", habituel " + Math.round(R.m) + ")");
    if (w.sleep > 0 && w.sleep < 6 * 3600) flags.push("Nuit courte (" + Math.floor(w.sleep / 3600) + " h " + pad(Math.round(w.sleep % 3600 / 60)) + ")");
    if (!(w.hrv > 0 || w.rhr > 0 || w.sleep > 0)) return null;
    return { status: flags.length >= 2 ? "fatigue" : flags.length ? "vigilance" : "ok", flags: flags, hrv: w.hrv, hrvBase: H && H.m, rhr: w.rhr, rhrBase: R && R.m, sleep: w.sleep };
  }

  /* ================= nutrition ================= */
  var PAL = { assis: 1.3, debout: 1.45, actif: 1.6 };
  function bmr(p, w) { return 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5); }
  /* Dépense nette d'une séance (kcal) et d'où vient le chiffre. s : activité réelle (dur en min, kcal Garmin, kJ et watts moyens
     du capteur de puissance, km, D+) ou séance prévue (dur, charge). Priorité aux mesures :
     1. vélo avec capteur de puissance : travail mesuré (kJ) × 0,95 (rendement d'environ 24 %, moins le métabolisme de repos) ;
     2. calories Garmin × 0,9 (on retire le métabolisme de repos, déjà compté dans la journée) ;
     3. ton propre ratio, tiré de tes sorties mesurées (rates, voir kcalRates) ;
     4. sinon une estimation : watts, km-effort en course (100 m de D+ = 1 km), MET. */
  function kcalInfo(s, w, z, rates) {
    z = z || {};
    var h = (s.dur || 0) / 60, IF = h ? Math.sqrt((s.load || h * 46) / h / 100) : 0.68;
    if (s.sport === "velo" && s.pm && (s.kj > 0 || s.avgW > 0)) return { kcal: (s.kj > 0 ? s.kj : s.avgW * h * 3.6) * 0.95, src: "power" };
    if (s.kcal > 0) return { kcal: s.kcal * 0.9, src: "garmin" };
    var r = rates && rates[s.sport];
    if (r && h > 0 && s.load > 0) return { kcal: r * h * IF, src: "perso" };
    var k;
    if (s.sport === "velo") { var watts = s.avgW || s.watts || IF * (z.ftp || 2.6 * w); k = watts * h * 3.6 * 0.95; }
    else if (s.sport === "course") { var km = s.km > 0 ? s.km + (s.dplus || 0) / 100 : 10 * IF / 0.68 * h; k = 0.95 * w * km; }
    else if (s.sport === "natation") k = 7 * w * h * IF / 0.68;
    else if (s.sport === "tri") k = 9 * w * h;
    /* Padel : VO2 moyen autour de 24 ml/kg/min en match amateur, soit environ 6,9 MET, moins 1 MET de repos. */
    else if (s.sport === "padel") k = 5.9 * w * h;
    else k = 6 * w * h;
    return { kcal: k, src: "estim" };
  }
  function sessionKcal(s, w, z, rates) { return kcalInfo(s, w, z, rates).kcal; }
  /* Ton ratio par sport, d'après tes sorties mesurées des 90 derniers jours (capteur de puissance ou calories Garmin) :
     kcal par heure, ramenées à l'intensité (kcal / (h × IF)). Médiane, à partir de 3 sorties, bornée à 5-20 kcal/kg/h.
     Sert à estimer les séances prévues avec tes vrais chiffres. acts : activités brutes (dur en secondes). */
  function kcalRates(acts, w, before) {
    var from = addDays(before, -90), by = {}, out = {};
    (acts || []).forEach(function (a) {
      if (a.date < from || a.date >= before || !(a.dur > 600) || !(a.load > 0) || a.sport === "autre") return;
      var it = { sport: a.sport, dur: a.dur / 60, kcal: a.kcal, kj: a.kj, avgW: a.avgW, pm: a.pm }, m = kcalInfo(it, w);
      if (m.src !== "power" && m.src !== "garmin") return;
      var h = a.dur / 3600, IF = Math.sqrt(a.load / h / 100);
      if (IF < 0.4 || IF > 1.2) return;
      (by[a.sport] = by[a.sport] || []).push(m.kcal / (h * IF));
    });
    Object.keys(by).forEach(function (k) {
      var v = by[k].sort(function (a, b) { return a - b; }); if (v.length < 3) return;
      var med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
      out[k] = clamp(med, 5 * w, 20 * w);
    });
    return out;
  }
  var DAYTYPE = {
    repos: { label: "Repos", c: 4 }, recup: { label: "Récupération", c: 4.5 }, endu: { label: "Endurance", c: 5 },
    cle: { label: "Séance clé", c: 6 }, long: { label: "Sortie longue", c: 7.5 }, xlong: { label: "Très longue sortie", c: 9 },
    charge: { label: "Recharge en glucides", c: 9 }
  };
  function dayType(items) {
    if (!items.length) return "repos";
    var tot = sum(items.map(function (s) { return s.dur || 0; })), mx = Math.max.apply(null, items.map(function (s) { return s.dur || 0; }));
    if (mx >= 210) return "xlong";
    if (items.some(function (s) { return s.long; }) || mx >= 140) return "long";
    if (items.some(function (s) { return s.key; }) || tot >= 100) return "cle";
    if (tot >= 50) return "endu";
    return "recup";
  }
  /* Glucides pendant l'effort, au-delà d'1 h 15. */
  /* avoid : ce que tu ne veux pas emporter ({ iso, gel, barre, banane, dattes }). */
  function ravito(s, avoid) {
    if (!s || (s.dur || 0) < 90 || s.sport === "natation") return null;
    avoid = avoid || {};
    var h = s.dur / 60, run = RUN[s.sport];
    /* Padel : 30 à 60 g/h recommandés pendant le jeu ; on reste dans le bas de la fourchette. */
    var gph = s.sport === "padel" ? (h < 2 ? 30 : 45) : run ? (h < 2 ? 30 : h < 3 ? 45 : 60) : (h < 2 ? 40 : h < 3 ? 60 : 75);
    var need = Math.round(gph * h / 5) * 5, items = { iso: 0, gel: 0, barre: 0, banane: 0, dattes: 0 };
    var C = { iso: 30, gel: 25, barre: 20, banane: 25, dattes: 22 };
    items.iso = avoid.iso ? 0 : s.sport === "course" ? Math.floor(h / 1.5) : Math.max(1, Math.round(h));
    var got = items.iso * C.iso;
    var order = (s.sport === "velo" ? ["barre", "banane", "barre", "gel", "dattes"] : s.sport === "padel" ? ["banane", "barre", "dattes"] : ["gel", "dattes", "gel", "barre", "banane"]).filter(function (k) { return !avoid[k]; });
    if (!order.length) order = ["gel", "barre", "banane", "dattes"].filter(function (k) { return !avoid[k]; });
    if (!order.length) order = ["barre"];
    for (var j = 0; got < need - 8 && j < 40; j++) { var it = order[j % order.length]; items[it]++; got += C[it]; }
    return { sport: s.sport, gph: gph, carbs: got, need: need, items: items, water: run ? "400-600 ml" : "500-750 ml",
      salt: h >= 2 ? "Au-delà de 2 h, ajoute une pincée de sel par bidon (ou une boisson salée)." : "" };
  }
  /* Besoins du jour. items : séances du jour (prévues ou réalisées). */
  /* opt.load : veille ou avant-veille d'une course de plus d'1 h 30 (recharge en glucides). */
  function dayNeeds(p, w, items, z, avoid, opt) {
    var b = bmr(p, w), base = b * (PAL[p.activity] || PAL.assis);
    var ki = items.map(function (s) { return kcalInfo(s, w, z, opt && opt.rates); }), ex = sum(ki.map(function (k) { return k.kcal; }));
    var srcs = {}; ki.forEach(function (k) { srcs[k.src] = true; });
    var t = opt && opt.load ? "charge" : dayType(items), C = DAYTYPE[t].c * w, P = 1.7 * w;
    var kcal = base + ex;
    if (p.goal === "affutage" && (t === "repos" || t === "recup" || t === "endu")) kcal -= 300;
    var F = (kcal - 4 * C - 4 * P) / 9;
    if (F < 0.8 * w) { F = 0.8 * w; kcal = 4 * C + 4 * P + 9 * F; }
    if (F > kcal * 0.3 / 9) { F = kcal * 0.3 / 9; C = (kcal - 4 * P - 9 * F) / 4; }
    var rv = items.map(function (s) { return ravito(s, avoid); }).filter(Boolean), rc = sum(rv.map(function (r) { return r.carbs; }));
    return { type: t, label: items.some(function (s) { return s.race; }) ? "Jour de course" : DAYTYPE[t].label, gkg: DAYTYPE[t].c, kcal: Math.round(kcal / 10) * 10, C: Math.round(C), P: Math.round(P), F: Math.round(F),
      bmr: Math.round(b), base: Math.round(base), ex: Math.round(ex), exSrc: Object.keys(srcs), ravito: rv, ravitoC: rc, mealC: Math.round(Math.max(C - rc, 2.5 * w)) };
  }
  /* Ce que tu as noté (repas pris ailleurs, extras) : total en kcal, glucides, protéines, lipides, et grammes d'alcool (A).
     Une saisie sans macros est répartie comme un repas mixte (50 % des kcal en glucides, 20 % en protéines, 30 % en lipides). */
  function logTotals(list) {
    var t = { K: 0, C: 0, P: 0, F: 0, A: 0 };
    (list || []).forEach(function (e) {
      var k = +e.k || 0, has = e.c != null || e.p != null || e.f != null;
      t.K += k; t.A += +e.alc || 0;
      t.C += has ? +e.c || 0 : k * 0.5 / 4; t.P += has ? +e.p || 0 : k * 0.2 / 4; t.F += has ? +e.f || 0 : k * 0.3 / 9;
    });
    return t;
  }
  /* Part de la journée qui reste pour tes recettes. day : objectifs des repas { K, C, P, F } ; logged : déjà noté ;
     shareR : part des moments avec une recette ; shareE : part des moments sans rien de prévu (ils gardent leur part). */
  function mealTargets(day, logged, shareR, shareE) {
    var f = shareR + shareE > 0 ? shareR / (shareR + shareE) : 0, out = {};
    ["K", "C", "P", "F"].forEach(function (x) { out[x] = Math.max(0, day[x] - (logged[x] || 0)) * f; });
    return out;
  }
  /* Ajuste les grammes des recettes du jour : féculents selon les glucides, protéines selon les protéines, matières grasses pour le reste. */
  function scaleFactors(ingLists, target, FOOD) {
    var M = { c: [0, 0, 0], p: [0, 0, 0], f: [0, 0, 0], v: [0, 0, 0] };
    ingLists.forEach(function (ing) { ing.forEach(function (x) { var f = FOOD[x[0]]; if (!f) return; var r = M[f.r || "v"]; r[0] += f.n[1] * x[1] / 100; r[1] += f.n[2] * x[1] / 100; r[2] += f.n[3] * x[1] / 100; }); });
    var k = { c: 1, p: 1, f: 1 };
    for (var it = 0; it < 5; it++) {
      if (M.p[0] > 0) k.p = clamp((target.P - k.c * M.c[0] - k.f * M.f[0] - M.v[0]) / M.p[0], 0.6, 2);
      if (M.c[1] > 0) k.c = clamp((target.C - k.p * M.p[1] - k.f * M.f[1] - M.v[1]) / M.c[1], 0.45, 3.2);
      if (M.f[2] > 0) k.f = clamp((target.F - k.c * M.c[2] - k.p * M.p[2] - M.v[2]) / M.f[2], 0.4, 2.2);
    }
    /* Grosse journée : si les matières grasses plafonnent, les féculents comblent les calories manquantes. */
    if (target.K && M.c[1] > 0) {
      var got = 0; ["c", "p", "f", "v"].forEach(function (r) { var f = r === "v" ? 1 : k[r]; got += f * (4 * M[r][0] + 4 * M[r][1] + 9 * M[r][2]); });
      if (target.K - got > 100) k.c = clamp(k.c + (target.K - got) / 4 / M.c[1], 0.45, 3.5);
    }
    return k;
  }
  function factorFor(key, k, FOOD) { var f = FOOD[key]; return f && f.r && k[f.r] != null ? k[f.r] : 1; }

  root.RC_ENGINE = {
    iso: iso, parseISO: parseISO, addDays: addDays, mondayOf: mondayOf, daysBetween: daysBetween, clamp: clamp, sum: sum, pad: pad,
    SPORTS: SPORTS, RUN: RUN, sportOf: sportOf, ZONES: ZONES, THEMES: THEMES, FACT: FACT, DAYTYPE: DAYTYPE, KEYS: KEYS,
    loadsByDay: loadsByDay, fitnessSeries: fitnessSeries, formZone: formZone, history: history,
    generateWeek: generateWeek, brickSession: brickSession, padelSession: padelSession, PHASES: PHASES, phaseOf: phaseOf, RACE_TYPES: RACE_TYPES, raceInfo: raceInfo, racePlan: racePlan, raceSession: raceSession, phaseEnd: phaseEnd, seasonPos: seasonPos, REPRISE_WEEKS: REPRISE_WEEKS, themeOf: themeOf, lighten: lighten, sessionMinutes: sessionMinutes, sessionLoad: sessionLoad,
    icuText: icuText, targetLabel: targetLabel, stepView: stepView, paceLabel: paceLabel, durLabel: durLabel, readiness: readiness,
    bmr: bmr, sessionKcal: sessionKcal, kcalInfo: kcalInfo, kcalRates: kcalRates, dayType: dayType, ravito: ravito, dayNeeds: dayNeeds, logTotals: logTotals, mealTargets: mealTargets, scaleFactors: scaleFactors, factorFor: factorFor
  };
})(typeof window !== "undefined" ? window : globalThis);
