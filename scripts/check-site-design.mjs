// Render components in memory. No build, dist output, server, or network calls.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = (name) => {
    if (name.endsWith(".css")) return {};
    if (!name.startsWith(".")) return require(name);
    const base = path.resolve(path.dirname(file), name);
    const target = [base, `${base}.tsx`, `${base}.ts`].find((candidate) => fs.existsSync(candidate));
    assert.ok(target, `Module exists: ${name}`);
    return load(target);
  };
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const render = (file, props = {}) => renderToStaticMarkup(React.createElement(load(file).default, props));
const { projects } = load("src/data/portfolio.ts");
const home = render("src/components/HomeLanding.tsx", { post: { slug: "example", category: "Engineering", title: "Example article", summary: "Example summary" }, onRead() {} });
assert.equal((home.match(/Read case study/g) || []).length, 3);
assert.equal((home.match(/Read article/g) || []).length, 1);
assert.ok(!home.includes("home-radar") && !home.includes("carousel"));
assert.ok(home.includes('href="/portfolio#work"'));
const nav = render("src/components/SiteNavigation.tsx");
for (const href of ["/portfolio", "/blogs", "/about", "/work-with-me", "/SaiKumarResume.pdf", "/expenses", "/learn-with-me", "/signin"]) assert.ok(nav.includes(`href="${href}"`), href);
assert.ok(nav.includes('aria-expanded="false"') && nav.includes('aria-controls="unified-navigation"'));
for (const project of projects) {
  const html = render("src/components/ProjectPage.tsx", { slug: project.slug });
  assert.ok(html.includes("The design decision"), project.slug);
  assert.ok(html.includes("Reported result") && html.includes("All case studies"));
  assert.equal((html.match(/id="unified-navigation"/g) || []).length, 1);
}
assert.ok(render("src/components/ProjectPage.tsx", { slug: "missing-project" }).includes("Project not found"));
const portfolio = render("src/components/PortfolioPage.tsx");
assert.ok(portfolio.includes("Technical Skills") && portfolio.includes("A60MC0ZW3CFK"));
const app = fs.readFileSync("src/App.tsx", "utf8");
assert.ok(app.includes("<SavePostButton") && app.includes("onClick={handleLearnAccessLogout}") && app.includes("<ProfileMenu"));
assert.ok(!app.includes('surface=home') && !app.includes('home-writing-carousel'));
console.log("PASS: rendered homepage, shared navigation, 7 case studies, not-found page, portfolio credentials, and preserved account/reader actions.");
