/* Lorebook pages: one renderer per section, list + entry. */
(function () {
  "use strict";
  var A = window.App, P = A.pages, esc = A.esc;
  var TIERS = ["weak", "average", "strong", "elite", "boss", "mythic"];

  function crumbs(parts) {
    return '<div class="crumbs"><a href="./">Home</a>' + parts.map(function (p) {
      return " / " + (p[1] ? '<a href="' + p[1] + '">' + p[0] + "</a>" : esc(p[0]));
    }).join("") + "</div>";
  }
  function find(dkey, id) {
    var list = A.data[dkey];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function missing(what) { A.h(crumbs([[what]]) + "<h1>Not in the lorebook</h1><p class='lede'>Nothing by that name is known here.</p>"); }
  /* one hue per district, spaced round the wheel: the accent on its cards, its map pins and its hub page */
  var DCOL = null;
  function dcol(d) {
    if (!DCOL) {
      DCOL = {};
      Object.keys(districtsAll()).sort().forEach(function (n, i, all) { DCOL[n] = "hsl(" + Math.round(i * 360 / all.length) + ", 62%, 62%)"; });
    }
    return DCOL[d] || "";
  }
  A.dcol = dcol;
  function districtOf(kind, r) {
    if (kind === "places") return r.district;
    if (kind === "people") { var l = r.location && A.byName("locations", r.location); return l ? l.district : ""; }
    return "";
  }
  function accent(d) { return d && dcol(d) ? ' style="--dc:' + dcol(d) + '"' : ""; }
  function card(kind, r, sub, land) {
    var d = districtOf(kind, r), been = kind === "places" && A.been && A.been.has(r.id);
    return '<a class="card' + (d ? " dc" : "") + (been ? " visited" : "") + '" href="' + A.href(kind, r.id) + '"' + accent(d) +
      (d || been ? ' title="' + esc((d || "") + (been ? (d ? " · " : "") + "been there" : "")) + '"' : "") + ">" + (r.img !== undefined ? '<div class="pic' + (land ? " land" : "") + '">' +
      A.img(r.img, r.name, "", true) + "</div>" : "") + '<div class="body"><div class="t">' + esc(r.name) + "</div>" +
      (sub ? '<div class="s">' + sub + "</div>" : "") + (land || r.img === undefined ? '<div class="x">' + esc(A.first(r.info)) + "</div>" : "") +
      "</div></a>";
  }
  function uniq(list) { var seen = {}; return list.filter(function (n) { return seen[n.name] ? false : (seen[n.name] = 1); }); }
  function copy(btn, text) {
    var done = function (msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = "Copy"; }, 1500); };
    if (!navigator.clipboard) { done("Select and copy"); return; }
    navigator.clipboard.writeText(text).then(function () { done("Copied"); }, function () { done("Select and copy"); });
  }
  function districtLink(d) {
    return '<a href="districts/' + d.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + '/">' + esc(d) + "</a>";
  }
  var KINDNAME = {people: "People", places: "Places", factions: "Factions", creatures: "Creatures", lore: "Lore", mechanics: "Guide books",
                  items: "Items", starts: "Story starts"};
  /* appends "Mentioned on" to the entry's main column (after the page has drawn, so its own listeners stay) */
  function mentioned(name, kind, id) {
    var list = A.mentions(name, kind, id), col = document.querySelector("main .article > .prose, main > .prose");
    if (!list.length || !col) return;
    var by = {};
    list.forEach(function (m) { (by[m.kind] = by[m.kind] || []).push(m.r); });
    var sec = document.createElement("section");
    sec.innerHTML = "<h2>Mentioned on</h2>" + Object.keys(by).map(function (k) {
      var rows = by[k];
      return "<p><strong>" + esc(KINDNAME[k] || k) + ":</strong> " + rows.slice(0, 30).map(function (r) {
        return '<a href="' + A.href(k, r.id) + '">' + esc(r.name) + "</a>";
      }).join(", ") + (rows.length > 30 ? ' <span class="note">and ' + (rows.length - 30) + " more</span>" : "") + "</p>";
    }).join("");
    col.appendChild(sec);
  }
  function nameCell(kind) { return function (r) { return '<a href="' + A.href(kind, r.id) + '">' + esc(r.name) + "</a>"; }; }
  function byArea(people) {   // a place's people under the area they keep to, the areas in the place's own order
    var groups = {}, order = [];
    people.forEach(function (n) { var k = n.area || ""; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(n); });
    return order.sort(function (a, b) { return (a === "") - (b === ""); }).map(function (k) { return {area: k, rows: groups[k]}; });
  }
  function levels(lv) { return lv && lv.length ? lv.join("-") : ""; }
  function regionOf(name) { return A.byName("regions", name); }
  function placeLink(name, area) {
    var p = A.byName("locations", name);
    if (!p) return esc(name || "");
    return '<a href="' + A.href("places", p.id) + '">' + esc(name) + "</a>" + (area ? ", " + esc(area) : "");
  }
  A.ui = {card: card, crumbs: crumbs, find: find, missing: missing, uniq: uniq, placeLink: placeLink, nameCell: nameCell,   // play.js
          mentioned: mentioned, districtLink: districtLink, districtsAll: districtsAll};
  /* a place's era by its region ("" in a world with none), a story start's by its card (the site block, the world's hooks) */
  function hasEras() { return Object.keys(A.data.site.eras.regions).length > 0; }
  function era(region) { return hasEras() ? A.data.site.eras.regions[region] || A.data.site.eras.other : ""; }
  function startEra(r) {
    var E = A.data.site.startEras, hit = E.rules.filter(function (x) { return new RegExp(x[0]).test(r.info); })[0];
    return hit ? hit[1] : E.other;
  }
  function bookLink(name) {   // a guide book the pages cite, linked when the world has it
    var b = name && A.byName("books", name);
    return b ? '<a href="' + A.href("mechanics", b.id) + '">' + esc(b.name) + "</a>" : esc(name || "");
  }
  A.bookLink = bookLink;   // play.js

  /* ---------- home ---------- */
  P[""] = function () {
    var d = A.data, isles = regionOf(d.site.main);
    var tiles = [["people", A.count("npcs"), "people"], ["places", d.locations.length, "places"], ["districts", Object.keys(districtsAll()).length, "districts"], ["factions", d.factions.length, "factions"],
                 ["creatures", d.creatures.length, "creatures"], ["items", d.items.length, "items"], ["abilities", d.abilities.length, "abilities"],
                 ["traits", d.traits.length, "traits"], ["lore", d.lore.length, "lore entries"], ["mechanics", d.books.length, "guide books"],
                 ["say", d.say.length, "typed actions"], ["starts", d.starts.length, "story starts"], ["music", d.music.length, "tracks"]]
      .filter(function (t) { return d.site.off.indexOf(t[0]) < 0; });   // a section the world has none of
    var some = function (list, n) {   // n at random, no repeats
      list = list.slice(); var out = [];
      while (list.length && out.length < n) out.push(list.splice(Math.floor(Math.random() * list.length), 1)[0]);
      return out;
    };
    var people = some(uniq(d.npcs.filter(function (n) { return n.img && !A.hidden(n); })), 6);
    var scenic = d.locations.filter(function (l) { return l.img && l.region === d.site.main && l.kind === "complex"; });
    var hero = some(scenic, 1)[0], places = some(scenic.filter(function (l) { return l !== hero; }), 4);
    var all = districtsAll(), dnames = Object.keys(all).sort();
    var sl = function (n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
    var tools = [["say/", "What to say", A.t("homeSay")],
                 ["bench/", "Crafting bench", "Pick a recipe and get the lines to type, checked against the world's own scripts."],
                 ["planner/", "Character planner", "Every creator pick with its unlocks; compare two builds side by side."],
                 ["map/" + (isles ? isles.id + "/" : ""), "The map", A.t("homeMap")]]
      .filter(function (t) { return t[0] !== "bench/" || d.craft; });   // the crafting bench, where the world has one
    var intro = isles ? A.first(isles.info.replace(/^\[[^\]]*\]\s*/, ""), 260) : "";
    A.h('<section class="banner"' + (hero ? "" : ' data-plain="1"') + ">" + (hero ? A.img(hero.img, "").replace('loading="lazy" ', "") : "") +
      '<div class="bannertext"><h1>' + esc(d.site.world) + "</h1><p>" + esc(intro) + '</p><div class="bannerlinks">' +
      tools.map(function (t) { return '<a href="' + t[0] + '">' + esc(t[1]) + "</a>"; }).join("") + "</div>" +
      (hero ? '<a class="pictured" href="' + A.href("places", hero.id) + '">Pictured: ' + esc(hero.name) + (hero.district ? ", " + esc(hero.district) : "") + "</a>" : "") +
      "</div></section>" +
      '<div class="tiles">' + tiles.map(function (t) { return '<a class="tile" href="' + t[0] + '/"><b>' + t[1] + "</b><span>" + t[2] + "</span></a>"; }).join("") + "</div>" +
      "<h2>Start here</h2><div class='grid wide'>" + tools.map(function (t) {
        return '<a class="card tool" href="' + t[0] + '"><div class="body"><div class="t">' + esc(t[1]) + '</div><div class="x">' + esc(t[2]) + "</div></div></a>";
      }).join("") + "</div>" +
      (dnames.length ? "<h2>The districts</h2><div class='dchips'>" + dnames.map(function (n) {
        return '<a href="districts/' + sl(n) + '/"' + accent(n) + "><i></i>" + esc(n) + "</a>";
      }).join("") + "</div>" : "") +
      (places.length ? "<h2>Places to visit</h2><div class='grid wide'>" + places.map(function (l) { return card("places", l, esc(l.district || ""), true); }).join("") + "</div>" : "") +
      (people.length ? "<h2>People you might meet</h2><div class='grid'>" + people.map(function (n) { return card("people", n, esc(n.type)); }).join("") + "</div>" : "") +
      (isles && isles.map ? '<h2>The map</h2><a class="hero" href="map/' + isles.id + '/">' + A.img(isles.map, isles.name + " map") + "</a>" : "") +
      '<p class="note" style="margin-top:32px">Everything here is what a player can learn at the table: no one\'s secrets, no hidden places. ' +
      "Built from the world file; data " + esc(d.sha || "") + ".</p>");
  };

  /* ---------- people ---------- */
  P.people = function (id) {
    if (id) return person(id);
    var seen = {}, rows = A.data.npcs.filter(function (n) { return seen[n.name] ? false : (seen[n.name] = 1); });
    A.listPage({title: "People", rows: rows, lede: esc(A.t("ledePeople")),
      facet: {district: function (r) { var p = A.byName("locations", r.location); return p ? p.district : ""; },
              faction: function (r) { return r.faction; }, tier: function (r) { return r.tier; }, type: function (r) { return r.type; }},
      names: {district: "District", faction: "Faction", tier: "Tier", type: "Type"},
      sorts: {tier: function (a, b) { return TIERS.indexOf(a) - TIERS.indexOf(b); }},
      card: function (r) { return card("people", r, esc(r.type) + (r.level ? " · level " + r.level : "")); }});
  };
  function person(id) {
    var n = find("npcs", id);
    if (!n) return missing("People");
    var parts = n.info.split(/\n\s*\n/);
    var others = A.data.npcs.filter(function (o) { return o.location && o.location === n.location && o.id !== n.id; });
    var place = A.byName("locations", n.location);
    var versions = A.data.npcs.filter(function (o) { return o.name === n.name; });
    var vlabel = function (o) { var pl = A.byName("locations", o.location); return (pl ? era(pl.region) : "Elsewhere") + (o.epithet ? ": " + o.epithet : ""); };
    A.h(crumbs([["People", "people/"], [n.name]]) + "<h1>" + esc(n.name) + "</h1>" + (n.epithet ? '<p class="lede">' + esc(n.epithet) + "</p>" : "") +
      (versions.length > 1 ? '<nav class="tabs" aria-label="Eras">' + versions.map(function (o) {
        return '<a href="' + A.href("people", o.id) + '"' + (o.id === n.id ? ' class="on" aria-current="page"' : "") + ">" + esc(vlabel(o)) + "</a>";
      }).join("") + "</nav>" : "") + A.depth.compareHtml(versions, era) + '<div class="article"><div class="prose">' +
      A.prose(parts.join("\n\n"), n.name) +
      (n.personality.length ? "<h2>Personality</h2><ul>" + n.personality.map(function (l) {
        var m = l.split(/:\s*/); return "<li><strong>" + esc(m[0]) + ":</strong> " + esc(m.slice(1).join(": ")) + "</li>";
      }).join("") + "</ul>" : "") + A.depth.connectionsHtml(n) +
      (others.length ? "<h2>Also at " + esc(n.location) + "</h2><div class='grid'>" + others.slice(0, 18).map(function (o) {
        return card("people", o, esc(o.type));
      }).join("") + "</div>" : "") + "</div>" +
      A.infobox(n.name, n.img || (versions.filter(function (o) { return o.img; })[0] || {}).img, [["Type", esc(n.type)], ["Gender", esc(n.gender)], ["Tier", esc(n.tier)], ["Level", n.level],
        ["Faction", n.faction ? A.nameLink("factions", n.faction) : ""], ["Home", n.location ? placeLink(n.location, n.area) : ""],
        ["District", place && place.district ? districtLink(place.district) : ""], ["Era", place ? era(place.region) : ""],
        ["Map", place && regionOf(place.region) && regionOf(place.region).map ? '<a href="map/' + regionOf(place.region).id + "/?pin=" + place.id + '">Show on map</a>' : ""]]) +
      "</div>");
    mentioned(n.name, "people", n.id);
  }

  /* ---------- places ---------- */
  P.places = function (id) {
    if (id) return placePage(id);
    var facet = {};
    if (hasEras()) facet.era = function (r) { return era(r.region); };
    facet.district = function (r) { return r.district; };
    facet.kind = function (r) { return r.kind; };
    if (A.been.count()) facet.been = function (r) { return A.been.has(r.id) ? "Been there" : "Not yet"; };   // only once the reader marks a place
    A.listPage({title: "Places", rows: A.data.locations, lede: esc(A.t("ledePlaces")),
      facet: facet, names: {era: "Era", district: "District", kind: "Kind", been: "Been there"},
      card: function (r) { return card("places", r, esc(r.district || r.region) + (levels(r.levels) ? " · lv " + levels(r.levels) : ""), true); }});
  };
  function sayHere(name) {
    var out = [];
    A.data.say.forEach(function (f) {
      f.triggers.forEach(function (t) {
        if (t.where.some(function (w) { return w.split(": ").slice(1).join(": ") === name; }) || t.dests.indexOf(name) >= 0 && f.key === "route") {
          if (!out.some(function (o) { return o.f === f; })) out.push({f: f, t: t});
        }
      });
    });
    return out;
  }
  function placePage(id) {
    var p = find("locations", id);
    if (!p) return missing("Places");
    var people = A.data.npcs.filter(function (n) { return n.location === p.name; });
    var reg = regionOf(p.region), here = sayHere(p.name);
    A.h(crumbs([["Places", "places/"], [p.name]]) + "<h1>" + esc(p.name) + '</h1><p class="beenrow">' + A.been.button(p) +
      '<span id="beenkept"></span></p><div class="article"><div class="prose">' +
      A.prose(p.info.replace(/^\[[^\]]*\]\s*/, ""), p.name) +
      (here.length ? "<h2>What you can do here</h2><ul>" + here.map(function (h) {
        return '<li><a href="say/' + h.f.key + '/">' + esc(h.f.label) + "</a>" + (h.t.examples[0] ? ": <code>" + esc(h.t.examples[0]) + "</code>" : "") + "</li>";
      }).join("") + "</ul>" : "") +
      (p.areas.length ? "<h2>Areas</h2><div class='gallery'>" + p.areas.map(function (a) {
        return "<figure>" + (a.img ? A.img(a.img, a.name, "", true) : '<div class="noimg" role="img" aria-label="No picture yet"></div>') + "<figcaption><b>" + esc(a.name) + "</b>" + A.link(esc(a.text.split("\n")[0]), p.name) + "</figcaption></figure>";
      }).join("") + "</div>" : "") +
      (people.length ? "<h2>People here</h2>" + byArea(people).map(function (g) {
        return (g.area ? "<h3>" + esc(g.area) + "</h3>" : "") + "<div class='grid'>" + g.rows.map(function (n) { return card("people", n, esc(n.type)); }).join("") + "</div>";
      }).join("") : "") +
      "</div>" + A.infobox(p.name, p.img, [["District", p.district ? districtLink(p.district) : ""], ["Region", esc(p.region)], ["Era", era(p.region)],
        ["Kind", esc(p.kind)], ["Levels", levels(p.levels)], ["Factions", p.factions.map(function (f) { return A.nameLink("factions", f); }).join(" · ")],
        ["Map", reg && reg.map ? '<a href="map/' + reg.id + "/?pin=" + p.id + '">Show on map</a>' : ""]]) + "</div>");
    mentioned(p.name, "places", p.id);
  }

  /* ---------- map ---------- */
  /* a region with no map picture: its places as a list, as its pre-rendered page has them; a world with no map at all: the
     regions, each its own page */
  function mapless(r) {
    if (!r) {
      A.h(crumbs([["Map"]]) + "<h1>Map</h1><div class='grid wide'>" + A.visible(A.data.regions).map(function (x) { return card("map", x, ""); }).join("") + "</div>");
      return;
    }
    var places = A.data.locations.filter(function (l) { return l.region === r.name; });
    A.h(crumbs([["Map", "map/"], [r.name]]) + "<h1>" + esc(r.name) + '</h1><div class="prose">' + A.prose(r.info, r.name) +
      "<h2>Places in this region</h2></div><div class='grid'>" + places.map(function (l) {
        return card("places", l, esc(l.district || l.kind) + (levels(l.levels) ? " · lv " + levels(l.levels) : ""), true);
      }).join("") + "</div>");
  }
  P.map = function (id) {
    var asked = id ? A.data.regions.filter(function (r) { return r.id === id; })[0] : null;
    var regs = A.data.regions.filter(function (r) { return r.map && A.data.locations.some(function (l) { return l.region === r.name; }); });
    if ((asked && !asked.map) || !regs.length) return mapless(asked && !asked.map ? asked : null);
    var reg = regs.filter(function (r) { return r.id === id; })[0] || regs.filter(function (r) { return r.name === A.data.site.main; })[0] || regs[0];
    var pinId = A.param("pin"), distPick = A.param("district");
    var places = A.data.locations.filter(function (l) { return l.region === reg.name; });
    var dists = {}; places.forEach(function (p) { if (p.district) dists[p.district] = 1; });
    var main = A.data.site.mapOrder;
    var opts = regs.filter(function (r) { return r === reg || !A.hidden(r); }).sort(function (a, b) {
      var ia = main.indexOf(a.name), ib = main.indexOf(b.name);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.name.localeCompare(b.name);
    });
    A.h(crumbs([["Map"]]) + "<h1>" + esc(reg.name) + '</h1><div class="mapbar"><select id="mreg" aria-label="Which map">' +
      opts.map(function (r) { return '<option value="' + r.id + '"' + (r === reg ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("") +
      '</select><select id="mdist" aria-label="Show one district"><option value="">All districts</option>' +
      Object.keys(dists).sort().map(function (d) { return "<option>" + esc(d) + "</option>"; }).join("") +
      '</select><input id="mfind" type="search" placeholder="Find a place on this map" aria-label="Find a place" list="mlist"><datalist id="mlist">' +
      places.map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join("") +
      '</datalist><label><input type="checkbox" id="mlbl"> Show labels</label><span class="count" id="mcount"></span>' +
      '<button type="button" id="mclear" hidden>Clear my marks</button><span id="beenkept"></span>' + A.spoil.listNote(regs.length - opts.length, regs.length - opts.length === 1 ? "map" : "maps") + "</div>" +
      (Object.keys(dists).length ? '<div class="dchips small" id="mlegend">' + Object.keys(dists).sort().map(function (d) {
        return '<button type="button" data-d="' + esc(d) + '"' + accent(d) + "><i></i>" + esc(d) + '<span class="prog" data-prog="' + esc(d) + '"></span></button>';
      }).join("") + "</div>" : "") +
      '<div class="map" id="map" tabindex="0" aria-label="Map of ' + esc(reg.name) + ': drag or arrow keys to pan, + and - to zoom; find a place with the box above">' +
      '<div class="stage" id="stage">' + A.img(reg.map, reg.name).replace('loading="lazy" ', "") +
      places.map(function (p) {
        return '<button class="pin ' + esc(p.kind) + (dcol(p.district) ? " dc" : "") + '" tabindex="-1" data-id="' + p.id + '" style="left:' + (p.fx * 1000) + "px;top:" + (p.fy * 1000) +
          "px" + (dcol(p.district) ? ";--dc:" + dcol(p.district) : "") + '" aria-label="' + esc(p.name) + (p.district ? ", " + esc(p.district) : "") + '"><span class="lbl" hidden>' + esc(p.name) + "</span></button>";
      }).join("") + '</div><div class="pop" id="pop" hidden role="dialog" aria-label="Place" tabindex="-1"></div><div class="zoom"><button id="zin" aria-label="Zoom in">+</button>' +
      '<button id="zout" aria-label="Zoom out">-</button><button id="zfit">Fit</button></div></div>');
    var map = document.getElementById("map"), stage = document.getElementById("stage"), pop = document.getElementById("pop");
    var v = {s: 1, x: 0, y: 0};
    var labelsOn = false, rank = {complex: 0, wilderness: 1, simple: 2};
    // the labels that fit: towns first, then wilds, then the rest, shortest names first; a label that would overlap one already
    // placed (or leave the map) stays hidden until the zoom makes room (the screen size of a label never changes with zoom)
    var order = places.slice().sort(function (a, b) {
      return (rank[a.kind] === undefined ? 3 : rank[a.kind]) - (rank[b.kind] === undefined ? 3 : rank[b.kind]) || a.name.length - b.name.length;
    });
    var sizes = null;   // each label's real size on screen, measured once (a label's screen size never changes with zoom)
    function measure() {
      sizes = {};
      stage.querySelectorAll(".pin .lbl").forEach(function (l) {
        l.hidden = false;
        var b = l.getBoundingClientRect();
        sizes[l.parentNode.dataset.id] = [b.width, b.height];
        l.hidden = true;
      });
    }
    function placeLabels() {
      if (labelsOn && !sizes) measure();
      var r = map.getBoundingClientRect(), dist = document.getElementById("mdist").value;
      var at = function (p) { return [v.x + p.fx * 1000 * v.s, v.y + p.fy * 1000 * v.s]; };
      // obstacles: every pin (a label never covers another place's dot) and the zoom buttons
      var pins = places.map(function (p) { var c = at(p); return {id: p.id, box: [c[0] - 9, c[1] - 9, c[0] + 9, c[1] + 9]}; });
      var z = document.querySelector(".zoom").getBoundingClientRect();
      var boxes = [[z.left - r.left - 6, z.top - r.top - 6, z.right - r.left + 6, z.bottom - r.top + 6]];
      var hit = function (box, own) {
        return box[0] < 0 || box[2] > r.width || box[1] < 0 || box[3] > r.height ||
          boxes.some(function (o) { return box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]; }) ||
          pins.some(function (q) { var o = q.box; return q.id !== own && box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]; });
      };
      order.forEach(function (p) {
        var lbl = stage.querySelector('.pin[data-id="' + p.id + '"] .lbl');
        if (!lbl) return;
        var show = labelsOn && !(dist && p.district !== dist), left = false;
        if (show) {
          var c = at(p), size = sizes[p.id] || [p.name.length * 8 + 20, 24], w = size[0] + 6, h = size[1] + 4;
          var right = [c[0] + 9, c[1] - h / 2, c[0] + 9 + w, c[1] + h / 2], leftBox = [c[0] - 9 - w, c[1] - h / 2, c[0] - 9, c[1] + h / 2];
          if (!hit(right, p.id)) boxes.push(right);
          else if (!hit(leftBox, p.id)) { boxes.push(leftBox); left = true; }   // the right is taken: try the left of the dot
          else show = false;
        }
        lbl.hidden = !show;
        lbl.classList.toggle("left", left);
      });
    }
    function apply() {
      stage.style.transform = "translate(" + v.x + "px," + v.y + "px) scale(" + v.s + ")";
      stage.querySelectorAll(".pin").forEach(function (b) { b.style.transform = "translate(-50%, -50%) scale(" + (1 / v.s) + ")"; });
      if (labelsOn) { cancelAnimationFrame(apply.raf); apply.raf = requestAnimationFrame(placeLabels); }
    }
    function fit() {
      var r = map.getBoundingClientRect();
      v.s = Math.min(r.width, r.height) / 1000; v.x = (r.width - 1000 * v.s) / 2; v.y = (r.height - 1000 * v.s) / 2; apply();
    }
    function zoom(f, cx, cy) {
      var r = map.getBoundingClientRect();
      cx = cx == null ? r.width / 2 : cx; cy = cy == null ? r.height / 2 : cy;
      var ns = Math.max(0.2, Math.min(8, v.s * f));
      v.x = cx - (cx - v.x) * ns / v.s; v.y = cy - (cy - v.y) * ns / v.s; v.s = ns; apply();
    }
    function focus(p) {
      var r = map.getBoundingClientRect();
      v.s = Math.max(v.s, 2.5); v.x = r.width / 2 - p.fx * 1000 * v.s; v.y = r.height / 2 - p.fy * 1000 * v.s; apply();
      stage.querySelectorAll(".pin").forEach(function (b) { b.classList.toggle("on", b.dataset.id === p.id); });
      var people = A.data.npcs.filter(function (n) { return n.location === p.name; });
      pop.hidden = false;
      pop.innerHTML = (p.img ? A.img(p.img, p.name, "", true) : "") + '<div class="body"><h3><a href="' + A.href("places", p.id) + '">' + esc(p.name) +
        "</a></h3><div class='note'>" + esc(p.district || "") + (levels(p.levels) ? " · level " + levels(p.levels) : "") + "</div><p>" +
        esc(A.first(p.info, 260)) + "</p>" + (people.length ? "<div class='note'>" + people.length + " people here</div>" : "") +
        '<p class="popbtns">' + A.been.button(p) + '<button id="pclose">Close</button></p></div>';
      document.getElementById("pclose").onclick = closePop;
      if (keyed) pop.focus();
    }
    var keyed = false, lastFocus = null;
    function closePop() { pop.hidden = true; if (lastFocus) lastFocus.focus(); }
    map.addEventListener("keydown", function (e) {
      var step = 60;
      if (e.key === "Escape" && !pop.hidden) { e.preventDefault(); closePop(); return; }
      if (e.target.closest("input, select, .pop")) return;
      var d = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]}[e.key];
      if (d) { e.preventDefault(); v.x += d[0]; v.y += d[1]; apply(); }
      else if (e.key === "+" || e.key === "=") zoom(1.4); else if (e.key === "-") zoom(1 / 1.4);
    });
    map.addEventListener("scroll", function () { map.scrollLeft = 0; map.scrollTop = 0; });
    var drag = null, touches = {}, pinch = null;
    map.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".pin, .pop, .zoom")) return;
      touches[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(touches);
      if (ids.length === 2) {   // two fingers: pinch to zoom around their midpoint
        var a = touches[ids[0]], b = touches[ids[1]];
        pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: v.s}; drag = null;
      } else { drag = {x: e.clientX - v.x, y: e.clientY - v.y}; }
      map.classList.add("drag"); map.setPointerCapture(e.pointerId);
    });
    map.addEventListener("pointermove", function (e) {
      if (touches[e.pointerId]) touches[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(touches);
      if (pinch && ids.length === 2) {
        var a = touches[ids[0]], b = touches[ids[1]], r = map.getBoundingClientRect();
        zoom(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d / v.s, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      } else if (drag) { v.x = e.clientX - drag.x; v.y = e.clientY - drag.y; apply(); }
    });
    function lift(e) { delete touches[e.pointerId]; pinch = null; drag = null; map.classList.remove("drag"); }
    map.addEventListener("pointerup", lift);
    map.addEventListener("pointercancel", lift);
    map.addEventListener("wheel", function (e) {
      e.preventDefault(); var r = map.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
    }, {passive: false});
    stage.addEventListener("click", function (e) {
      var b = e.target.closest(".pin"); if (!b) return;
      keyed = false; lastFocus = null;
      focus(places.filter(function (p) { return p.id === b.dataset.id; })[0]);
    });
    document.getElementById("zin").onclick = function () { zoom(1.4); };
    document.getElementById("zout").onclick = function () { zoom(1 / 1.4); };
    document.getElementById("zfit").onclick = fit;
    document.getElementById("mreg").onchange = function () { A.go("map/" + this.value + "/"); };
    document.getElementById("mdist").onchange = function () {
      var d = this.value;
      stage.querySelectorAll(".pin").forEach(function (b) {
        var p = places.filter(function (x) { return x.id === b.dataset.id; })[0];
        b.classList.toggle("dim", !!d && p.district !== d);
      });
      document.querySelectorAll("#mlegend button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.d === d ? "true" : "false"); });
      placeLabels();
    };
    /* the reader's marks: pins they have been to, each district's progress on its legend chip, the count, the clear button */
    function tally() {
      if (!stage.isConnected) { A.been.changed = null; return; }   // the reader has left this map
      var prog = A.been.progress(places), n = 0;
      stage.querySelectorAll(".pin").forEach(function (b) { var on = A.been.has(b.dataset.id); b.classList.toggle("been", on); if (on) n++; });
      document.querySelectorAll("#mlegend [data-prog]").forEach(function (s) {
        var o = prog[s.dataset.prog]; s.textContent = n && o ? o[0] + "/" + o[1] : "";
      });
      document.getElementById("mcount").textContent = places.length + " places" + (n ? " · been to " + n : "");
      var c = document.getElementById("mclear");
      c.hidden = !A.been.count(); c.textContent = "Clear my marks"; c.dataset.armed = "";
      document.getElementById("beenkept").innerHTML = A.been.keptNote();
    }
    A.been.changed = tally;
    var clear = document.getElementById("mclear");
    clear.onclick = function () {   // asks once in place: a second press clears every mark, on every map
      if (!this.dataset.armed) { this.dataset.armed = "1"; this.textContent = "Clear all " + A.been.count() + " marks?"; return; }
      A.been.clear();
      pop.querySelectorAll("[data-been]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      tally();
    };
    clear.onblur = function () { if (this.dataset.armed) { this.dataset.armed = ""; this.textContent = "Clear my marks"; } };
    tally();
    var legend = document.getElementById("mlegend");
    if (legend) legend.onclick = function (e) {
      var b = e.target.closest("button[data-d]"); if (!b) return;
      var sel = document.getElementById("mdist");
      sel.value = sel.value === b.dataset.d ? "" : b.dataset.d;   // a second click shows every district again
      sel.onchange();
    };
    document.getElementById("mlbl").onchange = function () { labelsOn = this.checked; placeLabels(); };
    document.getElementById("mfind").onchange = function () {
      var p = A.byName("locations", this.value);
      if (p && p.region === reg.name) { keyed = true; lastFocus = this; focus(p); }
    };
    fit();
    if (distPick && dists[distPick]) { document.getElementById("mdist").value = distPick; document.getElementById("mdist").onchange(); }
    var start = places.filter(function (p) { return p.id === pinId; })[0];
    if (start) focus(start);
  };

  /* ---------- factions ---------- */
  /* ---------- creatures ---------- */
  P.creatures = function (id) {
    if (id) {
      var c = find("creatures", id);
      if (!c) return missing("Creatures");
      var met = uniq(A.data.npcs.filter(function (n) { return n.type === c.name; }));
      var tags = function (l, cls) { return l.map(function (x) { return '<span class="tag ' + cls + '">' + esc(x) + "</span>"; }).join(""); };
      A.h(crumbs([["Creatures", "creatures/"], [c.name]]) + "<h1>" + esc(c.name) + '</h1><div class="article"><div class="prose">' +
        A.prose(c.info, c.name) + (met.length ? "<h2>Known " + esc(c.name) + "</h2><div class='grid'>" + met.map(function (n) {
          return card("people", n, n.level ? "level " + n.level : "");
        }).join("") + "</div>" : "") + "</div>" +
        A.infobox(c.name, met[0] && met[0].img, [["Weak to", tags(c.weak, "weak")], ["Resists", tags(c.resist, "strong")], ["Immune", tags(c.immune, "boss")]]) + "</div>");
      mentioned(c.name, "creatures", c.id);
      return;
    }
    A.listPage({title: "Creatures", rows: A.data.creatures, wide: true, lede: esc(A.t("ledeCreatures")) + " Pick a damage type to see what it hurts.",
      facet: {weak: function (r) { return r.weak; }, resist: function (r) { return r.resist; }}, names: {weak: "Weak to", resist: "Resists"},
      card: function (r) { return card("creatures", r, (r.weak.length ? "weak to " + esc(r.weak.join(", ")) : "")); },
      table: [{h: "Creature", v: function (r) { return r.name; }, html: nameCell("creatures")},
              {h: "Weak to", v: function (r) { return r.weak.join(", "); }, html: function (r) { return esc(r.weak.join(", ")); }},
              {h: "Resists", v: function (r) { return r.resist.join(", "); }, html: function (r) { return esc(r.resist.join(", ")); }},
              {h: "Immune", v: function (r) { return r.immune.join(", "); }, html: function (r) { return esc(r.immune.join(", ")); }}]});
  };

  /* ---------- lore ---------- */
  P.lore = function (id) {
    if (id) {
      var l = find("lore", id);
      if (!l) return missing("Lore");
      A.h(crumbs([["Lore", "lore/"], [l.name]]) + "<h1>" + esc(l.name) + '</h1><div class="prose">' + A.prose(l.info, l.name) + "</div>");
      return;
    }
    A.listPage({title: "Lore", rows: A.data.lore, wide: true, lede: esc(A.t("ledeLore")),
      card: function (r) { return card("lore", r, ""); }});
  };

  /* ---------- mechanics: the guide books ---------- */
  var BOOK_SAY = {};
  function bookSay() {
    if (Object.keys(BOOK_SAY).length) return BOOK_SAY;
    A.data.say.forEach(function (f) { (BOOK_SAY[f.book] = BOOK_SAY[f.book] || []).push(f); });
    return BOOK_SAY;
  }
  P.mechanics = function (id) {
    if (id) {
      var b = find("books", id);
      if (!b) return missing("Mechanics");
      var acts = bookSay()[b.name] || [];
      var bench = !!A.data.craft && A.data.site.books.bench.indexOf(b.name) >= 0;
      A.h(crumbs([["Mechanics", "mechanics/"], [b.name]]) + "<h1>" + esc(b.name) + '</h1><div class="prose">' + A.prose(b.info, b.name) +
        (acts.length || bench ? "<h2>What to say</h2><ul>" + (bench ? '<li><a href="bench/">The crafting bench</a>: build the exact line and see what the forge says</li>' : "") +
          acts.map(function (f) { return '<li><a href="say/' + f.key + '/">' + esc(f.label) + "</a></li>"; }).join("") + "</ul>" : "") +
        '<p class="note">Every new character carries this book in the world.</p></div>');
      return;
    }
    A.h(crumbs([["Mechanics"]]) + '<h1>Mechanics</h1><p class="lede">' + esc(A.t("ledeMechanics")) + " " +
      'Each book links to the lines that set its system off.</p><div class="grid wide">' +
      A.data.books.map(function (b) { return card("mechanics", b, (bookSay()[b.name] || []).length ? (bookSay()[b.name].length + " typed actions") : ""); }).join("") +
      '</div><h2>Tables</h2><ul><li><a href="skills/">Skills</a>: what each art covers and how hard things are</li><li><a href="traits/">Traits</a>: every creation pick and what it gives</li>' +
      '<li><a href="abilities/">Abilities</a>: requirements, power and cooldown</li><li><a href="items/">Items</a>: bonuses by item</li></ul>');
  };

  /* ---------- skills, traits, abilities, items ---------- */
  P.skills = function () {
    A.h(crumbs([["Skills"]]) + '<h1>Skills</h1><p class="lede">' + esc(A.t("ledeSkills")) + " Each names what it covers, what it does not, and examples by difficulty.</p>" +
      A.data.skills.map(function (s) {
        return '<h2 class="cap" id="' + s.id + '" data-toc="' + esc(s.name) + '">' + esc(s.name) + ' <span class="tag">' + esc(s.type) + '</span> <span class="tag">' + esc(s.attribute) + '</span></h2><div class="prose">' +
          A.prose(s.info) + A.depth.ladderHtml(s.name) + "</div>";
      }).join(""));
  };
  var kv = A.bonuses;
  /* an ability's requirements in words: "Forging 24", "Level 5", a trait as its own name (linked) */
  function needs(list, plain) {   // plain: no links (inside a card, which is a link itself)
    return (list || []).map(function (r) {
      if (r.type === "skill") return esc((r.variable || "").charAt(0).toUpperCase() + (r.variable || "").slice(1) + " " + r.amount);
      if (r.type === "characterLevel") return "Level " + esc(r.amount);
      if (r.type === "trait") { var t = A.byName("traits", r.variable); return t && !plain ? '<a href="' + A.href("traits", t.id) + '">' + esc(r.variable) + "</a>" : esc(r.variable); }
      return esc(r.type + " " + (r.variable || "") + " " + (r.amount != null ? r.amount : ""));
    }).join(", ");
  }
  P.traits = function (id) {
    if (id) {
      var t = find("traits", id);
      if (!t) return missing("Traits");
      var cat = A.data.categories.filter(function (c) { return c.name === t.category; })[0];
      A.h(crumbs([["Traits", "traits/"], [t.name]]) + "<h1>" + esc(t.name) + '</h1><div class="article"><div class="prose">' + A.prose(t.info, t.name) +
        (cat ? "<h2>" + esc(cat.name) + "</h2>" + A.prose(cat.info.split("\n\n")[0]) : "") + "</div>" +
        A.infobox(t.name, null, [["Category", esc(t.category)], ["Attributes", kv(t.attributes)], ["Skills", kv(t.skills)], ["Resources", kv(t.resources)],
          ["Abilities", t.abilities.map(function (a) { var r = A.byName("abilities", a); return r ? '<a href="' + A.href("abilities", r.id) + '">' + esc(a) + "</a>" : esc(a); }).join(", ")],
          ["Starts with", t.startingItems.map(function (i) { return esc(i.item || i); }).join(", ")],
          ["Needs", t.unlockedBy.map(function (u) {
            var r = A.data.traits.filter(function (x) { return x.id === u || x.name === u; })[0], s = r ? null : A.byName("starts", u);
            return r ? '<a href="' + A.href("traits", r.id) + '">' + esc(r.name) + "</a>" : s ? 'the start <a href="' + A.href("starts", s.id) + '">' + esc(u) + "</a>" : esc(u);
          }).join(" or ")],
          ["Not with", t.excludedBy.map(function (u) { var s = A.byName("starts", u); return s ? 'the start <a href="' + A.href("starts", s.id) + '">' + esc(u) + "</a>" : esc(u); }).join(", ")]]) + "</div>");
      return;
    }
    A.listPage({title: "Traits", rows: A.data.traits, wide: true, lede: "Every pick in character creation and the traits a story gives you.",
      facet: {category: function (r) { return r.category; }}, names: {category: "Category"},
      card: function (r) { return card("traits", r, esc(r.category) + (kv(r.attributes) ? " · " + kv(r.attributes) : "")); },
      table: [{h: "Trait", v: function (r) { return r.name; }, html: nameCell("traits")},
              {h: "Category", v: function (r) { return r.category; }, html: function (r) { return esc(r.category); }},
              {h: "Attributes", v: function (r) { return kv(r.attributes); }, html: function (r) { return kv(r.attributes); }},
              {h: "Skills", v: function (r) { return kv(r.skills); }, html: function (r) { return kv(r.skills); }},
              {h: "Resources", v: function (r) { return kv(r.resources); }, html: function (r) { return kv(r.resources); }}]});
  };
  P.abilities = function (id) {
    if (id) {
      var a = find("abilities", id);
      if (!a) return missing("Abilities");
      A.h(crumbs([["Abilities", "abilities/"], [a.name]]) + "<h1>" + esc(a.name) + '</h1><div class="article"><div class="prose">' + A.prose(a.info, a.name) + "</div>" +
        A.infobox(a.name, null, [["Needs", needs(a.needs)], ["Power", a.bonus], ["Cooldown", a.cooldown != null ? a.cooldown + " turns" : ""]]) + "</div>");
      return;
    }
    A.listPage({title: "Abilities", rows: A.data.abilities, wide: true, lede: "Techniques, arts and powers, with what each needs.",
      facet: {needs: function (r) {
        var q = r.needs[0];
        return !q ? "nothing" : q.type === "skill" ? q.variable : q.type === "characterLevel" ? "a level" : "a trait";
      }}, names: {needs: "Needs"},
      card: function (r) { return card("abilities", r, needs(r.needs, true)); },
      table: [{h: "Ability", v: function (r) { return r.name; }, html: nameCell("abilities")},
              {h: "Needs", v: function (r) { return r.needs[0] ? (r.needs[0].variable || r.needs[0].type) + " " + String(1000 + (r.needs[0].amount || 0)) : ""; },
               html: function (r) { return needs(r.needs); }},
              {h: "Power", v: function (r) { return Number(r.bonus) || 0; }, html: function (r) { return r.bonus == null ? "" : esc(r.bonus); }},
              {h: "Cooldown", v: function (r) { return Number(r.cooldown) || 0; }, html: function (r) { return r.cooldown == null ? "" : esc(r.cooldown); }}]});
  };
  /* ---------- starts, modes, music, search ---------- */
  P.starts = function (id) {
    if (id) {
      var s = find("starts", id);
      if (!s) return missing("Story starts");
      A.h(crumbs([["Story starts", "starts/"], [s.name]]) + "<h1>" + esc(s.name) + '</h1><div class="prose">' + A.prose(s.info, s.name) + "</div>");
      return;
    }
    // the facets read the start's own card line ("PARTY · 2-5 players · Saikai Free Port · guided") and danger line
    var head = function (r) { return r.info.split("\n")[0].split(" · "); };
    var sf = {who: function (r) { return /^PARTY/.test(r.info) ? "Party" : "Solo"; },
              district: function (r) { var h = head(r); return h.length > 2 ? h[h.length - 2] : ""; },
              danger: function (r) { var m = r.info.match(/Danger: \S* ?(\w+)/); return m ? m[1] : ""; }};
    if (A.data.site.startEras.rules.length) sf.era = startEra;
    A.listPage({title: "Story starts", rows: A.data.starts, wide: true, lede: "Where a story can open, and who is in the first scene.",
      facet: sf,
      names: {who: "Who", district: "District", danger: "Danger", era: "Era"},
      card: function (r) { return card("starts", r, esc(head(r).slice(0, 2).join(" · "))); }});
  };
  P.modes = function () {
    A.h(crumbs([["Game modes"]]) + '<h1>Game modes</h1><p class="lede">How the story leans: what to expect more of, what less, and which starts suit it.</p>' +
      A.data.modes.map(function (m) { return "<h2>" + esc(m.name) + '</h2><div class="prose">' + A.prose(m.info) + "</div>"; }).join(""));
  };
  P.music = function () {
    var by = {};
    A.data.music.forEach(function (t) { (by[t.mood] = by[t.mood] || []).push(t); });
    A.h(crumbs([["Music"]]) + '<h1>Music</h1><p class="lede">' + esc(A.t("ledeMusic")) + '</p><div id="music">' +
      Object.keys(by).sort().map(function (m) {
        return "<h2>" + esc(m.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")) + '</h2><p><button type="button" class="playall">Play all ' +
          by[m].length + '</button></p><div class="grid wide">' + by[m].map(function (t) {
          return '<div class="say"><div class="t">' + esc(t.title) + '</div><audio controls preload="none" aria-label="' + esc(t.title) + '" src="' + esc(t.url) + '"></audio></div>';
        }).join("") + "</div>";
      }).join("") + "</div>");
    // one track at a time; "Play all" runs a mood's tracks in order, each one starting when the last ends
    var box = document.getElementById("music"), queue = null;
    var tracksAfter = function (btn) { return [].slice.call(btn.closest("p").nextElementSibling.querySelectorAll("audio")); };
    box.addEventListener("play", function (e) {
      box.querySelectorAll("audio").forEach(function (a) { if (a !== e.target) a.pause(); });
      if (queue && queue.indexOf(e.target) < 0) queue = null;   // a track started by hand ends the run
    }, true);
    box.addEventListener("ended", function (e) {
      if (!queue) return;
      var next = queue[queue.indexOf(e.target) + 1];
      if (next) next.play(); else queue = null;
    }, true);
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".playall"); if (!b) return;
      queue = tracksAfter(b); queue[0].currentTime = 0; queue[0].play();
    });
  };
  /* results grouped by kind, best kinds first (people and places), each group's best matches first */
  P.search = function () {
    var q = A.param("q");
    var list = A.search(q), groups = {}, order = [];
    list.forEach(function (e) { if (!groups[e.kind]) { groups[e.kind] = []; order.push(e.kind); } groups[e.kind].push(e); });
    var label = {people: "People", places: "Places", factions: "Factions", creatures: "Creatures", lore: "Lore", mechanics: "Guide books",
                 abilities: "Abilities", traits: "Traits", skills: "Skills", items: "Items", starts: "Story starts", map: "Maps"};
    A.h(crumbs([["Search"]]) + "<h1>Results for \"" + esc(q) + '"</h1><p class="count">' + list.length + " found in " + order.length + " kinds</p>" +
      (list.length ? "" : '<p class="lede">Nothing matches. Try one word of a name, or a place.</p>') +
      order.map(function (k) {
        var rows = groups[k];
        return '<h2 class="kindhead" data-toc="' + esc(label[k] || k) + '">' + esc(label[k] || k) + ' <span class="count">' + rows.length + "</span></h2><div class='grid" +
          (k === "people" || k === "places" ? "" : " wide") + "'>" + rows.slice(0, 60).map(function (e) {
            var r = A.byId[e.kind + "/" + e.id];
            return card(e.kind, r, esc(r.type || r.district || r.category || ""), e.kind === "places");
          }).join("") + "</div>" + (rows.length > 60 ? '<p class="note">' + (rows.length - 60) + " more: narrow the search.</p>" : "");
      }).join(""));
  };

  /* ---------- districts: the hub pages (the district's lore, its places, people and factions) ---------- */
  function districtsAll() {
    var out = {};
    A.data.locations.forEach(function (l) { if (l.district) (out[l.district] = out[l.district] || []).push(l); });
    return out;
  }
  P.districts = function (id) {
    var all = districtsAll(), names = Object.keys(all).sort();
    var sl = function (n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
    var lore = function (n) { return A.byName("lore", "District: " + n); };
    var site = A.data.site, isles = regionOf(site.main);
    // a district's hub lore opens "<District> is a district of <the world>. ": the card shows what follows
    var hubLine = new RegExp("^.*? is a district of " + site.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\. ");
    if (!id) {
      var marked = A.been.count(), prog = A.been.progress(A.data.locations.filter(function (l) { return l.region === site.main; }));
      A.h(crumbs([["Districts"]]) + '<h1>Districts</h1><p class="lede">' + esc(A.t("ledeDistricts")) + " " +
        'Each one\'s level band covers everything in it.</p><div class="grid wide">' +
        names.map(function (n) {
          var places = all[n].filter(function (l) { return l.region === site.main; });
          var hub = places.filter(function (l) { return l.img; })[0] || {};
          var lv = places.map(function (l) { return l.levels || []; }).reduce(function (a, b) { return a.concat(b); }, []);
          var band = lv.length ? Math.min.apply(null, lv) + "-" + Math.max.apply(null, lv) : "";
          var lr = lore(n);
          return '<a class="card dc" href="districts/' + sl(n) + '/"' + accent(n) + '><div class="pic land">' + A.img(hub.img, n, "", true) + '</div><div class="body"><div class="t">' +
            esc(n) + '</div><div class="s">' + places.length + " places" + (band ? " · level " + band : "") + (marked ? " · been to " + (prog[n] || [0])[0] : "") + '</div><div class="x">' +
            esc(lr ? A.first(lr.info.replace(hubLine, ""), 140) : "") + "</div></div></a>";
        }).join("") + "</div>");
      return;
    }
    var name = names.filter(function (n) { return sl(n) === id; })[0];
    if (!name) return missing("Districts");
    var before = all[name].filter(function (l) { return l.region === site.main; });
    var after = site.lateRegion ? all[name].filter(function (l) { return l.region === site.lateRegion; }) : [];
    var others = all[name].filter(function (l) { return l.region !== site.main && l.region !== site.lateRegion; });   // a district over more regions
    var shown = all[name].filter(function (l) { return !A.hidden(l); }), lateHidden = after.length && A.hidden(after[0]);
    var here = {}; shown.forEach(function (l) { here[l.name] = 1; });
    var people = uniq(A.data.npcs.filter(function (n) { return here[n.location] && !A.hidden(n); }));
    var facs = {}; shown.forEach(function (l) { l.factions.forEach(function (f) { facs[f] = 1; }); });
    var mine = A.been.count() ? A.been.progress(shown)[name] : null;
    var lr = lore(name);
    A.h(crumbs([["Districts", "districts/"], [name]]) + '<h1 class="dh"' + accent(name) + ">" + esc(name) + '</h1><div class="prose">' + (lr ? A.prose(lr.info, name) : "") +
      "</div><p>" + (isles && isles.map ? '<a href="map/' + isles.id + "/?district=" + encodeURIComponent(name) + '">Show it on the map</a> · ' : "") +
      '<a href="people/?district=' + encodeURIComponent(name) + '">Everyone here</a></p>' +
      (mine ? '<p class="beenbar"><span>Been to ' + mine[0] + " of " + mine[1] + ' places here</span><meter min="0" max="' + mine[1] + '" value="' + mine[0] +
        '" aria-label="Places of ' + esc(name) + ' you have been to"></meter></p>' : "") +
      "<h2>" + esc(A.t("placesBefore")) + "</h2><div class='grid'>" + before.map(function (l) { return card("places", l, esc(l.kind) + (levels(l.levels) ? " · lv " + levels(l.levels) : ""), true); }).join("") + "</div>" +
      (lateHidden ? "<h2>" + esc(A.t("placesAfter")) + "</h2><p>" + A.spoil.listNote(after.length, "places") + "</p>" :
        after.length ? "<h2>" + esc(A.t("placesAfter")) + "</h2><div class='grid'>" + after.map(function (l) { return card("places", l, esc(l.kind) + (levels(l.levels) ? " · lv " + levels(l.levels) : ""), true); }).join("") + "</div>" : "") +
      (others.length ? "<h2>" + esc(A.t("placesElsewhere")) + "</h2><div class='grid'>" + others.map(function (l) { return card("places", l, esc(l.region) + (levels(l.levels) ? " · lv " + levels(l.levels) : ""), true); }).join("") + "</div>" : "") +
      (Object.keys(facs).length ? "<h2>Factions here</h2><div class='grid wide'>" + Object.keys(facs).sort().map(function (f) {
        var r = A.byName("factions", f); return r ? card("factions", r, esc(r.type)) : "";
      }).join("") + "</div>" : "") +
      (people.length ? "<h2>People</h2><div class='grid'>" + people.slice(0, 48).map(function (n) { return card("people", n, esc(n.type)); }).join("") + "</div>" +
        (people.length > 48 ? '<p><a href="people/?district=' + encodeURIComponent(name) + '">All ' + people.length + " people of " + esc(name) + "</a></p>" : "") : ""));
  };

  /* ---------- what to say ---------- */
  P.say = function (key) {
    var fams = A.data.say;
    if (!key) {
      var by = {};
      fams.forEach(function (f) { (by[f.system] = by[f.system] || []).push(f); });
      A.h(crumbs([["What to say"]]) + '<h1>What to say</h1><p class="lede">' + esc(A.t("ledeSay")) + " Each one is read off the world\'s own " +
        "triggers and checked against their word checks, so the words are right; where a line also needs the narrator to agree the moment is real, it says so." +
        (A.data.craft ? ' Crafting has its own <a href="bench/">bench</a>.' : "") + "</p>" +
        Object.keys(by).map(function (s) {
          return "<h2>" + esc(s) + "</h2><div class='grid wide'>" + by[s].map(function (f) {
            var t = f.triggers[0];
            return '<a class="card" href="say/' + f.key + '/"><div class="body"><div class="t">' + esc(f.label) + '</div><div class="s">' + esc(f.how) +
              "</div>" + (t.examples[0] ? '<div class="x"><code>' + esc(t.examples[0]) + "</code></div>" : "") + "</div></a>";
          }).join("") + "</div>";
        }).join(""));
      return;
    }
    var f = fams.filter(function (x) { return x.key === key; })[0];
    if (!f) return missing("What to say");
    var book = f.book && A.byName("books", f.book);
    A.h(crumbs([["What to say", "say/"], [f.label]]) + "<h1>" + esc(f.label) + '</h1><p class="lede">' + esc(f.how) +
      (book ? ' Rules: <a href="' + A.href("mechanics", book.id) + '">' + esc(book.name) + "</a>." : "") + "</p>" +
      '<div class="say"><label for="try"><b>Try your own line</b></label><div class="line"><input id="try" style="flex:1" placeholder="Type what your character does..."></div>' +
      '<div id="tryout" class="note" aria-live="polite">Type a line to see which of these it would set off.</div></div>' +
      (f.triggers.length > 6 ? '<div class="filters"><input type="search" id="tf" placeholder="Filter by place or person" aria-label="Filter by place or person"><span class="count" id="tc" aria-live="polite"></span></div>' : "") +
      '<div id="trows"></div>');
    function row(t, i) {
      return '<div class="say" data-i="' + i + '">' + (t.where.length ? "<div><b>Where:</b> " + t.where.map(function (w) {
        var nm = w.split(": ").slice(1).join(": "); return esc(w.split(":")[0]) + " " + placeLink(nm);
      }).join(", ") + "</div>" : "") + (t.dests.length ? "<div><b>Destinations:</b> " + t.dests.map(function (d) { return placeLink(d); }).join(", ") + "</div>" : "") +
      (t.needs.length ? "<div><b>Also needs:</b> " + t.needs.map(function (n) { return A.link(esc(n)); }).join("; ") + "</div>" : "") +
      t.examples.map(function (e) {
        return '<div class="line"><code>' + esc(e) + '</code><button data-copy="' + esc(e) + '" aria-label="Copy: ' + esc(e) + '">Copy</button></div>';
      }).join("") + '<div class="note">Word check: ' + t.words.map(function (w) { return "<code>" + esc(w) + "</code>"; }).join(" and ") + "</div></div>";
    }
    function draw(filter) {
      var q = (filter || "").toLowerCase(), n = 0;
      document.getElementById("trows").innerHTML = f.triggers.map(function (t, i) {
        var hay = (t.where.join(" ") + " " + t.needs.join(" ") + " " + t.dests.join(" ") + " " + t.examples.join(" ")).toLowerCase();
        if (q && hay.indexOf(q) < 0) return "";
        n++; return row(t, i);
      }).join("");
      var tc = document.getElementById("tc"); if (tc) tc.textContent = n + " of " + f.triggers.length;
    }
    draw("");
    var tf = document.getElementById("tf"); if (tf) tf.addEventListener("input", function () { draw(tf.value); });
    document.getElementById("trows").addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy]"); if (b) copy(b, b.dataset.copy);
    });
    document.getElementById("try").addEventListener("input", function () {
      var line = this.value, out = document.getElementById("tryout");
      if (!line.trim()) { out.innerHTML = "Type a line to see which of these it would set off."; return; }
      var pass = f.triggers.filter(function (t) { return !Bench.wordCheck(t, line).length; });
      out.innerHTML = pass.length ? '<span class="ok">Passes the word check for ' + pass.length + " of " + f.triggers.length + "</span>" +
        (pass.length < f.triggers.length ? ". The rest need other words: see each one's word check below." : ".") :
        '<span class="no">No match.</span> Use one of the words in a word check below.';
    });
  };

  /* ---------- the crafting bench ---------- */
  P.bench = function () {
    var C = A.data.craft;
    if (!C) return missing("Crafting bench");   // a world with no crafting bench
    var ledger = A.tryStore(A.key("bench")) || {};
    function save(storage) {
      ledger = Bench.own(C, storage);
      return A.tryStore(A.key("bench"), ledger);
    }
    var NOSAVE = '<p class="warn">This browser will not keep the ledger (storage is blocked): it lasts until you leave the page.</p>';
    var stations = A.data.locations;
    var QUAL = ["Base", "Fine", "Superior", "Master-made", "Named"];
    var BB = A.data.site.books.bench;
    A.h(crumbs([["Crafting bench"]]) + '<h1>Crafting bench</h1><p class="lede">' + esc(A.t("benchLede")) + " Rules: " + bookLink(BB[0]) + ", " +
      "recipes: " + bookLink(BB[1]) + '.</p><div class="cols"><div>' +
      '<div class="form"><label for="bact">I want to</label><select id="bact"><option value="craft">Craft a recipe</option><option value="design">Design a new recipe</option>' +
      '<option value="upgrade">Upgrade something I made</option></select>' +
      '<label for="brec" data-for="craft upgrade">Recipe</label><select id="brec" data-for="craft upgrade"></select>' +
      '<label for="bqual" data-for="upgrade">It is now</label><select id="bqual" data-for="upgrade"><option value="">Base</option><option>Fine</option><option>Superior</option><option>Master-made</option></select>' +
      '<label for="bname" data-for="design">Item name</label><input id="bname" data-for="design" placeholder="frost spear">' +
      '<label for="bmats" data-for="design">Materials</label><input id="bmats" data-for="design" placeholder="iron spearhead, ice crystal, cedar haft (up to 5)">' +
      '<label for="bstat" data-for="design">Station</label><select id="bstat" data-for="design"><option value="">let the item choose</option></select>' +
      '<label for="bloc">Where you are</label><select id="bloc"></select><label for="barea">Area</label><select id="barea"></select>' +
      '<label for="bskill">Craft skill</label><input id="bskill" type="number" min="0" max="30" value="3">' +
      '<span></span><p class="note" id="bmaster"></p>' +
      '<label for="broll">The roll</label><select id="broll">' + C.tiers.map(function (t) { return "<option" + (t === "Success" ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") + "</select>" +
      '</div><div class="say" style="margin-top:16px"><div><b>Click the ability</b> <span class="tag" id="babil"></span> <b>and type:</b></div>' +
      '<div class="line"><input id="bline" style="flex:1" aria-label="What to type"><button data-copyline aria-label="Copy the words to type">Copy</button></div>' +
      '<div class="note">The action box then reads: <code id="bfull"></code></div><div class="line"><button class="primary" id="brun">Run it at the bench</button>' +
      '<button id="breset">Clear my ledger</button></div></div></div><div><div id="bout" class="verdict note" aria-live="polite">Pick what to make and press Run.</div>' +
      '<div id="bledger"></div></div></div>');
    var $ = function (id) { return document.getElementById(id); };
    var words = {};
    C.triggers.forEach(function (t) { if (t.ability) words[t.key] = t.ability; });
    var known = function () { return Object.assign({}, C.seed.asg_art_recipes, ledger.asg_art_recipes || {}); };
    function stationWords() {
      var all = {};
      Object.keys(C.seed.asg_art_recipes).forEach(function (k) { all[C.seed.asg_art_recipes[k].station] = 1; });
      return Object.keys(all).sort();
    }
    $("bstat").innerHTML += stationWords().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
    $("bloc").innerHTML = stations.map(function (l) { return "<option>" + esc(l.name) + "</option>"; }).join("");
    function fillAreas() {
      var l = A.byName("locations", $("bloc").value);
      $("barea").innerHTML = (l ? l.areas : []).map(function (a) { return "<option>" + esc(a.name) + "</option>"; }).join("");
    }
    function fillRecipes() {
      var r = known(), act = $("bact").value;
      var names = act === "upgrade" ? Object.keys((ledger.asg_art_stock || {})).concat(Object.keys(r)) : Object.keys(r);
      names = names.filter(function (n, i) { return names.indexOf(n) === i; }).sort();
      $("brec").innerHTML = names.map(function (n) { return "<option>" + esc(n) + "</option>"; }).join("");
    }
    function pickStation() {
      var rec = known()[$("brec").value];
      if (!rec || $("bact").value === "design") return;
      var at = Bench.stationPlace(C, stations, rec.disc);
      if (at) { $("bloc").value = at[0]; fillAreas(); $("barea").value = at[1]; }
    }
    function line() {
      var act = $("bact").value;
      if (act === "craft") return $("brec").value;
      if (act === "upgrade") return ($("bqual").value ? $("bqual").value + " " : "") + $("brec").value;
      var mats = $("bmats").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var m = mats.length > 1 ? mats.slice(0, -1).join(", ") + " and " + mats[mats.length - 1] : mats[0];
      return ($("bname").value.trim() || "frost spear") + (m ? " from " + m : "") + ($("bstat").value ? " at a " + $("bstat").value : "");
    }
    function trig() { return {craft: "asg_art_craft", design: "asg_art_design", upgrade: "asg_art_upgrade"}[$("bact").value]; }
    function update() {
      var act = $("bact").value, rec = known()[$("brec").value];
      $("bmaster").textContent = rec && act !== "design" ? "Stations for " + rec.disc + ": " + (C.stations[rec.disc] || []).join(", ") +
        ". Master-made and Named only at " + (C.masters[rec.disc] || []).join(", ") + "." : "";
      document.querySelectorAll("[data-for]").forEach(function (el) { el.hidden = el.dataset.for.split(" ").indexOf(act) < 0; });
      $("babil").textContent = words[trig()];
      $("bline").value = line();
      $("bfull").textContent = "Use " + words[trig()] + " to " + $("bline").value;
    }
    function drawLedger() {
      var mine = ledger.asg_art_recipes || {}, stock = ledger.asg_art_stock || {};
      var own = Object.keys(mine).filter(function (k) { return !C.seed.asg_art_recipes[k]; });
      $("bledger").innerHTML = "<h3>My ledger (this browser only)</h3><p class='note'>" + Object.keys(C.seed.asg_art_recipes).length + " book recipes" +
        (own.length ? ", designed: " + own.map(esc).join(", ") : "") + "</p>" + (Object.keys(stock).length ? "<ul>" + Object.keys(stock).map(function (k) {
          return "<li>" + esc(k) + ": " + (stock[k] || []).map(function (n, q) { return n ? QUAL[q] + " x" + n : ""; }).filter(Boolean).join(", ") + "</li>";
        }).join("") + "</ul>" : "<p class='note'>Nothing made yet.</p>");
    }
    function scene(text, story) {
      var skills = {}; C.crafts.forEach(function (c) { skills[c] = Number($("bskill").value) || 0; });
      return {text: text, story: story || "", tick: (ledger.__tick || 10) + 1, storage: ledger, location: $("bloc").value, area: $("barea").value,
              roll: $("broll").value, skills: skills};
    }
    function run() {
      var full = "Use " + words[trig()] + " to " + $("bline").value;
      $("bfull").textContent = full;
      var res, sc = scene(full);
      try { res = Bench.craftTurn(C, sc); }
      catch (e) { $("bout").innerHTML = '<span class="no">The bench could not run this: ' + esc(e.message) + "</span>"; return; }
      var bt = Bench.beats(res), pend = res.storage.asg_art_pending || [];
      res.storage.__tick = sc.tick;
      var kept = save(res.storage);
      var named = pend.filter(function (p) { return p.tick === sc.tick; }).pop() || null;
      $("bout").innerHTML = (named ? '<div class="ok"><b>Accepted.</b> The narrator is told to finish it and name it in brackets: <code>[' + esc(named.options[0].name) +
        "]</code></div>" : '<div class="warn"><b>Not made this turn.</b> Read why below.</div>') +
        "<h3>What the narrator is told</h3>" + (bt.length ? bt.map(function (b) { return '<div class="beat">' + esc(b) + "</div>"; }).join("") : "<p class='note'>Nothing: the line did not reach a crafting trigger.</p>") +
        (named ? '<button id="bcommit">The narrator wrote [' + esc(named.options[0].name) + "]</button>" : "") + (kept ? "" : NOSAVE) +
        '<div id="bcommitout"></div>';
      if (named) $("bcommit").onclick = function () {
        var q = named.options[0].q || 0, before = Bench.stockOf(Bench.own(C, ledger), named.base, q), c;
        var sc2 = scene("", Bench.commitLine(named.options[0].name));
        try { c = Bench.commitTurn(C, sc2); }
        catch (e) { $("bcommitout").innerHTML = '<p class="no">The commit could not run: ' + esc(e.message) + "</p>"; return; }
        c.storage.__tick = sc2.tick;
        var ok = save(c.storage), after = Bench.stockOf(ledger, named.base, q);
        $("bcommit").disabled = true;
        $("bcommitout").innerHTML = after > before ? '<p class="ok">Recorded in your ledger: ' + esc(named.options[0].name) + " x" + after + ".</p>" + (ok ? "" : NOSAVE) :
          '<p class="no">The commit did not record it (nothing was waiting for that name).</p>';
        drawLedger(); fillRecipes();
      };
      drawLedger();
    }
    ["bact", "brec", "bqual", "bname", "bmats", "bstat", "bloc", "barea"].forEach(function (id) {
      $(id).addEventListener(id === "bname" || id === "bmats" ? "input" : "change", function () {
        if (id === "bact") fillRecipes();
        if (id === "brec") pickStation();
        if (id === "bloc") fillAreas();
        update();
      });
    });
    $("bline").addEventListener("input", function () { $("bfull").textContent = "Use " + words[trig()] + " to " + this.value; });
    $("brun").onclick = run;
    $("breset").onclick = function () { save({}); drawLedger(); fillRecipes(); $("bout").innerHTML = "Ledger cleared."; };
    document.querySelector("[data-copyline]").onclick = function () { copy(this, $("bline").value); };
    fillAreas(); fillRecipes(); pickStation(); update(); drawLedger();
  };
})();

/* ---------- the character planner: the creator's own categories and rules, added up ---------- */
(function () {
  "use strict";
  var A = window.App, esc = A.esc;

  var START = "@start";   // a build's story start (picked[START]): a pick's unlockedBy / excludedBy may name one, as the creator's do
  /* a trait shows when nothing unlocks it or one of its unlockers is picked, and nothing picked excludes it (either way round) */
  function open(t, picked) {
    var names = Object.keys(picked).map(function (c) { return picked[c]; });
    if (t.unlockedBy.length && !t.unlockedBy.some(function (u) { return names.indexOf(u) >= 0; })) return false;
    return !names.some(function (n) {
      if (n === t.name) return false;
      var o = A.byName("traits", n);
      return t.excludedBy.indexOf(n) >= 0 || (o && o.excludedBy.indexOf(t.name) >= 0);
    });
  }
  function totals(picked) {
    var C = A.data.creation, out = {attr: {}, skills: {}, res: {}, abilities: [], items: []};
    C.attributes.forEach(function (a) { out.attr[a] = C.start; });
    Object.keys(picked).forEach(function (c) {
      var t = A.byName("traits", picked[c]); if (!t) return;
      t.attributes.forEach(function (b) { out.attr[b.attribute] = (out.attr[b.attribute] || C.start) + Number(b.modifier || 0); });
      t.skills.forEach(function (b) { out.skills[b.skill] = (out.skills[b.skill] || 0) + Number(b.modifier || 0); });
      t.resources.forEach(function (b) { out.res[b.resource] = (out.res[b.resource] || 0) + Number(b.modifier || 0); });
      t.abilities.forEach(function (a) { if (out.abilities.indexOf(a) < 0) out.abilities.push(a); });
      t.startingItems.forEach(function (i) { out.items.push((i.quantity > 1 ? i.quantity + " " : "") + (i.item || i)); });
    });
    return out;
  }
  /* a pick whose unlocker went away is dropped, and that can drop others; the story start is no pick and stays */
  function prune(p) {
    var changed = true, dropped = [];
    while (changed) {
      changed = false;
      Object.keys(p).forEach(function (c) {
        if (c === START) return;
        var t = A.byName("traits", p[c]);
        var rest = {}; Object.keys(p).forEach(function (k) { if (k !== c) rest[k] = p[k]; });
        if (!t || !open(t, rest)) { dropped.push(p[c]); delete p[c]; changed = true; }
      });
    }
    return dropped;
  }
  /* the starts a creator pick names (unlockedBy / excludedBy): the planner offers a story start only where one matters */
  function startLocked() {
    return A.data.traits.some(function (t) { return t.unlockedBy.concat(t.excludedBy).some(function (u) { return A.byName("starts", u); }); });
  }
  A.planner = {open: open, totals: totals, prune: prune, START: START, startLocked: startLocked};   // the gate runs these under node

  A.pages.planner = function () {
    var cats = A.data.categories, C = A.data.creation;
    // two builds, A and B, side by side in "Compare"; a shared link carries both (?pick= and ?vs=)
    var stored = A.tryStore(A.key("planner")) || {};
    var builds = stored.A || stored.B ? {A: stored.A || {}, B: stored.B || {}} : {A: stored, B: {}};   // an older save was one build
    var parse = function (str) {
      var out = {};
      str.split("|").forEach(function (n) { var t = A.byName("traits", n); if (t) out[t.category] = n; else if (A.byName("starts", n)) out[START] = n; });
      return out;
    };
    var starts = startLocked() ? A.data.starts : [];
    if (A.param("pick")) builds = {A: parse(A.param("pick")), B: A.param("vs") ? parse(A.param("vs")) : {}};
    var slot = "A", mode = "edit", picked = builds.A;
    var rules = A.data.site.books.planner.map(A.bookLink);
    A.h('<div class="crumbs"><a href="./">Home</a> / Character planner</div><h1>Character planner</h1><p class="lede">' + esc(A.t("plannerLede")) +
      (rules.length ? " Rules: " + rules.join(", ") + "." : "") + '</p><nav class="tabs" aria-label="Builds" id="pslots">' +
      '<a href="planner/" data-slot="A">Build A</a><a href="planner/" data-slot="B">Build B</a><a href="planner/" data-slot="cmp">Compare A and B</a></nav>' +
      '<div class="article"><div id="pcats"></div>' +
      '<aside class="infobox" id="ptotal"></aside></div>');
    function draw() {
      var dropped = prune(picked);
      builds[slot] = picked;
      A.tryStore(A.key("planner"), builds);
      document.querySelectorAll("#pslots a").forEach(function (t) {
        var on = mode === "compare" ? t.dataset.slot === "cmp" : t.dataset.slot === slot;
        t.classList.toggle("on", on);
        if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
      });
      document.getElementById("pcats").parentNode.classList.toggle("wide", mode === "compare");
      document.getElementById("ptotal").hidden = mode === "compare";
      if (mode === "compare") { prune(builds.A); prune(builds.B); compare(); return; }
      document.getElementById("pcats").innerHTML = (dropped.length ? '<p class="warn">No longer open, so left out: ' + dropped.map(esc).join(", ") + "</p>" : "") +
        (starts.length ? '<div class="say"><label for="pc-start"><b>Story start</b></label> <span class="note">some picks open or close with the start</span>' +
          '<div class="line"><select id="pc-start" data-cat="' + START + '" style="flex:1"><option value="">(no start chosen)</option>' +
          starts.map(function (s) { return "<option" + (picked[START] === s.name ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") +
          "</select></div></div>" : "") +
        cats.map(function (c) {
          var rest = {}; Object.keys(picked).forEach(function (k) { if (k !== c.name) rest[k] = picked[k]; });
          var opts = c.traits.map(function (n) { return A.byName("traits", n); }).filter(function (t) { return t && open(t, rest); });
          var cur = picked[c.name] ? A.byName("traits", picked[c.name]) : null;
          return '<div class="say"><label for="pc-' + c.id + '"><b>' + esc(c.name) + "</b></label> " +
            '<span class="note">' + (opts.length ? opts.length + " open" : "none open yet") + "</span>" +
            '<div class="line"><select id="pc-' + c.id + '" data-cat="' + esc(c.name) + '" style="flex:1"' + (opts.length ? "" : " disabled") + ">" +
            '<option value="">(no pick)</option>' + opts.map(function (t) {
              return "<option" + (cur && cur.name === t.name ? " selected" : "") + ">" + esc(t.name) + "</option>";
            }).join("") + "</select></div>" +
            (cur ? '<div class="prose"><p><a href="' + A.href("traits", cur.id) + '">' + esc(cur.name) + "</a>: " +
              esc(A.first(cur.info, 220)) + "</p></div>" : "") +
            '<details><summary class="note">About ' + esc(c.name) + "</summary>" + A.prose(c.info) + "</details></div>";
        }).join("");
      var T = totals(picked), warn = [];
      var attrs = C.attributes.map(function (a) {
        var v = T.attr[a], shown = Math.min(v, C.max);
        if (v > C.max) warn.push(a + " would be " + v + ": the creator stops it at " + C.max);
        if (v <= C.low) warn.push(a + " at " + v + ": " + (C.lowText[a] || "a weakness"));
        return ["" + esc(a.charAt(0).toUpperCase() + a.slice(1)), "<b>" + shown + "</b>" + (v !== C.start ? ' <span class="note">(' + (v > C.start ? "+" : "") + (v - C.start) + ")</span>" : "")];
      });
      var list = function (o) { return Object.keys(o).sort().map(function (k) { return esc(k) + " " + (o[k] > 0 ? "+" : "") + o[k]; }).join(", "); };
      var join = function (b) { return encodeURIComponent(Object.keys(b).map(function (c) { return b[c]; }).join("|")); };
      var url = location.origin + A.root + "planner/?pick=" + join(builds.A) + (Object.keys(builds.B).length ? "&vs=" + join(builds.B) : "");
      document.getElementById("ptotal").innerHTML = '<div class="hd">Build ' + slot + "</div>" + '<dl>' + attrs.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") +
        "<dt>Skills</dt><dd>" + (list(T.skills) || "-") + "</dd><dt>Resources</dt><dd>" + (list(T.res) || "-") + "</dd>" +
        "<dt>Abilities</dt><dd>" + (T.abilities.map(function (a) { var r = A.byName("abilities", a); return r ? '<a href="' + A.href("abilities", r.id) + '">' + esc(a) + "</a>" : esc(a); }).join(", ") || "-") + "</dd>" +
        "<dt>Starts with</dt><dd>" + (T.items.map(esc).join(", ") || "-") + "</dd></dl>" +
        (warn.length ? '<div class="say warn" style="margin:0 12px 12px">' + warn.map(esc).join("<br>") + "</div>" : "") +
        '<div style="padding:0 12px 12px"><button id="pshare">' + (Object.keys(builds.B).length ? "Copy a link to builds A and B" : "Copy a link to this build") + "</button>" + ' <button id="pclear">Start over</button></div>';
      document.getElementById("pshare").onclick = function () {
        var b = this;
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { b.textContent = "Link copied"; }, function () { b.textContent = url; });
        else b.textContent = url;
      };
      document.getElementById("pclear").onclick = function () { picked = {}; draw(); };
    }
    /* the two builds' picks and totals in one table, the difference marked */
    function compare() {
      var TA = totals(builds.A), TB = totals(builds.B);
      var row = function (label, a, b, num) {
        var diff = num && a !== b ? ' <span class="' + (b > a ? "ok" : "no") + '">(' + (b > a ? "+" : "") + (b - a) + ")</span>" : "";
        return "<tr><th scope=\"row\">" + esc(label) + "</th><td>" + (a === "" || a == null ? "-" : esc(a)) + "</td><td" + (a !== b ? ' class="cmpdiff"' : "") + ">" +
          (b === "" || b == null ? "-" : esc(b)) + diff + "</td></tr>";
      };
      var keys = function (x, y) { var k = {}; Object.keys(x).concat(Object.keys(y)).forEach(function (n) { k[n] = 1; }); return Object.keys(k).sort(); };
      var html = '<div class="tablewrap"><table class="cmp"><thead><tr><th></th><th>Build A</th><th>Build B</th></tr></thead><tbody>' +
        (builds.A[START] || builds.B[START] ? row("Story start", builds.A[START] || "", builds.B[START] || "") : "") +
        cats.filter(function (c) { return builds.A[c.name] || builds.B[c.name]; }).map(function (c) {
          return row(c.name, builds.A[c.name] || "", builds.B[c.name] || "");
        }).join("") +
        '<tr><th colspan="3">Stats</th></tr>' + C.attributes.map(function (a) { return row(a, Math.min(TA.attr[a], C.max), Math.min(TB.attr[a], C.max), true); }).join("") +
        '<tr><th colspan="3">Skills</th></tr>' + keys(TA.skills, TB.skills).map(function (k) { return row(k, TA.skills[k] || 0, TB.skills[k] || 0, true); }).join("") +
        '<tr><th colspan="3">Resources</th></tr>' + keys(TA.res, TB.res).map(function (k) { return row(k, TA.res[k] || 0, TB.res[k] || 0, true); }).join("") +
        row("Abilities", TA.abilities.join(", "), TB.abilities.join(", ")) + row("Starts with", TA.items.join(", "), TB.items.join(", ")) +
        "</tbody></table></div>";
      document.getElementById("pcats").innerHTML = html;
    }
    document.getElementById("pslots").addEventListener("click", function (e) {
      var t = e.target.closest("[data-slot]"); if (!t) return;
      e.preventDefault(); e.stopPropagation();   // a tab here, not a page change
      if (t.dataset.slot === "cmp") mode = "compare";
      else { mode = "edit"; builds[slot] = picked; slot = t.dataset.slot; picked = builds[slot]; }
      draw();
    });
    document.getElementById("pcats").addEventListener("change", function (e) {
      var s = e.target.closest("select[data-cat]"); if (!s) return;
      if (s.value) picked[s.dataset.cat] = s.value; else delete picked[s.dataset.cat];
      draw();
      var again = document.getElementById(s.id); if (again) again.focus();
    });
    draw();
  };
})();
