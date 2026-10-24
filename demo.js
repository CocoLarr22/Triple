/* Triple — sorties d'exemple, pour découvrir l'appli avant de connecter Intervals.icu. */
(function (root) {
  "use strict";
  var E = root.RC_ENGINE;
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
  var TPL = [
    [0, "natation", "Swim", 45, 0.7, 2.8, 0, "Natation · piscine"],
    [1, "velo", "VirtualRide", 75, 0.79, 0, 0, "Home trainer · sweet spot"],
    [2, "course", "Run", 50, 0.72, 10.6, 30, "Footing du midi"],
    [3, "natation", "Swim", 50, 0.74, 2.9, 0, "Natation · séries"],
    [5, "velo", "Ride", 175, 0.69, 26, 420, "Sortie longue · col"],
    [6, "course", "Run", 80, 0.7, 10.4, 60, "Sortie longue course"]
  ];
  function demoData(today) {
    var r = rng(7), acts = [], wellness = {}, start = E.mondayOf(E.addDays(today, -7 * 18));
    for (var d = start; d <= today; d = E.addDays(d, 1)) {
      var wd = (E.parseISO(d).getDay() + 6) % 7, wi = Math.floor(E.daysBetween(start, d) / 7), recov = wi % 4 === 3;
      var grow = 1 + wi * 0.012;
      if (d < today) TPL.forEach(function (t, j) {
        if (t[0] !== wd || r() < 0.1) return;
        var min = Math.round(t[3] * grow * (recov ? 0.7 : 1) * (0.88 + r() * 0.24));
        var IF = t[4] + (r() - 0.5) * 0.05, h = min / 60, sp = t[1];
        var km = t[5] ? t[5] * h * IF / 0.68 : 0, dplus = Math.round(t[6] * h * (0.8 + r() * 0.4));
        var kcal = sp === "velo" ? Math.round(IF * 255 * h * 3.6) : sp === "natation" ? Math.round(7 * 72 * h) : Math.round(0.95 * 72 * km);
        acts.push({ id: "demo-" + d + "-" + j, date: d, sport: sp, type: t[2], name: t[7], dur: min * 60, dist: Math.round(km * 1000), dplus: t[2] === "VirtualRide" || sp === "natation" ? 0 : dplus,
          load: Math.round(h * IF * IF * 100), hr: Math.round(118 + (IF - 0.6) * 160 + (r() - 0.5) * 6), watts: sp === "velo" ? Math.round(IF * 255) : 0, kcal: kcal, src: "Exemple", demo: true,
          /* temps par zone (Z1 à Z5) : surtout de l'endurance, plus d'intensité dans les séances clés */
          zt: (IF >= 0.84 ? [0.22, 0.38, 0.14, 0.2, 0.06] : IF >= 0.76 ? [0.2, 0.55, 0.2, 0.05, 0] : [0.3, 0.62, 0.08, 0, 0]).map(function (f) { return Math.round(f * min * 60); }), zs: "hr" });
      });
      wellness[d] = { hrv: Math.round(58 + (r() - 0.5) * 14), rhr: Math.round(47 + (r() - 0.5) * 5), sleep: Math.round((7.2 + (r() - 0.5) * 1.6) * 3600), weight: Math.round((72.4 - wi * 0.03 + (r() - 0.5) * 0.8) * 10) / 10, demo: true };
    }
    return { acts: acts, wellness: wellness, zones: { ftp: 255, lthrRide: 162, lthrRun: 171, pace: true, css: 108, demo: true } };
  }
  root.RC_DEMO = demoData;
})(typeof window !== "undefined" ? window : globalThis);
