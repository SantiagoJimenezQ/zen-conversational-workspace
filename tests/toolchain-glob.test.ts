import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { ESLint } from "eslint";

const require = createRequire(import.meta.url);
const fromEslint = createRequire(require.resolve("eslint"));

test("the fixed glob engine supports legacy CommonJS and ESM default imports alongside modern named imports", async () => {
  const matcher = fromEslint("minimatch");
  assert.equal(typeof matcher, "function");
  assert.equal(matcher("src/app/page.tsx", "src/**/*.tsx"), true);
  assert.equal(matcher("src/app/page.tsx", "tests/**/*.tsx"), false);
  assert.equal(matcher.minimatch(".hidden.ts", "*.ts", { dot: true }), true);
  assert.equal(
    new matcher.Minimatch("**/*.{ts,tsx}").match("src/page.tsx"),
    true,
  );
  assert.deepEqual(matcher.match(["a.ts", "b.js"], "*.ts"), ["a.ts"]);
  assert.equal(matcher.defaults({ nocase: true })("README.md", "*.MD"), true);

  const esmPath = resolve(
    dirname(fromEslint.resolve("minimatch")),
    "../esm/index.js",
  );
  const esm = await import(pathToFileURL(esmPath).href);
  assert.equal(esm.default("src/app/page.tsx", "src/**/*.tsx"), true);
  assert.equal(esm.minimatch("src/app/page.tsx", "tests/**/*.tsx"), false);
  assert.equal(new esm.Minimatch("**/*.tsx").match("src/page.tsx"), true);
});

test("React lint rules still report glob-matched violations with the fixed engine", async () => {
  const fromNext = createRequire(require.resolve("eslint-config-next"));
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.jsx"],
        plugins: { react: fromNext("eslint-plugin-react") },
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        rules: {
          "react/forbid-component-props": [
            "error",
            { forbid: [{ propNamePattern: "data-*" }] },
          ],
        },
      },
    ],
  });
  const results = await eslint.lintText(
    'const Demo = () => <Widget data-qa="sample" />;',
    { filePath: "qa.jsx" },
  );
  assert.equal(results[0].fatalErrorCount, 0);
  assert.equal(results[0].errorCount, 1);
  assert.equal(results[0].messages[0].ruleId, "react/forbid-component-props");
});
