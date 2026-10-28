/* The crafting bench and the word checks: the world's own trigger conditions and scripts, run as the engine runs them.
   Pure functions; lorebook_site_test.py loads this file under node and runs them against the world's data. */
(function (root) {
  "use strict";

  function cmp(op, a, b) {
    switch (op) {
      case "equals": return a === b;
      case "notEquals": return a !== b;
      case "greaterThan": return a > b;
      case "greaterThanOrEqual": return a >= b;
      case "lessThan": return a < b;
      case "lessThanOrEqual": return a <= b;
      default: throw new Error("bench: unknown operator " + op);
    }
  }

  function textCheck(c, text) {
    switch (c.operator) {
      case "regex": return new RegExp(c.value).test(text);       // the engine compiles regex values with new RegExp
      case "notContains": return text.indexOf(c.value) < 0;
      case "contains": return text.indexOf(c.value) >= 0;
      case "equals": return text === c.value;
      default: throw new Error("bench: unknown text operator " + c.operator);
    }
  }

  /* one condition against a scene: {text, story, tick, storage} */
  function condition(c, scene) {
    switch (c.type) {
      case "action-text": return textCheck(c, scene.text || "");
      case "story-text": return textCheck(c, scene.story || "");
      case "game-tick": return cmp(c.operator, scene.tick, c.value);
      case "read-number": return cmp(c.operator, Number(scene.storage[c.key] || 0), c.value);
      case "read-boolean": return cmp(c.operator, scene.storage[c.key] === true, c.value);
      default: throw new Error("bench: condition " + c.type + " is not one the bench evaluates");
    }
  }

  /* what a script's check() answers in this scene */
  function answer(cond, scene) {
    switch (cond.type) {
      case "action-text": return scene.text || "";
      case "story-text": return scene.story || "";
      case "game-tick": return scene.tick;
      case "party-location": return scene.location || "";
      case "party-area": return scene.area || "";
      case "action-success-level": return (scene.roll || "success").toLowerCase();
      case "skill-value": return Number((scene.skills || {})[cond.skill] || 0);
      case "player-experience": return 0;
      default: throw new Error("bench: a script asked for " + cond.type + ", which the bench does not model");
    }
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* run every trigger whose conditions pass, in order, storage threaded through (one engine phase) */
  function runTriggers(triggers, scene) {
    var storage = clone(scene.storage || {});
    var runs = [];
    for (var i = 0; i < triggers.length; i++) {
      var t = triggers[i];
      var s = Object.assign({}, scene, {storage: storage});
      if (!t.conditions.every(function (c) { return condition(c, s); })) continue;
      var effects = [], logs = [];
      var check = function (cond) { return answer(cond, s); };
      new Function("check", "storage", "effects", "log", t.script)(check, storage, effects, function (x) { logs.push(String(x)); });
      runs.push({key: t.key, effects: effects, logs: logs});
    }
    return {storage: storage, runs: runs};
  }

  function beats(result) {
    var out = [];
    result.runs.forEach(function (r) {
      r.effects.forEach(function (e) { if (e.type === "story" && e.instruction) out.push(e.instruction); });
    });
    return out;
  }

  /* the party's ledger as the recipe book leaves it on the first turn (the book's own script is not shipped), then theirs */
  function seeded(craft, storage) { return Object.assign(clone(craft.seed || {}), storage || {}); }

  /* a player's action through the crafting triggers (the commit trigger needs narration, so it is left out here) */
  function craftTurn(craft, scene) {
    var acts = craft.triggers.filter(function (t) { return t.key !== "asg_art_commit"; });
    return runTriggers(acts, Object.assign({}, scene, {storage: seeded(craft, scene.storage)}));
  }

  /* the narrator names the finished piece: the commit trigger records it (planning turn after the action) */
  function commitTurn(craft, scene) {
    var commit = craft.triggers.filter(function (t) { return t.key === "asg_art_commit"; });
    return runTriggers(commit, Object.assign({}, scene, {storage: seeded(craft, scene.storage)}));
  }

  /* what a viewer's browser keeps: only what is theirs (designed recipes, stock, pending orders), never a copy of the book,
     so a republished book is always the one the bench reads */
  function own(craft, storage) {
    var seed = craft.seed || {}, out = {};
    Object.keys(storage).forEach(function (k) {
      if (k === "asg_art_recipes") {
        var mine = {};
        Object.keys(storage[k] || {}).forEach(function (n) { if (!(seed[k] || {})[n]) mine[n] = storage[k][n]; });
        if (Object.keys(mine).length) out[k] = mine;
      } else if (JSON.stringify(storage[k]) !== JSON.stringify(seed[k])) out[k] = storage[k];
    });
    return out;
  }

  /* the word check of one typed-action trigger: every regex passes and no notContains guard is in the line */
  function wordCheck(trigger, line) {
    var fails = [];
    trigger.words.forEach(function (rx) { if (!new RegExp(rx).test(line)) fails.push(rx); });
    trigger.not.forEach(function (s) { if (line.indexOf(s) >= 0) fails.push("must not contain " + s); });
    return fails;
  }

  /* the scene for a craft: the first known place whose "location area" names one of the craft's stations, as the craft
     script reads a station off party-location + party-area together (The Workshop is a location, not an area) */
  function stationPlace(craft, places, disc) {
    var want = (craft.stations[disc] || []).map(function (w) { return new RegExp("\\b" + w + "\\b", "i"); });
    for (var i = 0; i < places.length; i++) {
      var l = places[i];
      for (var j = 0; j < l.areas.length; j++) {
        var a = l.areas[j];
        if (want.some(function (re) { return re.test(l.name + " " + a.name); })) return [l.name, a.name];
      }
    }
    return null;
  }

  /* the narration the bench writes when the player says the narrator finished the piece */
  function commitLine(name) { return "You finish the work: [" + name + "] is done."; }

  /* the stock count of one piece at one quality (asg_art_stock: name -> [Base, Fine, Superior, Master-made, Named]) */
  function stockOf(storage, base, q) { return ((storage.asg_art_stock || {})[base] || [])[q || 0] || 0; }

  root.Bench = {condition: condition, runTriggers: runTriggers, craftTurn: craftTurn, commitTurn: commitTurn,
                beats: beats, wordCheck: wordCheck, stationPlace: stationPlace, commitLine: commitLine, stockOf: stockOf, own: own};
  if (typeof module !== "undefined") module.exports = root.Bench;
})(typeof window !== "undefined" ? window : globalThis);
