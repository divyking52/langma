/*
 * Inlines every pages/*.html into index.html as an inert <template> route,
 * plus the page stylesheet scoped to .pg-view, plus the hash router.
 * Re-runnable: each region is replaced between its markers.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PAGES_DIR = path.join(ROOT, "pages");
const INDEX = path.join(ROOT, "index.html");

const CSS_MARK = "<!-- @pg:css -->";
const CSS_END = "<!-- /@pg:css -->";
const VIEWS_MARK = "<!-- @pg:views -->";
const VIEWS_END = "<!-- /@pg:views -->";
const ROUTER_MARK = "<!-- @pg:router -->";
const ROUTER_END = "<!-- /@pg:router -->";

/* ---------- page extraction ---------- */

const SLUG_SAFE = /^[A-Za-z0-9_-]+$/;

function pageData(file) {
  const html = fs.readFileSync(path.join(PAGES_DIR, file), "utf8");
  const slug = file.replace(/\.html$/, "");
  const main = html.match(/<main id="main">([\s\S]*?)<\/main>/);
  if (!main) throw new Error("no <main id=\"main\"> in " + file);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1].trim();
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [, ""])[1];
  return { slug, title, desc, body: main[1] };
}

/* ../index.html#contact -> #contact, ../index.html -> #/, x.html -> #/x */
function rewriteLinks(html) {
  return html
    .replace(/href="\.\.\/index\.html#([^"]*)"/g, 'href="#$1"')
    .replace(/href="\.\.\/index\.html"/g, 'href="#/"')
    .replace(/href="(#!?main)"/g, 'href="#top"')
    .replace(/href="([A-Za-z0-9_-]+)\.html"/g, 'href="#/$1"');
}

/* ---------- css scoping ---------- */

const DROP = [
  /^\.skip\b/, /^\.site-head\b/, /^\.head-inner\b/, /^\.brand\b/, /^\.site-nav\b/,
  /^\.menu-toggle\b/, /^\.site-foot\b/, /^\.foot-inner\b/, /^\.foot-bottom\b/, /^\.foot-brand\b/,
];
const KEYFRAMES = { rise: "pg-rise", float: "pg-float" };

function splitSelectors(prelude) {
  const out = [];
  let depth = 0, buf = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  out.push(buf);
  return out.map(s => s.trim()).filter(Boolean);
}

