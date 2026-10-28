/* A lorebook, play: quests, the new-player guide, the item browser (sources, slots, compare) and faction depth
   (rank ladder, rivals, the quests its people give). Loads after pages.js and uses its helpers (App.ui). */
(function () {
  "use strict";
  var A = window.App, P = A.pages, esc = A.esc, U = A.ui;
  var X = A.play = {};
  var DANGER = ["Low", "Moderate", "High", "Severe", "Deadly"];

  function link(kind, dkey, name, plain) {
    var r = name && A.byName(dkey, name);
    return r && !plain ? '<a href="' + A.href(kind, r.id) + '">' + esc(name) + "</a>" : esc(name || "");
  }
  function placeOf(name) { return A.byName("locations", name); }
  function giverOf(q) {   // the giver's page in the quest's own era
    return A.data.npcs.filter(function (n) { return n.name === q.giver && n.epithet === q.giverEra; })[0] || A.byName("npcs", q.giver);
  }
  function giverLink(q, plain) {
    var n = giverOf(q);
    return n && !plain ? '<a href="' + A.href("people", n.id) + '">' + esc(q.giver) + "</a>" : esc(q.giver);
  }
  X.giverOf = giverOf;
  function districtOfPlace(name) { var p = placeOf(name); return p ? p.district : ""; }
  function cur() { return " " + esc(A.data.site.currency); }   // " Mon": after a price
  function see(k) {   // " See <the book>." where the world has the book the pages cite for k (the site block's books)
    var name = A.data.site.books[k];
    return name && A.byName("books", name) ? " See " + A.bookLink(name) + "." : "";
  }

  /* ---------- items: where each comes from, in words ---------- */
  /* plain: no links (inside a card, which is a link itself) */
  X.source = function (it, plain) {
    var where = esc(it.where);
    if (it.place && !plain) {
      var p = placeOf(it.place), at = it.where.indexOf(it.place);
      if (p && at >= 0) where = esc(it.where.slice(0, at)) + '<a href="' + A.href("places", p.id) + '">' + esc(it.place) + "</a>" + esc(it.where.slice(at + it.place.length));
    }
    var fac = link("factions", "factions", it.faction, plain);
    var out = {
      sold: "Sold for " + it.price + cur() + " at " + where,
      found: "Found at " + where + ", never sold",
      lair: "Left by the boss of " + where + ", never sold",
      taken: "Taken from a beaten " + where + "; a market pays " + it.price + cur(),
      made: "Made with the Artisan abilities" + (plain || !A.data.craft ? "" : ' (<a href="bench/">the crafting bench</a>)'),
      start: "Starting gear",
      oath: "Handed over when you swear to " + fac,
      rank: "Handed over on reaching " + esc(it.where.split(", ")[0]) + " in " + fac
    }[it.how] || "";
    var start = it.start && it.start.length ? "Starts with: " + it.start.map(function (t) { return link("traits", "traits", t, plain); }).join(", ") : "";
    return [out, start].filter(Boolean).join(". ");
  };
  var HOW = {sold: "Sold", found: "Found", lair: "Lair rarity", taken: "Taken from foes", made: "Crafted", start: "Starting gear",
             oath: "Oath token", rank: "Rank token", "": "Other"};
  X.HOW = HOW;

  var CMAX = 4;
  function picked() { var v = A.tryStore(A.key("compare")); return Array.isArray(v) ? v : []; }
  function toggle(id) {
    var v = picked(), i = v.indexOf(id);
    if (i >= 0) v.splice(i, 1); else { v.push(id); if (v.length > CMAX) v.shift(); }
    A.tryStore(A.key("compare"), v);
    return v;
  }
  function tray(v) {
    return v.length ? "Comparing " + v.length + " of " + CMAX + ': <a href="items/?compare=' + esc(v.join(",")) + '">Compare them side by side</a>' +
      ' · <button type="button" id="cmpclear">Clear</button>' : "Tick up to " + CMAX + " items to compare them side by side.";
  }
  function compareItems(ids) {
    var rows = ids.map(function (i) { return A.byId["items/" + i]; }).filter(Boolean);
    var vars = {};
    rows.forEach(function (r) { r.bonuses.forEach(function (b) { vars[b.type + ":" + b.variable] = 1; }); });
    var bkeys = Object.keys(vars).sort();
    var cell = function (r, k) {
      var b = r.bonuses.filter(function (x) { return x.type + ":" + x.variable === k; })[0];
      return b ? (b.value > 0 ? "+" : "") + esc(b.value) : "-";
    };
    var best = function (k) {   // the strongest value of a row is marked
      var vals = rows.map(function (r) { var b = r.bonuses.filter(function (x) { return x.type + ":" + x.variable === k; })[0]; return b ? Number(b.value) : -Infinity; });
      return Math.max.apply(null, vals);
    };
    A.h(U.crumbs([["Items", "items/"], ["Compare"]]) + "<h1>Compare items</h1>" + (rows.length < 2 ? '<p class="lede">Pick at least two items to compare (tick them in the item list or on an item\'s page).</p>' : "") +
      '<div class="tablewrap"><table class="cmp"><thead><tr><th></th>' + rows.map(function (r) {
        return "<th>" + '<a href="' + A.href("items", r.id) + '">' + esc(r.name) + "</a></th>";
      }).join("") + "</tr></thead><tbody>" +
      [["Category", function (r) { return esc(r.category); }], ["Slot", function (r) { return esc(r.slot || "-"); }],
       ["How you get it", function (r) { return X.source(r) || "-"; }], ["Price", function (r) { return r.price != null ? esc(r.price) + cur() : "-"; }]].map(function (x) {
        return '<tr><th scope="row">' + x[0] + "</th>" + rows.map(function (r) { return "<td>" + x[1](r) + "</td>"; }).join("") + "</tr>";
      }).join("") +
      (bkeys.length ? '<tr><th colspan="' + (rows.length + 1) + '">Bonuses</th></tr>' : "") + bkeys.map(function (k) {
        var top = best(k), name = k.split(":")[1];
        return '<tr><th scope="row">' + esc(name.charAt(0).toUpperCase() + name.slice(1)) + "</th>" + rows.map(function (r) {
          var b = r.bonuses.filter(function (x) { return x.type + ":" + x.variable === k; })[0];
          return "<td" + (b && Number(b.value) === top && rows.length > 1 ? ' class="cmpdiff"' : "") + ">" + cell(r, k) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<p><a href="items/">Back to the items</a> · <button type="button" id="cmpclear">Clear the comparison</button></p>');
    document.getElementById("cmpclear").onclick = function () { A.tryStore(A.key("compare"), []); A.go("items/"); };
  }
  P.items = function (id) {
    if (!id && A.param("compare")) return compareItems(A.param("compare").split(",").slice(0, CMAX));
    if (id) {
      var it = U.find("items", id);
      if (!it) return U.missing("Items");
      var on = picked().indexOf(it.id) >= 0;
      A.h(U.crumbs([["Items", "items/"], [it.name]]) + "<h1>" + esc(it.name) + '</h1><div class="article"><div class="prose">' + A.prose(it.info, it.name) +
        (X.source(it) ? "<h2>How you get it</h2><p>" + X.source(it) + ".</p>" : "") +
        '<p><button type="button" id="cmpme" aria-pressed="' + on + '">' + (on ? "Remove from the comparison" : "Add to the comparison") + '</button> <span class="note" id="cmptray">' + tray(picked()) + "</span></p></div>" +
        A.infobox(it.name, it.img, [["Category", esc(it.category)], ["Slot", esc(it.slot)], ["Bonuses", A.bonuses(it.bonuses)],
          ["Price", it.price != null ? esc(it.price) + cur() : ""], ["Source", esc(HOW[it.how] || "")]]) + "</div>");
      var me = document.getElementById("cmpme");
      me.onclick = function () {
        var v = toggle(it.id), now = v.indexOf(it.id) >= 0;
        me.setAttribute("aria-pressed", now); me.textContent = now ? "Remove from the comparison" : "Add to the comparison";
        document.getElementById("cmptray").innerHTML = tray(v); clear();
      };
      var clear = function () { var c = document.getElementById("cmpclear"); if (c) c.onclick = function () { A.tryStore(A.key("compare"), []); A.go("items/" + it.id + "/"); }; };
      clear();
      return;
    }
    var check = function (r) {
      var on = picked().indexOf(r.id) >= 0;
      return '<label class="cmpbox"><input type="checkbox" data-cmp="' + r.id + '"' + (on ? " checked" : "") + ' aria-label="Compare ' + esc(r.name) + '"></label>';
    };
    A.listPage({title: "Items", rows: A.data.items, table: [
        {h: "Compare", v: function (r) { return picked().indexOf(r.id) >= 0 ? 0 : 1; }, html: check},
        {h: "Item", v: function (r) { return r.name; }, html: U.nameCell("items")},
        {h: "Category", v: function (r) { return r.category; }, html: function (r) { return esc(r.category); }},
        {h: "Slot", v: function (r) { return r.slot; }, html: function (r) { return esc(r.slot); }},
        {h: "Bonuses", v: function (r) { return A.bonuses(r.bonuses); }, html: function (r) { return A.bonuses(r.bonuses); }},
        {h: "Source", v: function (r) { return HOW[r.how]; }, html: function (r) { return esc(HOW[r.how]); }},
        {h: "Price", v: function (r) { return r.price == null ? 1e9 : r.price; }, html: function (r) { return r.price != null ? esc(r.price) + cur() : ""; }}],
      lede: esc(A.t("ledeItems")) + " The table view has a Compare column.",
      facet: {category: function (r) { return r.category; }, slot: function (r) { return r.slot; }, how: function (r) { return HOW[r.how]; },
              bonus: function (r) { return r.bonuses.map(function (b) { return b.variable.charAt(0).toUpperCase() + b.variable.slice(1); }); }},
      names: {category: "Category", slot: "Slot", how: "Source", bonus: "Raises"},
      card: function (r) { return U.card("items", r, esc(r.category) + (r.how ? " · " + esc(HOW[r.how]) : "") + (r.price != null ? " · " + esc(r.price) + cur() : "")); }});
    var grid = document.getElementById("grid");
    grid.insertAdjacentHTML("beforebegin", '<p class="note" id="cmptray"></p>');
    var t = document.getElementById("cmptray");
    var show = function (v) {
      t.innerHTML = tray(v);
      var c = document.getElementById("cmpclear");
      if (c) c.onclick = function () { A.tryStore(A.key("compare"), []); grid.querySelectorAll("[data-cmp]").forEach(function (b) { b.checked = false; }); show([]); };
    };
    show(picked());
    grid.addEventListener("change", function (e) {
      var b = e.target.closest("[data-cmp]"); if (!b) return;
      var v = toggle(b.dataset.cmp);
      grid.querySelectorAll("[data-cmp]").forEach(function (x) { x.checked = v.indexOf(x.dataset.cmp) >= 0; });   // a fifth tick drops the first
      show(v);
    });
  };

  /* ---------- quests ---------- */
  function questsOf(f) { return A.data.quests.filter(f); }
  X.lineOf = function (q) {
    return q.line ? questsOf(function (x) { return x.line === q.line && x.of === q.of; }).sort(function (a, b) { return a.part - b.part; }) : [];
  };
  function questCard(q) {
    return U.card("quests", q, esc(q.kind) + (q.line ? " · part " + q.part + " of " + q.of : "") + " · " + esc(q.giver));
  }
  P.quests = function (id) {
    if (id) {
      var q = U.find("quests", id);
      if (!q) return U.missing("Quests");
      var line = X.lineOf(q), d = districtOfPlace(q.place);
      var giver = giverOf(q), lineHtml = "";
      if (line.length > 1) {
        lineHtml = "<h2>" + esc(q.line) + "</h2><p>Part " + q.part + " of " + q.of + ". The parts, in order:</p><ol>" + line.map(function (x) {
          return "<li>" + (x.id === q.id ? "<strong>" + esc(x.name) + "</strong> (this one)" : '<a href="' + A.href("quests", x.id) + '">' + esc(x.name) + "</a>") + "</li>";
        }).join("") + "</ol>";
      }
      A.h(U.crumbs([["Quests", "quests/"], [q.name]]) + "<h1>" + esc(q.name) + '</h1><div class="article"><div class="prose">' + A.prose(q.info, q.name) +
        "<p><strong>Goal:</strong> " + esc(q.goal) + "</p>" +
        (q.steps.length ? '<details class="spoiler"><summary>Show the steps (spoilers)</summary><ol>' + q.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></details>" : "") +
        lineHtml + (q.next ? "<p><strong>Leads to:</strong> " + link("quests", "quests", q.next) + "</p>" : "") +
        (q.kind === "Rank mission" ? '<p>A promotion test: sworn members of ' + link("factions", "factions", q.faction) + ' who stand ready for the rank of ' + esc(q.rank) +
          " are raised when it is done." + see("ranks") + "</p>" : "") +
        "</div>" + A.infobox(q.name, giver && giver.img, [["Kind", esc(q.kind)], ["Given by", giverLink(q)],
          ["Where", link("places", "locations", q.place)], ["District", d ? U.districtLink(d) : ""], ["Faction", link("factions", "factions", q.faction)],
          ["Rank", esc(q.rank)], ["Standing", q.standing.map(function (s) { return (s.value > 0 ? "+" : "") + esc(s.value) + " " + link("factions", "factions", s.faction); }).join(", ")]]) + "</div>");
      return;
    }
    var bandOf = function (q) { var p = placeOf(q.place); return p && p.levels && p.levels.length ? p.levels[0] : 0; };
    A.listPage({title: "Quests", rows: A.data.quests, wide: true,
      lede: "Every quest a player can be offered: who gives it, where, and what it asks. The steps stay folded on each quest's page, since they give the story away.",
      facet: {kind: function (r) { return r.kind; }, district: function (r) { return districtOfPlace(r.place); },
              faction: function (r) { return r.faction || (giverOf(r) || {}).faction || ""; }},
      names: {kind: "Kind", district: "District", faction: "Faction"},
      card: questCard,
      table: [{h: "Quest", v: function (r) { return r.name; }, html: U.nameCell("quests")},
              {h: "Kind", v: function (r) { return r.kind; }, html: function (r) { return esc(r.kind) + (r.line ? " " + r.part + "/" + r.of : ""); }},
              {h: "Given by", v: function (r) { return r.giver; }, html: function (r) { return giverLink(r); }},
              {h: "Where", v: function (r) { return r.place; }, html: function (r) { return link("places", "locations", r.place); }},
              {h: "From level", v: bandOf, html: function (r) { return bandOf(r) || ""; }}]});
  };
  /* a person's and a place's quests, appended under their text */
  function appendQuests(list, title) {
    var col = document.querySelector("main .article > .prose, main > .prose");
    if (!list.length || !col) return;
    var sec = document.createElement("section");
    sec.innerHTML = "<h2>" + esc(title) + "</h2><ul>" + list.map(function (q) {
      return '<li><a href="' + A.href("quests", q.id) + '">' + esc(q.name) + '</a> <span class="note">(' + esc(q.kind) + (q.line ? ", part " + q.part + " of " + q.of : "") + ")</span></li>";
    }).join("") + "</ul>";
    col.appendChild(sec);
  }
  var people = P.people, places = P.places;
  P.people = function (id) {
    people(id);
    var n = id && U.find("npcs", id);
    if (n) appendQuests(questsOf(function (q) { return q.giver === n.name && q.giverEra === n.epithet; }), "Quests " + n.name + " gives");
  };
  P.places = function (id) {
    places(id);
    var p = id && U.find("locations", id);
    if (p) appendQuests(questsOf(function (q) { return q.place === p.name; }), "Quests here");
  };

  /* ---------- factions: rank ladder, rivals web, its people's quests ---------- */
  X.ladder = function (f) {
    var oath = A.data.items.filter(function (i) { return i.how === "oath" && i.faction === f.name; })[0];
    return [{rank: "Sworn", token: oath, mission: null}].concat(f.ranks.map(function (r) {
      return {rank: r, token: A.data.items.filter(function (i) { return i.how === "rank" && i.faction === f.name && i.where.split(", ")[0] === r; })[0],
              mission: A.data.quests.filter(function (q) { return q.kind === "Rank mission" && q.faction === f.name && q.rank === r; })[0]};
    }));
  };
  X.ties = function (f) {   // rivals, and the factions this one's text names or that name it
    var says = function (text, name) { return text.indexOf(name) >= 0; };
    return A.data.factions.filter(function (o) { return o.name !== f.name; }).map(function (o) {
      return {r: o, rival: f.rivals.indexOf(o.name) >= 0 || o.rivals.indexOf(f.name) >= 0, named: says(f.info, o.name) || says(o.info, f.name)};
    }).filter(function (c) { return c.rival || c.named; }).sort(function (a, b) { return (b.rival - a.rival) || a.r.name.localeCompare(b.r.name); });
  };
  P.factions = function (id) {
    if (id) {
      var f = U.find("factions", id);
      if (!f) return U.missing("Factions");
      var members = U.uniq(A.data.npcs.filter(function (n) { return n.faction === f.name && !A.hidden(n); }));
      var names = {}; members.forEach(function (n) { names[n.name] = 1; });
      var seats = A.data.locations.filter(function (l) { return l.factions.indexOf(f.name) >= 0 && !A.hidden(l); });
      var jobs = A.data.say.filter(function (s) { return s.key === "fac_job"; })[0];
      var job = jobs && jobs.triggers.filter(function (t) { return t.key.indexOf(f.id.replace(/-/g, "_")) >= 0; })[0];
      var ladder = f.ranks.length ? X.ladder(f) : [], ties = X.ties(f);
      var work = questsOf(function (q) { return names[q.giver] && q.kind !== "Rank mission" && !A.hidden(q); });
      A.h(U.crumbs([["Factions", "factions/"], [f.name]]) + "<h1>" + esc(f.name) + '</h1><div class="article"><div class="prose">' + A.prose(f.info, f.name) +
        (ladder.length ? "<h2>Ranks</h2><p>Swear the oath to join, then each rank is earned by its mission." + see("ranks") + '</p><ol class="ranks">' +
          ladder.map(function (s) {
            return "<li><strong>" + esc(s.rank) + "</strong>" + (s.mission ? ': <a href="' + A.href("quests", s.mission.id) + '">' + esc(s.mission.name) + "</a> from " + giverLink(s.mission) : "") +
              (s.token ? ' <span class="note">(token: <a href="' + A.href("items", s.token.id) + '">' + esc(s.token.name) + "</a>)</span>" : "") + "</li>";
          }).join("") + "</ol>" : "") +
        (job ? '<h2>Work</h2><p>Sworn members ask for work at the seat' + (job.where.length ? " (" + esc(job.where.join(", ").replace(/^location: /, "")) + ")" : "") +
          ': <code>' + esc(job.examples[0]) + "</code>.</p>" : "") +
        (ties.length ? "<h2>Rivals and ties</h2><ul>" + ties.map(function (c) {
          return '<li><a href="' + A.href("factions", c.r.id) + '">' + esc(c.r.name) + '</a> <span class="note">(' +
            (c.rival ? "rival" + (c.named ? ", and named in one another's account" : "") : "named in one another's account") + ")</span></li>";
        }).join("") + "</ul>" : "") +
        (work.length ? "<h2>Quests from its people</h2><ul>" + work.map(function (q) {
          return '<li><a href="' + A.href("quests", q.id) + '">' + esc(q.name) + '</a> <span class="note">(' + esc(q.giver) + ")</span></li>";
        }).join("") + "</ul>" : "") +
        (members.length ? "<h2>Members</h2><div class='grid'>" + members.map(function (n) { return U.card("people", n, esc(n.type)); }).join("") + "</div>" : "") +
        "</div>" + A.infobox(f.name, null, [["Kind", esc(f.type)], ["Members", members.length || ""], ["Ranks", f.ranks.length ? f.ranks.length + 1 : ""],
          ["Rivals", f.rivals.map(function (r) { return link("factions", "factions", r); }).join(", ")],
          ["Holds", seats.slice(0, 12).map(function (l) { return U.placeLink(l.name); }).join(" · ")]]) + "</div>");
      U.mentioned(f.name, "factions", f.id);
      return;
    }
    A.listPage({title: "Factions", rows: A.data.factions, wide: true, lede: esc(A.t("ledeFactions")),
      facet: {kind: function (r) { return r.type; }}, names: {kind: "Kind"},
      card: function (r) { return U.card("factions", r, esc(r.type) + (r.ranks.length ? " · " + (r.ranks.length + 1) + " ranks" : "") + (r.rivals.length ? " · rival of " + esc(r.rivals.join(", ")) : "")); }});
  };

  /* ---------- the new-player guide ---------- */
  X.startInfo = function (s) {
    var head = s.info.split("\n")[0], dz = s.info.match(/Danger: \S+ (\w+)/), lv = s.info.match(/Recommended Level (\d+)-(\d+)/);
    return {party: /^PARTY/.test(head), guided: /guided/.test(head), danger: dz ? dz[1] : "", low: lv ? +lv[1] : 0, high: lv ? +lv[2] : 0,
            district: (head.split(" · ")[head.split(" · ").length - 2] || "")};
  };
  X.bands = function () {   // each district's level band, over its places on the main map (Asagiri: before the war), lowest first
    var all = U.districtsAll();
    return Object.keys(all).map(function (d) {
      var ps = all[d].filter(function (l) { return l.region === A.data.site.main; });
      var lv = ps.map(function (l) { return l.levels || []; }).reduce(function (a, b) { return a.concat(b); }, []);
      var hub = ps.filter(function (l) { return l.kind === "complex"; }).sort(function (a, b) { return (a.levels || [0])[0] - (b.levels || [0])[0]; })[0];
      return {d: d, lo: lv.length ? Math.min.apply(null, lv) : 0, hi: lv.length ? Math.max.apply(null, lv) : 0, hub: hub};
    }).sort(function (a, b) { return a.lo - b.lo || a.hi - b.hi; });
  };
  X.firstQuests = function (n) {   // quests that open a line or stand alone, at the gentlest places
    return A.data.quests.filter(function (q) { return (q.kind === "Side quest" || (q.kind === "Quest line" && q.part === 1)) && !A.hidden(q); }).map(function (q) {
      var p = placeOf(q.place); return {q: q, lo: p && p.levels && p.levels.length ? p.levels[0] : 99};
    }).sort(function (a, b) { return a.lo - b.lo || a.q.name.localeCompare(b.q.name); }).slice(0, n);
  };
  P.guide = function () {
    var starts = A.data.starts.filter(function (s) { return !A.hidden(s); }).map(function (s) { return {s: s, i: X.startInfo(s)}; });
    var gentle = starts.filter(function (x) { return x.i.guided && x.i.danger === "Low"; }).sort(function (a, b) { return a.i.low - b.i.low; }).slice(0, 6);
    var solo = starts.filter(function (x) { return !x.i.party; }).length;
    var say = A.data.site.firstSay.map(function (k) { return A.data.say.filter(function (f) { return f.key === k; })[0]; }).filter(Boolean);
    var books = A.data.site.books.guide.map(function (n) { return A.byName("books", n); }).filter(Boolean);
    var bands = X.bands(), first = X.firstQuests(8);
    var k = 0, n = function () { return ++k; };   // the sections are numbered as drawn: one the world has nothing for is left out
    A.h(U.crumbs([["New player guide"]]) + "<h1>New player guide</h1><p class=\"lede\">Your first session in " + esc(A.data.site.name) + ": where to begin, " +
      "who to make, the first things to type, and where to go as you grow.</p><div class=\"prose\">" +
      "<h2>" + n() + ". Pick where to begin</h2><p>" + esc(A.t("guideOpen")) + " " + starts.length + ' places (<a href="starts/">every story start</a>): ' + solo + " for one player, " +
      (starts.length - solo) + " for a party. A guided start plays an authored opening first, then the world is yours. The gentlest guided ones:</p>" +
      "<div class='grid wide'>" + gentle.map(function (x) { return U.card("starts", x.s, esc((x.i.party ? "Party" : "Solo") + " · " + x.i.district + " · level " + x.i.low + "-" + x.i.high)); }).join("") + "</div>" +
      "<h2>" + n() + ". Make your character</h2><p>The creator asks " + A.data.categories.length + " questions in order, from your " + esc((A.data.categories[0] || {}).name || "first pick") +
      ' on. The <a href="planner/">character planner</a> walks the same picks with the same unlocks and adds up what they give; it can compare two builds.</p>' +
      "<p>" + A.data.categories.map(function (c) { return esc(c.name); }).join(" · ") + "</p>" +
      "<h2>" + n() + ". Your first words</h2><p>" + esc(A.t("guideSay")) + " A few to start with (all of them: <a href=\"say/\">What to say</a>):</p>" +
      "<ul>" + say.map(function (f) {
        return '<li><a href="say/' + esc(f.key) + '/">' + esc(f.label) + "</a>: " + esc(f.how) + (f.triggers[0] && f.triggers[0].examples[0] ? " <code>" + esc(f.triggers[0].examples[0]) + "</code>" : "") + "</li>";
      }).join("") + "</ul>" +
      (bands.length ? "<h2>" + n() + ". Where to go as you grow</h2><p>Every district has a level band. Start low and follow the road up:</p>" +
      '<div class="tablewrap"><table><thead><tr><th>District</th><th>Levels</th><th>Its town</th></tr></thead><tbody>' + bands.map(function (b) {
        return '<tr><td><span class="dchips inline"' + (A.dcol(b.d) ? ' style="--dc:' + A.dcol(b.d) + '"' : "") + "><i></i></span>" + U.districtLink(b.d) + "</td><td>" + b.lo + "-" + b.hi + "</td><td>" +
          (b.hub ? '<a href="' + A.href("places", b.hub.id) + '">' + esc(b.hub.name) + "</a>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>" : "") +
      "<h2>" + n() + ". First quests</h2><p>Quests that stand alone or open a line, at the gentlest places (all of them: <a href=\"quests/\">Quests</a>):</p><ul>" + first.map(function (x) {
        return '<li><a href="' + A.href("quests", x.q.id) + '">' + esc(x.q.name) + "</a> from " + giverLink(x.q) + " at " + link("places", "locations", x.q.place) +
          (x.lo < 99 ? ' <span class="note">(level ' + x.lo + "+)</span>" : "") + "</li>";
      }).join("") + "</ul>" +
      (books.length ? "<h2>" + n() + ". Read before you need it</h2><p>Every new character carries the guide books. The ones that answer the first questions:</p><ul>" + books.map(function (b) {
        return '<li><a href="' + A.href("mechanics", b.id) + '">' + esc(b.name) + "</a>: " + esc(A.first(b.info, 140)) + "</li>";
      }).join("") + "</ul>" : "") +
      '<p>How the story leans is set by its <a href="modes/">game mode</a>' + (A.byName("books", A.data.site.books.fighting) ?
        "; how a fight goes, by " + A.bookLink(A.data.site.books.fighting) : "") + ".</p></div>");
  };
})();
