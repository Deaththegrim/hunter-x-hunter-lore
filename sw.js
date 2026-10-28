/* A lorebook, offline (his pick 2026-10-28, research/lorebook-improvements-2026-10-28.md): a service worker scoped to the
   site's folder. The build writes its version and the files every page needs into the line below
   (lorebook_site.service_worker): the scripts, style and data under their versioned addresses (app.js?v=<build>), which is how
   every page asks for them, so a page gets its own build's files whether they come from this store or the network. Each build's
   worker stores its files fetched past the browser's cache and refuses to install unless the stored home page and data.json are
   that build's. Pages come from the network first; offline, the stored home page stands in for any page and the app draws the
   asked one from the stored data. Pictures answer from the store and are refreshed behind it (the newest MAX_IMAGES, per build).
   Every site of the host shares one origin and so one cache storage: this site's stores carry its folder's name. */
var LOREBOOK = {"version": "cc4c4e30927b8e84", "shell": ["./", "app.js?v=cc4c4e30927b8e84", "pages.js?v=cc4c4e30927b8e84", "bench.js?v=cc4c4e30927b8e84", "depth.js?v=cc4c4e30927b8e84", "play.js?v=cc4c4e30927b8e84", "reader.js?v=cc4c4e30927b8e84", "style.css?v=cc4c4e30927b8e84", "data.json?v=cc4c4e30927b8e84", "manifest.webmanifest", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]};
var SITE = self.registration.scope.replace(/\/+$/, "").split("/").pop() || "lore";
var STATIC = SITE + "-static-" + LOREBOOK.version, IMAGES = SITE + "-images-" + LOREBOOK.version, MAX_IMAGES = 400;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(STATIC).then(function (c) {
    return c.addAll(LOREBOOK.shell.map(function (u) { return new Request(u, {cache: "reload"}); })).then(function () {
      return Promise.all([c.match("./").then(function (r) { return r.text(); }), c.match("data.json?v=" + LOREBOOK.version).then(function (r) { return r.json(); })]);
    }).then(function (got) {
      if (got[0].indexOf('<meta name="build" content="' + LOREBOOK.version + '">') < 0 || got[1].sha !== LOREBOOK.version) {
        throw new Error("the host still serves another build's files: not installed (tried again on the next visit)");
      }
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {   // this site's older stores go; the first version's unprefixed names too
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return (k.indexOf(SITE + "-") === 0 || /^lore-(static|images)-/.test(k)) && k !== STATIC && k !== IMAGES;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function trim(cache) {
  return cache.keys().then(function (keys) {
    return Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map(function (k) { return cache.delete(k); }));
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(function () {
      return caches.open(STATIC).then(function (c) { return c.match("./"); });
    }));
    return;
  }
  if (/\.(webp|png|jpe?g)$/i.test(url.pathname) && !LOREBOOK.shell.some(function (f) { return url.pathname.slice(-f.length - 1) === "/" + f; })) {
    e.respondWith(caches.open(IMAGES).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {   // a re-rendered picture keeps its name: refresh the stored copy behind it
          if (res.ok) c.put(req, res.clone()).then(function () { return trim(c); });
          return res;
        });
        if (!hit) return net;
        e.waitUntil(net.catch(function () { return null; }));
        return hit;
      });
    }));
    return;
  }
  if (req.url.indexOf(self.registration.scope) === 0) {   // this build's own files (exact address, version included), else the network
    e.respondWith(caches.open(STATIC).then(function (c) {
      return c.match(req).then(function (hit) { return hit || fetch(req); });
    }));
  }
});