function prefixSelector(sel) {
  if (DROP.some(re => re.test(sel))) return "";
  if (/^html\b/.test(sel)) return "";
  if (sel === ":root") return ".pg-view";
  if (/^body\b/.test(sel)) return ".pg-view" + sel.slice(4);
  if (sel === "*") return ".pg-view *";
  if (/^\.rv-on\b/.test(sel)) return ".pg-view.rv-on" + sel.slice(6);
  if (/^[a-z]*\*:before|^[a-z]*\*:after/.test(sel) && !/[.\s#]/.test(sel)) return ".pg-view " + sel;
  return ".pg-view " + sel;
}

function parseRules(css) {
  const nodes = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i);
    if (brace === -1) break;
    const strayClose = css.indexOf("}", i);
    if (strayClose !== -1 && strayClose < brace) { i = strayClose + 1; continue; }
    let depth = 1, j = brace + 1;
    while (j < css.length && depth > 0) {
      const c = css[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      j++;
    }
    nodes.push({ prelude: css.slice(i, brace).trim(), body: css.slice(brace + 1, j - 1) });
    i = j;
  }
  return nodes;
}

/* the font @import ends with a query string full of ";" — only a quote-aware scan cuts it cleanly */
function stripAtImport(css) {
  let out = "", i = 0;
  while (i < css.length) {
    if (css.startsWith("@import", i)) {
      let j = i + 7, quote = "";
      while (j < css.length) {
        const c = css[j];
        if (quote) { if (c === quote) quote = ""; }
        else if (c === "'" || c === '"') quote = c;
        else if (c === ";") { j++; break; }
        j++;
      }
      i = j;
      continue;
    }
    out += css[i++];
  }
  return out;
}

function scopeCss(css) {
  css = stripAtImport(css).replace(/\/\*[\s\S]*?\*\//g, "");
  const walk = src => parseRules(src).map(({ prelude, body }) => {
    if (/^@keyframes|^@-webkit-keyframes/.test(prelude)) {
      const name = prelude.replace(/^@(-webkit-)?keyframes\s*/, "").trim();
      return KEYFRAMES[name] ? prelude.replace(name, KEYFRAMES[name]) + "{" + body + "}" : prelude + "{" + body + "}";
    }
    if (/^@(media|supports)/.test(prelude)) return prelude + "{" + walk(body) + "}";
    if (/^@/.test(prelude)) return prelude + "{" + body + "}";
    const sels = splitSelectors(prelude).map(prefixSelector).filter(Boolean);
    if (!sels.length) return "";
    let decl = body;
    for (const [from, to] of Object.entries(KEYFRAMES)) {
      decl = decl.replace(new RegExp("(animation(?:-name)?\\s*:[^;}]*?)\\b" + from + "\\b"), "$1" + to);
    }
    return sels.join(",") + "{" + decl + "}";
  }).join("");
  return walk(css);
}

/* rules that restore what index.html's document-level reset would otherwise steal */
const EXTRA_CSS = `
.pg-view{position:relative;padding-top:calc(var(--nav) + 14px);min-height:60vh;isolation:isolate}
.pg-view[hidden]{display:none}
:where(.pg-view) p{margin:1em 0}
:where(.pg-view) h1{margin:.67em 0}
:where(.pg-view) h2{margin:.83em 0}
:where(.pg-view) h3{margin:1em 0}
:where(.pg-view) h4{margin:1.33em 0}
:where(.pg-view) ul,:where(.pg-view) ol{margin:1em 0;padding-inline-start:40px}
:where(.pg-view) figure,:where(.pg-view) blockquote{margin:1em 0}
.pg-view .reveal{opacity:1;transform:none}
@media(max-width:600px){.pg-view{padding-top:calc(var(--nav) + 6px)}}
`;

/* ---------- router ---------- */

const ROUTER = `
/* HASH ROUTES — every inner page ships inside index.html as an inert <template data-route>. */
(function () {
  var view = document.getElementById("pg-view");
  var home = document.getElementById("main");
  if (!view || !home) return;
  var descMeta = document.querySelector('meta[name="description"]');
  var homeTitle = document.title, homeDesc = descMeta ? descMeta.content : "";
  var TEMPLATES = {};
  document.querySelectorAll("template[data-route]").forEach(function (t) { TEMPLATES[t.dataset.route] = t; });
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var dispose = null, mounted = "";

  function routeOf(hash) {
    if (!hash || hash.indexOf("#/") !== 0) return "";
    return decodeURIComponent(hash.slice(2)).replace(/^\\/+/g, "").replace(/\\/+$/, "").replace(/\\.html$/, "");
  }

  function enhance(root) {
    var kills = [], io = null, scvRaf = 0, scvLast = 0;
    var on = function (target, type, fn, opts) {
      target.addEventListener(type, fn, opts || false);
      kills.push(function () { target.removeEventListener(type, fn, opts || false); });
    };

    /* pick-a-focus buttons */
    var out = root.querySelector("#choice-output");
    var choices = root.querySelectorAll("[data-choice]");
    choices.forEach(function (btn) {
      on(btn, "click", function () {
        choices.forEach(function (c) { c.setAttribute("aria-pressed", String(c === btn)); });
        if (out) out.textContent = btn.dataset.text || "";
      });
    });

    /* directory search + filters */
    var search = root.querySelector("#page-search");
    var cards = [].slice.call(root.querySelectorAll("[data-page-card]"));
    var empty = root.querySelector(".directory-empty");
    var filters = root.querySelectorAll("[data-filter]");
    var category = "all";
    function filter() {
      if (!cards.length) return;
      var q = (search && search.value || "").toLowerCase().trim(), shown = 0;
      cards.forEach(function (card) {
        var hit = (!q || card.textContent.toLowerCase().indexOf(q) > -1) &&
                  (category === "all" || card.dataset.category === category);
        card.hidden = !hit;
        if (hit) shown++;
      });
      if (empty) empty.style.display = shown ? "none" : "block";
    }
    if (search) on(search, "input", filter);
    filters.forEach(function (btn) {
      on(btn, "click", function () {
        category = btn.dataset.filter;
        filters.forEach(function (b) { b.classList.toggle("active", b === btn); });
        filter();
      });
    });

    /* enquiry draft */
    var form = root.querySelector("#quick-enquiry");
    if (form) on(form, "submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var subject = encodeURIComponent("Langma website enquiry: " + data.get("interest"));
      var body = encodeURIComponent("Name: " + data.get("name") + "\\nEmail: " + data.get("email") +
        "\\nPhone: " + data.get("phone") + "\\nInterest: " + data.get("interest") + "\\n\\n" + data.get("message"));
      var status = root.querySelector(".form-status");
      if (status) status.textContent = "Your email draft is ready. Review it and press Send to contact Langma.";
      location.href = "mailto:info@langmainternational.com?subject=" + subject + "&body=" + body;
    });

    if (reduce.matches) return function () { kills.forEach(function (f) { f(); }); };

    /* entrance reveals, scoped to the mounted route */
    root.classList.add("rv-on");
    var TEXT = "h1,h2,h3,h4,p,.lead,.section-intro,.section-kicker,.eyebrow,.fine-print";
    var BLOCK = ".page-hero>*,.section-inner>*,.contact-inner>*,.interactive-panel>*,.directory-tools,.form,.accordion,.card-grid,.blog-grid,.contact-list,.feature-list";
    root.querySelectorAll(TEXT).forEach(function (el) { el.setAttribute("data-rv", "fade"); });
    var wide = 0;
    root.querySelectorAll(BLOCK).forEach(function (el) {
      if (el.matches(TEXT) || el.hasAttribute("data-rv")) return;
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      var isWide = r.width >= document.documentElement.clientWidth * .82;
      var fromLeft = isWide ? wide++ % 2 === 0 : r.left + r.width / 2 < innerWidth / 2;
      el.setAttribute("data-rv", fromLeft ? "left" : "right");
    });
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("rv-in"); io.unobserve(e.target); } });
    }, { threshold: .15, rootMargin: "0px 0px -6% 0px" });
    root.querySelectorAll("[data-rv]").forEach(function (el) { io.observe(el); });
    /* observers can miss what was already on screen when the route mounted */
    function rvReveal() {
      root.querySelectorAll("[data-rv]:not(.rv-in)").forEach(function (el) {
        if (el.offsetParent === null) return;
        var b = el.getBoundingClientRect();
        if (b.bottom > 0 && b.top < innerHeight) el.classList.add("rv-in");
      });
    }

    /* scroll-linked svg: route divider + headline swoosh */
    var ROUTE = "M0 44 C 70 44 110 16 180 16 C 250 16 280 50 350 50 C 420 50 450 12 520 12 C 590 12 620 52 690 52 C 760 52 790 18 860 18 C 930 18 960 48 1030 48 C 1100 48 1140 30 1200 30";
    var SWOOSH = "M3 11 C 48 3 96 2 141 7 C 176 11 208 12 237 4";
    var night = function (el) { return !!el.closest(".page-index,.contact-strip"); };
    root.querySelectorAll(":scope > section").forEach(function (section) {
      if (section.classList.contains("page-hero")) return;
      var rule = document.createElement("div");
      rule.className = "scv-rule" + (night(section) ? " scv-dark" : "");
      rule.setAttribute("data-scv", "rule");
      rule.setAttribute("aria-hidden", "true");
      rule.innerHTML = '<svg viewBox="0 0 1200 64" preserveAspectRatio="none" focusable="false">' +
        '<path class="scv-guide" d="' + ROUTE + '"></path><path class="scv-line" d="' + ROUTE + '"></path></svg>' +
        '<span class="scv-node"></span>';
      section.insertBefore(rule, section.firstChild);
    });
    root.querySelectorAll(".section h2,.contact-inner h2").forEach(function (head) {
      head.classList.add("scv-host");
      var arc = document.createElement("div");
      arc.className = "scv-arc" + (night(head) ? " scv-dark" : "");
      arc.setAttribute("data-scv", "arc");
      arc.setAttribute("aria-hidden", "true");
      arc.innerHTML = '<svg viewBox="0 0 240 16" preserveAspectRatio="none" focusable="false">' +
        '<path class="scv-line" d="' + SWOOSH + '"></path></svg>';
      head.appendChild(arc);
    });
    var items = [];
    root.querySelectorAll("[data-scv]").forEach(function (host) {
      var line = host.querySelector(".scv-line"), svg = host.querySelector("svg");
      if (!line || !svg) return;
      var len = line.getTotalLength() || 1;
      line.style.setProperty("--len", len.toFixed(1));
      items.push({ host: host, line: line, len: len, vb: svg.viewBox.baseVal,
        node: host.querySelector(".scv-node"), p: -1 });
    });
    function frame() {
      var vh = innerHeight || 800;
      items.forEach(function (o) {
        var r = o.host.getBoundingClientRect();
        if (!r.width) return;
        var p = (vh * .86 - r.top) / (r.height + vh * .5);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        if (p === o.p) return;
        o.p = p;
        o.host.style.setProperty("--sp", p.toFixed(3));
        if (!o.node) return;
        var pt = o.line.getPointAtLength(o.len * p);
        var x = Math.min(Math.max(pt.x / o.vb.width * r.width, 5), r.width - 5);
        o.node.style.transform = "translate(" + x.toFixed(1) + "px," + (pt.y / o.vb.height * r.height).toFixed(1) + "px)";
      });
    }
    function tick() { scvRaf = 0; rvReveal(); frame(); }
    function onScroll() {
      var now = Date.now();
      if (now - scvLast < 50) return;
      scvLast = now;
      if (!scvRaf) scvRaf = requestAnimationFrame(tick);
    }
    on(window, "scroll", onScroll, { passive: true });
    on(window, "resize", function () { items.forEach(function (o) { o.p = -1; }); tick(); });
    requestAnimationFrame(tick);

    return function () {
      root.classList.remove("rv-on");
      if (io) io.disconnect();
      if (scvRaf) cancelAnimationFrame(scvRaf);
      kills.forEach(function (f) { f(); });
    };
  }

  function showHome(anchor) {
    if (dispose) { dispose(); dispose = null; }
    view.hidden = true;
    view.textContent = "";
    home.hidden = false;
    mounted = "";
    document.title = homeTitle;
    if (descMeta) descMeta.content = homeDesc;
    dispatchEvent(new Event("resize"));
    if (anchor) {
      var target = document.getElementById(anchor);
      if (target) requestAnimationFrame(function () { target.scrollIntoView({ block: "start" }); });
    } else {
      scrollTo({ top: 0, behavior: "instant" });
    }
  }

  function render() {
    var hash = location.hash;
    if (hash.indexOf("#/") !== 0) { showHome(hash ? hash.slice(1) : ""); return; }
    var slug = routeOf(hash);
    var tpl = TEMPLATES[slug];
    if (!tpl) { showHome(""); return; }
    if (mounted !== slug) {
      if (dispose) { dispose(); dispose = null; }
      view.textContent = "";
      view.appendChild(tpl.content.cloneNode(true));
      mounted = slug;
      scrollTo({ top: 0, behavior: "instant" });
      document.title = tpl.dataset.title || document.title;
      if (descMeta && tpl.dataset.desc) descMeta.content = tpl.dataset.desc;
      if (home.hidden === false) home.hidden = true;
      view.hidden = false;
      dispatchEvent(new Event("resize"));
      dispose = enhance(view);
    }
  }

  addEventListener("hashchange", render);
  render();
})();
`;

/* ---------- region replacement ---------- */

function replaceRegion(src, mark, end, content, anchor, before) {
  const a = src.indexOf(mark), b = src.indexOf(end);
  if (a !== -1 && b > a) return src.slice(0, a) + content + src.slice(b + end.length);
  const at = src.indexOf(anchor);
  if (at === -1) throw new Error("anchor not found: " + anchor);
  const insert = before ? src.slice(0, at) + content + src.slice(at)
                        : src.slice(0, at + anchor.length) + content + src.slice(at + anchor.length);
  return insert;
}

/* ---------- run ---------- */

const files = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith(".html")).sort();
const pages = files.map(pageData);
const bad = pages.filter(p => !SLUG_SAFE.test(p.slug)).map(p => p.slug);
if (bad.length) throw new Error("unexpected slug: " + bad.join(", "));

const sharedCss = fs.readFileSync(path.join(PAGES_DIR, "shared.css"), "utf8");
const css = scopeCss(sharedCss) + EXTRA_CSS;

const templates = pages.map(p => {
  const body = rewriteLinks(p.body).replace(/\s+$/, "");
  const title = p.title.replace(/"/g, "&quot;");
  const desc = p.desc.replace(/"/g, "&quot;");
  return `<template id="pg-${p.slug}" data-route="${p.slug}" data-title="${title}" data-desc="${desc}">${body}</template>`;
}).join("\n");

const viewsBlock = `
${VIEWS_MARK}
<div id="pg-view" class="pg-view" role="main" tabindex="-1" hidden></div>
${templates}
${VIEWS_END}
`;

const cssBlock = `
${CSS_MARK}
<style data-pg="inner-pages">
${css}
</style>
${CSS_END}
`;

const routerBlock = `
${ROUTER_MARK}
<script>${ROUTER}</script>
${ROUTER_END}
`;

let index = fs.readFileSync(INDEX, "utf8");
index = replaceRegion(index, CSS_MARK, CSS_END, cssBlock, "</head>", true);
index = replaceRegion(index, VIEWS_MARK, VIEWS_END, viewsBlock, '<footer class="footer">', true);
index = replaceRegion(index, ROUTER_MARK, ROUTER_END, routerBlock, "<script>", true);
fs.writeFileSync(INDEX, index);

console.log("routes: " + pages.length + " | page css: " + (css.length / 1024).toFixed(1) +
  "kb | index.html: " + (index.length / 1024).toFixed(1) + "kb");
