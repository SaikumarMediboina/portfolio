// Read-only checks; does not run the application build or write dist files.
import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

const source = fs.readFileSync("src/data/portfolio.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { projects } = module.exports;
assert.equal(projects.length, 7);
assert.equal(new Set(projects.map((project) => project.slug)).size, projects.length);
for (const project of projects) {
  assert.match(project.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(project.problem && project.contribution && project.result && project.evidenceNote);
  assert.equal(project.architecture.length, 4);
}
const app = fs.readFileSync("src/App.tsx", "utf8");
assert.ok(app.includes('href={`/projects/${project.slug}`}'));
assert.ok(app.includes('href={`/projects/${selectedProject.slug}`}'));
assert.ok(app.includes('id="work"'));
assert.ok(app.includes('currentPathname.startsWith("/projects/")'));
const rewrites = JSON.parse(fs.readFileSync("vercel.json", "utf8")).rewrites;
assert.ok(rewrites.some((route) => route.source === "/projects/:slug" && route.destination === "/index.html"));
assert.ok(rewrites.some((route) => route.source === "/portfolio"));
assert.equal(fs.readFileSync("public/SaiKumarResume.pdf").subarray(0, 5).toString(), "%PDF-");
assert.ok(fs.readFileSync("scripts/generate-static-seo.mjs", "utf8").includes("...projectRoutes"));
for (const file of ["src/App.tsx", "src/components/ProjectPage.tsx", "src/data/portfolio.ts"]) {
  const parsed = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  assert.equal(parsed.parseDiagnostics.length, 0, `Syntax: ${file}`);
}
console.log("PASS: seven unique project routes, case-study data, links, Vercel rewrites, sitemap registration, resume PDF and TypeScript syntax.");
