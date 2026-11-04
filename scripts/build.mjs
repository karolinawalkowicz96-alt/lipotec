#!/usr/bin/env node
/**
 * LIPOTEC static site builder — zero dependencies.
 *
 * src/pages/**.html  → dist/**.html (served with clean URLs on Vercel)
 * src/layout.html    → shared document shell
 * src/partials/*.html→ {{> name}} includes
 * company.config.mjs → {{company.x}} tokens and {{#if company.x}}…{{/if}} blocks
 *
 * Each page starts with <!--meta { JSON } --> holding title, description, etc.
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import company from "../company.config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const SITE = company.siteUrl.replace(/\/$/, "");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const get = (obj, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const hashes = new Map();
async function assetUrl(rel) {
  if (!hashes.has(rel)) {
    const buf = await readFile(path.join(ROOT, rel.replace(/^\//, "")));
    hashes.set(rel, createHash("sha1").update(buf).digest("hex").slice(0, 10));
  }
  return `${rel}?v=${hashes.get(rel)}`;
}

async function render(tpl, ctx, partials, depth = 0) {
  if (depth > 6) throw new Error("Partial nesting too deep");
  // partials
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Missing partial: ${name}`);
    return partials[name];
  });
  if (/\{\{>/.test(tpl)) return render(tpl, ctx, partials, depth + 1);
  // conditionals (non-greedy, supports {{else}})
  let prev;
  do {
    prev = tpl;
    tpl = tpl.replace(
      /\{\{#(if|unless)\s+([\w.]+)\s*\}\}((?:(?!\{\{#(?:if|unless))[\s\S])*?)\{\{\/\1\}\}/g,
      (_, kind, key, body) => {
        const [yes, no = ""] = body.split("{{else}}");
        const truthy = Boolean(get(ctx, key));
        return (kind === "if" ? truthy : !truthy) ? yes : no;
      },
    );
  } while (tpl !== prev);
  // assets with cache-busting
  const assetMatches = [...tpl.matchAll(/\{\{asset:([^}]+)\}\}/g)];
  for (const m of assetMatches) tpl = tpl.replace(m[0], await assetUrl(m[1].trim()));
  // raw values {{{x}}} and escaped values {{x}}
  tpl = tpl.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => get(ctx, k) ?? "");
  tpl = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = get(ctx, k);
    if (v === undefined) throw new Error(`Unknown token {{${k}}}`);
    return escapeHtml(v);
  });
  return tpl;
}

function parsePage(raw, file) {
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`Missing <!--meta--> block in ${file}`);
  return { meta: JSON.parse(m[1]), body: raw.slice(m[0].length) };
}

function jsonLd(meta, urlPath) {
  const url = SITE + (urlPath === "/" ? "/" : urlPath);
  const org = {
    "@type": "Organization",
    "@id": `${SITE}/#organization`,
    name: company.brand,
    url: `${SITE}/`,
    logo: `${SITE}/assets/brand/lipotec-logo.svg`,
    email: company.email,
    ...(company.phone ? { telephone: company.phone } : {}),
    ...(company.legalName ? { legalName: company.legalName } : {}),
    ...(company.nip ? { taxID: company.nip } : {}),
  };
  const graph = [
    org,
    { "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: company.brand, inLanguage: "pl-PL", publisher: { "@id": org["@id"] } },
    {
      "@type": meta.schemaType || "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: meta.title,
      description: meta.description,
      inLanguage: "pl-PL",
      isPartOf: { "@id": `${SITE}/#website` },
      ...(meta.schemaType === "Article"
        ? { headline: meta.h1 || meta.title, author: { "@id": org["@id"] }, publisher: { "@id": org["@id"] }, datePublished: meta.date, dateModified: meta.modified || meta.date, image: `${SITE}/assets/img/og-eva-sp6.jpg` }
        : {}),
    },
  ];
  if (meta.breadcrumbs) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: meta.breadcrumbs.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + p })),
    });
  }
  if (meta.product) {
    // Factual description only — no offers, ratings or reviews are claimed.
    graph.push({
      "@type": "Product",
      name: "EVA SP6",
      model: "EVA SP6",
      brand: { "@type": "Brand", name: "EUROMI" },
      manufacturer: { "@type": "Organization", name: "EUROMI SA" },
      category: "Systemy do liposukcji / liposculpture",
      description:
        "System EUROMI do liposukcji nutacyjno-infradźwiękowej (N.I.L.) łączący rękojeść nutacyjną, aspirator i ilościowy system infiltracji tłokowej. Wyrób przeznaczony dla użytkowników profesjonalnych.",
      image: `${SITE}/assets/img/og-eva-sp6.jpg`,
      url,
    });
  }
  if (meta.faq) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: meta.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}

function faqHtml(faq) {
  return faq
    .map(
      ([q, a]) =>
        `<details class="faq-item"><summary><span>${escapeHtml(q)}</span><i aria-hidden="true"></i></summary><div class="faq-answer"><p>${escapeHtml(a)}</p></div></details>`,
    )
    .join("");
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const partials = {};
  for (const f of await readdir(path.join(SRC, "partials"))) {
    partials[path.basename(f, ".html")] = await readFile(path.join(SRC, "partials", f), "utf8");
  }
  const layout = await readFile(path.join(SRC, "layout.html"), "utf8");
  const pageFiles = (await walk(path.join(SRC, "pages"))).filter((f) => f.endsWith(".html"));
  const sitemap = [];
  const year = new Date().getFullYear();

  for (const file of pageFiles) {
    const rel = path.relative(path.join(SRC, "pages"), file).replace(/\\/g, "/");
    const urlPath = rel === "index.html" ? "/" : "/" + rel.replace(/(\/index)?\.html$/, "");
    const { meta, body } = parsePage(await readFile(file, "utf8"), rel);
    const ctx = {
      company,
      year,
      page: { bodyClass: "", preload: "", ...meta, path: urlPath, canonical: SITE + (urlPath === "/" ? "/" : urlPath) },
      faqHtml: meta.faq ? faqHtml(meta.faq) : "",
    };
    const content = await render(body, ctx, partials);
    let html = await render(layout, { ...ctx, content, jsonld: jsonLd(meta, urlPath) }, partials);
    // mark the active navigation item
    html = html.replace(/<a([^>]*?) href="([^"]+)"([^>]*?)data-nav([^>]*)>/g, (all, a, href, b, c) => {
      const active = href === urlPath || (href !== "/" && urlPath.startsWith(href + "/"));
      return `<a${a} href="${href}"${b}${active ? 'aria-current="page" ' : ""}data-nav${c}>`;
    });
    const leftover = html.match(/\{\{[^}]*\}\}/);
    if (leftover) throw new Error(`Unrendered token ${leftover[0]} in ${rel}`);
    const outFile = path.join(DIST, rel);
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, html);
    if (!meta.noindex) sitemap.push({ loc: ctx.page.canonical, priority: meta.priority ?? 0.6, modified: meta.modified || meta.date });
    console.log(`built ${rel.padEnd(52)} ${urlPath}`);
  }

  // static assets
  for (const dir of ["css", "js", "img", "brand"]) await cp(path.join(ROOT, "assets", dir), path.join(DIST, "assets", dir), { recursive: true });
  await cp(path.join(ROOT, "assets", "brand", "favicon.svg"), path.join(DIST, "favicon.svg"));

  const today = new Date().toISOString().slice(0, 10);
  await writeFile(
    path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
      .sort((a, b) => b.priority - a.priority)
      .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.modified || today}</lastmod><priority>${u.priority.toFixed(1)}</priority></url>`)
      .join("\n")}\n</urlset>\n`,
  );
  await writeFile(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

  const size = (await walk(DIST)).length;
  console.log(`\n${pageFiles.length} pages, ${size} files → dist/`);
  if (!company.complianceReady) console.warn("! company.config.mjs: legal data incomplete (complianceReady=false)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


