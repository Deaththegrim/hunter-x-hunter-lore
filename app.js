/* A lorebook: data, routing, search, links, text. Pages are in pages.js, the bench in bench.js. */
(function () {
  "use strict";
  var App = window.App = {data: null, pages: {}, index: [], byId: {}};

  App.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c];
    });
  };
  App.h = function (html) { document.getElementById("main").innerHTML = html; };
  App.href = function (kind, id) { return kind + "/" + encodeURIComponent(id) + "/"; };
  /* the site's root path, from <base href> (every page carries one, so a link "people/x/" means the same on every page) */
  App.root = (function () {
    try { var u = new URL(document.baseURI); return typeof u.pathname === "string" ? u.pathname.replace(/[^/]*$/, "") : "/"; }
    catch (e) { return "/"; }
  })();
  /* the route: the path under the root, without slashes at the ends */
  App.path = function () {
    var p = decodeURIComponent(location.pathname);
    if (p.indexOf(App.root) === 0) p = p.slice(App.root.length);
    return p.replace(/index\.html$/, "").replace(/^\/+|\/+$/g, "");
  };
  App.param = function (k) { try { return new URLSearchParams(location.search).get(k) || ""; } catch (e) { return ""; } };
  App.go = function (url) { history.pushState(null, "", new URL(url, document.baseURI).href); route(); };
  /* a trait's bonuses as the world writes them ([{attribute|skill|resource, modifier}]) -> "Body +1, Breathcraft +2" */
  App.bonuses = function (list) {
    return (Array.isArray(list) ? list : []).map(function (b) {
      var name = b.attribute || b.skill || b.resource || b.variable || "", m = Number(b.modifier != null ? b.modifier : b.value);
      return name ? App.esc(name.charAt(0).toUpperCase() + name.slice(1)) + " " + (m > 0 ? "+" : "") + (isFinite(m) ? m : "") : "";
    }).filter(Boolean).join(", ");
  };
  /* the world's art (lorebook_assets.art_json, carried in the shell): each folder's picture size and the pictures whose own
     size differs (sizes), so a picture's box is held before it loads, and the small copies for cards, lists, galleries and previews */
  App.art = (function () {
    try { var a = JSON.parse(document.getElementById("art").textContent); return a && a.base && a.folders ? a : null; }
    catch (e) { return null; }
  })();
  App.artOf = function (url) {
    var a = App.art, s = String(url || "");
    if (!a || s.indexOf(a.base) !== 0) return null;
    var path = s.slice(a.base.length), size = a.folders[path.split("/")[0]] && ((a.sizes || {})[path] || a.folders[path.split("/")[0]]);
    return size && path.indexOf("/") > 0 ? {thumb: a.thumbs + path, w: size[0], h: size[1]} : null;
  };
  /* small: the thumbnail (a card, a list, a preview); a thumbnail that fails falls back to the full picture */
  App.img = function (url, alt, cls, small) {
    if (!url) return "";
    var art = App.artOf(url), src = art && small ? art.thumb : url;
    return '<img loading="lazy" src="' + App.esc(src) + '"' + (art ? ' width="' + art.w + '" height="' + art.h + '"' : "") +
      (src !== url ? ' data-full="' + App.esc(url) + '"' : "") + ' alt="' + App.esc(alt || "") + '"' + (cls ? ' class="' + cls + '"' : "") + ">";
  };
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.dataset.full && t.getAttribute("src") !== t.dataset.full) t.src = t.dataset.full;
  }, true);
  /* a browser storage key of this site (data.json's site block: each lorebook keeps its readers' marks under its own) */
  App.key = function (name) { return App.data.site.keys[name]; };
  /* what the pages say about the world (the site block's text: the world's copy over the kit's) */
  App.t = function (k) { return App.data.site.text[k]; };
  /* read (no value) or write a per-viewer value; a write answers whether the browser kept it */
  App.tryStore = function (k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) { return v === undefined ? null : false; }
  };

  /* sections: route key, data key, nav label, group */
  App.SECTIONS = [
    {k: "people", d: "npcs", label: "People", g: "World"},
    {k: "places", d: "locations", label: "Places", g: "World"},
    {k: "map", label: "Map", g: "World"},
    {k: "districts", label: "Districts", g: "World"},
    {k: "factions", d: "factions", label: "Factions", g: "World"},
    {k: "creatures", d: "creatures", label: "Creatures", g: "World"},
    {k: "lore", d: "lore", label: "Lore", g: "World"},
    {k: "guide", label: "New player guide", g: "Play"},
    {k: "mechanics", d: "books", label: "Mechanics", g: "Play"},
    {k: "quests", d: "quests", label: "Quests", g: "Play"},
    {k: "say", d: "say", label: "What to say", g: "Play"},
    {k: "bench", label: "Crafting bench", g: "Play"},
    {k: "planner", label: "Character planner", g: "Play"},
    {k: "abilities", d: "abilities", label: "Abilities", g: "Play"},
    {k: "traits", d: "traits", label: "Traits", g: "Play"},
    {k: "skills", d: "skills", label: "Skills", g: "Play"},
    {k: "items", d: "items", label: "Items", g: "Play"},
    {k: "starts", d: "starts", label: "Story starts", g: "Play"},
    {k: "modes", d: "modes", label: "Game modes", g: "Play"},
    {k: "music", d: "music", label: "Music", g: "Extras"}
  ];
  var KIND = {npcs: "people", locations: "places", factions: "factions", creatures: "creatures", lore: "lore", books: "mechanics",
              abilities: "abilities", traits: "traits", skills: "skills", items: "items", starts: "starts", regions: "map", quests: "quests"};
  App.KIND = KIND;
  var LABEL = {people: "Person", places: "Place", factions: "Faction", creatures: "Creature", lore: "Lore", mechanics: "Guide",
               abilities: "Ability", traits: "Trait", skills: "Skill", items: "Item", starts: "Story start", map: "Map", quests: "Quest"};
  App.LABEL = LABEL;
  /* an entry the reader keeps covered (reader.js: after the war, until they choose to see it); the app refuses to start
     without reader.js, so this never fails open */
  App.hidden = function (r) { return App.spoil.hides(r); };
  App.visible = function (rows) { return rows.filter(function (r) { return !App.hidden(r); }); };

  /* how many entries a section lists: people once each, however many eras they have */
  App.count = function (d) {
    if (d !== "npcs") return App.data[d].length;
    var seen = {}; App.data.npcs.forEach(function (n) { seen[n.name] = 1; }); return Object.keys(seen).length;
  };

  /* the side nav is built once; a route only moves its current mark, so keyboard focus on a nav link survives */
  function buildNav() {
    var html = '<a href="./" data-k="">Home</a>', grp = "";
    App.SECTIONS.forEach(function (s) {
      if (s.k === "bench" && !App.data.craft) return;   // the crafting bench, where the world has one
      if (App.data.site.off.indexOf(s.k) >= 0) return;   // a section the world has none of
      if (s.g !== grp) { grp = s.g; html += '<div class="grp">' + grp + "</div>"; }
      var n = s.d && App.data[s.d] ? App.count(s.d) : "";
      html += '<a href="' + s.k + '/" data-k="' + s.k + '">' + s.label + (n ? "<span>" + n + "</span>" : "") + "</a>";
    });
    html += '<a href="./" id="random">Random page</a>';
    document.getElementById("side").innerHTML = html;
    document.getElementById("random").addEventListener("click", function (e) {   // any person, place, creature or lore entry
      e.preventDefault();
      var pool = App.index.filter(function (x) { return /^(people|places|creatures|lore)$/.test(x.kind); });
      var x = pool[Math.floor(Math.random() * pool.length)];
      App.go(App.href(x.kind, x.id));
    });
  }
  function nav(active) {
    document.querySelectorAll("#side a").forEach(function (a) {
      var on = a.dataset.k === active;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  /* ---------- search ---------- */
  App.buildIndex = function () {
    App.index = []; App.byId = {};
    Object.keys(KIND).forEach(function (d) {
      var seen = {};
      (App.data[d] || []).forEach(function (r) {
        var kind = KIND[d];
        App.byId[kind + "/" + r.id] = r;
        if (d === "npcs" && seen[r.name]) return;   // one result per person: the page switches between eras
        seen[r.name] = 1;
        App.index.push({kind: kind, id: r.id, name: r.name, n: r.name.toLowerCase(), img: r.img || null,
                        t: (r.name + " " + (r.type || "") + " " + (r.category || "") + " " + (r.info || "")).toLowerCase()});
      });
    });
  };
  App.search = function (q, limit) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var words = q.split(/\s+/);
    var out = [];
    App.index.forEach(function (e) {
      if (App.hidden(App.byId[e.kind + "/" + e.id])) return;
      var score = 0;
      if (e.n === q) score = 100;
      else if (e.n.indexOf(q) === 0) score = 60;
      else if (e.n.indexOf(q) > 0) score = 40;
      else if (words.every(function (w) { return e.n.indexOf(w) >= 0; })) score = 30;
      else if (words.every(function (w) { return e.t.indexOf(w) >= 0; })) score = 10;
      if (score) out.push({e: e, s: score + (e.kind === "people" || e.kind === "places" ? 2 : 0)});
    });
    out.sort(function (a, b) { return b.s - a.s || a.e.n.length - b.e.n.length; });
    return out.slice(0, limit || out.length).map(function (x) { return x.e; });
  };
  function resultsHtml(list) {
    return list.map(function (e, i) {
      return '<a role="option" id="opt' + i + '" aria-selected="' + (i === 0) + '" href="' + App.href(e.kind, e.id) + '"' + (i === 0 ? ' class="on"' : "") + ">" +
             (e.img ? App.img(e.img, "", "", true) : "") + "<span>" + App.esc(e.name) + '</span><span class="kind">' + LABEL[e.kind] + "</span></a>";
    }).join("");
  }
  function wireSearch() {
    var q = document.getElementById("q"), box = document.getElementById("results"), sel = 0;
    function open(on) {
      box.hidden = !on;
      q.setAttribute("aria-expanded", on ? "true" : "false");
      if (!on) q.removeAttribute("aria-activedescendant");
    }
    function mark(items) {
      items.forEach(function (a, i) { a.classList.toggle("on", i === sel); a.setAttribute("aria-selected", i === sel ? "true" : "false"); });
      if (items[sel]) q.setAttribute("aria-activedescendant", items[sel].id);
    }
    function show() {
      var list = App.search(q.value, 12);
      sel = 0;
      box.innerHTML = list.length ? resultsHtml(list) + '<a role="option" id="optall" aria-selected="false" href="search/?q=' +
        encodeURIComponent(q.value) + '"><span>All results for "' + App.esc(q.value) + '"</span></a>' :
        '<div role="option" aria-disabled="true" aria-selected="false" class="note" style="padding:8px 12px">Nothing found</div>';
      open(!!q.value.trim());
      mark(box.querySelectorAll("a[href]"));
    }
    q.addEventListener("input", show);
    q.addEventListener("keydown", function (ev) {
      var items = box.querySelectorAll("a[href]");
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        sel = Math.max(0, Math.min(items.length - 1, sel + (ev.key === "ArrowDown" ? 1 : -1)));
        mark(items);
      } else if (ev.key === "Enter") {
        if (!q.value.trim()) return;
        App.go(items[sel] ? items[sel].getAttribute("href") : "search/?q=" + encodeURIComponent(q.value));
        open(false);
      } else if (ev.key === "Escape") { open(false); }
    });
    document.addEventListener("click", function (ev) { if (!ev.target.closest(".search")) open(false); });
    document.querySelector(".search").addEventListener("focusout", function (ev) {
      if (!ev.relatedTarget || !ev.relatedTarget.closest(".search")) open(false);
    });
    box.addEventListener("click", function () { open(false); });
  }

  /* ---------- text: links + light markdown ---------- */
  var LINKER = null, LINKS = {};
  App.buildLinker = function () {
    var names = [];
    [["npcs", "people"], ["locations", "places"], ["factions", "factions"], ["creatures", "creatures"]].forEach(function (p) {
      App.data[p[0]].forEach(function (r) {
        if (r.name.length >= 4 && !LINKS[r.name]) { LINKS[r.name] = App.href(p[1], r.id); names.push(r.name); }
      });
    });
    names.sort(function (a, b) { return b.length - a.length; });
    var alt = names.map(function (n) { return App.esc(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
    LINKER = new RegExp("(^|[^\\w'])(" + alt + ")(?![\\w])", "g");
  };
  App.link = function (escaped, self) {
    return escaped.replace(LINKER, function (m, pre, name) {
      var raw = name.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
      if (raw === self || !LINKS[raw]) return m;
      return pre + '<a href="' + LINKS[raw] + '">' + name + "</a>";
    });
  };
  /* the world's text: **bold**, "- " lists, blank-line paragraphs; names of public records become links */
  App.prose = function (text, self) {
    var blocks = String(text || "").split(/\n\s*\n/);
    return blocks.map(function (b) {
      var lines = b.split("\n");
      var inline = function (s) { return App.link(App.esc(s), self).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); };
      if (lines.every(function (l) { return /^\s*- /.test(l); })) {
        return "<ul>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^\s*- /, "")) + "</li>"; }).join("") + "</ul>";
      }
      // runs of list lines become a <ul>, runs of other lines a <p>: a <ul> inside a <p> is split by the browser and the
      // text after it falls out of the paragraph (it lost the prose size on phones)
      var out = "", list = [], para = [];
      var flush = function () {
        if (para.length) { out += "<p>" + para.join("<br>") + "</p>"; para = []; }
        if (list.length) { out += "<ul>" + list.join("") + "</ul>"; list = []; }
      };
      lines.forEach(function (l) {
        if (/^\s*- /.test(l)) { if (para.length) flush(); list.push("<li>" + inline(l.replace(/^\s*- /, "")) + "</li>"); return; }
        if (list.length) flush();
        para.push(inline(l));
      });
      flush();
      return out;
    }).join("");
  };
  App.first = function (text, n) {
    var s = String(text || "").replace(/^\[[^\]]*\]\s*/, "").replace(/\*\*/g, "").split("\n")[0];
    return s.length > (n || 160) ? s.slice(0, n || 160).replace(/\s+\S*$/, "").replace(/[.,;:!?]+$/, "") + "..." : s;
  };

  /* list page helper: filters + a card grid with "show more" */
  App.listPage = function (opt) {
    var all = opt.rows;
    opt.rows = App.visible(all);
    var state ={q: "", f: {}, n: 120, view: opt.table && App.param("view") === "table" ? "table" : "cards", sort: 0, dir: 1};
    Object.keys(opt.facet || {}).forEach(function (k) { if (App.param(k)) state.f[k] = App.param(k); });   // only this list's own filters
    function rows() {
      var q = state.q.toLowerCase();
      return opt.rows.filter(function (r) {
        for (var k in state.f) {
          if (!state.f[k]) continue;
          var v = opt.facet[k](r);   // a facet may give a list (a creature is weak to several things): any one matches
          if (Array.isArray(v) ? v.indexOf(state.f[k]) < 0 : String(v) !== state.f[k]) return false;
        }
        return !q || (r.name + " " + (r.info || "")).toLowerCase().indexOf(q) >= 0;
      });
    }
    /* table view: each column {h: heading, v: row -> sortable value, html: row -> cell}; a heading button sorts */
    function table(list) {
      var cols = opt.table, c = cols[state.sort];
      list = list.slice().sort(function (a, b) {
        var x = c.v(a), y = c.v(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * state.dir;
      });
      return '<div class="tablewrap"><table><thead><tr>' + cols.map(function (k, i) {
        var on = i === state.sort;
        return '<th aria-sort="' + (on ? (state.dir > 0 ? "ascending" : "descending") : "none") + '"><button type="button" class="sortby" data-col="' + i + '">' +
          App.esc(k.h) + (on ? (state.dir > 0 ? " ▲" : " ▼") : "") + "</button></th>";
      }).join("") + "</tr></thead><tbody>" + list.slice(0, state.n).map(function (r) {
        return "<tr>" + cols.map(function (k) { return "<td>" + k.html(r) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
    }
    function draw() {
      var list = rows();
      var grid = document.getElementById("grid");
      grid.className = state.view === "table" ? "" : "grid" + (opt.wide ? " wide" : "");
      grid.innerHTML = state.view === "table" ? table(list) : list.slice(0, state.n).map(opt.card).join("");
      document.getElementById("count").textContent = list.length + " of " + opt.rows.length;
      document.getElementById("more").hidden = list.length <= state.n;
    }
    var facets = Object.keys(opt.facet || {}).map(function (k) {
      var vals = {};
      opt.rows.forEach(function (r) {
        var v = opt.facet[k](r);
        (Array.isArray(v) ? v : [v]).forEach(function (x) { if (x !== "" && x != null) vals[x] = 1; });
      });
      var keys = Object.keys(vals).sort(opt.sorts && opt.sorts[k] || undefined);
      return '<select data-f="' + k + '" aria-label="' + (opt.names || {})[k] + '"><option value="">' + (opt.names || {})[k] + ": all</option>" +
        keys.map(function (v) { return '<option' + (state.f[k] === v ? " selected" : "") + ">" + App.esc(v) + "</option>"; }).join("") + "</select>";
    }).join("");
    App.h('<div class="crumbs"><a href="./">Home</a> / ' + opt.title + "</div><h1>" + opt.title + '</h1><p class="lede">' + opt.lede +
      '</p><div class="filters"><input type="search" id="lf" placeholder="Filter ' + opt.title.toLowerCase() + '..." aria-label="Filter ' + opt.title + '">' +
      facets + (opt.table ? '<button type="button" id="view" aria-pressed="' + (state.view === "table") + '">' + (state.view === "table" ? "Show cards" : "Show as a table") + "</button>" : "") +
      '<span class="count" id="count" aria-live="polite"></span>' + (App.spoil ? App.spoil.listNote(all.length - opt.rows.length, opt.title.toLowerCase()) : "") +
      '</div><div class="grid' + (opt.wide ? " wide" : "") + '" id="grid"></div>' +
      '<button class="more" id="more">Show more</button>');
    document.getElementById("lf").addEventListener("input", function (e) { state.q = e.target.value; state.n = 120; draw(); });
    document.querySelectorAll("[data-f]").forEach(function (s) {
      s.addEventListener("change", function () { state.f[s.dataset.f] = s.value; state.n = 120; draw(); });
    });
    document.getElementById("more").addEventListener("click", function () { state.n += 240; draw(); });
    if (opt.table) {
      document.getElementById("view").addEventListener("click", function () {
        state.view = state.view === "table" ? "cards" : "table";
        this.textContent = state.view === "table" ? "Show cards" : "Show as a table";
        this.setAttribute("aria-pressed", state.view === "table");
        history.replaceState(null, "", location.pathname + (state.view === "table" ? "?view=table" : ""));
        draw();
      });
      document.getElementById("grid").addEventListener("click", function (e) {
        var b = e.target.closest(".sortby"); if (!b) return;
        var i = Number(b.dataset.col);
        state.dir = state.sort === i ? -state.dir : 1; state.sort = i; draw();
        var again = document.querySelector('.sortby[data-col="' + i + '"]'); if (again) again.focus();
      });
    }
    draw();
  };
  App.infobox = function (title, img, rows) {
    return '<aside class="infobox"><div class="hd">' + App.esc(title) + "</div>" + (img ? App.img(img, title) : "") + "<dl>" +
      rows.filter(function (r) { return r[1] !== "" && r[1] != null; }).map(function (r) {
        return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>";
      }).join("") + "</dl></aside>";
  };
  App.byName = function (dkey, name) {
    var list = App.data[dkey];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  };
  /* "Mentioned on": every entry whose text names this one as a whole name (a wiki's what-links-here) */
  App.mentions = function (name, selfKind, selfId) {
    if (!name || name.length < 4) return [];
    var re = new RegExp("(^|[^\\w'])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w])");
    var out = [];
    ["npcs", "locations", "factions", "creatures", "lore", "books", "items", "starts"].forEach(function (d) {
      var kind = KIND[d], seen = {};
      App.data[d].forEach(function (r) {
        if ((kind === selfKind && (r.id === selfId || r.name === name)) || seen[r.name] || App.hidden(r)) return;
        var text = r.info + " " + (r.areas || []).map(function (a) { return a.text; }).join(" ");
        if (re.test(text)) { seen[r.name] = 1; out.push({kind: kind, r: r}); }
      });
    });
    return out;
  };
  App.nameLink = function (dkey, name) {
    var r = App.byName(dkey, name);
    return r ? '<a href="' + App.href(KIND[dkey], r.id) + '">' + App.esc(name) + "</a>" : App.esc(name);
  };

  /* ---------- router ---------- */
  function route() {
    var parts = App.path().split("/");
    var key = parts[0] || "";
    nav(key);
    drawer(false);
    var page = (App.data.site.off.indexOf(key) < 0 && App.pages[key]) || function () {   // no page there (GitHub serves 404.html for it)
      App.h('<div class="crumbs"><a href="./">Home</a></div><h1>Not in the lorebook</h1><p class="lede">Nothing is at this address. ' +
            "Try the search above, or start from the home page.</p>");
    };
    try { page(parts.slice(1).join("/")); }
    catch (e) { App.h("<h1>Something went wrong</h1><p class='note'>" + App.esc(e.message) + "</p>"); throw e; }
    if (!/^map/.test(key)) window.scrollTo(0, 0);
    document.title = (document.querySelector("main h1") || {}).textContent + " · " + App.data.site.title;
    onThisPage();
    if (App.reader) App.reader.routed(key, parts.slice(1).join("/"));
    if (routed) document.getElementById("main").focus({preventScroll: true});   // the new page, not the top of the old one
    routed = true;
  }

  /* "On this page": a page with 3+ sections gets a sticky list of them beside it (Vector 2022's TOC; research/lorebook-layout.md).
     Existing nodes are MOVED into the layout, never re-rendered, so every listener a page set stays live. */
  var tocWatch = null;
  function onThisPage() {
    if (tocWatch) { tocWatch.disconnect(); tocWatch = null; }
    var main = document.getElementById("main");
    var heads = [].slice.call(main.querySelectorAll("h2"));
    if (heads.length < 3) return;
    var toc = document.createElement("nav");
    toc.className = "toc";
    toc.setAttribute("aria-label", "On this page");
    toc.innerHTML = "<b>On this page</b>" + heads.map(function (h, i) {
      h.id = "sec-" + i;
      var label = h.dataset.toc || h.textContent;   // a heading carrying chips names its own label
      return '<button type="button" data-sec="' + i + '"' + (h.classList.contains("cap") ? ' style="text-transform:capitalize"' : "") + ">" +
        App.esc(label) + "</button>";
    }).join("");
    toc.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sec]"); if (!b) return;
      var h = document.getElementById("sec-" + b.dataset.sec);
      h.scrollIntoView({behavior: "smooth", block: "start"});
      h.setAttribute("tabindex", "-1"); h.focus({preventScroll: true});
    });
    var rail = document.createElement("div");
    rail.className = "rail";
    var box = main.querySelector(".article > .infobox");
    if (box) {
      box.parentNode.insertBefore(rail, box);
      rail.appendChild(box);
    } else {
      var grid = document.createElement("div"), col = document.createElement("div");
      grid.className = "tocgrid";
      var start = main.querySelector("h1");
      var nodes = [].slice.call(main.childNodes);
      var from = start ? nodes.indexOf(start) + 1 : 0;
      nodes.slice(from).forEach(function (n) { col.appendChild(n); });
      grid.appendChild(col); grid.appendChild(rail); main.appendChild(grid);
    }
    rail.appendChild(toc);
    if ("IntersectionObserver" in window) {
      tocWatch = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          toc.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.dataset.sec === en.target.id.slice(4)); });
        });
      }, {rootMargin: "-20% 0px -70% 0px"});
      heads.forEach(function (h) { tocWatch.observe(h); });
    }
  }

  var top = document.createElement("button");
  top.className = "totop"; top.type = "button"; top.textContent = "Top"; top.hidden = true;
  top.setAttribute("aria-label", "Back to the top of the page");
  top.addEventListener("click", function () { window.scrollTo({top: 0, behavior: "smooth"}); document.getElementById("main").focus({preventScroll: true}); });
  document.body.appendChild(top);
  window.addEventListener("scroll", function () { top.hidden = window.scrollY < 900; }, {passive: true});
  var routed = false;
  App.route = route;   // redraws the page in place (reader.js, after a switch)

  function drawer(on) {
    document.getElementById("side").classList.toggle("open", on);
    document.getElementById("menu").setAttribute("aria-expanded", on ? "true" : "false");
  }
  document.getElementById("menu").addEventListener("click", function () { drawer(!document.getElementById("side").classList.contains("open")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") drawer(false); });
  document.getElementById("main").addEventListener("click", function () { drawer(false); });
  function topHeight() { document.documentElement.style.setProperty("--top-h", document.querySelector(".top").offsetHeight + "px"); }
  window.addEventListener("resize", topHeight);
  topHeight();
  /* this page's build (the shell's meta): its data is asked for under that version, as its scripts are (sw.js) */
  App.build = (function () {
    try { var m = document.querySelector('meta[name="build"]'); return m && typeof m.content === "string" ? m.content : ""; }
    catch (e) { return ""; }
  })();
  fetch("data.json" + (App.build ? "?v=" + encodeURIComponent(App.build) : "")).then(function (r) {
    if (!r.ok) throw new Error("data.json answered " + r.status);
    return r.json();
  }).then(function (d) {
    if (!App.reader) throw new Error("reader.js did not load");
    App.data = d;
    App.buildIndex();
    App.buildLinker();
    buildNav();
    App.reader.init();
    wireSearch();
    if (location.hash.indexOf("#/") === 0) {   // an old #/ link: the same page at its real address
      var old = location.hash.slice(2).split("?");
      history.replaceState(null, "", App.root + (old[0] ? old[0].replace(/\/?$/, "/") : "") + (old[1] ? "?" + old[1] : ""));
    }
    document.addEventListener("click", function (ev) {   // links inside the site route here, without a page load
      var a = ev.target.closest("a[href]");
      if (!a || a.target || ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var u = new URL(a.href, document.baseURI);
      if (u.origin !== location.origin || u.pathname.indexOf(App.root) !== 0 || /\.[a-z0-9]+$/i.test(u.pathname)) return;
      ev.preventDefault();
      App.go(u.href);
    });
    window.addEventListener("popstate", route);
    route();
    // offline reading (sw.js, scoped to this folder): after the page is up, so its storing never slows the first visit; a
    // registration or an install that fails says so in the console (the site itself works on)
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var w = reg.installing;
          if (w) w.addEventListener("statechange", function () { if (w.state === "redundant") console.warn("lorebook: this build's offline copy did not install"); });
        });
      }).catch(function (e) { console.warn("lorebook: offline reading is off:", e); });
    }
  }).catch(function (e) { App.h("<h1>Could not load the lorebook</h1><p class='note'>" + App.esc(e.message) + "</p>"); });
})();
