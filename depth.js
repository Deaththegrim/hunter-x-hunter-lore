/* A lorebook, depth: the connections web of a person, the era compare, a skill's ladder and the weakness finder.
   Pure helpers on App.data plus their markup; pages.js calls them while drawing a page. */
(function () {
  "use strict";
  var A = window.App, esc = A.esc;
  var D = A.depth = {};

  function wordRe(name) {
    return new RegExp("(^|[^\\w'])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w])");
  }

  /* the ways the text calls a person: the full name, and a short name only they carry ("Tsumugi"), unless that short name is
     also an ordinary word somewhere in the text ("Angry", "Archivist") or part of another record's name */
  var ALIAS = null;
  function aliases() {
    if (ALIAS) return ALIAS;
    var count = {}, names = {}, plain = {}, other = {};
    A.data.npcs.forEach(function (o) { names[o.name] = 1; });
    Object.keys(names).forEach(function (nm) {
      (nm.match(/[A-Z][a-z]{3,}/g) || []).forEach(function (t, i, all) { if (all.indexOf(t) === i) count[t] = (count[t] || 0) + 1; });
    });
    ["npcs", "locations", "lore", "books"].forEach(function (d) {
      A.data[d].forEach(function (r) { (r.info.match(/\b[a-z]{4,}\b/g) || []).forEach(function (w) { plain[w] = 1; }); });
    });
    ["locations", "factions", "creatures", "items", "abilities", "traits"].forEach(function (d) {
      A.data[d].forEach(function (r) { (r.name.match(/[A-Z][a-z]{3,}/g) || []).forEach(function (t) { other[t] = 1; }); });
    });
    ALIAS = {};
    Object.keys(names).forEach(function (nm) {
      var pats = [wordRe(nm)];
      (nm.match(/[A-Z][a-z]{3,}/g) || []).forEach(function (t) {
        if (count[t] === 1 && !plain[t.toLowerCase()] && !other[t]) pats.push(wordRe(t));
      });
      ALIAS[nm] = pats;
    });
    return ALIAS;
  }
  function says(text, name) { return aliases()[name].some(function (re) { return re.test(text); }); }
  D.says = says;

  /* a person's web: who their text names, who names them, then faction-mates and housemates (twins of one person left out) */
  D.connections = function (n) {
    var out = {};
    A.data.npcs.forEach(function (o) {
      if (o.name === n.name || out[o.name]) return;
      var names = says(n.info, o.name), named = says(o.info, n.name);
      var fac = !!n.faction && o.faction === n.faction, home = !!n.location && o.location === n.location;
      if (names || named || fac || home) out[o.name] = {r: o, names: names, named: named, fac: fac, home: home};
    });
    var rank = function (c) { return c.names && c.named ? 0 : c.names || c.named ? 1 : c.fac ? 2 : 3; };
    return Object.keys(out).map(function (k) { return out[k]; }).sort(function (a, b) {
      return rank(a) - rank(b) || a.r.name.localeCompare(b.r.name);
    });
  };
  D.kindOf = function (c) { return c.names && c.named ? "both" : c.names ? "names" : c.named ? "named" : c.fac ? "fac" : "home"; };

  /* a radial web: this person in the middle, up to 12 connections around, each a link; lines say who names whom */
  D.web = function (n, list) {
    list = list.slice(0, 12);
    if (!list.length) return "";
    var W = 520, H = 420, cx = W / 2, cy = H / 2, R = 150, r0 = 34, r1 = 24;
    var node = function (p, x, y, rad, label, href, id) {
      var clip = "c" + id;
      return '<a href="' + href + '"><title>' + esc(label) + "</title>" +
        '<clipPath id="' + clip + '"><circle cx="' + x + '" cy="' + y + '" r="' + rad + '"/></clipPath>' +
        '<circle cx="' + x + '" cy="' + y + '" r="' + (rad + 2) + '" class="webring"/>' +
        (p.img ? '<image href="' + esc(p.img) + '" x="' + (x - rad) + '" y="' + (y - rad) + '" width="' + rad * 2 + '" height="' + rad * 2 +
          '" clip-path="url(#' + clip + ')" preserveAspectRatio="xMidYMin slice"/>' : '<circle cx="' + x + '" cy="' + y + '" r="' + rad + '" class="webnone"/>') +
        '<text x="' + x + '" y="' + (y + rad + 16) + '" text-anchor="middle" class="weblbl">' + esc(label.length > 22 ? label.slice(0, 21) + "…" : label) + "</text></a>";
    };
    var lines = "", nodes = "";
    list.forEach(function (c, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / list.length, x = Math.round(cx + R * Math.cos(a)), y = Math.round(cy + R * Math.sin(a));
      var kind = D.kindOf(c);
      lines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" class="web' + kind + '"/>';
      nodes += node(c.r, x, y, r1, c.r.name, A.href("people", c.r.id), "w" + i);
    });
    return '<figure class="web"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(n.name) + "'s connections: " +
      esc(list.map(function (c) { return c.r.name; }).join(", ")) + '">' + lines + nodes + node(n, cx, cy, r0, n.name, A.href("people", n.id), "me") +
      '</svg><figcaption class="note"><span class="key keyboth"></span> they name each other · <span class="key keynames"></span> ' +
      esc(n.name) + ' names them · <span class="key keynamed"></span> they name ' + esc(n.name) + ' · <span class="key keyfac"></span> same faction · ' +
      '<span class="key keyhome"></span> same home</figcaption></figure>';
  };

  D.connectionsHtml = function (n) {
    var list = D.connections(n).filter(function (c) { return !A.hidden(c.r); });   // people the reader keeps covered stay covered
    if (!list.length) return "";
    var text = list.filter(function (c) { return c.names || c.named; });
    var HOW = {both: "they name each other", names: "named in " + n.name + "'s story", named: "names " + n.name, fac: "same faction", home: "same home"};
    return "<h2>Connections</h2>" + D.web(n, list) + (text.length ? "<ul>" + text.map(function (c) {
      return '<li><a href="' + A.href("people", c.r.id) + '">' + esc(c.r.name) + '</a> <span class="note">(' + esc(HOW[D.kindOf(c)]) + ")</span></li>";
    }).join("") + "</ul>" : "");
  };

  /* the eras of one person side by side */
  D.compareHtml = function (versions, era) {
    if (versions.length < 2) return "";
    return '<details class="compare"><summary>Compare the eras side by side</summary><div class="cmpgrid">' + versions.map(function (o) {
      var pl = A.byName("locations", o.location);
      return '<div class="say"><h3><a href="' + A.href("people", o.id) + '">' + esc(pl ? era(pl.region) : "Elsewhere") + "</a></h3>" +
        (o.epithet ? '<p class="note">' + esc(o.epithet) + "</p>" : "") +
        "<p><strong>Home:</strong> " + esc(o.location || "-") + (o.area ? ", " + esc(o.area) : "") + "<br><strong>Level:</strong> " + esc(o.level) +
        " · " + esc(o.tier) + "<br><strong>Faction:</strong> " + esc(o.faction || "-") + "</p><p>" + esc(A.first(o.info, 320)) + "</p>" +
        (o.personality.length ? "<ul>" + o.personality.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
    }).join("") + "</div></details>";
  };

  /* a skill's ladder: every ability that needs it, by the level it needs */
  D.ladder = function (skill) {
    return A.data.abilities.filter(function (a) {
      return a.needs.some(function (q) { return q.type === "skill" && q.variable === skill; });
    }).map(function (a) {
      var q = a.needs.filter(function (q) { return q.type === "skill" && q.variable === skill; })[0];
      return {a: a, lv: Number(q.amount) || 0};
    }).sort(function (x, y) { return x.lv - y.lv || x.a.name.localeCompare(y.a.name); });
  };
  D.ladderHtml = function (skill) {
    var rungs = D.ladder(skill);
    if (!rungs.length) return "";
    return '<details class="ladder"><summary>' + rungs.length + " abilities open on this art, by level</summary><ol>" + rungs.map(function (x) {
      return '<li><span class="lv">' + x.lv + '</span> <a href="' + A.href("abilities", x.a.id) + '">' + esc(x.a.name) + "</a> " +
        '<span class="note">' + esc(A.first(x.a.info, 90)) + "</span></li>";
    }).join("") + "</ol></details>";
  };

  /* creatures by what hurts them: every damage word any creature is weak to */
  D.damageWords = function () {
    var all = {};
    A.data.creatures.forEach(function (c) { c.weak.concat(c.resist, c.immune).forEach(function (w) { all[w] = 1; }); });
    return Object.keys(all).sort();
  };
})();
