/* Triple — application (tout est stocké sur ton téléphone). */
(function () {
  "use strict";
  var D = window.RC_DATA, E = window.RC_ENGINE;
  var APP_VERSION = "0.13.0", STORE_KEY = "remcox.state.v1", ICU = "https://intervals.icu/api/v1";
  var SPORT = { natation: "Natation", velo: "Vélo", course: "Course", tri: "Triathlon", padel: "Padel", autre: "Autre" };
  var DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  var DAYS_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  /* ================= utilitaires ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var iso = E.iso, parseISO = E.parseISO, addDays = E.addDays, mondayOf = E.mondayOf, daysBetween = E.daysBetween, sum = E.sum, pad = E.pad;
  function today() { return iso(new Date()); }
  function dow(d) { return (parseISO(d).getDay() + 6) % 7; }
  function short(s) { var p = s.split("-"); return p[2] + "/" + p[1]; }
  function dShort(s) { return parseISO(s).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); }
  function longDate(s) { return parseISO(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
  function fmt(n, d) { if (n == null || isNaN(n)) return "—"; return n.toFixed(d == null ? 1 : d).replace(".", ","); }
  function euro(n) { return fmt(n, 2) + " €"; }
  function parseNum(v) { if (v == null) return null; v = String(v).trim().replace(",", "."); if (!v) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }
  function sign(n, d) { return (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d); }
  function fmtM(m) { m = Math.round(m); return m >= 1000 ? Math.floor(m / 1000) + "\u202f" + ("00" + (m % 1000)).slice(-3) + " m" : m + " m"; }
  function distLabel(a) { return a.dist ? " · " + (a.sport === "natation" ? fmtM(a.dist) : fmt(a.dist / 1000, 1) + " km") : ""; }
  function hm(min) { min = Math.round(min); if (min < 60) return min + " min"; var h = Math.floor(min / 60), r = min % 60; return h + " h" + (r ? " " + pad(r) : ""); }
  function hmBig(min) { min = Math.round(min); var h = Math.floor(min / 60), r = min % 60; return h ? h + '<small>h' + (r ? pad(r) : '') + '</small>' : min + '<small>min</small>'; }
  function ago(isoStr) {
    if (!isoStr) return "jamais"; var m = Math.round((Date.now() - new Date(isoStr).getTime()) / 60000);
    if (m < 2) return "à l'instant"; if (m < 60) return "il y a " + m + " min"; var h = Math.round(m / 60); if (h < 24) return "il y a " + h + " h";
    var d = Math.round(h / 24); return "il y a " + d + " jour" + (d > 1 ? "s" : "");
  }
  var toastTimer = null;
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600); }
  /* Couleurs des graphiques (mêmes valeurs que dans styles.css). */
  var C = { acc: "#4ECDC4", ink: "#F7FFF7", muted: "#A3B1AE", faint: "#707C7E", line: "#444C56", line2: "#56606B", bg: "#292F36",
    natation: "#3D8BDB", velo: "#D35FA8", course: "#D9772E", warn: "#F4C152", bad: "#FF7B72" };
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#292F36" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>';

  /* ================= état ================= */
  function defaults() {
    return {
      v: 2, profile: null,
      train: { sports: { natation: true, velo: true, course: true }, prio: "equilibre", avail: [45, 75, 60, 75, 0, 180, 120], planStart: null, bikeTarget: "auto",
        bricks: true, trail: "non", doubles: false, bikeWE: false, padel: {},
        injury: { mode: "none", sports: { natation: true, velo: true, course: false }, rsports: { natation: true, velo: true, course: true }, start: null, until: null },
        /* Repos et vacances : [{ id, kind: "repos" | "vacances", from, to, sports }] */
        periods: [] },
      races: [],
      prefs: { food: {}, recipes: {} },
      settings: { store: "lidl", mealHours: [10, 14, 18], lastExport: null, autoPush: true, airfryer: "" },
      icu: { key: "", lastSync: null, lastPush: null, error: null, stubs: 0, name: "" },
      zones: null, acts: {}, wellness: {}, plans: {}, weights: {}, day: {}, mealPlan: {}, shop: {}, prices: {}, demo: false,
      /* Ordre et blocs masqués de l'accueil et du plan : { accueil: { order: [ids], hidden: { id: true } } } */
      ui: { layout: {} }
    };
  }
  var S = load();
  /* Complète un état ancien ou importé : champs manquants, migrations. */
  function normalize(s) {
    var base = defaults();
    Object.keys(base).forEach(function (k) { if (s[k] == null && k !== "profile" && k !== "zones") s[k] = base[k]; });
    ["train", "settings", "icu", "prefs", "ui"].forEach(function (g) { if (!s[g] || typeof s[g] !== "object") s[g] = base[g]; Object.keys(base[g]).forEach(function (k) { if (s[g][k] == null) s[g][k] = base[g][k]; }); });
    /* Avant la version triathlon : une séance par jour, identifiée par la date seule. */
    if (!s.v || s.v < 2) { s.plans = {}; s.v = 2; }
    /* Première version : le trail est remplacé par la natation. */
    if ("trail" in s.train.sports) {
      delete s.train.sports.trail; s.train.sports.natation = true; s.plans = {};
      Object.keys(s.acts).forEach(function (k) { if (s.acts[k].sport === "trail") s.acts[k].sport = "course"; });
      if (s.demo) s.reloadDemo = true;
    }
    if (s.train.prio === "trail") s.train.prio = "equilibre";
    /* Padel : sorties importées avant que l'appli le reconnaisse (et ancien réglage « paddle »). */
    if (s.train.paddle) { if (!s.train.padel || !Object.keys(s.train.padel).length) s.train.padel = s.train.paddle; delete s.train.paddle; }
    if (!s.train.padel) s.train.padel = {};
    if (!Array.isArray(s.train.periods)) s.train.periods = [];
    Object.keys(s.acts).forEach(function (k) { var a = s.acts[k]; if ((a.sport === "autre" || a.sport === "paddle") && a.type) a.sport = E.sportOf(a.type); });
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(STORE_KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) {}
    return defaults();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast("Stockage plein : exporte une sauvegarde."); } }
  function pruneOld() {
    var lim = addDays(today(), -400), limD = addDays(today(), -60), ws = mondayOf(today());
    Object.keys(S.acts).forEach(function (k) { if (S.acts[k].date < lim) delete S.acts[k]; });
    Object.keys(S.wellness).forEach(function (k) { if (k < lim) delete S.wellness[k]; });
    Object.keys(S.day).forEach(function (k) { if (k < limD) delete S.day[k]; });
    Object.keys(S.plans).forEach(function (k) { if (k < addDays(ws, -7 * 20)) delete S.plans[k]; });
    Object.keys(S.shop).forEach(function (k) { if (k < addDays(ws, -14)) delete S.shop[k]; });
    Object.keys(S.train.padel || {}).forEach(function (k) { if (k < addDays(ws, -7 * 20)) delete S.train.padel[k]; });
    S.train.periods = S.train.periods.filter(function (p) { return p.to >= addDays(ws, -7 * 20); });
    var mk = Object.keys(S.mealPlan).sort(); mk.slice(0, Math.max(0, mk.length - 8)).forEach(function (k) { delete S.mealPlan[k]; });
  }

  /* ================= données dérivées ================= */
  var _acts = null;
  function actList() { if (!_acts) _acts = Object.keys(S.acts).map(function (k) { return S.acts[k]; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); return _acts; }
  function dirty() { _acts = null; _rates = null; }
  function actsOn(d) { return actList().filter(function (a) { return a.date === d; }); }
  function zones() { return S.zones || {}; }
  function weight() {
    var ks = Object.keys(S.weights).sort();
    if (ks.length && daysBetween(ks[ks.length - 1], today()) <= 30) return S.weights[ks[ks.length - 1]];
    var ws = Object.keys(S.wellness).filter(function (k) { return S.wellness[k].weight > 0; }).sort();
    if (ws.length && daysBetween(ws[ws.length - 1], today()) <= 30) return S.wellness[ws[ws.length - 1]].weight;
    if (ks.length) return S.weights[ks[ks.length - 1]];
    return S.profile && S.profile.weight || 70;
  }
  function connected() { return !!S.icu.key; }
  function hasData() { return actList().length > 0; }
  function zoneOpts() { var z = zones(), bt = S.train.bikeTarget; return { power: bt === "power" || (bt === "auto" && !!z.ftp), pace: !!z.pace, css: z.css }; }

  /* ================= plan ================= */
  /* Identifiant des séances dans Intervals.icu : garde l'ancien préfixe pour retrouver les séances déjà envoyées. */
  function eidOf(s) { return "remcox-" + s.date + "-" + s.sport + (s.brick ? "-enchaine" : ""); }
  /* Le padel est en plus : il ne compte ni dans le prévu ni dans le suivi du plan (régularité, progression). */
  /* Les séances d'entretien des vacances sont facultatives : elles ne comptent pas non plus. */
  function plannedMin(p) { return sum(p.sessions.filter(function (s) { return !s.skip && !s.extra && !s.period; }).map(function (s) { return s.dur; })); }
  function doneMinWeek(ws) {
    var end = addDays(ws, 7);
    return sum(actList().filter(function (a) { return a.date >= ws && a.date < end && a.sport !== "autre" && a.sport !== "padel"; }).map(function (a) { return a.dur / 60; }));
  }
  function prevCycleInfo(ws) {
    var wIdx = Math.floor(daysBetween(mondayOf(S.train.planStart), ws) / 7); if (wIdx < 4) return null;
    var cs = addDays(ws, -7 * (wIdx % 4 + 4)), p0 = S.plans[cs]; if (!p0) return null;
    var pl = 0, dn = 0;
    for (var i = 0; i < 4; i++) { var w = addDays(cs, 7 * i), p = S.plans[w]; if (!p) continue; pl += plannedMin(p); dn += doneMinWeek(w); }
    return { base: p0.base, runBase: p0.runBase, compliance: pl ? dn / pl : 1 };
  }
  /* Après une semaine de pause (5 jours ou plus), on compare à la semaine prévue au départ : la reprise repart un peu plus bas. */
  function lastWeekInfo(ws) {
    var p = S.plans[addDays(ws, -7)]; if (!p) return null;
    var pause = (p.offDays || 0) >= 5, pm = plannedMin(p) + (pause ? sum((p.paused || []).filter(function (s) { return !s.extra; }).map(function (s) { return s.dur; })) : 0);
    return { plannedMin: pm, doneMin: doneMinWeek(addDays(ws, -7)), pause: pause };
  }
  function buildPlan(ws) {
    var p = E.generateWeek({ ws: ws, avail: S.train.avail, prio: S.train.prio, sports: S.train.sports, acts: actList(),
      planStart: S.train.planStart || mondayOf(today()), fallbackHours: (S.profile && S.profile.curHours) || 5, css: zones().css || 120,
      doubles: !!S.train.doubles, bricks: S.train.bricks !== false, trail: S.train.trail || "non", bikeWE: !!S.train.bikeWE, injury: injuryFor(ws), races: S.races,
      padel: (S.train.padel || {})[ws] || null, periods: S.train.periods,
      prevCycle: prevCycleInfo(ws), lastWeek: lastWeekInfo(ws) });
    p.gen = today(); p.sessions.concat(p.paused || []).forEach(function (s) { s.eid = eidOf(s); });
    return p;
  }
  /* Blessure ou reprise pour une semaine donnée ; la reprise dure E.REPRISE_WEEKS semaines puis le plan normal reprend. */
  function injuryFor(ws) {
    var inj = S.train.injury;
    if (!inj || inj.mode === "none") return null;
    /* Blessé avec une date de reprise : la reprise démarre toute seule le lundi de cette semaine-là. */
    var start = inj.mode === "reprise" ? inj.start : inj.until ? mondayOf(inj.until) : null;
    if (inj.mode === "blesse" && (!start || ws < start)) return inj;
    if (start && daysBetween(mondayOf(start), ws) >= 7 * E.REPRISE_WEEKS) return null;
    return { mode: "reprise", start: start || ws, rsports: inj.rsports || null };
  }
  function repriseEnd() {
    var inj = S.train.injury, start = inj.mode === "reprise" ? inj.start : inj.mode === "blesse" && inj.until ? mondayOf(inj.until) : null;
    return start ? addDays(mondayOf(start), 7 * E.REPRISE_WEEKS) : null;
  }
  function setInjury(mode) {
    var inj = S.train.injury, ws = mondayOf(today());
    /* Déjà en reprise : on garde la semaine de départ (changer les sports ne relance pas la reprise). */
    if (mode === "reprise" && (inj.mode !== "reprise" || !inj.start)) { inj.start = ws; S.train.planStart = addDays(ws, 7 * E.REPRISE_WEEKS); }
    inj.mode = mode;
    if (mode === "none") S.train.planStart = ws;
    regenerate(ws); if (S.plans[addDays(ws, 7)]) regenerate(addDays(ws, 7));
    previews = {}; save(); render(); autoPush(ws);
  }
  function ensurePlans() {
    if (!S.profile) return false;
    var t = today(), ws = mondayOf(t), ch = false;
    if (!S.train.planStart) { S.train.planStart = ws; ch = true; }
    var inj = S.train.injury;
    if (inj && inj.mode === "blesse" && inj.until && mondayOf(inj.until) <= ws) { inj.mode = "reprise"; inj.start = mondayOf(inj.until); S.train.planStart = addDays(inj.start, 7 * E.REPRISE_WEEKS); ch = true; }
    if (inj && inj.mode === "reprise" && !injuryFor(ws)) { inj.mode = "none"; ch = true; }
    if (!S.plans[ws]) {
      var np = buildPlan(ws);
      /* Premier plan ouvert en cours de semaine : il commence aujourd'hui, les jours passés restent ce que tu as fait. */
      if (t > ws) { np.sessions = np.sessions.filter(function (s) { return s.date >= t; }); if (np.paused) np.paused = np.paused.filter(function (s) { return s.date >= t; }); np.partial = true; }
      S.plans[ws] = np; ch = true;
    }
    var nx = addDays(ws, 7);
    if (dow(t) >= 5 && !S.plans[nx]) { S.plans[nx] = buildPlan(nx); ch = true; }
    if (ch) save();
    return ch;
  }
  /* Repos et vacances : appliqués aux plans déjà enregistrés sans les recalculer (le reste de la semaine ne bouge pas). */
  function applyPeriodsAll() {
    var t = today(), ws0 = mondayOf(t), o = { today: t, css: zones().css || 120, sports: S.train.sports }, ch = [];
    Object.keys(S.plans).forEach(function (w) {
      if (w < addDays(ws0, -7)) return;
      var p = S.plans[w], drop = E.applyPeriods(p, S.train.periods, o);
      p.sessions.forEach(function (s) { if (!s.eid) s.eid = eidOf(s); });
      if (drop.length) p.orphans = (p.orphans || []).concat(drop);
      if (w >= ws0) ch.push(w);
    });
    previews = {}; save(); render(); ch.forEach(autoPush);
  }
  function periodsIn(ws) { var e = addDays(ws, 6); return S.train.periods.filter(function (p) { return p.from <= e && p.to >= ws; }).sort(function (a, b) { return a.from < b.from ? -1 : 1; }); }
  var previews = {};
  function weekPlan(ws) {
    if (S.plans[ws]) return S.plans[ws];
    if (!S.profile || ws < mondayOf(today())) return null;
    if (!previews[ws]) { previews[ws] = buildPlan(ws); previews[ws].preview = true; }
    return previews[ws];
  }
  /* Recalcule une semaine en gardant les jours passés ; les séances supprimées seront retirées d'Intervals. */
  function regenerate(ws) {
    var old = S.plans[ws], np = buildPlan(ws), t = today();
    if (old) {
      /* On garde le passé, et la séance du jour si tu l'as déjà allégée, sautée ou faite. */
      var keep = old.sessions.filter(function (s) { return s.date < t || (s.date === t && (s.light || s.skip || status(s, old) === "done")); });
      np.sessions = keep.concat(np.sessions.filter(function (s) { return s.date > t || (s.date === t && !keep.some(function (k) { return k.eid === s.eid; })); }));
      np.sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.slot || 0) - (b.slot || 0); });
      np.gen = old.gen; np.pushedAt = old.pushedAt;
      var orphans = (old.orphans || []).slice();
      old.sessions.forEach(function (s) {
        if (s.date < t || !s.icuId) return;
        var n = np.sessions.filter(function (x) { return x.eid === s.eid; })[0];
        if (n) n.icuId = s.icuId; else orphans.push(s.icuId);
      });
      np.orphans = orphans;
      np.base = old.base; np.runBase = old.runBase;
      /* Séances mises de côté (repos, vacances) : celles d'avant aujourd'hui viennent de l'ancien plan. */
      var pz = (old.paused || []).filter(function (s) { return s.date < t; }).concat((np.paused || []).filter(function (s) { return s.date >= t && !keep.some(function (k) { return k.eid === s.eid; }); }));
      if (pz.length) np.paused = pz; else delete np.paused;
    }
    S.plans[ws] = np; previews = {};
    return np;
  }
  function sessionsOn(d) { var p = weekPlan(mondayOf(d)); return p ? p.sessions.filter(function (s) { return s.date === d; }) : []; }
  function matches(s) { return actsOn(s.date).filter(function (a) { return s.sport === "tri" ? a.sport !== "autre" && a.sport !== "padel" : a.sport === s.sport || (E.RUN[a.sport] && E.RUN[s.sport]); }); }
  function status(s, p) {
    var m = matches(s), done = sum(m.map(function (a) { return a.dur / 60; })), t = today();
    if (done >= s.dur * 0.5) return "done";
    if (s.skip) return "skip";
    if (s.date < t) return (p && p.gen && s.date < p.gen) ? "before" : "miss";
    return s.date === t ? "today" : "todo";
  }
  function extrasOn(d) {
    var ss = sessionsOn(d);
    return actsOn(d).filter(function (a) { return !ss.some(function (s) { return a.sport === s.sport || (E.RUN[a.sport] && E.RUN[s.sport]); }); });
  }
  function plannedLoads() {
    var m = {}, t = today();
    [mondayOf(t), addDays(mondayOf(t), 7), addDays(mondayOf(t), 14)].forEach(function (ws) {
      var p = weekPlan(ws); if (!p) return;
      p.sessions.forEach(function (s) { if (s.date > t && !s.skip) m[s.date] = (m[s.date] || 0) + s.load; });
    });
    return m;
  }
  function fitness(from, to) { return E.fitnessSeries(actList(), S.wellness, from, to, today(), plannedLoads()); }

  /* ================= nutrition ================= */
  function actItem(a) {
    var h = a.dur / 3600;
    return { sport: a.sport, dur: a.dur / 60, load: a.load, kcal: a.kcal, km: a.sport === "natation" ? 0 : a.dist / 1000, dplus: a.dplus, watts: a.watts, kj: a.kj || 0, avgW: a.avgW || 0, pm: !!a.pm,
      long: a.dur >= 140 * 60, key: h > 0 && a.load / h >= 62 };
  }
  function dayItems(d) {
    var done = actsOn(d).filter(function (a) { return a.sport !== "autre" || a.dur > 1200; }).map(actItem);
    if (d < today()) return done;
    var rest = sessionsOn(d).filter(function (s) { return !s.skip && status(s) !== "done"; });
    return done.concat(rest);
  }
  function needsFor(d) {
    if (!S.profile) return null;
    /* Les 2 jours avant une course de plus d'1 h 30 : recharge en glucides. */
    var load = S.races.some(function (r) { var k = daysBetween(d, r.date); return (k === 1 || k === 2) && E.raceInfo(r).dur >= 90; });
    return E.dayNeeds(S.profile, weight(), dayItems(d), zones(), ravitoAvoid(), { load: load, rates: rates() });
  }
  /* Tes ratios de dépense par sport, tirés de tes sorties Garmin : ils servent à estimer les séances prévues. */
  var _rates = null;
  function rates() { if (!_rates) _rates = E.kcalRates(actList(), weight(), today()); return _rates; }
  function ravitoAvoid() { var b = function (k) { return S.prefs.food[k] === -1; }; return { iso: b("sucre"), gel: b("gel"), barre: b("barre"), banane: b("banane"), dattes: b("dattes") }; }

  var MK = D.MOMENTS.map(function (m) { return m.k; });
  var SHARE = { pd: 0.25, midi: 0.3, coll: 0.15, soir: 0.3 };
  /* ---- recettes adaptées à tes goûts ---- */
  var BASE = {}, RBY = {}, HIDDEN = {};
  ["pd", "plat", "coll"].forEach(function (g) { D.RECIPES[g].forEach(function (r, i) { r.grp = g; r.ord = i; BASE[r.id] = r; }); });
  function disliked(k) { return S.prefs.food[k] === -1; }
  function liked(k) { return S.prefs.food[k] === 1; }
  function wordRe(w) { return new RegExp("(^|[^a-zà-ÿœ])(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![a-zà-ÿœ])", "i"); }
  function inName(name, k) { return (D.WORD[k] || []).some(function (w) { return wordRe(w).test(name); }); }
  function rename(name, from, to) {
    var tw = (D.WORD[to] || [D.FOOD[to].fr.toLowerCase()])[0], done = false;
    (D.WORD[from] || []).forEach(function (w) {
      if (done) return;
      var re = wordRe(w);
      if (re.test(name)) { name = name.replace(re, function (m0, pre, word) { return pre + (word[0] === word[0].toUpperCase() ? tw[0].toUpperCase() + tw.slice(1) : tw); }); done = true; }
    });
    return name;
  }
  /* Même rôle : mêmes protéines, mêmes glucides ou mêmes calories. Rôles différents ou légumes : même poids. */
  function convert(from, to, g) {
    var F = D.FOOD[from], T = D.FOOD[to], k = 1;
    if (F.r === T.r && F.r === "p") k = F.n[1] / T.n[1];
    else if (F.r === T.r && F.r === "c") k = F.n[2] / T.n[2];
    else if (F.r === T.r && F.r === "f") k = F.n[0] / T.n[0];
    return Math.max(5, Math.round(g * E.clamp(k, 0.5, 5) / 5) * 5);
  }
  function autoLabel(k, g) {
    var f = D.FOOD[k];
    if (PIECES[k] && f.piece) { var n = g / f.piece; return k === "yaourt" ? Math.max(1, Math.round(n)) + " pot" + (n >= 1.5 ? "s" : "") : n < 0.75 ? "½" : String(Math.round(n * 2) / 2).replace(".5", " ½"); }
    if (f.liquid) return Math.round(g / 10) * 10 + " ml";
    return Math.round(g / 5) * 5 + " g" + (f.raw ? " cru" : "");
  }
  function adapt(r) {
    if (S.prefs.recipes[r.id] === -1) return { id: r.id, name: r.name, hidden: true, why: "Tu as masqué cette recette", byRecipe: true };
    var name = r.name, ing = [], subs = [], drops = [];
    for (var i = 0; i < r.ing.length; i++) {
      var x = r.ing[i];
      if (!disliked(x[0])) { ing.push(x.slice()); continue; }
      var fr = D.FOOD[x[0]].fr.toLowerCase();
      if ((r.core || []).indexOf(x[0]) >= 0) return { id: r.id, name: r.name, hidden: true, why: "Contient " + fr + ", au cœur de la recette" };
      var alt = (D.ALT[x[0]] || []).filter(function (k) { return !disliked(k); })[0];
      if (alt) {
        var g = convert(x[0], alt, x[1]), same = ing.filter(function (y) { return y[0] === alt; })[0];
        if (same) { same[1] += g; same[2] = autoLabel(alt, same[1]); } else ing.push([alt, g, autoLabel(alt, g)]);
        subs.push([x[0], alt]); name = rename(name, x[0], alt);
      } else if (inName(name, x[0])) return { id: r.id, name: r.name, hidden: true, why: "Contient " + fr };
      else drops.push(x[0]);
    }
    var score = (S.prefs.recipes[r.id] === 1 ? 100 : 0) + ing.filter(function (x) { return liked(x[0]); }).length * 10 - subs.length * 2 - drops.length * 2;
    /* Air fryer : un aliment remplacé suit son remplaçant (s'il se cuit au CRISPi), un aliment retiré disparaît. */
    var af = (r.af || []).map(function (k) {
      if (typeof k !== "string") return k;
      var sb = subs.filter(function (x) { return x[0] === k; })[0];
      if (sb) return D.AIRFRY[sb[1]] ? sb[1] : null;
      return drops.indexOf(k) >= 0 ? null : k;
    }).filter(function (k, i, a) { return k && a.indexOf(k) === i; });
    return { id: r.id, name: name, ing: ing, steps: r.steps, batch: r.batch, tag: r.tag, grp: r.grp, ord: r.ord, subs: subs, drops: drops, af: af,
      adapted: subs.length + drops.length > 0, fav: S.prefs.recipes[r.id] === 1, score: score };
  }
  function rebuildRecipes() {
    RBY = {}; HIDDEN = {};
    Object.keys(BASE).forEach(function (id) { var a = adapt(BASE[id]); if (a.hidden) HIDDEN[id] = a; else RBY[id] = a; });
  }
  function grpOf(m) { return m === "pd" ? "pd" : m === "coll" ? "coll" : "plat"; }
  function pool(m) {
    var g = grpOf(m);
    return Object.keys(RBY).map(function (id) { return RBY[id]; }).filter(function (r) { return r.grp === g; })
      .sort(function (a, b) { return b.score - a.score || a.ord - b.ord; });
  }
  function hiddenIn(m) { var g = grpOf(m); return Object.keys(HIDDEN).filter(function (id) { return BASE[id].grp === g; }).map(function (id) { return HIDDEN[id]; }); }
  function adaptNote(r) {
    var parts = r.subs.map(function (x) { return D.FOOD[x[0]].fr.toLowerCase() + " → " + D.FOOD[x[1]].fr.toLowerCase() + (D.COOK[x[1]] ? " (" + D.COOK[x[1]] + ")" : ""); });
    if (r.drops.length) parts.push("sans " + r.drops.map(function (k) { return D.FOOD[k].fr.toLowerCase(); }).join(", "));
    return parts.join(" · ");
  }
  /* Planning par défaut : tes recettes les mieux classées, 4 + 3 portions par moment. */
  function defaultMeals() {
    var out = {}, takenPlat = {};
    MK.forEach(function (m) {
      var list = pool(m).filter(function (r) { return !takenPlat[r.id]; }).slice(0, 2), o = {};
      if (list[0]) o[list[0].id] = list[1] ? 4 : 7;
      if (list[1]) o[list[1].id] = 3;
      if (grpOf(m) === "plat") list.forEach(function (r) { takenPlat[r.id] = true; });
      out[m] = o;
    });
    return out;
  }
  /* Complète chaque moment à 7 portions avec tes recettes préférées, sans toucher à ce que tu as déjà choisi. */
  function autoFill(ws) {
    var p = mealPlanEnsure(ws), n = 0;
    MK.forEach(function (m) {
      Object.keys(p[m]).forEach(function (id) { if (!RBY[id]) delete p[m][id]; });
      var left = 7 - planCount(p, m); if (left <= 0) return;
      var other = m === "midi" ? p.soir : m === "soir" ? p.midi : {};
      var cand = pool(m).filter(function (r) { return !p[m][r.id] && !(other && other[r.id]); });
      if (!cand.length) cand = pool(m).filter(function (r) { return !p[m][r.id]; });
      if (!cand.length) cand = pool(m);
      var a = cand[0], b = cand[1];
      if (!a) return;
      if (b && left >= 4) { p[m][a.id] = (p[m][a.id] || 0) + Math.ceil(left / 2); p[m][b.id] = (p[m][b.id] || 0) + Math.floor(left / 2); }
      else p[m][a.id] = (p[m][a.id] || 0) + left;
      n += left;
    });
    return n;
  }
  /* Après un changement de goûts : les recettes masquées sont remplacées dans les plannings en cours. */
  function reconcileMeals() {
    var ws = mondayOf(today());
    [ws, addDays(ws, 7)].forEach(function (w) { if (S.mealPlan[w]) autoFill(w); });
  }
  function mealPlanFor(ws) {
    if (S.mealPlan[ws]) return S.mealPlan[ws];
    var ks = Object.keys(S.mealPlan).filter(function (k) { return k < ws; }).sort();
    return JSON.parse(JSON.stringify(ks.length ? S.mealPlan[ks[ks.length - 1]] : defaultMeals()));
  }
  function mealPlanEnsure(ws) { if (!S.mealPlan[ws]) S.mealPlan[ws] = mealPlanFor(ws); MK.forEach(function (k) { if (!S.mealPlan[ws][k]) S.mealPlan[ws][k] = {}; }); return S.mealPlan[ws]; }
  function planCount(p, m) { var n = 0, o = p[m] || {}; Object.keys(o).forEach(function (id) { if (RBY[id]) n += o[id]; }); return n; }
  /* Répartit les portions de la semaine jour par jour, en alternant les recettes. */
  function rotation(o) {
    var left = {}, ids = Object.keys(o || {}).filter(function (id) { return RBY[id] && o[id] > 0; }), out = [];
    ids.forEach(function (id) { left[id] = o[id]; });
    while (out.length < 14) {
      var best = null; ids.forEach(function (id) { if (left[id] > 0 && (!best || left[id] > left[best]) && id !== out[out.length - 1]) best = id; });
      if (!best) ids.forEach(function (id) { if (left[id] > 0 && !best) best = id; });
      if (!best) break; out.push(best); left[best]--;
    }
    return out;
  }
  function pickFor(m, d) {
    var x = S.day[d] && S.day[d][m]; if (x && x.r && (x.r === "libre" || RBY[x.r])) return x.r;
    return rotation(mealPlanFor(mondayOf(d))[m])[dow(d)] || "libre";
  }
  function isDone(m, d) { var x = S.day[d] && S.day[d][m]; return !!(x && x.done); }
  function dayRec(d) { if (!S.day[d]) S.day[d] = {}; return S.day[d]; }
  function setDone(m, d, v) { dayRec(d)[m] = { r: pickFor(m, d), done: v }; }
  function setPick(m, d, id) { var x = dayRec(d); x[m] = { r: id, done: !!(x[m] && x[m].done) }; }
  function slotNow() { var h = new Date().getHours() + new Date().getMinutes() / 60, mh = S.settings.mealHours; return h < mh[0] ? 0 : h < mh[1] ? 1 : h < mh[2] ? 2 : 3; }
  function recipeName(id) { return id === "libre" ? "Repas libre" : RBY[id] ? RBY[id].name : BASE[id] ? BASE[id].name + " (masquée)" : "Recette supprimée"; }
  /* Menu du jour ajusté : facteurs par rôle (féculents, protéines, matières grasses). */
  /* Ce qui a été noté à la main (repas pris ailleurs, extras) : on le retire de la journée, les recettes restantes se partagent le reste. */
  function logOf(m, d) { var x = S.day[d] && S.day[d][m]; return x && x.log && x.log.length ? x.log : null; }
  function loggedDay(d) { var all = []; MK.concat(["extra"]).forEach(function (m) { var l = logOf(m, d); if (l) all = all.concat(l); }); return E.logTotals(all); }
  function dayMenu(d) {
    var n = needsFor(d); if (!n) return null;
    var picks = MK.map(function (m) { return pickFor(m, d); }), shareR = 0, shareE = 0, lists = [];
    picks.forEach(function (id, i) {
      var m = MK[i]; if (logOf(m, d)) return;
      if (RBY[id]) { shareR += SHARE[m]; lists.push(RBY[id].ing); } else shareE += SHARE[m];
    });
    var logged = loggedDay(d), day = { K: n.kcal - n.ravitoC * 4, C: n.mealC, P: n.P, F: n.F };
    var tgt = E.mealTargets(day, logged, shareR, shareE);
    var k = lists.length ? E.scaleFactors(lists, tgt, D.FOOD) : { c: 1, p: 1, f: 1 };
    return { n: n, k: k, picks: picks, logged: logged, day: day };
  }
  function macros(ing, k) { var t = [0, 0, 0, 0]; ing.forEach(function (x) { var f = D.FOOD[x[0]], kk = E.factorFor(x[0], k, D.FOOD); for (var i = 0; i < 4; i++) t[i] += f.n[i] * x[1] * kk / 100; }); return t; }
  var PIECES = { oeuf: 1, banane: 1, pomme: 1, clem: 1, tortilla: 1, dattes: 1, yaourt: 1 };
  function ingLabel(x, k) {
    var kk = E.factorFor(x[0], k, D.FOOD);
    if (Math.abs(kk - 1) < 0.06) return x[2];
    var f = D.FOOD[x[0]], g = x[1] * kk;
    if (PIECES[x[0]] && f.piece) { var n = g / f.piece; if (x[0] === "yaourt") return Math.max(1, Math.round(n)) + " pot" + (n >= 1.5 ? "s" : ""); return n < 0.75 ? "½" : String(Math.round(n * 2) / 2).replace(".5", " ½"); }
    if (f.liquid) return Math.max(5, Math.round(g / 10) * 10) + " ml";
    var suf = (x[2].match(/ (cru|crue|crues)$/) || [""])[0];
    return Math.max(5, Math.round(g / 5) * 5) + " g" + suf;
  }
  function ingName(k) { return D.FOOD[k].fr; }

  /* ================= courses ================= */
  function store() { for (var i = 0; i < D.STORES.length; i++) if (D.STORES[i].id === S.settings.store) return D.STORES[i]; return D.STORES[0]; }
  function basePrice(k) { var f = D.FOOD[k]; return f.p == null ? null : Math.round(f.p * store().k * 100) / 100; }
  function price(k) { var o = S.prices[k]; return typeof o === "number" ? { v: o, src: "corrigé" } : { v: basePrice(k), src: "estimé" }; }
  function costOf(k, g) {
    var f = D.FOOD[k], p = price(k).v; if (p == null) return null;
    if (f.unit === "pièce") return Math.ceil(g / f.piece - 0.01) * p;
    return g / 1000 * p;
  }
  function qtyLabel(k, g) {
    var f = D.FOOD[k];
    if (f.piece && (f.unit === "pièce" || PIECES[k])) { var n = Math.ceil(g / f.piece - 0.05); return n + (k === "yaourt" ? " pot" + (n > 1 ? "s" : "") : k === "gel" ? " gel" + (n > 1 ? "s" : "") : k === "barre" ? " barre" + (n > 1 ? "s" : "") : ""); }
    if (f.liquid) return g >= 1000 ? fmt(Math.ceil(g / 250) / 4, 2).replace(",00", "").replace(/0$/, "") + " L" : Math.ceil(g / 50) * 50 + " ml";
    if (g >= 1000) return fmt(Math.ceil(g / 100) / 10, 1).replace(",0", "") + " kg";
    return Math.ceil(g / 50) * 50 + " g";
  }
  function shopItems(ws) {
    var tot = {};
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i), menu = dayMenu(d); if (!menu) break;
      menu.picks.forEach(function (id) { if (!RBY[id]) return; RBY[id].ing.forEach(function (x) { tot[x[0]] = (tot[x[0]] || 0) + x[1] * E.factorFor(x[0], menu.k, D.FOOD); }); });
    }
    var p = weekPlan(ws), rv = { iso: 0, gel: 0, barre: 0, banane: 0, dattes: 0 };
    if (p) p.sessions.forEach(function (s) { if (s.skip) return; var r = E.ravito(s, ravitoAvoid()); if (r) Object.keys(r.items).forEach(function (k) { rv[k] += r.items[k]; }); });
    Object.keys(rv).forEach(function (k) { D.RAVITO[k].buy.forEach(function (b) { if (rv[k]) tot[b[0]] = (tot[b[0]] || 0) + b[1] * rv[k]; }); });
    return Object.keys(tot).filter(function (k) { return !D.FOOD[k].stock && tot[k] > 0; }).map(function (k) {
      return { k: k, f: D.FOOD[k], g: tot[k], q: qtyLabel(k, tot[k]), c: costOf(k, tot[k]) };
    });
  }
  function shopChecked(ws) { if (!S.shop[ws]) S.shop[ws] = {}; return S.shop[ws]; }

  /* ================= Intervals.icu ================= */
  function icu(path, opt) {
    opt = opt || {};
    var h = { Authorization: "Basic " + btoa("API_KEY:" + S.icu.key.trim()) };
    if (opt.body) h["Content-Type"] = "application/json";
    return fetch(ICU + path, { method: opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("auth");
        if (!r.ok) throw new Error("http " + r.status);
        return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
      }, function () { throw new Error("network"); });
  }
  function icuError(e) {
    var m = e && e.message;
    if (m === "auth") return "Intervals.icu refuse la clé. Vérifie-la dans Settings → Developer Settings.";
    if (m === "network") return "Impossible de joindre Intervals.icu. Vérifie ta connexion internet.";
    return "Intervals.icu a répondu une erreur (" + esc(m) + "). Réessaie dans un moment.";
  }
  function mapAct(a) {
    var z5;
    return { id: String(a.id), date: String(a.start_date_local || "").slice(0, 10), sport: E.sportOf(a.type), type: a.type || "", name: a.name || "",
      dur: a.moving_time || a.elapsed_time || 0, dist: a.distance || 0, dplus: a.total_elevation_gain || 0, load: a.icu_training_load || 0,
      hr: a.average_heartrate || 0, watts: a.icu_weighted_avg_watts || a.icu_average_watts || 0, kcal: a.calories || 0, src: a.source || "Intervals",
      /* Capteur de puissance : travail mesuré (kJ) et puissance moyenne, seulement si les watts viennent d'un vrai capteur. */
      kj: a.icu_joules > 0 ? Math.round(a.icu_joules / 1000) : 0, avgW: a.icu_average_watts || 0, pm: !!a.device_watts,
      /* temps passé dans chaque zone (Z1 à Z5, secondes) et d'où il vient : puissance, FC ou allure */
      zt: (z5 = E.zones5(a, E.sportOf(a.type))) ? z5.t : null, zs: z5 ? z5.src : null };
  }
  function readZones(list) {
    var z = {};
    (list || []).forEach(function (s) {
      var t = s.types || [];
      if (t.indexOf("Ride") >= 0) { if (s.ftp) z.ftp = s.ftp; if (s.lthr) z.lthrRide = s.lthr; }
      if (t.indexOf("Run") >= 0) { if (s.lthr) z.lthrRun = s.lthr; if (s.threshold_pace) z.pace = true; }
      if (t.indexOf("Swim") >= 0 && s.threshold_pace > 0) { var c = 100 / s.threshold_pace; if (c > 50 && c < 300) z.css = Math.round(c); }
    });
    return z;
  }
  var syncing = false;
  function sync(full) {
    if (!connected() || syncing) return Promise.resolve(false);
    syncing = true; $("sync-btn").classList.add("spin");
    var t = today(), oldest = (full || !S.icu.lastSync) ? addDays(t, -180) : addDays(S.icu.lastSync.slice(0, 10), -10);
    return Promise.all([
      icu("/athlete/0"),
      icu("/athlete/0/activities?oldest=" + oldest + "&newest=" + t),
      icu("/athlete/0/wellness?oldest=" + oldest + "&newest=" + t)
    ]).then(function (r) {
      var ath = r[0] || {}, acts = r[1] || [], well = r[2] || [];
      if (S.demo) clearDemo();
      S.icu.name = ath.firstname || ath.name || "";
      var setP = ath.sportSettings ? Promise.resolve(ath.sportSettings) : icu("/athlete/0/sport-settings").catch(function () { return []; });
      return setP.then(function (ss) {
        var z = readZones(ss); if (Object.keys(z).length) S.zones = z;
        Object.keys(S.acts).forEach(function (k) { var a = S.acts[k]; if (a.date >= oldest && a.src !== "Manuel") delete S.acts[k]; });
        var stubs = 0;
        (Array.isArray(acts) ? acts : []).forEach(function (a) {
          if (a.source === "STRAVA" && !a.moving_time) { stubs++; return; }
          var m = mapAct(a); if (m.date && m.dur > 0) S.acts[m.id] = m;
        });
        (Array.isArray(well) ? well : []).forEach(function (w) {
          if (!w || !w.id) return;
          S.wellness[w.id] = { ctl: w.ctl, atl: w.atl, hrv: w.hrv || w.hrvSDNN || 0, rhr: w.restingHR || 0, sleep: w.sleepSecs || 0, weight: w.weight || 0, fat: w.bodyFat || 0 };
        });
        S.icu.stubs = stubs; S.icu.lastSync = new Date().toISOString(); S.icu.error = null;
        if (oldest <= addDays(t, -180)) S.icu.zonesV = 1;
        dirty(); previews = {}; save();
        return true;
      });
    }).catch(function (e) { S.icu.error = icuError(e); save(); throw e; })
      .finally(function () { syncing = false; $("sync-btn").classList.remove("spin"); });
  }
  function eventFor(s) {
    return { category: "WORKOUT", start_date_local: s.date + "T00:00:00", type: s.trail ? "TrailRun" : { natation: "Swim", velo: "Ride", course: "Run" }[s.sport], name: "Triple · " + s.title,
      description: E.icuText(s, zoneOpts()), moving_time: s.dur * 60, icu_training_load: s.load, external_id: s.eid };
  }
  /* Envoie les séances à venir de la semaine dans le calendrier Intervals.icu (qui les transmet à Garmin). */
  function push(ws) {
    var p = S.plans[ws]; if (!connected() || !p) return Promise.resolve(false);
    var t = today(), live = p.sessions.filter(function (s) { return s.date >= t && !s.skip && !s.race && !s.extra; });
    var dels = (p.orphans || []).concat(p.sessions.filter(function (s) { return s.date >= t && s.skip && s.icuId; }).map(function (s) { return s.icuId; }));
    var step = live.length ? icu("/athlete/0/events/bulk?upsert=true", { method: "POST", body: live.map(eventFor) }) : Promise.resolve([]);
    return step.then(function (res) {
      (Array.isArray(res) ? res : []).forEach(function (ev) { live.forEach(function (s) { if (s.eid === ev.external_id) { s.icuId = ev.id; s.pushed = true; } }); });
      return Promise.all(dels.map(function (id) { return icu("/athlete/0/events/" + id, { method: "DELETE" }).catch(function () {}); }));
    }).then(function () {
      p.orphans = []; p.sessions.forEach(function (s) { if (s.skip) { delete s.icuId; s.pushed = false; } });
      p.pushedAt = new Date().toISOString(); S.icu.lastPush = p.pushedAt; S.icu.error = null; save(); return true;
    }).catch(function (e) { S.icu.error = icuError(e); save(); throw e; });
  }
  function autoPush(ws) {
    if (!connected() || !S.settings.autoPush || !S.plans[ws]) return;
    push(ws).then(function () { if (current === "entrainement") render(); }).catch(function () { toast("Envoi vers Intervals.icu impossible pour l'instant."); });
  }
  function syncAndRefresh(full, quiet) {
    if (!connected()) return Promise.resolve();
    return sync(full).then(function () {
      var ch = ensurePlans();
      render();
      if (!quiet) toast("Synchronisé avec Intervals.icu");
      var ws = mondayOf(today()), p = S.plans[ws];
      if (p && (!p.pushedAt || ch)) autoPush(ws);
      var nx = S.plans[addDays(ws, 7)]; if (nx && !nx.pushedAt) autoPush(addDays(ws, 7));
    }).catch(function () { render(); if (!quiet) toast("Synchronisation impossible"); });
  }

  /* Synchronisation automatique : à l'ouverture, au retour dans l'appli et toutes les 10 minutes quand elle est ouverte,
     si la dernière date de plus de « min » minutes. Elle relit les 10 derniers jours pour attraper les sorties arrivées en retard. */
  function autoSync(min) {
    if (!connected() || syncing) return;
    /* Temps par zone (v0.12) : on relit une fois les 6 derniers mois pour les sorties déjà importées. */
    if (!S.icu.zonesV) { syncAndRefresh(true, true).then(function () { if (!S.icu.error) { S.icu.zonesV = 1; save(); render(); } }); return; }
    if (!S.icu.lastSync || Date.now() - new Date(S.icu.lastSync).getTime() > min * 60000) syncAndRefresh(false, true);
  }

  /* ================= démo ================= */
  function loadDemo() {
    var d = window.RC_DEMO(today());
    d.acts.forEach(function (a) { S.acts[a.id] = a; });
    Object.keys(d.wellness).forEach(function (k) { if (!S.wellness[k]) S.wellness[k] = d.wellness[k]; });
    if (!S.zones) S.zones = d.zones;
    S.demo = true; S.plans = {}; S.train.planStart = mondayOf(today()); dirty(); previews = {};
    ensurePlans(); save();
  }
  function clearDemo() {
    Object.keys(S.acts).forEach(function (k) { if (S.acts[k].demo) delete S.acts[k]; });
    Object.keys(S.wellness).forEach(function (k) { if (S.wellness[k].demo) delete S.wellness[k]; });
    if (S.zones && S.zones.demo) S.zones = null;
    S.demo = false; S.plans = {}; S.train.planStart = mondayOf(today()); dirty(); previews = {};
  }

  /* ================= navigation ================= */
  var current = "accueil", weekOff = 0, suiviSeg = "forme", repasSeg = MK[slotNow()];
  function planWeek() { return addDays(mondayOf(today()), 7 * weekOff); }
  var BRAND = '<span class="brandmark" role="img" aria-label="Triple"><span class="sp" aria-hidden="true"><b></b><b></b><b></b></span><span class="w" aria-hidden="true"><em>TRI</em>PLE</span></span>';
  function show(tab) {
    if (!$("view-" + tab)) tab = "accueil";
    current = tab;
    document.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === tab)); });
    document.querySelectorAll(".view").forEach(function (v) { v.hidden = v.id !== "view-" + tab; });
    $("title").innerHTML = tab === "accueil" ? BRAND : esc($("view-" + tab).dataset.title);
    render(); window.scrollTo(0, 0);
    try { sessionStorage.setItem("remcox.tab", tab); } catch (e) {}
  }
  function render() {
    $("sync-btn").hidden = !connected();
    $("layout-btn").hidden = !S.profile || !LAYOUT[current];
    ({ accueil: renderAccueil, entrainement: renderPlan, suivi: renderSuivi, repas: renderRepas, courses: renderCourses })[current]();
  }
  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); }); });
  window.addEventListener("scroll", function () { $("topbar").classList.toggle("scrolled", window.scrollY > 4); }, { passive: true });

  /* ================= organisation des blocs ================= */
  var LAYOUT = {
    accueil: [["seance", "Séance du jour"], ["objectif", "Mon objectif"], ["forme", "Forme"], ["nutrition", "Nutrition du jour"], ["sorties", "Dernières sorties"], ["courses", "Courses"], ["intervals", "Intervals.icu"]],
    entrainement: [["resume", "Ma semaine"], ["objectifs", "Mes objectifs"], ["saison", "Saison et préparation"], ["jours", "La semaine, jour par jour"], ["blessure", "Blessure et reprise"], ["repos", "Repos et vacances"], ["montre", "Montre et compteur"], ["dispos", "Mes disponibilités"], ["methode", "Comment ton plan est construit"]]
  };
  var LAYOUT_TITLE = { accueil: "Organiser l'accueil", entrainement: "Organiser le plan" };
  /* Ordre choisi ; un bloc ajouté dans une nouvelle version prend sa place par défaut. */
  function layoutOf(view) {
    var L = (S.ui.layout || {})[view] || {}, def = LAYOUT[view].map(function (x) { return x[0]; });
    var order = (L.order || []).filter(function (id, i, a) { return def.indexOf(id) >= 0 && a.indexOf(id) === i; });
    def.forEach(function (id, i) { if (order.indexOf(id) < 0) order.splice(Math.min(i, order.length), 0, id); });
    return { order: order, hidden: L.hidden || {} };
  }
  function arrange(view, blocks) {
    var L = layoutOf(view), by = {};
    blocks.forEach(function (b) { by[b.id] = b.html; });
    var out = L.order.filter(function (id) { return !L.hidden[id] && by[id]; }).map(function (id) { return by[id]; }).join("");
    return (out || '<div class="empty">Tous les blocs sont masqués.</div>') +
      '<button class="link lay-link" data-act="layout" data-v="' + view + '">' + LAYOUT_ICON + ' ' + esc(LAYOUT_TITLE[view]) + '</button>';
  }
  var LAYOUT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M4 12h10M4 18h10"/><path d="M19 4v16M16.5 6.5 19 4l2.5 2.5M16.5 17.5 19 20l2.5-2.5"/></svg>';
  var GRIP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function layoutSheet(view) {
    if (!LAYOUT[view]) return;
    var st = layoutOf(view), LAB = {};
    LAYOUT[view].forEach(function (x) { LAB[x[0]] = x[1]; });
    function commit() { S.ui.layout[view] = { order: st.order.slice(), hidden: st.hidden }; save(); render(); }
    function rows() {
      return st.order.map(function (id, i) {
        var off = !!st.hidden[id];
        return '<li class="lay-row' + (off ? ' off' : '') + '" data-id="' + id + '"><span class="grip" aria-hidden="true">' + GRIP + '</span><span class="nm">' + esc(LAB[id]) + '</span>' +
          '<button type="button" class="lay-btn" data-mv="-1" aria-label="Monter « ' + esc(LAB[id]) + ' »"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="lay-btn" data-mv="1" aria-label="Descendre « ' + esc(LAB[id]) + ' »"' + (i === st.order.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="lay-btn" data-eye aria-pressed="' + !off + '" aria-label="' + (off ? 'Afficher' : 'Masquer') + ' « ' + esc(LAB[id]) + ' »">' + (off ? EYE_OFF : EYE) + '</button></li>';
      }).join("");
    }
    sheet('<h2>' + esc(LAYOUT_TITLE[view]) + '</h2><p class="small muted">Glisse un bloc par la poignée, ou utilise les flèches. L\'œil masque ou réaffiche un bloc.</p>' +
      '<ul class="lay" id="lay">' + rows() + '</ul><button class="btn block" id="lay-reset">Revenir à l\'ordre de départ</button><button class="btn primary block" data-sheet="close">Terminé</button>', function (root) {
      var list = root.querySelector("#lay");
      function redraw() { list.innerHTML = rows(); }
      list.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b || b.disabled) return;
        var id = b.closest("li").dataset.id, i = st.order.indexOf(id);
        if (b.dataset.mv) { var j = i + +b.dataset.mv; st.order.splice(i, 1); st.order.splice(j, 0, id); }
        else if (b.hasAttribute("data-eye")) { if (st.hidden[id]) delete st.hidden[id]; else st.hidden[id] = true; }
        commit(); redraw();
        var nb = list.querySelector('li[data-id="' + id + '"] ' + (b.dataset.mv ? '[data-mv="' + b.dataset.mv + '"]' : '[data-eye]'));
        if (nb && !nb.disabled) nb.focus();
      });
      /* Glisser-déposer à la poignée (doigt ou souris). */
      list.addEventListener("pointerdown", function (e) {
        var grip = e.target.closest(".grip"); if (!grip) return;
        e.preventDefault();
        var row = grip.closest("li"), items = Array.prototype.slice.call(list.children), from = items.indexOf(row);
        var stepH = items.length > 1 ? items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().top : row.offsetHeight;
        var y0 = e.clientY, to = from;
        row.classList.add("drag"); grip.setPointerCapture(e.pointerId);
        function move(ev) {
          var dy = ev.clientY - y0; to = E.clamp(from + Math.round(dy / stepH), 0, items.length - 1);
          row.style.transform = "translateY(" + dy + "px)";
          items.forEach(function (r, k) { if (r !== row) r.style.transform = k > from && k <= to ? "translateY(" + -stepH + "px)" : k < from && k >= to ? "translateY(" + stepH + "px)" : ""; });
        }
        function up() {
          grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
          items.forEach(function (r) { r.style.transform = ""; }); row.classList.remove("drag");
          if (to !== from) { var id = st.order.splice(from, 1)[0]; st.order.splice(to, 0, id); commit(); }
          redraw();
        }
        grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
      });
      root.querySelector("#lay-reset").addEventListener("click", function () { st = { order: LAYOUT[view].map(function (x) { return x[0]; }), hidden: {} }; delete S.ui.layout[view]; save(); render(); redraw(); toast("Ordre de départ rétabli"); });
    });
  }

  /* ================= éléments communs ================= */
  function sportChip(sp) { return '<span class="chip sport ' + sp + '">' + SPORT[sp] + '</span>'; }
  function ribbon() {
    function wave(y, amp, len, ph) { var d = "M-10 " + y; for (var x = -10; x <= 230; x += 5) d += " L" + x + " " + (y + Math.sin((x + ph) / len * Math.PI * 2) * amp).toFixed(1); return d; }
    return '<svg class="ribbon" viewBox="0 0 220 170" aria-hidden="true"><path d="' + wave(70, 10, 70, 0) + '" fill="none" stroke="' + C.acc + '" stroke-width="4" stroke-linecap="round" opacity=".9"/>' +
      '<path d="' + wave(96, 8, 70, 18) + '" fill="none" stroke="' + C.line2 + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="' + wave(120, 6, 70, 36) + '" fill="none" stroke="' + C.line + '" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function demoBanner() {
    if (!S.demo) return "";
    return '<div class="verdict"><span class="chip acc">Exemple</span><p class="small">Ce sont des sorties d\'exemple pour découvrir l\'appli. <button class="link" data-act="connect">Connecter Intervals.icu</button></p></div>';
  }
  function zoneColor(z) { return { Z1: C.faint, Z2: C.acc, Z3: "#9ED36A", SS: "#E9D46B", Z4: "#F4A452", Z5: C.bad, R: C.line2 }[z]; }

  /* ================= ACCUEIL ================= */
  function renderAccueil() {
    var el = $("view-accueil"), t = today(), html = demoBanner();
    if (!S.profile) { el.innerHTML = '<div class="empty">Complète ton profil pour commencer.</div>'; return; }
    var rd = E.readiness(S.wellness, t), ss = sessionsOn(t), p = weekPlan(mondayOf(t));
    /* Chaque bloc est découpé dans html au fur et à mesure, puis affiché dans l'ordre choisi (Organiser). */
    var top = html.length, mark = top, B = [];
    function cut(id) { B.push({ id: id, html: html.slice(mark) }); mark = html.length; }

    /* récupération */
    var live = ss.filter(function (s) { return !s.skip; }), main = live.filter(function (s) { return status(s, p) !== "done"; })[0] || live[0];
    var hardToday = live.filter(function (s) { return (s.key || s.long) && !s.light && status(s, p) !== "done"; })[0];
    if (rd && rd.status !== "ok" && hardToday) {
      html += '<div class="verdict ' + (rd.status === "fatigue" ? "bad" : "warn") + '"><span class="chip ' + (rd.status === "fatigue" ? "bad" : "warn") + '">' + (rd.status === "fatigue" ? "Fatigue" : "Vigilance") + '</span><div class="grow"><p class="small">' + esc(rd.flags.join(" · ")) + '. Ta séance du jour est exigeante : mieux vaut l\'alléger.</p><button class="btn block" style="margin-top:8px" data-act="lighten" data-date="' + t + '" data-level="' + rd.status + '">Alléger la séance</button></div></div>';
    }

    /* séance du jour */
    if (main) {
      var st = status(main, p), m = matches(main), doneMin = sum(m.map(function (a) { return a.dur / 60; }));
      var others = ss.filter(function (s) { return s !== main; });
      html += '<section class="hero ' + main.sport + '">' + ribbon() +
        '<div class="row wrap">' + sportChip(main.sport) + (main.key ? '<span class="chip acc">Séance clé</span>' : '') + (main.long ? '<span class="chip acc">Sortie longue</span>' : '') + (main.reprise ? '<span class="chip acc">Reprise</span>' : '') + (main.period ? '<span class="chip grey">Facultative</span>' : '') + (main.race ? '<span class="chip acc">Jour de course</span>' : '') + (main.light ? '<span class="chip warn">Allégée</span>' : '') + (st === "done" ? '<span class="chip good">Faite</span>' : '') + '</div>' +
        '<div><span class="eyebrow">Aujourd\'hui</span><div class="t">' + esc(main.title) + '</div></div>' +
        '<div class="row between"><div class="d num">' + hmBig(st === "done" ? doneMin : main.dur) + '</div><div style="text-align:right"><p class="small">' + esc(main.sub) + '</p><p class="tiny muted">Charge ~' + main.load + (main.sport === "natation" && main.dist ? ' · ' + fmtM(main.dist) : '') + '</p></div></div>' +
        (st === "done" ? '<p class="small">' + m.map(function (a) { return esc(a.name) + ' · ' + hm(a.dur / 60) + distLabel(a) + ' · charge ' + Math.round(a.load); }).join("<br>") + '</p>' : '') +
        '<div class="row"><button class="btn primary grow" data-act="session" data-date="' + t + '" data-eid="' + main.eid + '">Voir la séance</button>' + (st !== "done" && main.date >= t && !main.race ? '<button class="btn" data-act="skip" data-eid="' + main.eid + '" data-date="' + t + '">Je saute</button>' : '') + '</div>' +
        (others.length ? '<div class="also"><span class="eyebrow">' + (others.length > 1 ? 'Aussi aujourd\'hui' : others[0].brick ? 'Juste après' : 'Aussi aujourd\'hui') + '</span>' + others.map(sessButton).join("") + '</div>' : '') + '</section>';
    } else {
      var nx = null;
      for (var i = 1; i <= 7 && !nx; i++) nx = sessionsOn(addDays(t, i)).filter(function (s) { return !s.skip; })[0] || null;
      var skipped = ss.filter(function (s) { return s.skip; })[0], ex = actsOn(t), per = E.periodOn(S.train.periods, t);
      html += '<section class="hero">' + ribbon() + '<span class="eyebrow">Aujourd\'hui</span><div class="t">' + (skipped ? 'Séance sautée' : per ? E.PERIOD_LABEL[per.kind] : 'Repos') + '</div>' +
        (per && !skipped ? '<p class="small">' + (per.kind === "vacances" ? 'Profite. ' : '') + 'Pause jusqu\'au ' + esc(dShort(per.to)) + ', puis le plan reprend là où il en est.</p>' : '') +
        (ex.length ? '<p class="small">Fait : ' + ex.map(function (a) { return esc(a.name) + ' (' + hm(a.dur / 60) + ')'; }).join(", ") + '</p>' : per && !skipped ? '' : '<p class="small muted">' + (skipped ? 'Pas de souci : la suite du plan s\'adapte à ce que tu fais vraiment.' : 'La récupération fait partie de l\'entraînement : c\'est là que tu progresses.') + '</p>') +
        (nx ? '<p class="small">Prochaine séance : <b>' + DAYS_LONG[dow(nx.date)].toLowerCase() + '</b> · ' + esc(nx.title) + ' · ' + hm(nx.dur) + '</p>' : '') +
        (skipped ? '<button class="btn" data-act="unskip" data-date="' + t + '">Remettre la séance</button>' : '') + '</section>';
    }
    cut("seance");

    /* objectif */
    var g = nextGoal();
    if (g) {
      var GT = E.RACE_TYPES[g.type], gdl = daysBetween(t, g.date), gi = injuryFor(mondayOf(t)), re = repriseEnd();
      html += '<section class="card"><div class="row between"><div class="grow"><span class="eyebrow">Mon objectif</span><h3>' + esc(goalLabel(g)) + '</h3><p class="small muted">' + esc(GT.label) + ' · ' + esc(longDate(g.date)) + '</p></div><div class="bigval num">' + dayLabel(gdl) + '</div></div>' +
        '<p class="tiny muted">' + (gi && gi.mode === "blesse" ? (re ? 'Reprise prévue le ' + longDate(mondayOf(S.train.injury.until)) + ', puis ' + Math.floor(daysBetween(re, g.date) / 7) + ' semaines de préparation.' : 'Indique ta date de reprise dans le Plan pour caler la préparation.') :
          gi ? 'Reprise en cours, la préparation suit.' : (p && p.phaseLabel ? 'Phase en cours : ' + esc(p.phaseLabel).toLowerCase() + '.' : '')) + '</p>' +
        '<button class="btn block" data-go="entrainement">Voir la préparation</button></section>';
    }
    cut("objectif");

    /* forme */
    if (hasData()) {
      var fs = fitness(addDays(t, -42), t), cur = fs[fs.length - 1], fz = E.formZone(cur.tsb, cur.ctl);
      html += '<section class="card"><div class="card-head"><h2>Forme</h2><span class="chip ' + fz.tone + '">' + fz.label + '</span></div>' +
        '<div class="stats"><div class="stat"><span class="eyebrow">Condition</span><span class="v">' + Math.round(cur.ctl) + '</span></div><div class="stat"><span class="eyebrow">Fatigue</span><span class="v">' + Math.round(cur.atl) + '</span></div><div class="stat"><span class="eyebrow">Forme</span><span class="v">' + sign(Math.round(cur.tsb), 0) + '</span></div></div>' +
        '<p class="small muted">' + fz.hint + '</p>' + spark(fs.map(function (x) { return x.ctl; })) +
        (rd ? '<p class="tiny muted">Ce matin : ' + [rd.hrv ? 'VFC ' + Math.round(rd.hrv) + ' ms' : '', rd.rhr ? 'FC repos ' + Math.round(rd.rhr) : '', rd.sleep ? 'sommeil ' + Math.floor(rd.sleep / 3600) + ' h ' + pad(Math.round(rd.sleep % 3600 / 60)) : ''].filter(Boolean).join(' · ') + '</p>' : '') +
        '<button class="btn block" data-go="suivi">Voir le suivi</button></section>';
    }
    cut("forme");

    /* nutrition */
    var menu = dayMenu(t), n = menu.n;
    html += '<section class="card"><div class="card-head"><h2>Nutrition du jour</h2><span class="chip grey">' + esc(n.label) + '</span></div>' +
      '<div class="row between"><div class="bigval num">' + n.kcal + '<small>kcal</small></div></div>' +
      '<div class="macros-row"><span><b>' + n.C + '</b>g glucides</span><span><b>' + n.P + '</b>g protéines</span><span><b>' + n.F + '</b>g lipides</span></div>';
    if (n.ravito.length) html += '<p class="small">Pendant ta ' + (n.ravito[0].sport === "padel" ? 'partie' : 'sortie') + ' : ' + ravitoText(n.ravito[0]) + '.</p>';
    if (menu.logged.K) html += '<p class="small">Noté à la main : ' + Math.round(menu.logged.K) + ' kcal. Les portions de tes recettes sont ajustées au reste de la journée.</p>';
    html += '<p class="tiny muted">' + fmt(n.gkg, 1) + ' g de glucides par kg aujourd\'hui · dépense de tes séances : ' + n.ex + ' kcal' + (n.ex ? ' (' + exSrcLabel(n.exSrc) + ')' : '') + '</p>';
    var done = MK.map(function (k) { return isDone(k, t); }), slot = slotNow(), next = -1;
    for (var k = slot; k < 4; k++) if (!done[k]) { next = k; break; }
    if (next >= 0) {
      var mk = MK[next], id = menu.picks[next], mc = RBY[id] ? macros(RBY[id].ing, menu.k) : null;
      html += '<div style="border-top:1px solid var(--line);padding-top:12px"><span class="eyebrow">Prochain repas · ' + esc(D.MOMENTS[next].label) + '</span><h3>' + esc(recipeName(id)) + '</h3>' + (mc ? '<p class="small muted num">' + Math.round(mc[0]) + ' kcal · ' + Math.round(mc[2]) + ' g glucides · ' + Math.round(mc[1]) + ' g protéines</p>' : '') + '</div>' +
        '<div class="row"><button class="btn primary grow" data-act="eat" data-m="' + mk + '">Mangé</button><button class="btn" data-act="choose" data-m="' + mk + '" data-date="' + t + '">Changer</button></div>' +
        '<div class="row" style="gap:18px"><button class="link" data-act="logm" data-m="' + mk + '">J\'ai mangé autre chose</button><button class="link" data-act="logm" data-m="extra">Un verre, un apéro</button></div>';
    } else html += '<p class="small"><b>Journée complète.</b> <span class="muted">Les repas du jour sont cochés.</span></p>';
    html += '</section>';
    cut("nutrition");

    /* dernières sorties */
    var last = actList().slice(-4).reverse();
    if (last.length) html += '<section class="card"><div class="card-head"><h2>Dernières sorties</h2>' + (connected() ? '<span class="tiny muted">' + esc(ago(S.icu.lastSync)) + '</span>' : '') + '</div><div>' +
      last.map(function (a) { return actRow(a); }).join("") + '</div><button class="btn block" data-act="allacts">Voir toutes les sorties</button></section>';
    cut("sorties");

    /* courses */
    var items = shopItems(mondayOf(t)), ck = shopChecked(mondayOf(t)), left = items.filter(function (it) { return !ck[it.k]; });
    html += '<section class="card"><div class="card-head"><h2>Courses</h2><span class="chip ' + (left.length ? 'grey' : 'good') + '">' + (left.length ? left.length + ' à acheter' : 'Tout est pris') + '</span></div>';
    if (left.length) html += '<div class="mini-list">' + left.slice(0, 4).map(function (it) { return '<div class="li"><span>' + esc(it.f.fr) + '</span><span class="muted small num">' + esc(it.q) + '</span></div>'; }).join("") + '</div>' + (left.length > 4 ? '<p class="tiny muted">+ ' + (left.length - 4) + ' autre' + (left.length > 5 ? 's' : '') + '</p>' : '');
    html += '<button class="btn block" data-go="courses">Voir la liste de la semaine</button></section>';
    cut("courses");

    /* connexion */
    if (connected()) {
      html += '<section class="card"><div class="row between"><div><span class="eyebrow">Intervals.icu</span><p class="small">' + (S.icu.error ? '<span style="color:var(--bad)">' + S.icu.error + '</span>' : 'Synchronisé ' + ago(S.icu.lastSync) + ' · automatique à chaque ouverture') + '</p>' +
        (S.icu.stubs ? '<p class="tiny" style="color:var(--warn)">' + (S.icu.stubs > 1 ? S.icu.stubs + ' sorties viennent de Strava et ne sont pas lisibles' : '1 sortie vient de Strava et n\'est pas lisible') + ' : connecte Garmin directement à Intervals.icu.</p>' : '') +
        '</div><button class="btn" data-act="sync">Synchroniser</button></div></section>';
    } else if (!S.demo) {
      html += '<section class="card"><h2>Tes sorties</h2><p class="small muted">Connecte Intervals.icu pour importer tes sorties Garmin et envoyer le plan sur ta montre et ton compteur.</p><button class="btn primary block" data-act="connect">Connecter Intervals.icu</button><button class="btn block" data-act="demo">Essayer avec des sorties d\'exemple</button></section>';
    }
    cut("intervals");
    el.innerHTML = html.slice(0, top) + arrange("accueil", B);
  }
  /* D'où vient la dépense des séances du jour : mesure ou estimation, dit clairement. */
  function exSrcLabel(src) {
    var m = src.filter(function (k) { return k === "power" || k === "garmin"; }).length, e = src.indexOf("estim") >= 0, pe = src.indexOf("perso") >= 0;
    var parts = [];
    if (src.indexOf("power") >= 0) parts.push("capteur de puissance");
    if (src.indexOf("garmin") >= 0) parts.push("Garmin");
    if (pe) parts.push("estimée d'après tes sorties Garmin");
    if (e) parts.push("estimation");
    return (m && !e && !pe ? "mesurée : " : "") + parts.join(", ");
  }
  function ravitoText(r) {
    var parts = [];
    Object.keys(r.items).forEach(function (k) { var n = r.items[k]; if (n) parts.push(n + " " + (n > 1 ? D.RAVITO[k].many : D.RAVITO[k].one)); });
    return parts.join(", ") + " (~" + r.gph + " g de glucides par heure)";
  }
  function spark(vals) {
    if (vals.length < 2) return "";
    var W = 300, H = 46, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 4) { var mid = (max + min) / 2; min = mid - 2; max = mid + 2; }
    var pts = vals.map(function (v, i) { return [4 + i * (W - 8) / (vals.length - 1), 4 + (max - v) / (max - min) * (H - 8)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" "), last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Condition sur 6 semaines : ' + Math.round(vals[0]) + ' à ' + Math.round(vals[vals.length - 1]) + '"><path d="' + d + ' L' + last[0] + ' ' + H + ' L' + pts[0][0] + ' ' + H + ' Z" fill="rgba(78,205,196,.12)"/><path d="' + d + '" fill="none" stroke="' + C.acc + '" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><p class="tiny muted">Condition sur 6 semaines : ' + sign(Math.round(vals[vals.length - 1] - vals[0]), 0) + ' points</p>';
  }

  /* ================= objectifs ================= */
  /* Nombre de semaines conseillé entre la reprise (ou le début) et la course. */
  var MINW = { triS: 8, triM: 12, triL: 16, triXL: 24, run10: 6, runSemi: 10, runMara: 16, trail: 10, cyclo: 8 };
  function nextGoal() { var t = today(); return S.races.filter(function (r) { return r.date >= t && r.prio !== "B"; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0] || null; }
  function goalLabel(r) { return r.name || E.RACE_TYPES[r.type].label; }
  function dayLabel(dl) { return dl > 0 ? 'J-' + dl : dl === 0 ? 'Jour J' : 'Faite'; }
  function goalsCard() {
    var t = today(), list = S.races.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).filter(function (r) { return r.date >= addDays(t, -7); });
    var html = '<section class="card"><div class="card-head"><h2>Mes objectifs</h2><button class="btn" data-act="goal">Ajouter</button></div>';
    if (!list.length) return html + '<p class="small muted">Ajoute une course que tu prépares (triathlon, course à pied ou cyclosportive) : le plan se cale tout seul à rebours depuis la date, avec affûtage et semaine de course.</p></section>';
    html += '<div class="goal-list">' + list.map(function (r) {
      var T = E.RACE_TYPES[r.type], dl = daysBetween(t, r.date);
      return '<button class="goal-row" data-act="goal" data-id="' + r.id + '"><span class="grow"><span class="nm">' + esc(goalLabel(r)) + '</span><span class="tiny muted">' + esc(T.label) + ' · ' + esc(longDate(r.date)) + ' · ' + (r.prio === "B" ? "course de préparation" : "objectif principal") + '</span></span><span class="chip ' + (r.prio === "B" ? 'grey' : 'acc') + '">' + dayLabel(dl) + '</span></button>';
    }).join("") + '</div>';
    var g = nextGoal(), re = repriseEnd();
    if (g) {
      /* Semaines de préparation comptées depuis l'ajout de l'objectif (ou la fin de la reprise) : l'alerte ne réapparaît pas en fin de préparation. */
      var a0 = mondayOf(g.added && g.added < t ? g.added : t), from = re && re > a0 ? re : a0, wks = Math.floor(daysBetween(from, g.date) / 7), need = MINW[g.type] || 10;
      if (daysBetween(t, g.date) > 21) html += wks < need ? '<p class="small" style="color:var(--warn)">' + (re ? 'Après ta reprise, ta' : 'Ta') + ' préparation pour ' + esc(goalLabel(g)) + ' fait ' + wks + ' semaines : c\'est court pour cette distance (' + need + ' semaines conseillées). Vise une course plus courte ou plus tardive, ou fais-en une course de préparation.</p>' :
        '<p class="tiny muted">' + (re ? 'Après ta reprise, ' : '') + wks + ' semaines de préparation pour ' + esc(goalLabel(g)) + '.</p>';
    }
    return html + '</section>';
  }
  function goalSheet(id) {
    var r = id ? S.races.filter(function (x) { return x.id === id; })[0] : null;
    var d = r ? JSON.parse(JSON.stringify(r)) : { id: "g" + Date.now(), name: "", type: "triM", date: "", prio: "A", km: "", dplus: "", added: today() };
    var GROUPS = ["Triathlon", "Course à pied", "Vélo"];
    function read(root) {
      var n = root.querySelector("#g-name"), dt = root.querySelector("#g-date"), km = root.querySelector("#g-km"), dp = root.querySelector("#g-dp");
      if (n) d.name = n.value.trim(); if (dt) d.date = dt.value; if (km) d.km = parseNum(km.value) || ""; if (dp) d.dplus = parseNum(dp.value) || "";
    }
    function html() {
      var T = E.RACE_TYPES[d.type], I = E.raceInfo(d);
      return '<h2>' + (r ? 'Modifier l\'objectif' : 'Nouvel objectif') + '</h2>' +
        '<div class="field"><label for="g-name">Nom de la course</label><input id="g-name" type="text" value="' + esc(d.name) + '" placeholder="Par exemple : Triathlon de Lacanau" autocomplete="off"></div>' +
        '<div class="field"><label for="g-date">Date</label><input id="g-date" type="date" value="' + esc(d.date) + '" min="' + today() + '"></div>' +
        '<div class="field"><span class="lab">Épreuve</span>' + GROUPS.map(function (g) {
          return '<span class="tiny muted">' + g + '</span><div class="chips">' + Object.keys(E.RACE_TYPES).filter(function (k) { return E.RACE_TYPES[k].group === g; }).map(function (k) {
            return '<button type="button" class="chipbtn" data-type="' + k + '" aria-pressed="' + (d.type === k) + '">' + esc(E.RACE_TYPES[k].short) + '</button>'; }).join("") + '</div>';
        }).join("") + '</div>' +
        (T.needKm ? '<div class="two"><div class="field"><label for="g-km">Distance (km)</label><input id="g-km" type="text" inputmode="decimal" value="' + esc(d.km) + '" placeholder="' + (d.type === "cyclo" ? "120" : "30") + '"></div><div class="field"><label for="g-dp">Dénivelé (m)</label><input id="g-dp" type="text" inputmode="numeric" value="' + esc(d.dplus) + '" placeholder="' + (d.type === "cyclo" ? "1800" : "1200") + '"></div></div><p class="tiny muted">Parcours pas encore connu ? Mets une estimation : tu la corrigeras plus tard et le plan se recalera.</p>' : '') +
        '<div class="field"><span class="lab">Importance</span><div class="seg acc" role="group"><button type="button" data-prio="A" aria-pressed="' + (d.prio !== "B") + '">Objectif principal</button><button type="button" data-prio="B" aria-pressed="' + (d.prio === "B") + '">Course de préparation</button></div>' +
        '<span class="tiny muted">' + (d.prio === "B" ? 'Une course pour s\'entraîner : la veille est facile, le lendemain récupération, sans changer le reste du plan.' : 'Tout le plan se cale dessus : foncier, développement, spécifique, puis ' + I.taper + ' semaine' + (I.taper > 1 ? 's' : '') + ' d\'affûtage.') + '</span></div>' +
        '<p class="small muted">' + esc(T.label) + (T.parts ? ' : ' + T.parts.map(function (p) { return p[1]; }).join(" · ") : '') + '. Durée estimée : environ ' + E.durLabel(I.dur) + '.</p>' +
        '<p class="err" id="g-err" hidden></p><button class="btn primary block" id="g-save">Enregistrer</button>' +
        (r ? '<button class="btn danger block" id="g-del">Supprimer l\'objectif</button>' : '') + '<button class="btn block" data-sheet="close">Annuler</button>';
    }
    function done(msg) {
      var ws = mondayOf(today());
      regenerate(ws); if (S.plans[addDays(ws, 7)]) regenerate(addDays(ws, 7));
      previews = {}; save(); closeSheet(); render(); autoPush(ws); toast(msg);
    }
    sheet(html(), function (root) {
      var sh = root.querySelector(".sheet");
      sh.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-type]"))) { read(root); d.type = b.dataset.type; sh.innerHTML = '<div class="grab"></div>' + html(); }
        else if ((b = e.target.closest("[data-prio]"))) { read(root); d.prio = b.dataset.prio; sh.innerHTML = '<div class="grab"></div>' + html(); }
        else if (e.target.closest("#g-save")) {
          read(root);
          var er = sh.querySelector("#g-err");
          if (!d.date || d.date < today()) { er.textContent = "Choisis une date à venir."; er.hidden = false; return; }
          if (E.RACE_TYPES[d.type].needKm && !(d.km > 0)) { er.textContent = "Indique la distance en km."; er.hidden = false; return; }
          if (!d.added || (r && (r.date !== d.date || r.type !== d.type))) d.added = today();
          S.races = S.races.filter(function (x) { return x.id !== d.id; }).concat([d]);
          done(r ? "Objectif modifié" : "Objectif ajouté : le plan se cale dessus");
        } else if ((b = e.target.closest("#g-del"))) {
          if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Confirmer la suppression"; return; }
          S.races = S.races.filter(function (x) { return x.id !== d.id; }); done("Objectif supprimé");
        }
      });
    });
  }
  /* Frise de la préparation : de cette semaine jusqu'au dernier objectif principal (12 mois au plus), avec un repère par course. */
  function prepCard(g) {
    var t = today(), w0 = mondayOf(t), lim = addDays(w0, 364);
    var As = S.races.filter(function (r) { return r.prio !== "B" && r.date >= t && r.date <= lim; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var last = As.length ? As[As.length - 1] : g, wr = mondayOf(last.date), n = Math.max(1, daysBetween(w0, wr) / 7 + 1), segs = [];
    for (var w = w0; w <= wr; w = addDays(w, 7)) {
      var inj = injuryFor(w), k;
      if (inj) k = inj.mode === "blesse" ? "blesse" : "reprise";
      else { var rp = E.racePlan({ ws: w, races: S.races }); k = !rp ? "autre" : rp.mode === "after" ? "recup" : rp.phase === "raceweek" ? "affutage" : rp.phase; }
      if (segs.length && segs[segs.length - 1].k === k) segs[segs.length - 1].n++; else segs.push({ k: k, n: 1 });
    }
    var LAB = { blesse: "Blessure", reprise: "Reprise", foncier: "Foncier", developpement: "Dév.", specifique: "Spécif.", affutage: "Affût.", recup: "Récup", autre: "" };
    var SH = { blesse: "Bless.", reprise: "Repr.", foncier: "Fonc.", developpement: "Dév.", specifique: "Spé.", affutage: "Aff.", recup: "Réc.", autre: "" };
    /* Étiquette complète si elle tient dans la largeur du segment (environ 320 px de frise, 6,5 px par lettre), sinon abrégée, sinon rien. */
    function fit(x) { var px = x.n / n * (320 - 3 * (segs.length - 1)); return LAB[x.k].length * 6.5 + 4 <= px ? LAB[x.k] : SH[x.k].length * 6.5 + 4 <= px ? SH[x.k] : ""; }
    var bar = segs.map(function (x, i) { return '<i class="' + (i === 0 ? 'now ' : '') + (x.k === "blesse" ? 'inj' : x.k === "recup" ? 'rec' : '') + '" style="flex:' + x.n + '"></i>'; }).join("");
    var labs = segs.map(function (x, i) { return '<span style="flex:' + x.n + '"' + (i === 0 ? ' class="now"' : '') + '>' + fit(x) + '</span>'; }).join("");
    var span = n * 7, marks = S.races.filter(function (r) { return r.date >= t && r.date <= addDays(wr, 6); }).map(function (r) {
      return '<b class="season-mark' + (r.prio === "B" ? ' b' : '') + '" style="left:' + Math.min(99.5, daysBetween(w0, r.date) / span * 100).toFixed(1) + '%" aria-hidden="true"></b>';
    }).join("");
    var ticks = "", c = 0;
    for (var m = new Date(+w0.slice(0, 4), +w0.slice(5, 7), 1); iso(m) <= wr; m.setMonth(m.getMonth() + 1)) {
      if (c++ % (n > 30 ? 2 : 1)) continue;
      ticks += '<span style="left:' + (daysBetween(w0, iso(m)) / span * 100).toFixed(1) + '%">' + m.toLocaleDateString("fr-FR", { month: "short" }) + '</span>';
    }
    var cur = segs[0], CUR = { blesse: "Blessure : repos et rééducation.", reprise: "Reprise progressive sur " + E.REPRISE_WEEKS + " semaines.", foncier: "Foncier : endurance, technique et force.", developpement: "Développement : du seuil, des sorties longues qui s'allongent.", specifique: "Spécifique : allures de course et enchaînements.", affutage: "Affûtage : moins de volume, tu arrives frais.", recup: "Récupération après la course.", autre: "" };
    var nA = As.length;
    return '<section class="card"><div class="card-head"><h2>' + (nA > 1 ? 'Ta saison' : 'Ta préparation') + '</h2><span class="chip acc">' + dayLabel(daysBetween(t, g.date)) + '</span></div>' +
      '<div class="season-wrap"><div class="season" role="img" aria-label="' + (nA > 1 ? nA + ' objectifs principaux. ' : 'Préparation de ' + esc(goalLabel(g)) + ' : ') + segs.map(function (x) { return x.n + ' semaines ' + (LAB[x.k] || ''); }).join(", ") + '">' + bar + '</div>' + marks + '</div>' +
      '<div class="season-lab">' + labs + '</div><div class="season-months" aria-hidden="true">' + ticks + '</div>' +
      (S.races.some(function (r) { return r.prio === "B" && r.date >= t && r.date <= wr; }) ? '<p class="tiny muted season-key"><b class="key-a"></b>Objectif principal <b class="key-b"></b>Course de préparation</p>' : '') +
      '<p class="small"><b>' + (nA > 1 ? 'Prochain : ' : '') + esc(goalLabel(g)) + '</b> <span class="muted">· ' + esc(longDate(g.date)) + '</span></p><p class="small muted">' + esc(CUR[cur.k] || "") + '</p></section>';
  }
  /* Frise de la saison : de novembre à octobre, les triathlons l'été. */
  function seasonCard(ws) {
    var g = nextGoal(); if (g) return prepCard(g);
    var d = addDays(ws, 3), ph = E.phaseOf(d), end = E.phaseEnd(d), pos = E.seasonPos(today());
    var W = { foncier: 120, developpement: 61, specifique: 46, saison: 77, transition: 61 };
    var segs = E.PHASES.map(function (x) { return '<i class="' + (x.k === ph.k ? 'now' : '') + '" style="flex:' + W[x.k] + '"></i>'; }).join("");
    var labs = E.PHASES.map(function (x) { return '<span style="flex:' + W[x.k] + '"' + (x.k === ph.k ? ' class="now"' : '') + '>' + esc(x.short) + '</span>'; }).join("");
    return '<section class="card"><div class="card-head"><h2>Ta saison</h2><span class="tiny muted">Triathlons de juin à août</span></div>' +
      '<div class="season-wrap"><div class="season" role="img" aria-label="Phase ' + esc(ph.label) + ' jusqu\'au ' + short(end) + '">' + segs + '</div><b class="season-mark" style="left:' + (pos * 100).toFixed(1) + '%" aria-hidden="true"></b></div>' +
      '<div class="season-lab">' + labs + '</div><div class="season-months" aria-hidden="true">' + [["nov.", 0], ["janv.", 61], ["mars", 120], ["mai", 181], ["juil.", 242], ["sept.", 304]].map(function (m) { return '<span style="left:' + (m[1] / 365 * 100).toFixed(1) + '%">' + m[0] + '</span>'; }).join("") + '</div>' +
      '<p class="small"><b>' + esc(ph.label) + '</b> <span class="muted">· jusqu\'au ' + parseISO(end).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) + '</span></p><p class="small muted">' + esc(ph.goal) + '</p></section>';
  }
  /* ---- padel, un jour de la semaine ---- */
  var PADEL_DUR = [60, 90, 120];
  function padelRow(ws, p) {
    var pd = (S.train.padel || {})[ws], t = today();
    var off = p.mode === "blesse" || p.mode === "reprise" ? "injury" : p.mode === "race" ? "race" : p.padelOff;
    if (off) return pd || off === "injury" ? '<p class="tiny muted padel-off">' + (off === "injury" ? 'Padel : pas pendant la blessure ni la reprise, il sollicite beaucoup l\'épaule. Il revient avec le plan normal, après le feu vert de ton kiné.' : 'Padel : pas cette semaine, il tombe le jour ou la veille d\'une course.') + '</p>' : '';
    if (addDays(ws, 6) < t) return '';
    return '<div class="padel-row"><span class="grow"><span class="nm">Padel cette semaine</span><span class="tiny muted">' + (pd ? DAYS_LONG[pd.day] + ' · ' + hm(pd.dur) + ' · le plan s\'adapte autour' + (p.phase === "affutage" ? '. Affûtage : joue tranquille.' : '') : 'Une partie en plus, le plan s\'adapte autour') + '</span></span>' +
      '<button class="btn" data-act="padel" data-w="' + ws + '">' + (pd ? 'Modifier' : 'Ajouter') + '</button></div>';
  }
  /* --- repos et vacances --- */
  function periodSheet(id) {
    var t = today(), cur = id ? S.train.periods.filter(function (z) { return z.id === id; })[0] : null;
    var d = cur ? { kind: cur.kind, from: cur.from, to: cur.to, sports: JSON.parse(JSON.stringify(cur.sports || {})) } : { kind: "vacances", from: t, to: addDays(t, 6), sports: {} };
    function html(err) {
      return '<h2>' + (cur ? 'Modifier la période' : 'Repos ou vacances') + '</h2>' +
        '<div class="seg acc" role="group" aria-label="Type"><button type="button" data-pk="repos" aria-pressed="' + (d.kind === "repos") + '">Repos</button><button type="button" data-pk="vacances" aria-pressed="' + (d.kind === "vacances") + '">Vacances</button></div>' +
        '<p class="small muted">' + (d.kind === "repos" ? 'Aucune séance ces jours-là. Le plan reprend ensuite normalement.' : 'Aucune séance prévue. Si tu veux garder un peu de sport, coche-le : une séance facile un jour sur deux, sans obligation.') + '</p>' +
        '<div class="two"><div class="field"><label for="pe-from">Du</label><input id="pe-from" type="date" value="' + esc(d.from || "") + '"></div><div class="field"><label for="pe-to">Au (inclus)</label><input id="pe-to" type="date" value="' + esc(d.to || "") + '"></div></div>' +
        (d.kind === "vacances" ? '<div class="field"><span class="lab">Garder un peu de sport (facultatif)</span><div class="chips">' + E.SPORTS.filter(function (x) { return S.train.sports[x]; }).map(function (x) { return '<button type="button" class="chipbtn" data-ps="' + x + '" aria-pressed="' + !!d.sports[x] + '">' + SPORT[x] + '</button>'; }).join("") + '</div></div>' : '') +
        '<p class="err" id="pe-err"' + (err ? '' : ' hidden') + '>' + esc(err || "") + '</p>' +
        '<button class="btn primary block" id="pe-save">' + (cur ? 'Enregistrer' : 'Ajouter') + '</button>' +
        (cur ? '<button class="btn danger block" id="pe-del">Supprimer la période</button>' : '') + '<button class="btn block" data-sheet="close">Annuler</button>';
    }
    function done(msg) { closeSheet(); applyPeriodsAll(); toast(msg); }
    sheet(html(), function (root) {
      var sh = root.querySelector(".sheet");
      function redraw(err) { sh.innerHTML = '<div class="grab"></div>' + html(err); }
      sh.addEventListener("change", function (e) { if (e.target.id === "pe-from") { d.from = e.target.value || null; if (d.from && (!d.to || d.to < d.from)) { d.to = d.from; redraw(); } } if (e.target.id === "pe-to") d.to = e.target.value || null; });
      sh.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-pk]"))) { d.kind = b.dataset.pk; redraw(); }
        else if ((b = e.target.closest("[data-ps]"))) { var k = b.dataset.ps; d.sports[k] = !d.sports[k]; b.setAttribute("aria-pressed", String(!!d.sports[k])); }
        else if (e.target.closest("#pe-save")) {
          if (!d.from || !d.to) { redraw("Choisis une date de début et de fin."); return; }
          if (d.to < d.from) { redraw("La fin doit être après le début."); return; }
          var clash = S.train.periods.filter(function (z) { return z !== cur && z.from <= d.to && z.to >= d.from; })[0];
          if (clash) { redraw("Ces dates chevauchent une autre période (" + E.PERIOD_LABEL[clash.kind].toLowerCase() + " du " + dShort(clash.from) + " au " + dShort(clash.to) + ") : modifie plutôt celle-là."); return; }
          var z = cur || { id: "p" + Date.now().toString(36) };
          z.kind = d.kind; z.from = d.from; z.to = d.to;
          z.sports = d.kind === "vacances" ? E.SPORTS.reduce(function (o, x) { if (d.sports[x]) o[x] = true; return o; }, {}) : {};
          if (!cur) S.train.periods.push(z);
          done(E.PERIOD_LABEL[z.kind] + " enregistré" + (z.kind === "vacances" ? "es" : "") + " : le plan reprend le " + short(addDays(z.to, 1)));
        }
        else if (e.target.closest("#pe-del")) { S.train.periods = S.train.periods.filter(function (z) { return z !== cur; }); done("Période supprimée : les séances reviennent"); }
      });
    });
  }
  function padelSheet(ws) {
    var t = today(), cur = (S.train.padel || {})[ws];
    var okDays = [0, 1, 2, 3, 4, 5, 6].filter(function (i) { return addDays(ws, i) >= t; });
    var d = { day: cur ? cur.day : okDays[0], dur: cur ? cur.dur : 90 };
    if (okDays.indexOf(d.day) < 0) d.day = okDays[0];
    function html() {
      return '<h2>Padel cette semaine</h2><p class="small muted">Une partie en plus, hors triathlon. Ce jour-là, pas de séance clé ni de natation, et le lendemain pas de séance dure en course à pied. Le reste de la semaine baisse un peu pour garder la même fatigue, et ta préparation continue.</p>' +
        '<div class="field"><span class="lab">Jour</span><div class="chips">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) { return '<button type="button" class="chipbtn" data-pday="' + i + '" aria-pressed="' + (d.day === i) + '"' + (okDays.indexOf(i) < 0 ? ' disabled' : '') + '>' + DAYS[i] + ' ' + parseISO(addDays(ws, i)).getDate() + '</button>'; }).join("") + '</div></div>' +
        '<div class="field"><span class="lab">Durée</span><div class="seg acc" role="group">' + PADEL_DUR.map(function (m) { return '<button type="button" data-pdur="' + m + '" aria-pressed="' + (d.dur === m) + '">' + hm(m) + '</button>'; }).join("") + '</div></div>' +
        '<button class="btn primary block" id="pd-save">' + (cur ? 'Enregistrer' : 'Ajouter au plan') + '</button>' +
        (cur ? '<button class="btn danger block" id="pd-del">Retirer le padel</button>' : '') + '<button class="btn block" data-sheet="close">Annuler</button>';
    }
    function done(msg) {
      if (S.plans[ws]) regenerate(ws);
      previews = {}; save(); closeSheet(); render(); if (S.plans[ws]) autoPush(ws); toast(msg);
    }
    sheet(html(), function (root) {
      var sh = root.querySelector(".sheet");
      sh.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-pday]"))) { if (b.disabled) return; d.day = +b.dataset.pday; sh.innerHTML = '<div class="grab"></div>' + html(); }
        else if ((b = e.target.closest("[data-pdur]"))) { d.dur = +b.dataset.pdur; sh.innerHTML = '<div class="grab"></div>' + html(); }
        else if (e.target.closest("#pd-save")) { if (d.day == null) return; S.train.padel[ws] = { day: d.day, dur: d.dur }; done(cur ? "Padel modifié : le plan s'adapte" : "Padel ajouté : le plan s'adapte"); }
        else if (e.target.closest("#pd-del")) { delete S.train.padel[ws]; done("Padel retiré"); }
      });
    });
  }
  function rsportChips(lab) {
    var rs = S.train.injury.rsports || (S.train.injury.rsports = { natation: true, velo: true, course: true });
    return '<div class="field"><span class="lab">' + lab + '</span><div class="chips">' + E.SPORTS.map(function (sp) { return '<button class="chipbtn" data-act="rsport" data-s="' + sp + '" aria-pressed="' + (rs[sp] !== false) + '">' + SPORT[sp] + '</button>'; }).join("") + '</div><span class="tiny muted">Décoche un sport que ton kiné n\'autorise pas encore : il reste de côté pendant la reprise.</span></div>';
  }
  function sessButton(s) {
    return '<button class="sess ' + s.sport + (s.skip ? ' skip' : '') + '" data-act="session" data-date="' + s.date + '" data-eid="' + s.eid + '"><span class="nm">' + esc(s.title) +
      (s.key ? ' <span class="star" aria-label="séance clé">★</span>' : '') + (s.light ? ' <span class="chip warn">Allégée</span>' : '') + '</span><span class="sb">' + hm(s.dur) + ' · ' + esc(s.sub) + '</span></button>';
  }
  function lightened(o, level) {
    var l = E.lighten(o, level, zones().css);
    l.eid = o.eid; l.icuId = o.icuId; l.slot = o.slot; l.second = o.second; l.orig = o;
    return l;
  }

  /* ================= ENTRAÎNEMENT ================= */
  function renderPlan() {
    var el = $("view-entrainement"), t = today(), ws = planWeek(), p = weekPlan(ws), html = demoBanner();
    html += '<div class="seg" role="group" aria-label="Semaine"><button data-act="week" data-w="0" aria-pressed="' + (weekOff === 0) + '">Cette semaine</button><button data-act="week" data-w="1" aria-pressed="' + (weekOff === 1) + '">Semaine du ' + short(addDays(mondayOf(t), 7)) + '</button></div>';
    var PRIOS = [["equilibre", "Équilibré"], ["natation", "Natation"], ["velo", "Vélo"], ["course", "Course"]];
    if (!p) { el.innerHTML = html + '<div class="empty">Complète ton profil pour générer ton plan.</div>'; return; }
    var top = html.length, mark = top, B = [];
    function cut(id) { B.push({ id: id, html: html.slice(mark) }); mark = html.length; }
    var th = E.THEMES[p.theme] || { label: "Plan", goal: "" }, track = "", labs = "", inj = p.mode === "blesse" || p.mode === "reprise";
    var nW = p.mode === "reprise" ? p.rweeks : 4;
    for (var i = 1; i <= nW; i++) { track += '<i class="' + (!inj && i === 4 ? 'rec ' : '') + (i < p.wk ? 'done' : i === p.wk ? 'now' : '') + '"></i>'; labs += '<span>' + (!inj && i === 4 ? 'Récup' : 'S' + i) + '</span>'; }
    var pm = plannedMin(p), dm = doneMinWeek(ws), pload = sum(p.sessions.filter(function (s) { return !s.skip; }).map(function (s) { return s.load; }));
    var chips, title, goal, trackHTML = '<div class="track" style="grid-template-columns:repeat(' + nW + ',1fr)" aria-label="Semaine ' + p.wk + ' sur ' + nW + '">' + track + '</div><div class="track-lab" style="grid-template-columns:repeat(' + nW + ',1fr)">' + labs + '</div>';
    if (p.mode === "blesse") {
      var ue = S.train.injury.until;
      chips = '<span class="chip warn">Blessure</span>' + (ue ? '<span class="chip grey">Reprise le ' + short(ue) + '</span>' : ''); title = p.sessions.length ? 'Pause blessure' : 'Repos complet';
      goal = p.sessions.length ? 'Seulement les sports que tu peux pratiquer, en endurance facile, pour garder le cardio sans gêner la guérison.' :
        'Aucun sport pour l\'instant : la priorité, c\'est la guérison.' + (ue ? ' Le plan de reprise démarrera tout seul le ' + longDate(mondayOf(ue)) + '.' : ' Indique ta date de reprise dans « Blessure et reprise ».'); trackHTML = '';
    } else if (p.mode === "reprise") {
      chips = '<span class="chip acc">Reprise</span><span class="chip grey">Semaine ' + p.rw + ' sur ' + p.rweeks + '</span>'; title = 'Reprise en douceur';
      goal = p.rw <= 2 ? 'Footings courts sur route avec quelques côtes douces, natation et vélo faciles. Le volume remonte de 10 % par semaine.' :
        p.rw <= 4 ? 'Une séance de côtes par semaine pour le psoas et le cardio, une séance un peu plus soutenue en natation ou à vélo.' :
        'Côtes plus longues, un footing long, et le volume revient à ton niveau. Ensuite, le plan normal reprend.';
    } else if (p.race && (p.mode === "prep" || p.mode === "race")) {
      var dl = daysBetween(t, p.race.date);
      chips = '<span class="chip acc">' + (dl > 0 ? 'J-' + dl : dl === 0 ? 'Jour J' : 'Course passée') + '</span>' + (p.mode === "race" ? '' : '<span class="chip grey">' + (p.phase === "affutage" ? 'Affûtage' : p.rec ? 'Semaine de récupération' : 'Semaine ' + p.wk + ' sur 3') + '</span>');
      title = p.mode === "race" ? 'Semaine de course' : p.rec ? 'Récupération' : p.phaseLabel;
      goal = p.mode === "race" ? 'Séances courtes et faciles, réveil musculaire deux jours avant, repos la veille. Objectif : ' + (p.race.name || '') + '.' :
        p.rec ? 'Volume réduit de 30 % : ton corps assimile les 3 semaines de travail, en route vers ' + (p.race.name || 'ta course') + '.' : p.phaseGoal;
      if (p.mode === "race" || p.phase === "affutage") trackHTML = '';
    } else if (p.mode === "after") {
      chips = '<span class="chip good">Course faite</span>'; title = 'Récupération'; goal = p.phaseGoal; trackHTML = '';
    } else {
      chips = '<span class="chip acc">Cycle ' + p.cycle + '</span><span class="chip grey">' + (p.rec ? 'Semaine de récupération' : 'Semaine ' + p.wk + ' sur 3') + '</span>';
      title = p.rec ? 'Récupération' : th.label;
      goal = p.rec ? 'Volume réduit de 30 % : ton corps assimile les 3 semaines de travail. Garde la régularité, sans forcer.' : th.goal;
    }
    var PZ = periodsIn(ws);
    if (PZ.length) {
      var pz0 = PZ[0], back = addDays(PZ[PZ.length - 1].to, 1);
      chips += '<span class="chip grey">' + E.PERIOD_LABEL[pz0.kind] + '</span>';
      if (p.offDays === 7) {
        title = E.PERIOD_LABEL[pz0.kind]; trackHTML = '';
        goal = (pz0.kind === "vacances" ? 'Profite. ' : '') + 'Pas de séance prévue cette semaine. Le plan reprend le ' + longDate(back) + ', là où il en est, avec la même préparation pour tes objectifs.';
      }
    }
    html += '<section class="hero">' + ribbon() + '<div class="row wrap">' + chips + (p.preview ? '<span class="chip warn">Provisoire</span>' : '') + '</div>' +
      '<div class="t">' + esc(title) + '</div><p class="small">' + esc(goal) + '</p>' + trackHTML +
      '<div class="stats" style="margin-top:4px"><div class="stat"><span class="eyebrow">Prévu</span><span class="v">' + hm(pm).replace(" min", "<small>min</small>").replace(/ h (\d+)/, "<small>h</small>$1").replace(/ h$/, "<small>h</small>") + '</span></div><div class="stat"><span class="eyebrow">Fait</span><span class="v">' + (ws <= t ? hm(dm).replace(" min", "<small>min</small>").replace(/ h (\d+)/, "<small>h</small>$1").replace(/ h$/, "<small>h</small>") : '—') + '</span></div><div class="stat"><span class="eyebrow">Charge</span><span class="v">' + pload + '</span></div></div>' +
      (p.partial ? '<p class="tiny muted">Ton plan commence aujourd\'hui : les jours d\'avant montrent ce que tu as fait.</p>' : '') +
      (p.preview ? '<p class="tiny muted">Ce plan sera recalculé samedi avec tes dernières sorties, puis envoyé vers ta montre.</p>' : '') +
      (PZ.length && p.offDays && p.offDays < 7 ? '<p class="tiny muted">' + PZ.map(function (z) { return E.PERIOD_LABEL[z.kind] + ' du ' + dShort(z.from) + ' au ' + dShort(z.to); }).join(" · ") + ' : pas de séance ces jours-là, le reste de la semaine ne change pas.</p>' : '') +
      (p.adjusted === "pause" ? '<p class="tiny muted">Retour de pause : la semaine repart un peu plus bas pour ne pas forcer, puis le plan reprend son cours.</p>' : p.adjusted ? '<p class="tiny muted">Semaine recalée : la précédente a été moins remplie que prévu, on ne saute pas de marche.</p>' : '') + '</section>';

    cut("resume");
    html += goalsCard(); cut("objectifs");
    html += seasonCard(ws); cut("saison");

    /* répartition */
    var bySport = { natation: 0, velo: 0, course: 0, padel: 0 };
    p.sessions.forEach(function (s) { if (!s.skip && bySport[s.sport] != null) bySport[s.sport] += s.dur; });
    var totS = sum(Object.keys(bySport).map(function (k) { return bySport[k]; })) || 1;
    html += '<section class="card"><div class="card-head"><h2>La semaine</h2><span class="tiny muted">' + short(ws) + ' → ' + short(addDays(ws, 6)) + '</span></div>' +
      '<div class="split" role="img" aria-label="Répartition du temps par sport">' + Object.keys(bySport).filter(function (k) { return bySport[k]; }).map(function (k) { return '<i class="' + k + '" style="width:' + (bySport[k] / totS * 100) + '%"></i>'; }).join("") + '</div>' +
      '<div class="legend">' + Object.keys(bySport).filter(function (k) { return bySport[k]; }).map(function (k) { return '<span class="' + k + '">' + SPORT[k] + ' ' + hm(bySport[k]) + '</span>'; }).join("") + '</div><div>';
    for (var d = 0; d < 7; d++) {
      var date = addDays(ws, d), list = p.sessions.filter(function (s) { return s.date === date; }), ex = date <= t ? extrasOn(date) : [];
      html += '<div class="dayrow' + (date === t ? ' today' : '') + '"><div class="dl"><b>' + DAYS[d] + '</b><span>' + parseISO(date).getDate() + '</span></div><div style="display:flex;flex-direction:column;gap:6px;min-width:0">';
      if (!list.length && !ex.length) html += p.off && p.off[date] ? '<div class="sess rest pause">' + E.PERIOD_LABEL[p.off[date]] + '</div>' : '<div class="sess rest">Repos</div>';
      list.forEach(function (s) { html += sessButton(s); });
      ex.forEach(function (a) { html += '<div class="sess extra ' + a.sport + '"><span class="nm">' + esc(a.name || SPORT[a.sport]) + '</span><span class="sb">Hors plan · ' + hm(a.dur / 60) + '</span></div>'; });
      var sts = list.filter(function (s) { return !s.skip; }).map(function (s) { return status(s, p); });
      var stt = sts.length ? (sts.every(function (x) { return x === "done"; }) ? "done" : sts.indexOf("miss") >= 0 ? "miss" : "none") : (ex.length ? "done" : "none");
      html += '</div><span class="st ' + (stt === "done" ? "done" : stt === "miss" ? "miss" : "none") + '" aria-label="' + ({ done: "fait", miss: "manqué" }[stt] || "") + '">' + (stt === "done" ? CHECK : stt === "miss" ? CROSS : "") + '</span></div>';
    }
    html += '</div>' + padelRow(ws, p) + '</section>';
    cut("jours");

    /* blessure et reprise */
    var im = S.train.injury.mode;
    html += '<section class="card"><div class="card-head"><h2>Blessure et reprise</h2></div><div class="seg acc" role="group" aria-label="Situation"><button data-act="injury" data-v="none" aria-pressed="' + (im === "none") + '">Normal</button><button data-act="injury" data-v="blesse" aria-pressed="' + (im === "blesse") + '">Blessé</button><button data-act="injury" data-v="reprise" aria-pressed="' + (im === "reprise") + '">Reprise</button></div>' +
      (im === "blesse" ? '<p class="small muted">Coche les sports que tu peux encore pratiquer : le plan les garde en endurance facile, sans séance clé. Rien de coché : repos complet.</p><div class="chips">' + E.SPORTS.map(function (sp) { return '<button class="chipbtn" data-act="injsport" data-s="' + sp + '" aria-pressed="' + !!S.train.injury.sports[sp] + '">' + SPORT[sp] + '</button>'; }).join("") + '</div>' +
        '<div class="field"><label for="inj-until">Reprise prévue le</label><input id="inj-until" type="date" value="' + esc(S.train.injury.until || "") + '" min="' + t + '"><span class="tiny muted">Le jour où ton médecin ou ton kiné te laisse reprendre. La reprise de ' + E.REPRISE_WEEKS + ' semaines démarre alors toute seule.</span></div>' + (S.train.injury.until ? rsportChips("Sports de la reprise") : '') : '') +
      (im === "reprise" ? '<p class="small muted">' + E.REPRISE_WEEKS + ' semaines progressives. La course revient sur route : footings avec côtes douces, puis côtes de reprise pour le psoas et le cardio. Natation et vélo en endurance, une séance un peu plus soutenue à partir de la 3e semaine. Ensuite, un nouveau cycle commence.</p>' + rsportChips("Sports repris") : '') +
      (im === "none" ? '<p class="small muted">En cas de blessure, passe en « Blessé » : le plan ne garde que les sports possibles. Quand tu reprends, passe en « Reprise » pour revenir progressivement.</p>' : '<p class="tiny muted">Si la douleur revient, recule d\'une semaine et parles-en à ton kiné ou ton médecin.</p>') + '</section>';

    cut("blessure");

    /* repos et vacances */
    var PER = S.train.periods.filter(function (z) { return z.to >= t; }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    html += '<section class="card"><div class="card-head"><h2>Repos et vacances</h2></div><p class="small muted">Une pause, pas une blessure : les séances de ces jours-là sont retirées, et le plan reprend ensuite là où il en est, avec la même préparation pour tes objectifs.</p>' +
      (PER.length ? '<div class="periods">' + PER.map(function (z) {
        var n = daysBetween(z.from, z.to) + 1, kp = E.SPORTS.filter(function (x) { return z.kind === "vacances" && z.sports && z.sports[x]; });
        return '<button class="period-row ' + z.kind + '" data-act="period" data-id="' + esc(z.id) + '"><span class="grow"><span class="nm">' + E.PERIOD_LABEL[z.kind] + (z.from <= t ? ' <span class="chip acc">En cours</span>' : '') + '</span><span class="tiny muted">Du ' + esc(dShort(z.from)) + ' au ' + esc(dShort(z.to)) + ' · ' + n + ' jour' + (n > 1 ? 's' : '') + (kp.length ? ' · entretien ' + kp.map(function (x) { return SPORT[x].toLowerCase(); }).join(", ") : '') + '</span></span><span class="chev" aria-hidden="true">›</span></button>';
      }).join("") + '</div>' : '') +
      '<button class="btn block" data-act="period">Ajouter une période</button></section>';
    cut("repos");

    /* envoi */
    if (!p.preview) {
      if (connected()) html += '<section class="card"><div class="row between"><div class="grow"><span class="eyebrow">Montre & compteur</span><p class="small">' + (p.pushedAt ? 'Envoyé vers Intervals.icu ' + ago(p.pushedAt) + '.' : 'Pas encore envoyé vers Intervals.icu.') + '</p><p class="tiny muted">Intervals.icu transmet ensuite les séances des 7 prochains jours à Garmin Connect.</p></div><button class="btn" data-act="push">' + (p.pushedAt ? 'Renvoyer' : 'Envoyer') + '</button></div></section>';
      else html += '<section class="card"><span class="eyebrow">Montre & compteur</span><p class="small muted">Connecte Intervals.icu pour envoyer ces séances vers ton Epix et ton Edge.</p><button class="btn block" data-act="connect">Connecter Intervals.icu</button></section>';
    }

    cut("montre");

    /* disponibilités */
    html += '<section class="card"><div class="card-head"><h2>Mes disponibilités</h2><span class="chip grey num" id="av-total">' + hm(sum(S.train.avail)) + ' / sem.</span></div><p class="small muted">Le temps maximum que tu peux t\'entraîner chaque jour. Le plan remplit ces créneaux selon ta forme.</p><div class="avail">' +
      S.train.avail.map(function (v, i) { return '<div class="li"><span class="lab">' + DAYS_LONG[i] + '</span><span class="val num' + (v ? '' : ' off') + '">' + (v ? hm(v) : 'Repos') + '</span><div class="stepper"><button data-act="avail" data-i="' + i + '" data-d="-15" aria-label="Moins de temps le ' + DAYS_LONG[i].toLowerCase() + '"' + (v ? '' : ' disabled') + '>−</button><button data-act="avail" data-i="' + i + '" data-d="15" aria-label="Plus de temps le ' + DAYS_LONG[i].toLowerCase() + '">+</button></div></div>'; }).join("") + '</div>' +
      '<div class="field"><span class="lab">Sports</span><div class="chips">' + E.SPORTS.map(function (s) { return '<button class="chipbtn" data-act="sport" data-s="' + s + '" aria-pressed="' + !!S.train.sports[s] + '">' + SPORT[s] + '</button>'; }).join("") + '</div></div>' +
      '<div class="field"><span class="lab">Priorité</span><div class="seg acc" role="group">' + PRIOS.map(function (o) { return '<button data-act="prio" data-v="' + o[0] + '" aria-pressed="' + (S.train.prio === o[0]) + '">' + o[1] + '</button>'; }).join("") + '</div></div>' +
      '<div class="field"><span class="lab">Course à pied</span><div class="seg acc" role="group"><button data-act="trail" data-v="non" aria-pressed="' + (S.train.trail === "non") + '">Route seulement</button><button data-act="trail" data-v="peu" aria-pressed="' + (S.train.trail !== "non") + '">Route + un peu de trail</button></div>' +
      '<span class="tiny muted">Par défaut, tout se fait sur route, comme le jour J. « Un peu de trail » remplace une sortie longue par cycle de 4 semaines par une sortie sur chemins, l\'hiver et au printemps.</span></div>' +
      '<label class="switch"><input type="checkbox" id="tr-bricks" data-act="bricks"' + (S.train.bricks !== false ? ' checked' : '') + '><span>Enchaînement vélo-course après la sortie longue (10 à 20 min de course)</span></label>' +
      '<div class="field"><span class="lab">Vélo en semaine</span><div class="seg acc" role="group"><button data-act="bikewe" data-v="0" aria-pressed="' + !S.train.bikeWE + '">Home trainer</button><button data-act="bikewe" data-v="1" aria-pressed="' + !!S.train.bikeWE + '">Week-end seulement</button></div><span class="tiny muted">D\'octobre à février, il fait nuit tôt : en semaine, le vélo se fait sur home trainer, ou pas du tout si tu n\'en as pas.</span></div>' +
      '<label class="switch"><input type="checkbox" id="tr-doubles" data-act="doubles"' + (S.train.doubles ? ' checked' : '') + '><span>Je peux faire 2 séances le même jour (par exemple natation le midi, course le soir)</span></label>' +
      '<button class="btn primary block" data-act="replan" id="replan-btn" disabled>Recalculer mon plan</button></section>';
    cut("dispos");

    html += '<section class="card"><details class="fold"><summary>Comment ton plan est construit</summary><ul class="keys" style="margin-top:10px">' +
      '<li>Des cycles de 4 semaines : 3 semaines où la charge monte (+10, +18, +26 % par rapport à ta base), puis une semaine allégée de 30 %.</li>' +
      '<li>Un thème par cycle, qui tourne : seuil vélo, natation, vitesse course. Les autres sports sont entretenus.</li>' +
      '<li>Au moins 2 séances par sport et par semaine : en triathlon, la régularité compte plus que la longueur, surtout en natation. Avec peu de jours disponibles, autorise 2 séances le même jour.</li>' +
      '<li>Une course enchaînée après la sortie longue à vélo, en semaine de charge : 10, puis 15, puis 20 minutes.</li>' +
      '<li>La course se fait sur route, comme le jour J. Les côtes, sur route aussi, musclent le psoas et les fessiers : elles servent de séance clé en hiver.</li>' +
      '<li>D\'octobre à février, les séances de vélo en semaine se font sur home trainer (ou seulement le week-end si tu préfères), et la sortie longue est plafonnée à 3 h, en pleine journée.</li>' +
      '<li>La natation se compte en mètres, aux allures de ton seuil (CSS) : renseigne-le dans Intervals.icu pour des allures justes.</li>' +
      '<li>La saison est tournée vers l\'été, où ont lieu la plupart des triathlons : foncier l\'hiver, développement au printemps, préparation spécifique en mai et juin, saison de juin à août, transition à l\'automne.</li>' +
      '<li>Ta base vient de tes vraies sorties : +6 % par cycle si tu as suivi au moins 80 % du plan, sinon on repart de ce que tu as fait.</li>' +
      '<li>La course à pied monte plus prudemment que le vélo : elle use davantage les muscles et les tendons.</li>' +
      '<li>Surtout de l\'endurance facile, une ou deux séances clés par semaine, jamais deux jours durs d\'affilée.</li>' +
      '<li>Chaque matin, si ta récupération est incomplète (VFC, FC de repos, sommeil), l\'accueil te propose d\'alléger la séance.</li>' +
      '</ul></details><button class="link" data-act="regen">Régénérer cette semaine</button></section>';
    cut("methode");
    el.innerHTML = html.slice(0, top) + arrange("entrainement", B);
  }

  /* ================= détail d'une séance ================= */
  function openRace(s) {
    var r = S.races.filter(function (x) { return x.id === s.raceId; })[0] || {}, I = E.raceInfo(r), T = I.T, w = weight(), rv = E.ravito(s, ravitoAvoid());
    var parts = T.parts ? '<div class="parts">' + T.parts.map(function (x) { return '<div class="li ' + x[0] + '"><b>' + SPORT[x[0]] + '</b><span>' + esc(x[1]) + ' · environ ' + E.durLabel(x[2]) + '</span></div>'; }).join("") + '</div>' :
      '<div class="parts"><div class="li ' + s.sport + '"><b>' + esc(T.label) + '</b><span>' + (r.km ? r.km + ' km' : '') + (r.dplus ? ' · ' + r.dplus + ' m D+' : '') + ' · environ ' + E.durLabel(I.dur) + '</span></div></div>';
    sheet('<div class="row wrap">' + sportChip(s.sport) + '<span class="chip acc">' + (r.prio === "B" ? 'Course de préparation' : 'Objectif principal') + '</span></div>' +
      '<div><span class="eyebrow">' + esc(longDate(s.date)) + '</span><h2 style="font-size:28px">' + esc(s.title) + '</h2><p class="small muted">' + esc(T.label) + '</p></div>' + parts +
      '<section class="card"><h3>Nutrition de course</h3><ul class="keys">' +
      (I.dur >= 90 ? '<li><b>Les 2 jours avant :</b> recharge en glucides, environ ' + Math.round(9 * w / 10) * 10 + ' g par jour (pâtes, riz, pain, fruits), avec des aliments que tu connais. Peu de fibres la veille.</li>' : '<li><b>La veille :</b> un repas normal, riche en féculents, rien de nouveau.</li>') +
      '<li><b>Le matin :</b> petit-déjeuner 3 h avant le départ, environ ' + Math.round(1.5 * w / 10) * 10 + ' g de glucides (pain et confiture, riz au lait, banane). Rien que tu n\'aies testé à l\'entraînement.</li>' +
      (rv ? '<li><b>Pendant :</b> ' + ravitoText(rv) + '. Bois ' + rv.water + ' par heure. ' + rv.salt + '</li>' : '<li><b>Pendant :</b> de l\'eau ; un gel 15 min avant le départ si tu veux.</li>') +
      '<li><b>Après :</b> dans l\'heure, des glucides et 20 à 30 g de protéines, puis un vrai repas.</li></ul></section>' +
      (T.kind === "tri" ? '<section class="card"><h3>La veille</h3><p class="small">Prépare ton matériel : combinaison, lunettes, bonnet, casque, chaussures vélo et course, lacets élastiques, dossard, ceinture porte-dossard, ravitaillement. Repère le parc à vélos et les sorties de transition.</p></section>' : '') +
      '<button class="btn block" data-act="goal" data-id="' + esc(r.id || "") + '">Modifier l\'objectif</button><button class="btn block" data-sheet="close">Fermer</button>');
  }
  function openSession(date, eid) {
    var ws = mondayOf(date), p = weekPlan(ws), all = sessionsOn(date), s = all.filter(function (x) { return x.eid === eid; })[0] || all[0]; if (!s) return;
    if (s.race) return openRace(s);
    var z = zones(), st = status(s, p), m = matches(s), t = today();
    var blocks = s.blocks.map(function (b) {
      return '<div class="blk"><div class="bh"><span>' + esc(b.name || "Séance") + '</span>' + (b.reps > 1 ? '<span class="rep">' + b.reps + ' fois</span>' : '') + '</div>' +
        b.steps.map(function (x) { var v = E.stepView(s.sport, x, z); return '<div class="stp"><span class="du">' + esc(v.du) + '</span><span><span class="zc" style="background:' + zoneColor(x[1]) + '"></span>' + (x[2] ? esc(x[2]) + ' · ' : '') + '<span class="tg">' + esc(v.tg) + '</span></span></div>'; }).join("") + '</div>';
    }).join("");
    var r = E.ravito(s, ravitoAvoid()), n = needsFor(date);
    var nutri = s.brick ? '<section class="card"><h3>Nutrition autour de la séance</h3><ul class="keys"><li><b>Avant :</b> c\'est ton ravitaillement à vélo qui compte. Finis ton bidon dans les 20 dernières minutes de vélo.</li><li><b>Pendant :</b> rien de plus pour quelques minutes de course.</li><li><b>Après :</b> dans l\'heure, environ ' + Math.round(weight()) + ' g de glucides et 20 à 30 g de protéines.</li></ul></section>' :
      '<section class="card"><h3>Nutrition autour de la séance</h3><ul class="keys">' +
      ((s.key || s.long) ? '<li><b>Avant :</b> un repas riche en glucides 3 h avant (riz, pâtes, pain), ou une collation 1 h avant (banane, tartine de miel).</li>' : '<li><b>Avant :</b> pas besoin de manger spécialement, sauf si ton dernier repas date de plus de 4 h.</li>') +
      (r ? '<li><b>Pendant :</b> ' + ravitoText(r) + '. Bois ' + r.water + ' par heure. ' + r.salt + '</li>' : (s.sport === "natation" ? '<li><b>Pendant :</b> une gourde d\'eau en bord de bassin.</li>' : '<li><b>Pendant :</b> de l\'eau suffit.</li>')) +
      ((s.key || s.long) ? '<li><b>Après :</b> dans l\'heure, environ ' + Math.round(weight()) + ' g de glucides et 20 à 30 g de protéines (smoothie récup, skyr + banane + avoine).</li>' : '') +
      '</ul>' + (n ? '<p class="tiny muted">Ce jour-là : ' + n.kcal + ' kcal, ' + n.C + ' g de glucides (' + esc(n.label.toLowerCase()) + ').</p>' : '') + '</section>';
    var done = st === "done" ? '<div class="verdict"><span class="chip good">Faite</span><p class="small">' + m.map(function (a) { return esc(a.name) + ' · ' + hm(a.dur / 60) + distLabel(a) + (a.dplus ? ' · ' + Math.round(a.dplus) + ' m D+' : '') + ' · charge ' + Math.round(a.load) + (a.hr ? ' · FC moy. ' + Math.round(a.hr) : ''); }).join('<br>') + '</p></div>' : '';
    var acts = "";
    if (S.plans[ws] && date >= t && st !== "done") {
      acts = '<div class="two">' + (s.light || s.skip ? '<button class="btn" id="se-restore">Rétablir la séance</button>' : s.brick || s.extra ? '' : '<button class="btn" id="se-light">Alléger</button>') + (s.skip ? '' : '<button class="btn" id="se-skip">Je saute</button>') + '</div>';
    }
    sheet('<div class="row wrap">' + sportChip(s.sport) + (s.key ? '<span class="chip acc">Séance clé</span>' : '') + (s.long ? '<span class="chip acc">Sortie longue</span>' : '') + (s.brick ? '<span class="chip acc">Enchaînement</span>' : '') + (s.trail ? '<span class="chip grey">Trail</span>' : '') + (s.light ? '<span class="chip warn">Allégée</span>' : '') + (s.skip ? '<span class="chip grey">Sautée</span>' : '') + '</div>' +
      '<div><span class="eyebrow">' + esc(longDate(date)) + '</span><h2 style="font-size:28px">' + esc(s.title) + '</h2><p class="small muted">' + hm(s.dur) + ' · ' + esc(s.sub) + ' · charge ~' + s.load + '</p></div>' + done +
      (s.note ? '<p class="small">' + esc(s.note) + '</p>' : '') + '<div class="blocks">' + blocks + '</div>' +
      (s.extra ? '<p class="tiny muted">Pas envoyée sur ta montre. Enregistre ta partie sur ton Epix : elle remontera par Intervals.icu et comptera dans ta forme.</p>' :
        s.sport === "natation" ? '<p class="tiny muted">' + (z.css ? '' : 'Les allures au 100 m s\'afficheront une fois ton seuil de natation (CSS) renseigné dans Intervals.icu. ') + 'Sur ta montre, c\'est une séance piscine : vérifie la première, Garmin affiche parfois des longueurs comme des éducatifs.</p>' : (!z.ftp && !z.lthrRide && !z.lthrRun ? '<p class="tiny muted">Les zones s\'afficheront en watts et en bpm une fois Intervals.icu connecté (seuils FTP et FC).</p>' : '')) +
      nutri + acts +
      (s.extra ? '' : '<details class="fold"><summary>Texte envoyé à Intervals.icu</summary><div class="code">' + esc(E.icuText(s, zoneOpts())) + '</div></details>') +
      '<button class="btn block" data-sheet="close">Fermer</button>', function (root) {
      function apply(fn) {
        var pl = S.plans[ws], i = pl.sessions.indexOf(s); if (i < 0) return;
        pl.sessions[i] = fn(s); save(); closeSheet(); render(); autoPush(ws);
      }
      var bl = root.querySelector("#se-light"), bs = root.querySelector("#se-skip"), br = root.querySelector("#se-restore");
      if (bl) bl.addEventListener("click", function () { apply(function (o) { return lightened(o, (E.readiness(S.wellness, date) || {}).status); }); toast("Séance allégée"); });
      if (bs) bs.addEventListener("click", function () { apply(function (o) { o.skip = true; return o; }); toast("Séance sautée"); });
      if (br) br.addEventListener("click", function () { apply(function (o) { if (o.orig) { var r0 = o.orig; r0.icuId = o.icuId; delete r0.skip; return r0; } delete o.skip; return o; }); toast("Séance rétablie"); });
    });
  }

  /* ================= SUIVI ================= */
  function renderSuivi() {
    var el = $("view-suivi"), html = demoBanner();
    html += '<div class="seg" role="group" aria-label="Affichage">' + [["forme", "Forme"], ["zones", "Zones"], ["sorties", "Sorties"], ["poids", "Poids"]].map(function (o) { return '<button data-act="suiviseg" data-v="' + o[0] + '" aria-pressed="' + (suiviSeg === o[0]) + '">' + o[1] + '</button>'; }).join("") + '</div>';
    if (suiviSeg === "forme") html += formeHTML(); else if (suiviSeg === "zones") html += zonesHTML(); else if (suiviSeg === "sorties") html += sortiesHTML(); else html += poidsHTML();
    el.innerHTML = html;
    var ch = el.querySelector("[data-chart]"); if (ch) bindChart(ch);
  }
  var chartData = null;
  function formeHTML() {
    if (!hasData()) return '<div class="empty">Ta courbe de forme apparaît dès que tes sorties sont importées.</div>' + connectCTA();
    var t = today(), fs = fitness(addDays(t, -84), addDays(t, 14)), cur = fs.filter(function (x) { return x.d === t; })[0] || fs[fs.length - 1], fz = E.formZone(cur.tsb, cur.ctl);
    var wk = fs.filter(function (x) { return x.d === addDays(t, -7); })[0], ramp = wk ? cur.ctl - wk.ctl : 0;
    var html = '<div class="stats four"><div class="stat"><span class="eyebrow">Condition</span><span class="v">' + Math.round(cur.ctl) + '</span></div><div class="stat"><span class="eyebrow">Fatigue</span><span class="v">' + Math.round(cur.atl) + '</span></div><div class="stat"><span class="eyebrow">Forme</span><span class="v">' + sign(Math.round(cur.tsb), 0) + '</span></div><div class="stat"><span class="eyebrow">7 jours</span><span class="v">' + sign(ramp, 1) + '</span></div></div>' +
      '<div class="verdict"><span class="chip ' + fz.tone + '">' + fz.label + '</span><p class="small">' + fz.hint + (ramp > 7 ? ' Ta condition monte très vite (+' + fmt(ramp, 1) + ' en 7 jours) : surveille la fatigue.' : '') + '</p></div>';
    chartData = fs;
    html += '<section class="card"><div class="card-head"><h2>12 semaines</h2><span class="tiny muted">touche la courbe</span></div><div class="chart" data-chart="forme">' + formeChart(fs, t) + '</div>' +
      '<div class="legend"><span class="ln" style="--sc:' + C.acc + '">Condition</span><span class="ln" style="--sc:' + C.muted + '">Fatigue</span><span class="ln dash" style="--sc:' + C.acc + '">Prévu</span></div>' +
      '<p class="tiny muted">Condition : ta charge moyenne des 6 dernières semaines. Fatigue : celle des 7 derniers jours. Forme = condition − fatigue (barres du bas).</p></section>';
    var hrv = [], rhr = [];
    for (var i = 41; i >= 0; i--) { var w = S.wellness[addDays(t, -i)]; hrv.push(w && w.hrv > 0 ? w.hrv : null); rhr.push(w && w.rhr > 0 ? w.rhr : null); }
    if (hrv.filter(Boolean).length >= 7 || rhr.filter(Boolean).length >= 7) {
      html += '<section class="card"><div class="card-head"><h2>Récupération</h2><span class="tiny muted">6 semaines · Garmin</span></div>' +
        (hrv.filter(Boolean).length >= 7 ? miniLine(hrv, "VFC (ms)", C.acc) : '') + (rhr.filter(Boolean).length >= 7 ? miniLine(rhr, "FC de repos (bpm)", C.warn) : '') +
        '<p class="tiny muted">Une VFC qui baisse ou une FC de repos qui monte plusieurs jours de suite signalent une fatigue qui s\'accumule.</p></section>';
    }
    return html;
  }
  function connectCTA() { return connected() || S.demo ? '' : '<button class="btn primary block" data-act="connect">Connecter Intervals.icu</button><button class="btn block" data-act="demo">Essayer avec des sorties d\'exemple</button>'; }
  function formeChart(fs, t) {
    var W = 340, H = 220, L = 30, R = 8, T = 10, top = 140, gap = 14, bH = H - top - gap - 18;
    var mx = Math.max(20, Math.max.apply(null, fs.map(function (x) { return Math.max(x.ctl, x.atl); }))) * 1.08;
    var mn = Math.max(0, Math.floor((Math.min.apply(null, fs.map(function (x) { return Math.min(x.ctl, x.atl); })) - 5) / 10) * 10), tsbMax = Math.max(10, Math.max.apply(null, fs.map(function (x) { return Math.abs(x.tsb); })));
    var n = fs.length;
    function x(i) { return L + i * (W - L - R) / (n - 1); }
    function y(v) { return T + (mx - v) / (mx - mn) * (top - T); }
    var y0 = top + gap + bH / 2;
    function yb(v) { return y0 - v / tsbMax * (bH / 2); }
    var g = "", step = mx - mn > 80 ? 40 : mx - mn > 40 ? 20 : 10;
    for (var v = mn; v <= mx; v += step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + v + '</text>';
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y0 + '" y2="' + y0 + '" stroke="' + C.line2 + '"/><text x="' + (L - 5) + '" y="' + (y0 + 3) + '" text-anchor="end">0</text><text x="' + (W - R) + '" y="' + (top + gap - 2) + '" text-anchor="end">forme</text>';
    var ti = fs.findIndex(function (q) { return q.d === t; }); if (ti < 0) ti = n - 1;
    function path(key, from, to) { var s = ""; for (var i = from; i <= to; i++) s += (i === from ? "M" : "L") + x(i).toFixed(1) + " " + y(fs[i][key]).toFixed(1); return s; }
    var lines = '<path d="' + path("atl", 0, ti) + '" fill="none" stroke="' + C.muted + '" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="' + path("ctl", 0, ti) + '" fill="none" stroke="' + C.acc + '" stroke-width="2.5" stroke-linejoin="round"/>';
    if (ti < n - 1) lines += '<path d="' + path("atl", ti, n - 1) + '" fill="none" stroke="' + C.muted + '" stroke-width="1.5" stroke-dasharray="3 3"/><path d="' + path("ctl", ti, n - 1) + '" fill="none" stroke="' + C.acc + '" stroke-width="2.5" stroke-dasharray="4 3"/>';
    var bw = Math.max(1.5, (W - L - R) / n - 1.2), bars = "";
    fs.forEach(function (q, i) {
      var z = E.formZone(q.tsb, q.ctl), c = z.tone === "bad" ? C.bad : z.k === "optimal" ? C.acc : z.k === "frais" ? C.natation : C.faint;
      var a = yb(Math.max(0, q.tsb)), b = yb(Math.min(0, q.tsb));
      bars += '<rect x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + a.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0.5, b - a).toFixed(1) + '" fill="' + c + '"' + (q.fut ? ' opacity=".45"' : '') + '/>';
    });
    var xl = "";
    fs.forEach(function (q, i) { if (dow(q.d) === 0 && (daysBetween(q.d, t) % 28 === 0 || i === 0) && Math.abs(i - ti) >= 7) xl += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle">' + short(q.d) + '</text>'; });
    var today_ = '<line x1="' + x(ti).toFixed(1) + '" x2="' + x(ti).toFixed(1) + '" y1="' + T + '" y2="' + (H - 16) + '" stroke="' + C.faint + '" stroke-dasharray="2 3"/><text x="' + x(ti).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" style="fill:' + C.ink + '">auj.</text>';
    var cur = fs[ti], lab = '<text x="' + (x(ti) - 4).toFixed(1) + '" y="' + (y(cur.ctl) - 7).toFixed(1) + '" text-anchor="end" style="fill:' + C.ink + ';font-weight:600">' + Math.round(cur.ctl) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Condition ' + Math.round(cur.ctl) + ', fatigue ' + Math.round(cur.atl) + ', forme ' + Math.round(cur.tsb) + '">' + g + bars + lines + today_ + lab + xl +
      '<line class="cross" x1="0" x2="0" y1="' + T + '" y2="' + (H - 16) + '" stroke="' + C.ink + '" stroke-width="1" opacity="0"/><rect x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent" class="hit"/></svg>';
  }
  function bindChart(el) {
    var svg = el.querySelector("svg"), hit = svg.querySelector(".hit"), cross = svg.querySelector(".cross"), tip = null;
    function at(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * 340, n = chartData.length;
      var i = Math.max(0, Math.min(n - 1, Math.round((px - 30) / (340 - 38) * (n - 1)))), q = chartData[i];
      var xx = 30 + i * (340 - 38) / (n - 1);
      cross.setAttribute("x1", xx); cross.setAttribute("x2", xx); cross.setAttribute("opacity", ".6");
      if (!tip) { tip = document.createElement("div"); tip.className = "tip"; el.appendChild(tip); }
      tip.innerHTML = esc(parseISO(q.d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })) + (q.fut ? " (prévu)" : "") + "<br>Condition " + Math.round(q.ctl) + " · Fatigue " + Math.round(q.atl) + "<br>Forme " + sign(Math.round(q.tsb), 0) + (q.load ? " · charge " + Math.round(q.load) : "");
      var left = xx / 340 * r.width; tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, left - tip.offsetWidth / 2)) + "px";
    }
    function off() { cross.setAttribute("opacity", "0"); if (tip) { tip.remove(); tip = null; } }
    hit.addEventListener("pointermove", at); hit.addEventListener("pointerdown", at); hit.addEventListener("pointerleave", off);
  }
  function miniLine(vals, label, color) {
    var pts = vals.map(function (v, i) { return v == null ? null : [i, v]; }).filter(Boolean);
    var vs = pts.map(function (p) { return p[1]; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi - lo < 4) { lo -= 2; hi += 2; }
    var W = 300, H = 50, n = vals.length;
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + (4 + p[0] * (W - 8) / (n - 1)).toFixed(1) + " " + (4 + (hi - p[1]) / (hi - lo) * (H - 8)).toFixed(1); }).join(" ");
    var last = vs[vs.length - 1], avg = vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
    return '<div class="row between"><span class="small">' + label + '</span><span class="small num"><b>' + Math.round(last) + '</b> <span class="muted">· moy. ' + Math.round(avg) + '</span></span></div><svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + label + ' sur 6 semaines"><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  function sortiesHTML() {
    var t = today(), ws0 = mondayOf(t), weeks = [];
    for (var i = 11; i >= 0; i--) {
      var ws = addDays(ws0, -7 * i), end = addDays(ws, 7), h = { natation: 0, velo: 0, course: 0 };
      actList().forEach(function (a) { if (a.date >= ws && a.date < end && h[a.sport] != null) h[a.sport] += a.dur / 3600; });
      weeks.push({ ws: ws, h: h });
    }
    var html = '<button class="btn block" data-act="addact">Ajouter une sortie à la main</button>';
    if (!hasData()) return html + '<div class="empty">Aucune sortie pour l\'instant.</div>' + connectCTA();
    var mx = Math.max(4, Math.max.apply(null, weeks.map(function (w) { return w.h.natation + w.h.velo + w.h.course; }))), W = 340, H = 170, L = 26, B = 20, T = 8, bw = (W - L - 6) / 12;
    var g = "";
    for (var v = 0; v <= mx; v += mx > 12 ? 4 : 2) { var yy = T + (mx - v) / mx * (H - T - B); g += '<line x1="' + L + '" x2="' + W + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end">' + v + 'h</text>'; }
    var bars = "";
    weeks.forEach(function (w, i) {
      var x0 = L + i * bw + 3, y = H - B;
      ["natation", "velo", "course"].forEach(function (s) {
        var hh = w.h[s] / mx * (H - T - B); if (hh < 0.5) return;
        bars += '<rect x="' + x0.toFixed(1) + '" y="' + (y - hh + 1).toFixed(1) + '" width="' + (bw - 6).toFixed(1) + '" height="' + Math.max(1, hh - 2).toFixed(1) + '" rx="2" fill="' + C[s] + '"><title>' + SPORT[s] + ' ' + hm(w.h[s] * 60) + '</title></rect>'; y -= hh;
      });
      if (i % 3 === 2 || i === 11) bars += '<text x="' + (x0 + (bw - 6) / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + short(w.ws) + '</text>';
    });
    var tot = weeks.slice(-4).reduce(function (a, w) { return a + w.h.natation + w.h.velo + w.h.course; }, 0) / 4;
    html += '<section class="card"><div class="card-head"><h2>Volume</h2><span class="tiny muted">' + fmt(tot, 1) + ' h/sem. sur 4 semaines</span></div><div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Heures par semaine et par sport sur 12 semaines">' + g + bars + '</svg></div>' +
      '<div class="legend"><span class="natation">Natation</span><span class="velo">Vélo</span><span class="course">Course</span></div></section>';
    var recent = actList().filter(function (a) { return a.date >= addDays(t, -30); }).slice().reverse();
    html += '<section class="card"><div class="card-head"><h2>30 derniers jours</h2><span class="tiny muted">' + recent.length + ' sortie' + (recent.length > 1 ? 's' : '') + '</span></div><div>' +
      (recent.length ? recent.map(function (a) {
        return actRow(a, true);
      }).join("") : '<div class="empty">Rien sur les 30 derniers jours.</div>') + '</div></section>';
    return html;
  }
  /* ---- temps par zone ---- */
  /* Rampe turquoise d'une seule teinte, de sombre (Z1, facile) à clair (Z5, intense) : les zones sont ordonnées. */
  var ZRAMP = ["#357971", "#2FA094", "#36C6B8", "#67E6D7", "#ADFDF2"];
  var ZNAME = ["Récupération", "Endurance", "Tempo", "Seuil", "Au-dessus du seuil"];
  var zoneSport = "", zoneWeek = null;
  function zonesHTML() {
    var t = today(), ws0 = mondayOf(t), from4 = addDays(ws0, -21), end = addDays(ws0, 7), sp = zoneSport || null;
    var html = '<div class="chips" role="group" aria-label="Sport" style="margin:2px 0 12px">' + [["", "Tous"], ["natation", "Natation"], ["velo", "Vélo"], ["course", "Course"]].map(function (o) {
      return '<button class="chipbtn" data-act="zonesp" data-v="' + o[0] + '" aria-pressed="' + (zoneSport === o[0]) + '">' + o[1] + '</button>'; }).join("") + '</div>';
    var z = E.zoneTotals(actList(), from4, end, sp);
    if (!z.tot) return html + '<div class="empty">' + (hasData() ? 'Pas encore de temps par zone sur les 4 dernières semaines. Ils arrivent avec tes sorties Garmin par Intervals.icu (fréquence cardiaque, ou puissance à vélo).' : 'Aucune sortie pour l\'instant.') + '</div>' + (hasData() ? '' : connectCTA());
    /* 4 dernières semaines : part de chaque zone, et le repère facile / intense */
    var pct = function (x) { return Math.round(x * 100); };
    html += '<section class="card"><div class="card-head"><h2>4 dernières semaines</h2><span class="tiny muted">' + hm(z.tot / 60) + ' · ' + z.n + ' sortie' + (z.n > 1 ? 's' : '') + '</span></div>' +
      '<div class="zbig"><div><span class="bigval num">' + pct(z.easy) + '<small>%</small></span><span class="eyebrow">Facile · Z1-Z2</span></div><div><span class="bigval num">' + pct(z.mod) + '<small>%</small></span><span class="eyebrow">Modéré · Z3</span></div><div><span class="bigval num">' + pct(z.hard) + '<small>%</small></span><span class="eyebrow">Intense · Z4-Z5</span></div></div>' +
      '<div class="zbar" role="img" aria-label="Répartition du temps par zone">' + z.t.map(function (s, i) { return s ? '<i style="flex:' + s + ';background:' + ZRAMP[i] + '"></i>' : ''; }).join("") + '</div>' +
      '<div class="zlist">' + z.t.map(function (s, i) { return '<div class="li"><span class="zk" style="background:' + ZRAMP[i] + '"></span><span class="grow"><b>Z' + (i + 1) + '</b> <span class="muted">' + ZNAME[i] + '</span></span><span class="num">' + hm(s / 60) + '</span><span class="num muted zp">' + pct(s / z.tot) + ' %</span></div>'; }).join("") + '</div>' +
      '<p class="small muted">' + (z.easy >= 0.75 ? 'Bonne base : en endurance, on vise environ 80 % du temps en facile.' : z.easy >= 0.65 ? 'Un peu plus d\'intensité que le repère : en endurance, on vise environ 80 % du temps en facile.' : 'Beaucoup d\'intensité : en endurance, on vise environ 80 % du temps en facile (Z1-Z2).') + '</p></section>';
    /* 12 semaines : heures par zone, empilées */
    var weeks = [];
    for (var i = 11; i >= 0; i--) { var w = addDays(ws0, -7 * i); weeks.push({ ws: w, z: E.zoneTotals(actList(), w, addDays(w, 7), sp) }); }
    var mx = Math.max(2, Math.max.apply(null, weeks.map(function (w) { return w.z.tot / 3600; }))), W = 340, H = 170, L = 26, B = 20, T = 8, bw = (W - L - 6) / 12, g = "", bars = "";
    var stepY = mx > 12 ? 4 : mx > 6 ? 2 : 1;
    for (var v = 0; v <= mx; v += stepY) { var yy = T + (mx - v) / mx * (H - T - B); g += '<line x1="' + L + '" x2="' + W + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end">' + v + ' h</text>'; }
    weeks.forEach(function (w, k) {
      var x0 = L + k * bw + 3, y = H - B, sel = zoneWeek === w.ws;
      var seg = "";
      w.z.t.forEach(function (s, i) {
        var hh = s / 3600 / mx * (H - T - B); if (hh < 0.5) return;
        seg += '<rect x="' + x0.toFixed(1) + '" y="' + (y - hh + 1).toFixed(1) + '" width="' + (bw - 6).toFixed(1) + '" height="' + Math.max(1, hh - 2).toFixed(1) + '" rx="2" fill="' + ZRAMP[i] + '"/>';
        y -= hh;
      });
      bars += '<g class="zwk" data-act="zoneweek" data-w="' + w.ws + '"' + (zoneWeek && !sel ? ' opacity=".45"' : '') + '><rect x="' + (x0 - 3).toFixed(1) + '" y="' + T + '" width="' + bw.toFixed(1) + '" height="' + (H - T - B + 4) + '" fill="transparent"/>' + seg + '</g>';
      if (k % 3 === 2 || k === 11) bars += '<text x="' + (x0 + (bw - 6) / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + short(w.ws) + '</text>';
    });
    var sw = weeks.filter(function (w) { return w.ws === zoneWeek; })[0];
    html += '<section class="card"><div class="card-head"><h2>Semaine par semaine</h2><span class="tiny muted">touche une semaine</span></div>' +
      '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Heures par zone sur 12 semaines">' + g + bars + '</svg></div>' +
      '<div class="legend">' + ZRAMP.map(function (c, i) { return '<span style="--sc:' + c + '">Z' + (i + 1) + '</span>'; }).join("") + '</div>' +
      (sw ? '<p class="small num" style="margin-top:8px"><b>Semaine du ' + short(sw.ws) + '</b> · ' + (sw.z.tot ? sw.z.t.map(function (s, i) { return s ? 'Z' + (i + 1) + ' ' + hm(s / 60) : ''; }).filter(Boolean).join(' · ') + ' · ' + pct(sw.z.easy) + ' % facile' : 'pas de temps par zone') + '</p>' : '') + '</section>';
    var srcs = {}; actList().forEach(function (a) { if (a.zs && a.date >= from4) srcs[a.zs] = true; });
    html += '<p class="tiny muted" style="margin:0 4px 16px">Zones de ' + (srcs.power ? 'puissance à vélo quand ton capteur les donne, sinon ' : '') + 'fréquence cardiaque' + (srcs.pace ? ' ou d\'allure' : '') + ', telles que réglées dans Intervals.icu. Les zones au-delà de la 5e comptent en Z5.' + (z.miss ? ' ' + z.miss + ' sortie' + (z.miss > 1 ? 's' : '') + ' sans données de zones (ajoutée' + (z.miss > 1 ? 's' : '') + ' à la main ou sans cardio).' : '') + '</p>';
    return html;
  }
  function actRow(a, del) {
    return '<div class="act ' + a.sport + '"><span class="nm"><span>' + esc(a.name || SPORT[a.sport]) + '</span></span><span class="ld">' + (a.load ? 'charge ' + Math.round(a.load) : '') + '</span><span class="meta">' + esc(short(a.date)) + ' · ' + (/TrailRun/.test(a.type || '') ? 'Trail' : SPORT[a.sport]) + ' · ' + hm(a.dur / 60) + distLabel(a) + (a.dplus ? ' · ' + Math.round(a.dplus) + ' m D+' : '') + (a.hr ? ' · ' + Math.round(a.hr) + ' bpm' : '') + (del && a.src === "Manuel" ? ' · <button class="link" data-act="delact" data-id="' + esc(a.id) + '">Supprimer</button>' : '') + '</span></div>';
  }
  function poidsHTML() {
    var t = today(), tw = S.weights[t], all = {};
    Object.keys(S.wellness).forEach(function (k) { if (S.wellness[k].weight > 0) all[k] = S.wellness[k].weight; });
    Object.keys(S.weights).forEach(function (k) { all[k] = S.weights[k]; });
    var keys = Object.keys(all).filter(function (k) { return k >= addDays(t, -90); }).sort();
    var html = '<section class="card"><div class="card-head"><h2>Pesée du jour</h2><span class="tiny muted">' + esc(longDate(t)) + '</span></div>';
    if (typeof tw === "number") html += '<div class="row between"><div class="bigval num">' + fmt(tw, 1) + '<small>kg</small></div><button class="btn" data-act="editw">Modifier</button></div>';
    else html += '<p class="small muted">Le matin, à jeun. Si ta balance est reliée à Garmin, le poids arrive tout seul par Intervals.icu.</p><div class="row"><input id="today-w" type="text" inputmode="decimal" placeholder="' + fmt(weight(), 1) + '" aria-label="Poids du jour en kg" style="font-family:var(--display);font-size:26px;font-weight:700;text-align:center"><button class="btn primary" data-act="savew">Enregistrer</button></div>';
    html += '</section>';
    if (keys.length >= 2) {
      var vals = keys.map(function (k) { return all[k]; }), lo = Math.floor(Math.min.apply(null, vals) - 0.5), hi = Math.ceil(Math.max.apply(null, vals) + 0.5); if (hi - lo < 2) hi = lo + 2;
      var W = 340, H = 160, L = 30, R = 8, T = 10, B = 20, n = daysBetween(keys[0], t) || 1;
      var x = function (k) { return L + daysBetween(keys[0], k) / n * (W - L - R); }, y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
      var g = ""; for (var v = lo; v <= hi; v += (hi - lo > 6 ? 2 : 1)) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="' + C.line + '"/><text x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + v + '</text>';
      var dots = keys.map(function (k) { return '<circle cx="' + x(k).toFixed(1) + '" cy="' + y(all[k]).toFixed(1) + '" r="2.5" fill="' + C.muted + '"/>'; }).join("");
      var avg = keys.map(function (k) { var w = keys.filter(function (j) { return j <= k && j > addDays(k, -7); }).map(function (j) { return all[j]; }); return [k, sum(w) / w.length]; });
      var line = '<path d="' + avg.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join(" ") + '" fill="none" stroke="' + C.acc + '" stroke-width="2.5" stroke-linejoin="round"/>';
      var first = avg[Math.min(6, avg.length - 1)][1], last = avg[avg.length - 1][1], span = Math.max(1, daysBetween(avg[Math.min(6, avg.length - 1)][0], keys[keys.length - 1]) / 30.4);
      html += '<section class="card"><div class="card-head"><h2>90 jours</h2><span class="tiny muted">' + sign((last - first) / span, 1) + ' kg/mois</span></div><div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Poids sur 90 jours">' + g + dots + line + '<text x="' + L + '" y="' + (H - 4) + '">' + short(keys[0]) + '</text><text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">' + short(t) + '</text></svg></div>' +
        '<div class="legend"><span class="ln" style="--sc:' + C.acc + '">Moyenne sur 7 jours</span><span style="--sc:' + C.muted + '">Pesées</span></div>' +
        '<p class="tiny muted">En endurance, un poids stable avec plus de volume est bon signe. Une baisse rapide (plus d\'1 kg par mois) sans le vouloir veut dire que tu ne manges pas assez pour ta charge.</p></section>';
    } else html += '<div class="empty">La courbe apparaît après quelques pesées.</div>';
    return html;
  }

  /* ================= REPAS ================= */
  function renderRepas() {
    var el = $("view-repas"), t = today(), menu = dayMenu(t);
    if (!menu) { el.innerHTML = '<div class="empty">Complète ton profil pour calculer tes besoins.</div>'; return; }
    var n = menu.n, eaten = 0, total = 0, left = 0;
    function loggedRow(m, short, lg) {
      var lt = E.logTotals(lg); total += lt.K; eaten += lt.K;
      return '<div class="tl done"><button class="check" role="checkbox" aria-checked="true" data-act="logm" data-m="' + m + '" aria-label="' + esc(short) + ' noté">' + CHECK + '</button>' +
        '<button class="txt" data-act="logm" data-m="' + m + '"><span class="eyebrow">' + esc(short) + ' · noté</span><span class="nm">' + esc(lg.map(function (e) { return e.n; }).join(", ")) + '</span></button><span class="k">' + Math.round(lt.K) + ' kcal</span></div>';
    }
    var rows = D.MOMENTS.map(function (mo, i) {
      var lg = logOf(mo.k, t); if (lg) return loggedRow(mo.k, mo.short, lg);
      var id = menu.picks[i], d = isDone(mo.k, t), mc = RBY[id] ? macros(RBY[id].ing, menu.k) : null;
      if (mc) { total += mc[0]; if (d) eaten += mc[0]; else left += mc[0]; }
      return '<div class="tl' + (d ? ' done' : '') + '"><button class="check" role="checkbox" aria-checked="' + d + '" data-act="eat-toggle" data-m="' + mo.k + '" aria-label="' + esc(mo.label) + ' mangé">' + CHECK + '</button>' +
        '<button class="txt" data-act="choose" data-m="' + mo.k + '" data-date="' + t + '"><span class="eyebrow">' + esc(mo.short) + '</span><span class="nm">' + esc(recipeName(id)) + '</span></button><span class="k">' + (mc ? Math.round(mc[0]) + ' kcal' : '—') + '</span></div>';
    }).join("");
    var exRow = logOf("extra", t) ? loggedRow("extra", "Apéro et extras", logOf("extra", t)) : '', rest = menu.day.K - eaten;
    var html = '<section class="card"><div class="card-head"><h2>Aujourd\'hui</h2><span class="chip grey">' + esc(n.label) + '</span></div>' +
      '<div class="macros-row"><span><b>' + n.kcal + '</b>kcal</span><span><b>' + n.C + '</b>g gluc.</span><span><b>' + n.P + '</b>g prot.</span><span><b>' + n.F + '</b>g lip.</span></div>' +
      '<div class="bar" aria-hidden="true"><i style="width:' + (total ? Math.min(100, eaten / total * 100) : 0) + '%"></i></div><p class="tiny muted num">' + Math.round(eaten) + ' / ' + Math.round(total) + ' kcal dans tes repas' + (n.ravitoC ? ' + ' + n.ravitoC + ' g de glucides pendant l\'effort' : '') + ' · touche un repas pour en changer</p>' +
      '<div class="today-list">' + rows + exRow + '</div>' +
      (menu.logged.K ? '<p class="tiny muted num">' + (rest <= 0 ? 'Ta journée est déjà couverte : les portions de tes recettes sont au plus bas.' :
        left > rest * 1.1 ? 'Il te reste environ ' + Math.round(rest) + ' kcal. Tes recettes du jour sont réduites au plus bas (' + Math.round(left) + ' kcal).' :
        'Il te reste environ ' + Math.round(rest) + ' kcal : les portions de tes recettes sont ajustées.') + '</p>' : '') +
      '<div class="row" style="margin-top:10px"><button class="btn grow" data-act="logm" data-m="' + MK[slotNow()] + '">J\'ai mangé autre chose</button><button class="btn" data-act="logm" data-m="extra">Apéro, verre…</button></div></section>';
    if (n.ravito.length) {
      var r = n.ravito[0];
      html += '<section class="card"><div class="card-head"><h2>Pendant l\'effort</h2><span class="chip acc">' + r.gph + ' g/h</span></div><div class="ravito">' +
        Object.keys(r.items).filter(function (k) { return r.items[k]; }).map(function (k) { return '<div class="li"><b class="num">' + r.items[k] + '</b><div><span>' + esc(D.RAVITO[k].label) + '</span><br><span class="tiny muted">' + esc(D.RAVITO[k].how) + '</span></div></div>'; }).join("") +
        '</div><p class="tiny muted">Environ ' + r.carbs + ' g de glucides au total. Bois ' + r.water + ' par heure. ' + r.salt + ' Les quantités sont déjà dans ta liste de courses.</p></section>';
    }
    html += tastesCard();
    var ws = planWeek(), p = mealPlanFor(ws), counts = MK.map(function (k) { return planCount(p, k); }), mi = MK.indexOf(repasSeg), cnt = counts[mi];
    html += '<div class="section-head"><h2>Ma semaine</h2><span class="tiny muted">' + short(ws) + ' → ' + short(addDays(ws, 6)) + '</span></div>' +
      '<div class="seg" role="group" aria-label="Semaine"><button data-act="week" data-w="0" aria-pressed="' + (weekOff === 0) + '">Cette semaine</button><button data-act="week" data-w="1" aria-pressed="' + (weekOff === 1) + '">Semaine du ' + short(addDays(mondayOf(t), 7)) + '</button></div>' +
      '<div class="moments" role="group" aria-label="Moment de la journée">' + D.MOMENTS.map(function (mo, i) { return '<button class="mo" data-act="repasseg" data-v="' + mo.k + '" aria-pressed="' + (mo.k === repasSeg) + '"><span class="mn">' + esc(mo.short) + '</span><span class="mc ' + (counts[i] === 7 ? 'ok' : 'ko') + '">' + counts[i] + '/7</span></button>'; }).join("") + '</div>' +
      '<p class="small muted">Combien de fois tu manges chaque recette dans la semaine : la liste de courses se calcule dessus. ' + (cnt === 7 ? '<span class="chip good">7/7 prévus</span>' : '<span class="chip warn">' + cnt + '/7 prévus</span>') + '</p>' +
      (counts.some(function (c) { return c < 7; }) ? '<button class="btn block" data-act="autofill">Compléter la semaine avec mes préférées</button>' : '');
    html += pool(repasSeg).map(function (r) {
      var c = (p[repasSeg] && p[repasSeg][r.id]) || 0, mc = macros(r.ing, menu.k);
      var chips = (r.fav ? '<span class="chip acc">' + HEART + ' Favorite</span>' : '') + (r.tag ? '<span class="chip grey">' + esc(r.tag) + '</span>' : '') + (hasCrispi(r) ? '<span class="chip grey">CRISPi</span>' : '');
      return '<article class="meal' + (c ? ' planned' : '') + '"><div class="meal-top"><div class="grow"><h3>' + esc(r.name) + '</h3><p class="small muted num">' + Math.round(mc[0]) + '\u00a0kcal · ' + Math.round(mc[2]) + '\u00a0g\u00a0G · ' + Math.round(mc[1]) + '\u00a0g\u00a0P · ' + Math.round(mc[3]) + '\u00a0g\u00a0L</p>' + (chips ? '<div class="row wrap" style="gap:6px;margin-top:6px">' + chips + '</div>' : '') + '</div>' +
        '<div class="stepper" role="group" aria-label="Portions de ' + esc(r.name) + '"><button data-act="mstep" data-d="-1" data-id="' + r.id + '" aria-label="Une portion de moins"' + (c ? '' : ' disabled') + '>−</button><span class="num">' + c + '</span><button data-act="mstep" data-d="1" data-id="' + r.id + '" aria-label="Une portion de plus">+</button></div></div>' +
        (r.adapted ? '<p class="tiny adapt">Adaptée à tes goûts : ' + esc(adaptNote(r)) + '</p>' : '') +
        '<details class="fold"><summary>Ingrédients & recette</summary>' + recipeBody(r, menu.k) +
        '<div class="row" style="margin-top:10px"><button class="btn grow" data-act="fav" data-id="' + r.id + '">' + HEART + (r.fav ? ' Retirer des favorites' : ' Favorite') + '</button><button class="btn" data-act="hiderec" data-id="' + r.id + '">Masquer</button></div></details></article>';
    }).join("");
    var hid = hiddenIn(repasSeg);
    if (hid.length) html += '<section class="card"><details class="fold" style="border:0;padding:0"><summary>' + hid.length + ' recette' + (hid.length > 1 ? 's masquées' : ' masquée') + '</summary><div class="mini-list" style="margin-top:8px">' +
      hid.map(function (h) { return '<div class="li"><div class="grow"><span>' + esc(h.name) + '</span><br><span class="tiny muted">' + esc(h.why) + '</span></div>' + (h.byRecipe ? '<button class="link" data-act="unhide" data-id="' + h.id + '">Remettre</button>' : '') + '</div>'; }).join("") +
      '</div></details></section>';
    html += '<section class="card"><h2>Comment c\'est calculé</h2><ul class="keys"><li>Les grammes affichés sont ceux d\'aujourd\'hui : les féculents suivent tes besoins en glucides, les protéines restent stables (' + n.P + ' g, 1,7 g par kg).</li><li>Les glucides montent avec la séance : 4 g/kg un jour de repos, jusqu\'à 9 g/kg pour une très longue sortie.</li><li>Ta dépense de base est calculée avec la formule de Mifflin-St Jeor (' + n.bmr + ' kcal au repos), plus ton activité et tes séances.</li><li>Riz, pâtes, semoule et quinoa sont pesés crus.</li></ul></section>';
    el.innerHTML = html;
  }
  function recipeBody(r, k) {
    return '<ul class="ing">' + r.ing.map(function (x) { return '<li><span class="q">' + esc(ingLabel(x, k)) + '</span><span>' + esc(ingName(x[0])) + '</span></li>'; }).join("") + '</ul>' +
      crispiHTML(r, k) + (hasCrispi(r) ? '<span class="eyebrow">Sans air fryer</span>' : '') +
      '<ol class="steps">' + r.steps.map(function (st) { return '<li>' + esc(st) + '</li>'; }).join("") + '</ol>' + (r.batch ? '<p class="batch"><b>En avance :</b> ' + esc(r.batch) + '</p>' : '');
  }
  function hasCrispi(r) { return S.settings.airfryer === "crispi" && r.af && r.af.length > 0; }
  /* Au Ninja CRISPi : ce qui se cuit dedans, dans quel ordre, et dans quel récipient (1,4 L pour une petite quantité, 3,8 L sinon). */
  function crispiHTML(r, k) {
    if (!hasCrispi(r)) return "";
    var mm = function (t) { return t[0] === t[1] ? t[0] + " min" : t[0] + " à " + t[1] + " min"; };
    var items = r.af.map(function (a) {
      if (typeof a !== "string") return { name: a.label, cut: "", t: a.t, tip: a.tip, g: 0, custom: true };
      var A = D.AIRFRY[a], x = r.ing.filter(function (y) { return y[0] === a; })[0];
      return { name: A.nm || ingName(a).toLowerCase(), cut: A.cut, t: A.t, tip: A.tip, g: x ? x[1] * (k ? E.factorFor(a, k, D.FOOD) : 1) : 0 };
    }).sort(function (a, b) { return b.t[1] - a.t[1]; });
    var total = items[0].t[1], grams = sum(items.map(function (i) { return i.g; }));
    var box = items.length === 1 && grams <= 300 ? "1,4 L" : "3,8 L";
    function line(i, cap) { var n = cap ? i.name.charAt(0).toUpperCase() + i.name.slice(1) : i.name; return (i.custom ? esc(n) : '<b>' + esc(n) + '</b>' + (i.cut ? ', ' + esc(i.cut) : '')) + (i.tip ? ' (' + esc(i.tip) + ')' : ''); }
    /* Le plus long part en premier ; les autres entrent quand il reste leur temps de cuisson (regroupés à 1 min près). */
    var steps = ['<li>' + line(items[0], true) + ' : ' + mm(items[0].t) + '.</li>'], rest = items.slice(1), groups = [];
    rest.forEach(function (i) { var g = groups.filter(function (x) { return Math.abs(x.at - i.t[1]) <= 1; })[0]; if (g) g.items.push(i); else groups.push({ at: i.t[1], items: [i] }); });
    groups.forEach(function (g) {
      steps.push('<li>' + (g.at >= total ? 'En même temps, ajoute ' : 'Quand il reste ' + g.at + ' min, ajoute ') + g.items.map(function (i) { return line(i); }).join(", et ") + '.</li>');
    });
    return '<div class="crispi"><div class="crispi-h"><span class="chip acc">Ninja CRISPi</span><span class="small"><b>Frire sans huile · ' + total + ' min</b> · récipient ' + box + '</span></div>' +
      '<ol class="steps">' + steps.join("") + '</ol>' +
      '<p class="tiny muted">Pas de préchauffage, pas de papier cuisson dans le verre. Ce sont des temps de départ : vérifie la cuisson la première fois. Le reste de la recette ne change pas.</p></div>';
  }
  function chooseSheet(m, d) {
    var mo = D.MOMENTS[MK.indexOf(m)], ws = mondayOf(d), p = mealPlanFor(ws)[m] || {}, cur = pickFor(m, d), menu = dayMenu(d);
    var all = pool(m), planned = all.filter(function (r) { return p[r.id]; }), others = all.filter(function (r) { return !p[r.id]; });
    function row(r, extra) {
      var mc = macros(r.ing, menu.k), bits = [r.fav ? "Favorite" : "", extra, r.adapted ? "Adaptée à tes goûts" : ""].filter(Boolean).join(" · ");
      return '<button class="opt' + (r.id === cur ? ' sel' : '') + '" data-pick="' + r.id + '"><span class="grow"><span class="nm">' + esc(r.name) + '</span>' + (bits ? '<span class="tiny muted">' + esc(bits) + '</span>' : '') + '</span><span class="k num">' + Math.round(mc[0]) + ' kcal</span></button>';
    }
    sheet('<h2>' + esc(mo.label) + '</h2><p class="small muted">Qu\'est-ce qui te fait envie ?</p>' +
      '<div class="opts"><button class="opt" data-log="1"><span class="grow"><span class="nm">' + (logOf(m, d) ? 'Modifier ce que j\'ai noté' : 'J\'ai mangé autre chose') + '</span><span class="tiny muted">Chez ta famille, au resto… Note-le : tes autres repas s\'ajustent.</span></span></button></div>' +
      (planned.length ? '<span class="eyebrow">Prévu cette semaine</span><div class="opts">' + planned.map(function (r) { return row(r, r.tag || ""); }).join("") + '</div>' : '') +
      '<span class="eyebrow">Autres recettes</span><div class="opts">' + others.map(function (r) { return row(r, r.tag || "Hors planning"); }).join("") +
      '<button class="opt' + (cur === "libre" ? ' sel' : '') + '" data-pick="libre"><span class="grow"><span class="nm">Repas libre, sans détail</span><span class="tiny muted">Ce repas n\'est pas compté</span></span></button></div>' +
      '<button class="btn block" id="ch-tastes">Modifier mes goûts</button><button class="btn block" data-sheet="close">Annuler</button>', function (root) {
      root.querySelector("#ch-tastes").addEventListener("click", function () { openTastes(false); });
      root.querySelector("[data-log]").addEventListener("click", function () { closeSheet(); logSheet(m, d); });
      root.querySelectorAll("[data-pick]").forEach(function (b) { b.addEventListener("click", function () { setPick(m, d, b.dataset.pick); save(); closeSheet(); render(); toast("Repas choisi"); }); });
    });
  }

  /* ================= ce que j'ai mangé ================= */
  /* Saisie d'un repas pris ailleurs (ou d'un extra) : plat courant, aliment pesé ou saisie libre. */
  var PORTIONS = [[0.7, "Petite"], [1, "Normale"], [1.4, "Grosse"]];
  function logSheet(m, d) {
    var isX = m === "extra", label = isX ? "Apéro, verre, dessert, grignotage" : D.MOMENTS[MK.indexOf(m)].label;
    var tab = "plat", q = "", sel = null, por = 1, cnt = 1;
    function list() { var x = S.day[d] && S.day[d][m]; return (x && x.log) || []; }
    function setList(l) {
      var r = dayRec(d);
      if (l.length) r[m] = isX ? { log: l } : { r: "libre", done: true, log: l }; else delete r[m];
      save(); render();
    }
    function entriesHTML() {
      var l = list(); if (!l.length) return '<p class="small muted">Rien de noté pour l\'instant.</p>';
      var t = E.logTotals(l);
      return '<div class="mini-list">' + l.map(function (e, i) { return '<div class="li"><span class="grow">' + esc(e.n) + (e.q ? ' <span class="tiny muted">' + esc(e.q) + '</span>' : '') + '</span><span class="muted small num">' + Math.round(e.k) + ' kcal</span><button type="button" class="lay-btn" data-del="' + i + '" aria-label="Retirer ' + esc(e.n) + '">×</button></div>'; }).join("") + '</div>' +
        '<p class="tiny muted num">Total estimé : ' + Math.round(t.K) + ' kcal · ' + Math.round(t.C) + ' g glucides · ' + Math.round(t.P) + ' g protéines · ' + Math.round(t.F) + ' g lipides</p>' +
        (t.A ? '<p class="tiny muted">Dont environ ' + Math.round(t.A * 7) + ' kcal d\'alcool : elles comptent dans tes calories du jour, mais ne remplacent pas les glucides et les protéines de tes repas, dont ton corps a besoin pour récupérer.</p>' : '');
    }
    function resultsHTML() {
      var nq = norm(q);
      if (tab === "plat") {
        var groups = {}, order = [];
        D.DISHES.forEach(function (x) { if (nq && norm(x.nm).indexOf(nq) < 0) return; if (!groups[x.grp]) { groups[x.grp] = []; order.push(x.grp); } groups[x.grp].push(x); });
        if (isX) { var FIRST = ["Boissons", "Apéro", "Desserts"]; order.sort(function (a, b) { var ia = FIRST.indexOf(a), ib = FIRST.indexOf(b); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib); }); }
        if (!order.length) return '<p class="small muted">Rien trouvé. Essaie « Aliment » ou « Saisie libre ».</p>';
        return order.map(function (g) { return '<span class="eyebrow">' + esc(g) + '</span><div class="opts">' + groups[g].map(function (x) { return '<button type="button" class="opt" data-dish="' + x.id + '"><span class="grow"><span class="nm">' + esc(x.nm) + '</span><span class="tiny muted">' + esc(x.por) + '</span></span><span class="k num">' + x.k + ' kcal</span></button>'; }).join("") + '</div>'; }).join("");
      }
      var ks = Object.keys(D.FOOD).filter(function (k) { return !nq || norm(D.FOOD[k].fr).indexOf(nq) >= 0; }).sort(function (a, b) { return D.FOOD[a].fr.localeCompare(D.FOOD[b].fr, "fr"); });
      if (!ks.length) return '<p class="small muted">Rien trouvé. Essaie « Plat » ou « Saisie libre ».</p>';
      return '<div class="opts">' + ks.slice(0, 40).map(function (k) { var f = D.FOOD[k]; return '<button type="button" class="opt" data-food="' + k + '"><span class="grow"><span class="nm">' + esc(f.fr) + '</span><span class="tiny muted">' + f.n[0] + ' kcal pour 100 g' + (f.raw ? ' cru' : '') + '</span></span></button>'; }).join("") + '</div>';
    }
    function pickHTML() {
      if (tab === "libre") return '<div class="field"><label for="lg-n">Quoi</label><input id="lg-n" type="text" placeholder="Par exemple : repas chez ma mère" autocomplete="off"></div>' +
        '<div class="field"><label for="lg-k">Calories (kcal)</label><input id="lg-k" type="text" inputmode="numeric" placeholder="600"></div>' +
        '<div class="two"><div class="field"><label for="lg-c">Glucides (g)</label><input id="lg-c" type="text" inputmode="decimal" placeholder="facultatif"></div><div class="field"><label for="lg-p">Protéines (g)</label><input id="lg-p" type="text" inputmode="decimal" placeholder="facultatif"></div></div>' +
        '<div class="field"><label for="lg-f">Lipides (g)</label><input id="lg-f" type="text" inputmode="decimal" placeholder="facultatif"></div>' +
        '<p class="tiny muted">Sans le détail, les calories sont réparties comme un repas mixte.</p><p class="err" id="lg-err" hidden></p><button type="button" class="btn primary block" data-add>Ajouter</button>';
      if (sel && tab === "plat") {
        var x = D.DISHES.filter(function (y) { return y.id === sel; })[0];
        if (x.qty) return '<div class="crispi"><p class="small"><b>' + esc(x.nm) + '</b> <span class="muted">· ' + esc(x.por) + ', ' + x.k + ' kcal' + (x.alc ? ' dont ' + Math.round(x.alc * 7) + ' kcal d\'alcool' : '') + '</span></p>' +
          '<div class="seg acc" role="group" aria-label="Combien">' + [1, 2, 3, 4, 5].map(function (c) { return '<button type="button" data-cnt="' + c + '" aria-pressed="' + (cnt === c) + '">' + c + '</button>'; }).join("") + '</div>' +
          '<div class="row" style="margin-top:8px"><button type="button" class="btn" data-back>Retour</button><button type="button" class="btn primary grow" data-add>Ajouter · ' + Math.round(x.k * cnt) + ' kcal</button></div></div>';
        return '<div class="crispi"><p class="small"><b>' + esc(x.nm) + '</b> <span class="muted">· portion normale : ' + esc(x.por) + ', ' + x.k + ' kcal</span></p>' +
          '<div class="seg acc" role="group" aria-label="Portion">' + PORTIONS.map(function (p) { return '<button type="button" data-por="' + p[0] + '" aria-pressed="' + (por === p[0]) + '">' + p[1] + '</button>'; }).join("") + '</div>' +
          '<p class="tiny muted">Estimation pour une portion courante. Si tu t\'es resservi, choisis « Grosse » ou ajoute-le deux fois.</p>' +
          '<div class="row"><button type="button" class="btn" data-back>Retour</button><button type="button" class="btn primary grow" data-add>Ajouter · ' + Math.round(x.k * por) + ' kcal</button></div></div>';
      }
      if (sel && tab === "aliment") {
        var f = D.FOOD[sel], g0 = f.piece ? Math.round(f.piece) : 100;
        return '<div class="crispi"><p class="small"><b>' + esc(f.fr) + '</b> <span class="muted">· ' + f.n[0] + ' kcal pour 100 g' + (f.raw ? ', poids cru' : '') + '</span></p>' +
          '<div class="field"><label for="lg-g">Quantité (g)</label><input id="lg-g" type="text" inputmode="numeric" value="' + g0 + '"></div>' +
          '<div class="row"><button type="button" class="btn" data-back>Retour</button><button type="button" class="btn primary grow" data-add>Ajouter</button></div></div>';
      }
      return '<input id="lg-q" type="search" placeholder="' + (tab === "plat" ? (isX ? 'Chercher : bière, vin, chips…' : 'Chercher : pizza, lasagnes, raclette…') : 'Chercher un aliment') + '" value="' + esc(q) + '" aria-label="Chercher"><div id="lg-res" style="margin-top:8px">' + resultsHTML() + '</div>';
    }
    function tabsHTML() { return [["plat", "Plat"], ["aliment", "Aliment"], ["libre", "Saisie libre"]].map(function (o) { return '<button type="button" data-tab="' + o[0] + '" aria-pressed="' + (tab === o[0]) + '">' + o[1] + '</button>'; }).join(""); }
    sheet('<h2>Ce que j\'ai mangé</h2><p class="small muted">' + esc(label) + ' · ' + esc(longDate(d)) + '. Tes autres repas s\'ajustent à ce qui reste de ta journée.</p>' +
      '<div id="lg-list">' + entriesHTML() + '</div><div class="seg" role="group" aria-label="Type de saisie" id="lg-tabs" style="margin-top:12px">' + tabsHTML() + '</div><div id="lg-pick" style="margin-top:10px">' + pickHTML() + '</div>' +
      '<button class="btn primary block" data-sheet="close" style="margin-top:12px">Terminé</button>', function (root) {
      var sh = root.querySelector(".sheet");
      function redraw() { sh.querySelector("#lg-list").innerHTML = entriesHTML(); sh.querySelector("#lg-tabs").innerHTML = tabsHTML(); sh.querySelector("#lg-pick").innerHTML = pickHTML(); }
      function num(id) { var el = sh.querySelector(id); var v = el ? parseNum(el.value) : null; return v == null || isNaN(v) ? null : v; }
      sh.addEventListener("input", function (e) { if (e.target.id === "lg-q") { q = e.target.value; sh.querySelector("#lg-res").innerHTML = resultsHTML(); } });
      sh.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b || b.dataset.sheet) return;
        if (b.dataset.tab) { tab = b.dataset.tab; sel = null; q = ""; redraw(); }
        else if (b.dataset.dish) { sel = b.dataset.dish; por = 1; cnt = 1; redraw(); }
        else if (b.dataset.cnt) { cnt = +b.dataset.cnt; redraw(); }
        else if (b.dataset.food) { sel = b.dataset.food; redraw(); var gi = sh.querySelector("#lg-g"); if (gi) gi.select(); }
        else if (b.dataset.por) { por = +b.dataset.por; redraw(); }
        else if (b.hasAttribute("data-back")) { sel = null; redraw(); }
        else if (b.dataset.del != null) { var l = list().slice(); l.splice(+b.dataset.del, 1); setList(l); redraw(); }
        else if (b.hasAttribute("data-add")) {
          var en = null;
          if (tab === "plat" && sel) {
            var x = D.DISHES.filter(function (y) { return y.id === sel; })[0], pl = PORTIONS.filter(function (p) { return p[0] === por; })[0][1];
            if (x.qty) en = { n: x.nm + (cnt > 1 ? " × " + cnt : ""), q: x.por, k: x.k * cnt, c: x.c * cnt, p: x.p * cnt, f: x.f * cnt, src: "plat" };
            else en = { n: x.nm, q: pl === "Normale" ? x.por : pl.toLowerCase() + " portion", k: Math.round(x.k * por), c: Math.round(x.c * por), p: Math.round(x.p * por), f: Math.round(x.f * por), src: "plat" };
            if (x.alc) en.alc = x.alc * (x.qty ? cnt : por);
          } else if (tab === "aliment" && sel) {
            var g = num("#lg-g"); if (!(g > 0)) return;
            var f = D.FOOD[sel];
            en = { n: f.fr, q: Math.round(g) + " g" + (f.raw ? " cru" : ""), k: Math.round(f.n[0] * g / 100), p: Math.round(f.n[1] * g / 10) / 10, c: Math.round(f.n[2] * g / 10) / 10, f: Math.round(f.n[3] * g / 10) / 10, src: "aliment" };
          } else if (tab === "libre") {
            var k = num("#lg-k"), err = sh.querySelector("#lg-err");
            if (!(k > 0)) { err.textContent = "Indique au moins les calories."; err.hidden = false; return; }
            var nm = (sh.querySelector("#lg-n").value || "").trim() || "Repas";
            en = { n: nm, k: Math.round(k), c: num("#lg-c"), p: num("#lg-p"), f: num("#lg-f"), src: "libre" };
            if (en.c == null && en.p == null && en.f == null) { delete en.c; delete en.p; delete en.f; }
          }
          if (!en) return;
          setList(list().concat([en])); sel = null; q = ""; redraw(); toast("Ajouté : " + en.n);
        }
      });
    });
  }

  /* ================= goûts ================= */
  var HEART = '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
  var NOPE = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M6 18 18 6"/></svg>';
  function tasteStats() { var a = 0; Object.keys(RBY).forEach(function (id) { if (RBY[id].adapted) a++; }); return { adapted: a, hidden: Object.keys(HIDDEN).length }; }
  function tastesCard() {
    var f = S.prefs.food, nope = Object.keys(f).filter(function (k) { return f[k] === -1 && D.FOOD[k]; }), like = Object.keys(f).filter(function (k) { return f[k] === 1 && D.FOOD[k]; }), st = tasteStats();
    var html = '<section class="card"><div class="card-head"><h2>Mes goûts</h2><button class="btn" data-act="tastes">' + (nope.length || like.length ? 'Modifier' : 'Choisir') + '</button></div>';
    if (!nope.length && !like.length) return html + '<p class="small muted">Indique ce que tu aimes et ce que tu ne manges pas : les recettes remplacent l\'aliment par un équivalent, et tes préférées passent en premier.</p></section>';
    html += '<div class="chips">' + nope.map(function (k) { return '<span class="chip nope">' + NOPE + esc(D.FOOD[k].fr) + '</span>'; }).join("") + like.map(function (k) { return '<span class="chip acc">' + HEART + esc(D.FOOD[k].fr) + '</span>'; }).join("") + '</div>';
    return html + '<p class="tiny muted">' + st.adapted + ' recette' + (st.adapted > 1 ? 's adaptées' : ' adaptée') + ' · ' + st.hidden + ' masquée' + (st.hidden > 1 ? 's' : '') + '</p></section>';
  }
  function norm(t) { return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe"); }
  function openTastes(first) {
    var keys = Object.keys(D.FOOD).filter(function (k) { return !D.FOOD[k].stock; });
    function row(k) {
      var v = S.prefs.food[k] || 0;
      return '<div class="taste-row' + (v === 1 ? ' like' : v === -1 ? ' nope' : '') + '" data-k="' + k + '" data-n="' + esc(norm(D.FOOD[k].fr)) + '"><span class="nm">' + esc(D.FOOD[k].fr) + '</span><div class="taste-btns">' +
        '<button type="button" class="tbtn like" data-like="' + k + '" aria-pressed="' + (v === 1) + '" aria-label="J\'aime : ' + esc(D.FOOD[k].fr) + '">' + HEART + '</button>' +
        '<button type="button" class="tbtn nope" data-nope="' + k + '" aria-pressed="' + (v === -1) + '" aria-label="Je n\'aime pas : ' + esc(D.FOOD[k].fr) + '">' + NOPE + '</button></div></div>';
    }
    function sumText() { var st = tasteStats(); return st.adapted + ' recette' + (st.adapted > 1 ? 's adaptées' : ' adaptée') + ' · ' + st.hidden + ' masquée' + (st.hidden > 1 ? 's' : ''); }
    var groups = D.RAYONS.map(function (ry) {
      var ks = keys.filter(function (k) { return D.FOOD[k].rayon === ry; }).sort(function (a, b) { return D.FOOD[a].fr.localeCompare(D.FOOD[b].fr, "fr"); });
      return ks.length ? '<div class="group taste-group"><h3>' + esc(ry) + '</h3>' + ks.map(row).join("") + '</div>' : '';
    }).join("");
    sheet((first ? '<div class="brand"><span class="logo" aria-hidden="true"></span><div><h2>Tes goûts</h2><p class="small muted">Facultatif : tu pourras changer ça à tout moment dans Repas.</p></div></div>' : '<h2>Mes goûts</h2>') +
      '<p class="small muted"><b style="color:var(--acc-text)">J\'aime</b> : les recettes avec cet aliment passent en premier. <b style="color:var(--bad)">Je n\'aime pas</b> : il est remplacé par un équivalent (riz par pâtes, saumon par cabillaud…), ou la recette est masquée s\'il est au cœur du plat.</p>' +
      '<input type="text" id="taste-q" placeholder="Chercher un aliment" autocomplete="off" aria-label="Chercher un aliment">' + groups +
      '<p class="small muted" id="taste-sum" aria-live="polite">' + sumText() + '</p>' +
      '<button class="btn primary block" id="taste-done">' + (first ? 'Continuer' : 'Terminé') + '</button>', function (root) {
      var sh = root.querySelector(".sheet");
      sh.addEventListener("click", function (e) {
        var b = e.target.closest("[data-like],[data-nope]"); if (!b) return;
        var k = b.dataset.like || b.dataset.nope, v = b.dataset.like ? 1 : -1;
        if (S.prefs.food[k] === v) delete S.prefs.food[k]; else S.prefs.food[k] = v;
        var nv = S.prefs.food[k] || 0, r = sh.querySelector('.taste-row[data-k="' + k + '"]');
        r.classList.toggle("like", nv === 1); r.classList.toggle("nope", nv === -1);
        r.querySelector(".tbtn.like").setAttribute("aria-pressed", String(nv === 1)); r.querySelector(".tbtn.nope").setAttribute("aria-pressed", String(nv === -1));
        rebuildRecipes(); sh.querySelector("#taste-sum").textContent = sumText(); save();
      });
      sh.querySelector("#taste-q").addEventListener("input", function (e) {
        var q = norm(e.target.value.trim());
        sh.querySelectorAll(".taste-row").forEach(function (r) { r.hidden = !!q && r.dataset.n.indexOf(q) < 0; });
        sh.querySelectorAll(".taste-group").forEach(function (g) { g.hidden = !g.querySelector(".taste-row:not([hidden])"); });
      });
      sh.querySelector("#taste-done").addEventListener("click", function () {
        reconcileMeals(); save(); sheetLocked = false; closeSheet(); render();
        if (first) openConnect(true);
      });
    }, null, first);
  }

  /* ================= COURSES ================= */
  function renderCourses() {
    var el = $("view-courses"), ws = planWeek(), items = shopItems(ws), ck = shopChecked(ws), st = store();
    if (!S.profile) { el.innerHTML = '<div class="empty">Complète ton profil pour générer ta liste.</div>'; return; }
    var done = items.filter(function (it) { return ck[it.k]; }).length, total = sum(items.map(function (it) { return it.c || 0; }));
    var p = mealPlanFor(ws), missing = D.MOMENTS.filter(function (mo) { return planCount(p, mo.k) !== 7; });
    var html = '<div class="seg" role="group" aria-label="Semaine"><button data-act="week" data-w="0" aria-pressed="' + (weekOff === 0) + '">Cette semaine</button><button data-act="week" data-w="1" aria-pressed="' + (weekOff === 1) + '">Semaine du ' + short(addDays(mondayOf(today()), 7)) + '</button></div>';
    if (missing.length) html += '<div class="verdict warn"><span class="chip warn">Planning</span><p class="small">' + missing.map(function (mo) { return esc(mo.short) + ' ' + planCount(p, mo.k) + '/7'; }).join(" · ") + ' : la liste ne couvre pas toute la semaine. <button class="link" data-act="go-repas" data-v="' + missing[0].k + '">Compléter</button></p></div>';
    html += '<section class="card"><div class="card-head"><h2>Coût estimé</h2><span class="tiny muted">' + short(ws) + ' → ' + short(addDays(ws, 6)) + '</span></div><div class="row between"><div class="bigval num">' + fmt(total, 0) + '<small>€</small></div><button class="btn" data-act="store">' + esc(st.name) + '</button></div>' +
      '<p class="tiny muted">Repas de la semaine aux quantités ajustées à tes séances, plus le ravitaillement des sorties longues. Prix estimés : touche un prix pour le corriger.</p></section>';
    html += '<section class="card"><div class="row"><div class="bar grow" aria-hidden="true"><i style="width:' + (items.length ? done / items.length * 100 : 0) + '%"></i></div><span class="small muted num">' + done + ' / ' + items.length + '</span><button class="link" data-act="reset-shop">Tout décocher</button></div>';
    if (!items.length) html += '<div class="empty">Aucune recette prévue. Planifie tes repas dans l\'onglet Repas.</div>';
    D.RAYONS.forEach(function (ry) {
      var g = items.filter(function (it) { return it.f.rayon === ry; }); if (!g.length) return;
      html += '<div class="group"><h3>' + esc(ry) + '</h3>' + g.map(function (it) {
        var pr = price(it.k);
        return '<div class="item' + (ck[it.k] ? ' done' : '') + '"><button class="check" role="checkbox" aria-checked="' + !!ck[it.k] + '" data-act="ck" data-k="' + it.k + '" aria-label="' + esc(it.f.fr) + ' acheté">' + CHECK + '</button>' +
          '<div class="txt" data-act="ck" data-k="' + it.k + '"><span class="nm">' + esc(it.f.fr) + '</span></div>' +
          '<div class="right"><span class="qty">' + esc(it.q) + '</span><button class="pricebtn" data-act="price" data-k="' + it.k + '" aria-label="Modifier le prix de ' + esc(it.f.fr) + '">' + (pr.src === "corrigé" ? '<span class="edited"></span>' : '') + (it.c == null ? '—' : euro(it.c)) + '<span class="muted">' + (pr.src === "estimé" ? '~' : '') + '</span></button></div></div>';
      }).join("") + '</div>';
    });
    html += '<div class="group"><h3>Placard · à vérifier</h3>' + D.SPICES.map(function (sp) { return '<div class="item"><div class="txt"><span class="nm">' + esc(sp) + '</span></div></div>'; }).join("") + '</div></section>';
    el.innerHTML = html;
  }
  function priceSheet(k) {
    var f = D.FOOD[k], pr = price(k), unit = f.unit === "pièce" ? "€ / pièce" : f.liquid ? "€ / L" : "€ / kg";
    sheet('<h2>' + esc(f.fr) + '</h2><div class="field"><label for="pr-v">Prix chez ' + esc(store().name) + ' (' + unit + ')</label><input id="pr-v" type="text" inputmode="decimal" value="' + fmt(pr.v, 2) + '"><span class="tiny muted">' + (pr.src === "corrigé" ? 'Corrigé · estimation ' + fmt(basePrice(k), 2) : 'Estimé') + '</span></div>' +
      '<p class="tiny muted">Entre le prix au ' + (f.unit === "pièce" ? "produit" : f.liquid ? "litre" : "kilo") + ' affiché sur l\'étiquette.</p><button class="btn primary block" id="p-save">Enregistrer</button><div class="two"><button class="btn" id="p-reset">Prix estimé</button><button class="btn" data-sheet="close">Annuler</button></div>', function (root) {
      root.querySelector("#p-save").addEventListener("click", function () { var v = parseNum(root.querySelector("#pr-v").value); if (v == null || v <= 0) { toast("Prix invalide"); return; } S.prices[k] = v; save(); closeSheet(); render(); toast("Prix enregistré"); });
      root.querySelector("#p-reset").addEventListener("click", function () { delete S.prices[k]; save(); closeSheet(); render(); });
    });
  }
  function storeSheet() {
    sheet('<h2>Ton magasin</h2><p class="small muted">Les prix sont estimés selon l\'enseigne. Tu peux corriger chaque prix en magasin.</p><div class="opts">' + D.STORES.map(function (s) { return '<button class="opt' + (s.id === S.settings.store ? ' sel' : '') + '" data-store="' + s.id + '"><span class="grow"><span class="nm">' + esc(s.name) + '</span></span></button>'; }).join("") + '</div><button class="btn block" data-sheet="close">Annuler</button>', function (root) {
      root.querySelectorAll("[data-store]").forEach(function (b) { b.addEventListener("click", function () { S.settings.store = b.dataset.store; save(); closeSheet(); render(); }); });
    });
  }

  /* ================= actions (délégation) ================= */
  var availDirty = false;
  var ACT = {
    week: function (b) { weekOff = +b.dataset.w; render(); },
    session: function (b) { openSession(b.dataset.date, b.dataset.eid); },
    lighten: function (b) {
      var ws = mondayOf(b.dataset.date), p = S.plans[ws]; if (!p) return;
      p.sessions = p.sessions.map(function (s) {
        if (s.date !== b.dataset.date || s.skip || status(s, p) === "done") return s;
        if (s.brick) { s.skip = true; return s; }
        return (s.key || s.long) ? lightened(s, b.dataset.level) : s;
      });
      save(); render(); autoPush(ws); toast("Séance allégée");
    },
    skip: function (b) { var ws = mondayOf(b.dataset.date), p = S.plans[ws]; if (!p) return; p.sessions.forEach(function (s) { if (s.eid === b.dataset.eid) s.skip = true; }); save(); render(); autoPush(ws); toast("Séance sautée"); },
    unskip: function (b) { var ws = mondayOf(b.dataset.date), p = S.plans[ws]; if (!p) return; p.sessions.forEach(function (s) { if (s.date === b.dataset.date) delete s.skip; }); save(); render(); autoPush(ws); },
    eat: function (b) { setDone(b.dataset.m, today(), true); save(); render(); toast("Repas coché"); },
    logm: function (b) { logSheet(b.dataset.m, today()); },
    "eat-toggle": function (b) { var m = b.dataset.m, t = today(); setDone(m, t, !isDone(m, t)); save(); render(); },
    choose: function (b) { chooseSheet(b.dataset.m, b.dataset.date || today()); },
    sync: function () { syncAndRefresh(false); },
    connect: function () { openConnect(false); },
    demo: function () { loadDemo(); render(); toast("Sorties d'exemple chargées"); },
    push: function (b) {
      b.disabled = true; b.textContent = "Envoi…";
      push(planWeek()).then(function () { render(); toast("Séances envoyées vers Intervals.icu"); }).catch(function () { render(); toast("Envoi impossible"); });
    },
    avail: function (b) {
      var i = +b.dataset.i, v = Math.max(0, Math.min(360, S.train.avail[i] + (+b.dataset.d)));
      if (v > 0 && v < 30) v = +b.dataset.d > 0 ? 30 : 0;
      S.train.avail[i] = v; availDirty = true; save();
      var li = b.closest(".li"); li.querySelector(".val").textContent = v ? hm(v) : "Repos"; li.querySelector(".val").classList.toggle("off", !v);
      li.querySelector('[data-d="-15"]').disabled = !v; $("av-total").textContent = hm(sum(S.train.avail)) + " / sem.";
      $("replan-btn").disabled = false;
    },
    sport: function (b) {
      var s = b.dataset.s, on = E.SPORTS.filter(function (x) { return S.train.sports[x]; });
      if (S.train.sports[s] && on.length === 1) { toast("Garde au moins un sport"); return; }
      S.train.sports[s] = !S.train.sports[s]; b.setAttribute("aria-pressed", String(!!S.train.sports[s])); save(); $("replan-btn").disabled = false;
    },
    trail: function (b) { S.train.trail = b.dataset.v; save(); b.parentNode.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); $("replan-btn").disabled = false; },
    bricks: function (b) { S.train.bricks = b.checked; save(); $("replan-btn").disabled = false; },
    doubles: function (b) { S.train.doubles = b.checked; save(); $("replan-btn").disabled = false; },
    bikewe: function (b) { S.train.bikeWE = b.dataset.v === "1"; save(); b.parentNode.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); $("replan-btn").disabled = false; },
    injury: function (b) { if (S.train.injury.mode === b.dataset.v) return; setInjury(b.dataset.v); toast(b.dataset.v === "blesse" ? "Plan adapté à ta blessure" : b.dataset.v === "reprise" ? "Reprise sur " + E.REPRISE_WEEKS + " semaines" : "Plan normal"); },
    goal: function (b) { goalSheet(b.dataset.id || null); },
    padel: function (b) { padelSheet(b.dataset.w); },
    period: function (b) { periodSheet(b.dataset.id || null); },
    rsport: function (b) { var inj = S.train.injury, sp = inj.rsports || (inj.rsports = {}), k = b.dataset.s; sp[k] = sp[k] === false; setInjury(inj.mode); },
    injsport: function (b) { var sp = S.train.injury.sports, k = b.dataset.s; sp[k] = !sp[k]; setInjury("blesse"); },
    prio: function (b) { S.train.prio = b.dataset.v; save(); b.parentNode.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); $("replan-btn").disabled = false; },
    replan: function () {
      var ws = mondayOf(today()); regenerate(ws); if (S.plans[addDays(ws, 7)]) regenerate(addDays(ws, 7));
      availDirty = false; save(); render(); autoPush(ws); toast("Plan recalculé");
    },
    regen: function (b) {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Confirmer : régénérer la semaine"; return; }
      var ws = planWeek(); if (S.plans[ws]) regenerate(ws); else previews = {};
      save(); render(); autoPush(ws); toast("Semaine régénérée");
    },
    suiviseg: function (b) { suiviSeg = b.dataset.v; render(); },
    allacts: function () { suiviSeg = "sorties"; show("suivi"); },
    zonesp: function (b) { zoneSport = b.dataset.v; zoneWeek = null; render(); },
    zoneweek: function (b) { zoneWeek = zoneWeek === b.dataset.w ? null : b.dataset.w; render(); },
    layout: function (b) { layoutSheet(b.dataset.v); },
    addact: function () { manualActSheet(); },
    delact: function (b) { delete S.acts[b.dataset.id]; dirty(); save(); render(); toast("Sortie supprimée"); },
    savew: function () { var v = parseNum($("today-w").value); if (v == null || v < 30 || v > 250) { toast("Entre ton poids en kg, par exemple 71,5"); return; } S.weights[today()] = v; save(); render(); toast("Pesée enregistrée"); },
    editw: function () { delete S.weights[today()]; save(); render(); var i = $("today-w"); if (i) i.focus(); },
    repasseg: function (b) { repasSeg = b.dataset.v; render(); },
    tastes: function () { openTastes(false); },
    autofill: function () { var n = autoFill(planWeek()); save(); render(); toast(n ? n + " portion" + (n > 1 ? "s ajoutées" : " ajoutée") : "La semaine est déjà complète"); },
    fav: function (b) { var id = b.dataset.id; if (S.prefs.recipes[id] === 1) delete S.prefs.recipes[id]; else S.prefs.recipes[id] = 1; rebuildRecipes(); save(); render(); },
    hiderec: function (b) { S.prefs.recipes[b.dataset.id] = -1; var p = S.mealPlan[planWeek()]; if (p) MK.forEach(function (m) { if (p[m]) delete p[m][b.dataset.id]; }); rebuildRecipes(); save(); render(); toast("Recette masquée"); },
    unhide: function (b) { delete S.prefs.recipes[b.dataset.id]; rebuildRecipes(); save(); render(); toast("Recette remise"); },
    mstep: function (b) {
      var p = mealPlanEnsure(planWeek()), o = p[repasSeg], id = b.dataset.id, n = Math.max(0, Math.min(14, (o[id] || 0) + (+b.dataset.d)));
      if (n) o[id] = n; else delete o[id]; save(); render();
    },
    "go-repas": function (b) { repasSeg = b.dataset.v; show("repas"); },
    store: function () { storeSheet(); },
    price: function (b) { priceSheet(b.dataset.k); },
    ck: function (b) { var ck = shopChecked(planWeek()), k = b.dataset.k; if (ck[k]) delete ck[k]; else ck[k] = true; save(); render(); },
    "reset-shop": function (b) {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Confirmer ?"; return; }
      S.shop[planWeek()] = {}; save(); render(); toast("Liste remise à zéro");
    }
  };
  $("main").addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]"); if (go) { show(go.dataset.go); return; }
    var a = e.target.closest("[data-act]"); if (!a || !ACT[a.dataset.act]) return;
    ACT[a.dataset.act](a, e);
  });
  $("main").addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "today-w") { e.preventDefault(); ACT.savew(); } });
  $("sync-btn").addEventListener("click", function () { syncAndRefresh(false); });
  $("layout-btn").addEventListener("click", function () { layoutSheet(current); });
  $("main").addEventListener("change", function (e) {
    if (e.target.id === "inj-until") { S.train.injury.until = e.target.value || null; setInjury("blesse"); toast(e.target.value ? "Reprise prévue le " + short(e.target.value) : "Date de reprise retirée"); }
  });

  /* ================= feuilles ================= */
  var onClose = null, sheetLocked = false;
  function sheet(html, setup, cleanup, locked) {
    sheetLocked = false; closeSheet();
    var root = $("sheet-root");
    root.innerHTML = '<div class="scrim" id="scrim"><div class="sheet' + (locked ? ' full' : '') + '" role="dialog" aria-modal="true">' + (locked ? '' : '<div class="grab"></div>') + html + '</div></div>';
    onClose = cleanup || null; sheetLocked = !!locked;
    root.querySelector("#scrim").addEventListener("click", function (e) { if ((e.target.id === "scrim" && !sheetLocked) || e.target.closest('[data-sheet="close"]')) closeSheet(); });
    root.querySelector(".sheet").addEventListener("click", function (e) { var a = e.target.closest("[data-act]"); if (a && ACT[a.dataset.act] && !a.closest(".opts")) { closeSheet(); ACT[a.dataset.act](a, e); } });
    if (setup) setup(root);
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    var root = $("sheet-root"); if (!root.innerHTML) return;
    root.innerHTML = ""; document.body.style.overflow = ""; sheetLocked = false;
    if (onClose) { var f = onClose; onClose = null; f(); }
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheetLocked) closeSheet(); });

  /* --- sortie ajoutée à la main --- */
  function manualActSheet() {
    var sp = "velo";
    sheet('<h2>Ajouter une sortie</h2><div class="seg" role="group">' + E.SPORTS.map(function (s) { return '<button type="button" data-sp="' + s + '" aria-pressed="' + (s === sp) + '">' + SPORT[s] + '</button>'; }).join("") + '</div>' +
      '<div class="two"><div class="field"><label for="ma-date">Date</label><input id="ma-date" type="date" value="' + today() + '"></div><div class="field"><label for="ma-dur">Durée (min)</label><input id="ma-dur" type="text" inputmode="numeric" placeholder="90"></div></div>' +
      '<div class="two"><div class="field"><label for="ma-km" id="ma-kml">Distance (km)</label><input id="ma-km" type="text" inputmode="decimal" placeholder="facultatif"></div><div class="field"><label for="ma-dp">D+ (m)</label><input id="ma-dp" type="text" inputmode="numeric" placeholder="facultatif"></div></div>' +
      '<div class="field"><label>Ressenti de l\'effort</label><div class="seg" role="group">' + [[2, "Facile"], [4, "Modéré"], [6, "Soutenu"], [8, "Dur"], [10, "Max"]].map(function (o) { return '<button type="button" data-rpe="' + o[0] + '" aria-pressed="' + (o[0] === 4) + '">' + o[1] + '</button>'; }).join("") + '</div></div>' +
      '<p class="err" id="ma-err" hidden></p><button class="btn primary block" id="ma-save">Ajouter</button><button class="btn block" data-sheet="close">Annuler</button>', function (root) {
      var rpe = 4;
      root.querySelector(".sheet").addEventListener("click", function (e) {
        var b = e.target.closest("[data-sp]"); if (b) { sp = b.dataset.sp; root.querySelectorAll("[data-sp]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); root.querySelector("#ma-kml").textContent = sp === "natation" ? "Distance (m)" : "Distance (km)"; }
        var r = e.target.closest("[data-rpe]"); if (r) { rpe = +r.dataset.rpe; root.querySelectorAll("[data-rpe]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === r)); }); }
      });
      root.querySelector("#ma-save").addEventListener("click", function () {
        var d = root.querySelector("#ma-date").value, dur = parseNum(root.querySelector("#ma-dur").value), km = parseNum(root.querySelector("#ma-km").value), dp = parseNum(root.querySelector("#ma-dp").value);
        var er = root.querySelector("#ma-err");
        if (!d || d > today()) { er.textContent = "Choisis une date passée ou aujourd'hui."; er.hidden = false; return; }
        if (!dur || dur < 5 || dur > 900) { er.textContent = "Indique la durée en minutes, par exemple 75."; er.hidden = false; return; }
        var IF = { 2: 0.58, 4: 0.68, 6: 0.8, 8: 0.92, 10: 1.02 }[rpe], id = "m" + Date.now();
        S.acts[id] = { id: id, date: d, sport: sp, type: "", name: SPORT[sp] + " (ajoutée)", dur: Math.round(dur * 60), dist: km ? (sp === "natation" ? km : km * 1000) : 0, dplus: dp || 0, load: Math.round(dur / 60 * IF * IF * 100), hr: 0, watts: 0, kcal: 0, src: "Manuel" };
        dirty(); previews = {}; save(); closeSheet(); render(); toast("Sortie ajoutée");
      });
    });
  }

  /* --- connexion Intervals.icu --- */
  function openConnect(first) {
    sheet((first ? '<div class="brand"><span class="logo" aria-hidden="true"></span><div><h2>Tes sorties</h2><p class="small muted">Dernière étape.</p></div></div>' : '<h2>Intervals.icu</h2>') +
      '<p class="small">Triple lit tes sorties Garmin dans Intervals.icu et y écrit ton plan, qu\'Intervals envoie ensuite sur ton Epix et ton Edge.</p>' +
      '<ol class="steps-guide"><li>Sur <b>intervals.icu</b>, ouvre <b>Settings</b>.</li><li>Tout en bas, <b>Developer Settings</b> : génère une <b>API key</b> et copie-la.</li><li>Colle-la ci-dessous.</li></ol>' +
      '<div class="field"><label for="icu-key">Clé API</label><input id="icu-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(S.icu.key) + '" placeholder="Colle ta clé ici"></div>' +
      '<p class="tiny muted">Ta clé reste sur ce téléphone. Elle n\'est jamais incluse dans les sauvegardes exportées.</p>' +
      '<p class="err" id="icu-err" hidden></p>' + (window.RC_PREVIEW ? '<div class="verdict warn"><span class="chip warn">Aperçu</span><p class="small">Dans cet aperçu, la connexion à Intervals.icu est bloquée. Elle fonctionnera une fois l\'appli installée depuis ta propre adresse GitHub Pages.</p></div>' : '<button class="btn primary block" id="icu-go">Connecter et importer mes sorties</button>') +
      '<details class="fold"><summary>À vérifier dans Intervals.icu</summary><ul class="keys" style="margin-top:10px"><li>Settings → Connections : <b>Garmin</b> connecté directement (pas seulement via Strava : Strava interdit de transmettre ses sorties).</li><li>Dans le bloc Garmin, case <b>Upload planned workouts</b> cochée pour recevoir les séances sur ta montre et ton compteur.</li><li>Tes seuils (FTP, FC au seuil) renseignés : les zones de tes séances en dépendent.</li></ul></details>' +
      (first ? '<button class="btn block" id="icu-demo">Essayer d\'abord avec des sorties d\'exemple</button><button class="btn block" id="icu-later">Plus tard</button>' : '<button class="btn block" data-sheet="close">Fermer</button>'), function (root) {
      var go = root.querySelector("#icu-go"), err = root.querySelector("#icu-err");
      if (go) go.addEventListener("click", function () {
        var k = root.querySelector("#icu-key").value.trim();
        if (k.length < 10) { err.textContent = "Colle la clé complète."; err.hidden = false; return; }
        S.icu.key = k; save(); go.disabled = true; go.textContent = "Connexion…"; err.hidden = true;
        sync(true).then(function () {
          S.plans = {}; S.train.planStart = mondayOf(today()); previews = {}; ensurePlans(); save();
          closeSheet(); render(); toast(actList().length + " sorties importées");
          autoPush(mondayOf(today()));
        }).catch(function () {
          go.disabled = false; go.textContent = "Réessayer"; err.innerHTML = S.icu.error || "Connexion impossible."; err.hidden = false;
          S.icu.key = ""; save();
        });
      });
      var dm = root.querySelector("#icu-demo"); if (dm) dm.addEventListener("click", function () { loadDemo(); sheetLocked = false; closeSheet(); render(); });
      var lt = root.querySelector("#icu-later"); if (lt) lt.addEventListener("click", function () { sheetLocked = false; closeSheet(); render(); });
    }, null, first);
  }

  /* --- réglages --- */
  var exportFile = null;
  function buildExport() {
    var copy = JSON.parse(JSON.stringify(S)); copy.icu.key = "";
    return new File([JSON.stringify({ app: "triple", version: 1, exportedAt: new Date().toISOString(), state: copy })], "triple-sauvegarde-" + today() + ".json", { type: "application/json" });
  }
  function openSettings() {
    var pf = S.profile || {}, bt = S.train.bikeTarget;
    sheet('<h2>Réglages</h2>' +
      '<section class="card"><h3>Mon profil</h3>' + (S.profile ? '<p class="small">' + (pf.name ? esc(pf.name) + ' · ' : '') + pf.age + ' ans · ' + pf.height + ' cm · ' + fmt(weight(), 1) + ' kg · ' + (pf.goal === "affutage" ? "Affûtage" : "Performance") + '</p>' : '<p class="small muted">Profil incomplet.</p>') + '<button class="btn block" id="s-profile">Modifier mon profil</button></section>' +
      '<section class="card"><h3>Intervals.icu</h3>' + (connected() ? '<p class="small">Connecté' + (S.icu.name ? ' · ' + esc(S.icu.name) : '') + ' · synchronisé ' + ago(S.icu.lastSync) + '</p>' + (S.icu.error ? '<p class="small err">' + S.icu.error + '</p>' : '') +
        '<label class="switch"><input type="checkbox" id="s-auto"' + (S.settings.autoPush ? ' checked' : '') + '><span>Envoyer automatiquement le plan vers Intervals.icu</span></label>' +
        '<div class="field"><span class="lab">Cible des séances vélo</span><div class="seg" role="group">' + [["auto", "Auto"], ["power", "Puissance"], ["hr", "Cardio"]].map(function (o) { return '<button type="button" data-bt="' + o[0] + '" aria-pressed="' + (bt === o[0]) + '">' + o[1] + '</button>'; }).join("") + '</div><span class="tiny muted">Auto : en watts si ta FTP est connue dans Intervals.icu, sinon en fréquence cardiaque.</span></div>' +
        '<div class="two"><button class="btn" id="s-sync">Tout resynchroniser</button><button class="btn danger" id="s-disc">Déconnecter</button></div>'
        : '<p class="small muted">Non connecté.</p><button class="btn primary block" data-act="connect">Connecter Intervals.icu</button>') + '</section>' +
      (S.demo ? '<section class="card"><h3>Sorties d\'exemple</h3><p class="small muted">Elles disparaissent automatiquement quand tu connectes Intervals.icu.</p><button class="btn block" id="s-nodemo">Retirer les sorties d\'exemple</button></section>' : '') +
      '<section class="card"><h3>Sauvegarde</h3><p class="small muted">Tes données vivent uniquement sur ce téléphone. Exporte une sauvegarde de temps en temps (Fichiers ou iCloud Drive). ' + (S.settings.lastExport ? 'Dernier export : ' + short(S.settings.lastExport) + '.' : 'Aucun export pour l\'instant.') + '</p><button class="btn primary block" id="exp">Exporter une sauvegarde</button><button class="btn block" id="imp">Importer une sauvegarde</button></section>' +
      '<section class="card"><h3>Repas</h3><div class="field"><label>Heures limites (petit-déj / midi / collation)</label><div class="row"><input id="s-h0" type="text" inputmode="numeric" value="' + S.settings.mealHours[0] + '" aria-label="Petit-déjeuner avant"><input id="s-h1" type="text" inputmode="numeric" value="' + S.settings.mealHours[1] + '" aria-label="Midi avant"><input id="s-h2" type="text" inputmode="numeric" value="' + S.settings.mealHours[2] + '" aria-label="Collation avant"></div></div><button class="btn block" id="s-hsave">Enregistrer</button></section>' +
      '<section class="card"><h3>Cuisine</h3><label class="switch"><input type="checkbox" id="s-crispi"' + (S.settings.airfryer === "crispi" ? ' checked' : '') + '><span>J\'ai un air fryer Ninja CRISPi (verre, 4-en-1)</span></label><p class="tiny muted">Les recettes indiquent alors ce qui se cuit dedans : le mode, le temps, l\'ordre et le récipient.</p></section>' +
      '<section class="card"><h3>Données</h3><button class="btn danger block" id="wipe">Effacer toutes les données</button></section>' +
      '<p class="tiny muted" style="text-align:center">Triple ' + APP_VERSION + '</p><button class="btn block" data-sheet="close">Fermer</button>', function (root) {
      root.querySelector("#s-profile").addEventListener("click", function () { openProfile(false); });
      var au = root.querySelector("#s-auto"); if (au) au.addEventListener("change", function () { S.settings.autoPush = au.checked; save(); });
      root.querySelectorAll("[data-bt]").forEach(function (b) { b.addEventListener("click", function () { S.train.bikeTarget = b.dataset.bt; save(); root.querySelectorAll("[data-bt]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); autoPush(mondayOf(today())); }); });
      var sy = root.querySelector("#s-sync"); if (sy) sy.addEventListener("click", function () { closeSheet(); syncAndRefresh(true); });
      var dc = root.querySelector("#s-disc"); if (dc) dc.addEventListener("click", function () {
        if (!dc.dataset.armed) { dc.dataset.armed = "1"; dc.textContent = "Confirmer"; return; }
        S.icu = defaults().icu; save(); closeSheet(); render(); toast("Intervals.icu déconnecté");
      });
      var nd = root.querySelector("#s-nodemo"); if (nd) nd.addEventListener("click", function () { clearDemo(); ensurePlans(); save(); closeSheet(); render(); toast("Sorties d'exemple retirées"); });
      root.querySelector("#exp").addEventListener("click", function () {
        var f = buildExport(), done = function () { S.settings.lastExport = today(); save(); toast("Sauvegarde exportée"); };
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: "Sauvegarde Triple" }).then(done).catch(function (err) { if (err && err.name !== "AbortError") download(f, done); });
        else download(f, done);
      });
      root.querySelector("#imp").addEventListener("click", function () { $("import-input").click(); });
      root.querySelector("#s-crispi").addEventListener("change", function (e) { S.settings.airfryer = e.target.checked ? "crispi" : ""; save(); render(); toast(e.target.checked ? "Recettes au Ninja CRISPi activées" : "Recettes sans air fryer"); });
      root.querySelector("#s-hsave").addEventListener("click", function () {
        var h = [0, 1, 2].map(function (i) { return parseNum(root.querySelector("#s-h" + i).value); });
        if (h.every(function (x) { return x != null && x >= 0 && x <= 24; }) && h[0] < h[1] && h[1] < h[2]) { S.settings.mealHours = h; save(); toast("Heures enregistrées"); } else toast("Heures invalides");
      });
      var wipe = root.querySelector("#wipe");
      wipe.addEventListener("click", function () {
        if (!wipe.dataset.armed) { wipe.dataset.armed = "1"; wipe.textContent = "Confirmer : tout effacer"; return; }
        S = defaults(); dirty(); previews = {}; save(); closeSheet(); render(); openProfile(true);
      });
    });
  }
  function download(file, done) {
    var u = URL.createObjectURL(file), a = document.createElement("a");
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000); done();
  }
  $("open-settings").addEventListener("click", openSettings);
  $("import-input").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var p; try { p = JSON.parse(r.result); } catch (err) { toast("Fichier illisible."); return; }
      if (!p || (p.app !== "triple" && p.app !== "remcox") || !p.state) { toast("Ce fichier n'est pas une sauvegarde Triple."); return; }
      var key = S.icu.key; S = normalize(p.state); S.icu.key = key;
      dirty(); previews = {}; save(); closeSheet(); ensurePlans(); render(); toast("Sauvegarde importée");
      if (!S.profile) openProfile(true);
    };
    r.readAsText(f);
  });

  /* --- profil (premier lancement & modification) --- */
  var ACTIVITY = { assis: ["Assis la plupart du temps", "Bureau, études, peu de marche"], debout: ["Debout ou marche régulière", "Commerce, enseignement, 8 000 pas et plus"], actif: ["Travail physique", "Chantier, manutention"] };
  var GOALS = { perf: ["Performance", "Manger assez pour progresser et bien récupérer."], affutage: ["Affûtage", "Perdre un peu de poids : léger déficit les jours faciles seulement, jamais les jours de grosse séance."] };
  function openProfile(first) {
    var pf = S.profile || {}, draft = { name: pf.name || "", sex: pf.sex || "h", age: pf.age || "", height: pf.height || "", weight: pf.weight || "", activity: pf.activity || "assis", goal: pf.goal || "perf", curHours: pf.curHours || 5, store: S.settings.store };
    function opt(attr, val, cur, lab, hint) { return '<button type="button" class="opt' + (cur === val ? ' sel' : '') + '" data-' + attr + '="' + val + '"><span class="grow"><span class="nm">' + esc(lab) + '</span>' + (hint ? '<span class="tiny muted">' + esc(hint) + '</span>' : '') + '</span></button>'; }
    function form() {
      return (first ? '<div class="brand"><span class="logo" aria-hidden="true"></span><div><h2>Bienvenue sur Triple</h2><p class="small muted">Triathlon : natation, vélo, course. Ton plan, ta forme et ton assiette. Tout reste sur ton téléphone.</p></div></div>' : '<h2>Mon profil</h2>') +
        '<div class="field"><label for="pf-name">Prénom</label><input id="pf-name" type="text" autocomplete="given-name" value="' + esc(draft.name) + '" placeholder="Facultatif"></div>' +
        '<div class="field"><span class="lab">Sexe</span><div class="seg" role="group"><button type="button" data-sex="h" aria-pressed="' + (draft.sex === "h") + '">Homme</button><button type="button" data-sex="f" aria-pressed="' + (draft.sex === "f") + '">Femme</button></div></div>' +
        '<div class="three"><div class="field"><label for="pf-age">Âge</label><input id="pf-age" type="text" inputmode="numeric" value="' + esc(draft.age) + '" placeholder="ans"></div><div class="field"><label for="pf-h">Taille</label><input id="pf-h" type="text" inputmode="numeric" value="' + esc(draft.height) + '" placeholder="cm"></div><div class="field"><label for="pf-w">Poids</label><input id="pf-w" type="text" inputmode="decimal" value="' + esc(String(draft.weight).replace(".", ",")) + '" placeholder="kg"></div></div>' +
        '<div class="field"><span class="lab">Au quotidien, hors sport</span><div class="opts">' + Object.keys(ACTIVITY).map(function (k) { return opt("activity", k, draft.activity, ACTIVITY[k][0], ACTIVITY[k][1]); }).join("") + '</div></div>' +
        '<div class="field"><span class="lab">Objectif nutrition</span><div class="opts">' + Object.keys(GOALS).map(function (k) { return opt("goal", k, draft.goal, GOALS[k][0], GOALS[k][1]); }).join("") + '</div></div>' +
        '<div class="field"><span class="lab">Volume actuel (si tu n\'as pas encore importé de sorties)</span><div class="row"><div class="stepper"><button type="button" data-hrs="-1" aria-label="Une heure de moins">−</button><span class="num" id="pf-hrs">' + draft.curHours + '</span><button type="button" data-hrs="1" aria-label="Une heure de plus">+</button></div><span class="small muted">heures par semaine</span></div></div>' +
        '<div class="field"><span class="lab">Où fais-tu tes courses ?</span><div class="chips">' + D.STORES.map(function (s) { return '<button type="button" class="chipbtn" data-st="' + s.id + '" aria-pressed="' + (draft.store === s.id) + '">' + esc(s.name) + '</button>'; }).join("") + '</div></div>' +
        '<p class="err" id="pf-err" hidden></p><button class="btn primary block" id="pf-next">' + (first ? 'Continuer' : 'Enregistrer') + '</button>' + (first ? '' : '<button class="btn block" data-sheet="close">Annuler</button>');
    }
    sheet(form(), function (root) {
      var sh = root.querySelector(".sheet");
      function err(m) { var e = root.querySelector("#pf-err"); e.textContent = m; e.hidden = false; e.scrollIntoView({ block: "center" }); }
      sh.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-sex]"))) { draft.sex = b.dataset.sex; sh.querySelectorAll("[data-sex]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }
        else if ((b = e.target.closest("[data-activity]"))) { draft.activity = b.dataset.activity; sh.querySelectorAll("[data-activity]").forEach(function (x) { x.classList.toggle("sel", x === b); }); }
        else if ((b = e.target.closest("[data-goal]"))) { draft.goal = b.dataset.goal; sh.querySelectorAll("[data-goal]").forEach(function (x) { x.classList.toggle("sel", x === b); }); }
        else if ((b = e.target.closest("[data-hrs]"))) { draft.curHours = Math.max(1, Math.min(25, draft.curHours + (+b.dataset.hrs))); sh.querySelector("#pf-hrs").textContent = draft.curHours; }
        else if ((b = e.target.closest("[data-st]"))) { draft.store = b.dataset.st; sh.querySelectorAll("[data-st]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }
        else if (e.target.closest("#pf-next")) {
          draft.name = sh.querySelector("#pf-name").value.trim(); draft.age = parseNum(sh.querySelector("#pf-age").value); draft.height = parseNum(sh.querySelector("#pf-h").value); draft.weight = parseNum(sh.querySelector("#pf-w").value);
          if (!draft.age || draft.age < 14 || draft.age > 90) return err("Indique ton âge (entre 14 et 90 ans).");
          if (!draft.height || draft.height < 130 || draft.height > 230) return err("Indique ta taille en cm, par exemple 178.");
          if (!draft.weight || draft.weight < 35 || draft.weight > 200) return err("Indique ton poids en kg, par exemple 71,5.");
          S.profile = { name: draft.name, sex: draft.sex, age: Math.round(draft.age), height: Math.round(draft.height), weight: draft.weight, activity: draft.activity, goal: draft.goal, curHours: draft.curHours };
          S.settings.store = draft.store;
          if (!Object.keys(S.weights).length) S.weights[today()] = draft.weight;
          previews = {}; save();
          if (first) openTrainingSetup(); else { closeSheet(); ensurePlans(); render(); toast("Profil enregistré"); }
        }
      });
    }, null, first);
  }
  function openTrainingSetup() {
    var av = S.train.avail.slice(), sp = JSON.parse(JSON.stringify(S.train.sports)), prio = S.train.prio, dbl = !!S.train.doubles;
    function html() {
      return '<h2>Ton entraînement</h2><p class="small muted">Le temps maximum que tu peux t\'entraîner chaque jour. Tu pourras le changer à tout moment dans l\'onglet Plan.</p>' +
        '<div class="avail">' + av.map(function (v, i) { return '<div class="li"><span class="lab">' + DAYS_LONG[i] + '</span><span class="val num' + (v ? '' : ' off') + '">' + (v ? hm(v) : 'Repos') + '</span><div class="stepper"><button type="button" data-i="' + i + '" data-d="-15"' + (v ? '' : ' disabled') + ' aria-label="Moins">−</button><button type="button" data-i="' + i + '" data-d="15" aria-label="Plus">+</button></div></div>'; }).join("") + '</div>' +
        '<p class="small num">Total : <b>' + hm(sum(av)) + '</b> par semaine</p>' +
        '<div class="field"><span class="lab">Sports</span><div class="chips">' + E.SPORTS.map(function (s) { return '<button type="button" class="chipbtn" data-sp="' + s + '" aria-pressed="' + !!sp[s] + '">' + SPORT[s] + '</button>'; }).join("") + '</div></div>' +
        '<div class="field"><span class="lab">Priorité</span><div class="seg acc" role="group">' + [["equilibre", "Équilibré"], ["natation", "Natation"], ["velo", "Vélo"], ["course", "Course"]].map(function (o) { return '<button type="button" data-prio="' + o[0] + '" aria-pressed="' + (prio === o[0]) + '">' + o[1] + '</button>'; }).join("") + '</div></div>' +
        '<label class="switch"><input type="checkbox" id="tr-dbl"' + (dbl ? ' checked' : '') + '><span>Je peux faire 2 séances le même jour (par exemple natation le midi, course le soir)</span></label>' +
        '<p class="tiny muted">En triathlon, l\'idéal est 2 séances de chaque sport par semaine. Avec moins de 6 jours disponibles, autoriser 2 séances le même jour aide à y arriver.</p>' +
        '<button class="btn primary block" id="tr-next">Continuer</button>';
    }
    sheet(html(), function (root) {
      var sh = root.querySelector(".sheet");
      sh.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-i]"))) { var i = +b.dataset.i, v = Math.max(0, Math.min(360, av[i] + (+b.dataset.d))); if (v > 0 && v < 30) v = +b.dataset.d > 0 ? 30 : 0; av[i] = v; sh.innerHTML = html(); }
        else if ((b = e.target.closest("[data-sp]"))) { var s = b.dataset.sp; if (sp[s] && E.SPORTS.filter(function (x) { return sp[x]; }).length === 1) return; sp[s] = !sp[s]; sh.innerHTML = html(); }
        else if ((b = e.target.closest("[data-prio]"))) { prio = b.dataset.prio; sh.innerHTML = html(); }
        else if (e.target.id === "tr-dbl") { dbl = e.target.checked; }
        else if (e.target.closest("#tr-next")) {
          if (sum(av) < 60) { toast("Prévois au moins une heure par semaine"); return; }
          S.train.avail = av; S.train.sports = sp; S.train.prio = prio; S.train.doubles = dbl; S.plans = {}; S.train.planStart = mondayOf(today()); previews = {}; save();
          openTastes(true);
        }
      });
    }, null, true);
  }

  /* ================= pas de zoom ================= */
  /* Comme une appli : ni zoom au double tap, ni zoom en pinçant. Les taps rapides sur les boutons (+, −…) passent toujours. */
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); }, { passive: false });
  var lastTouchEnd = 0;
  document.addEventListener("touchend", function (e) {
    var now = Date.now();
    if (now - lastTouchEnd < 350 && !(e.target.closest && e.target.closest("button,a,input,select,textarea,label,summary,[data-act],[role=button],.grip"))) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  /* ================= démarrage ================= */
  rebuildRecipes();
  if (S.reloadDemo) { delete S.reloadDemo; clearDemo(); loadDemo(); }
  pruneOld(); ensurePlans(); save();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  var lastDay = today();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (today() !== lastDay) { lastDay = today(); repasSeg = MK[slotNow()]; previews = {}; ensurePlans(); render(); }
    autoSync(5);
  });
  /* Appli ouverte : on relit Intervals.icu toutes les 10 minutes, sans rien demander. */
  setInterval(function () { if (document.visibilityState === "visible") autoSync(10); }, 60000);
  var startTab = location.hash ? location.hash.slice(1) : null;
  if (!startTab) try { startTab = sessionStorage.getItem("remcox.tab"); } catch (e) {}
  show(startTab || "accueil");
  if (!S.profile) openProfile(true);
  else autoSync(5);

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      /* Nouvelle version prête : elle s'installe toute seule, sauf si une fenêtre est ouverte (on ne coupe pas une saisie) : alors le bandeau la propose. */
      function ready(w) {
        if (!document.querySelector("#sheet-root .scrim")) { w.postMessage("skipWaiting"); return; }
        $("update-banner").hidden = false; $("update-btn").onclick = function () { w.postMessage("skipWaiting"); };
      }
      if (reg.waiting && navigator.serviceWorker.controller) ready(reg.waiting);
      reg.addEventListener("updatefound", function () { var w = reg.installing; if (!w) return; w.addEventListener("statechange", function () { if (w.state === "installed" && navigator.serviceWorker.controller) ready(w); }); });
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") reg.update().catch(function () {}); });
    }).catch(function () {});
    var reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (!reloaded) { reloaded = true; location.reload(); } });
  }
})();
