import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const fixtureTemplate = path.join(projectRoot, "consumer-fixture");

const tempDir = mkdtempSync(path.join(tmpdir(), "ruki-consumer-"));
const fixtureDir = path.join(tempDir, "fixture");

cpSync(fixtureTemplate, fixtureDir, { recursive: true });

const moduleDir = path.join(fixtureDir, "node_modules", "ruki-logger");
mkdirSync(moduleDir, { recursive: true });
cpSync(path.join(projectRoot, "dist"), path.join(moduleDir, "dist"), { recursive: true });

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const publishedPackage = {
  name: packageJson.name,
  version: packageJson.version,
  type: packageJson.type,
  main: packageJson.main,
  module: packageJson.module,
  types: packageJson.types,
  exports: packageJson.exports,
  typesVersions: packageJson.typesVersions,
  sideEffects: packageJson.sideEffects
};

writeFileSync(path.join(moduleDir, "package.json"), JSON.stringify(publishedPackage, null, 2));

const tscBin = path.join(projectRoot, "node_modules", ".bin", "tsc");
const eslintBin = path.join(projectRoot, "node_modules", ".bin", "eslint");
const tseslintPath = pathToFileURL(
  path.join(projectRoot, "node_modules", "typescript-eslint", "dist", "index.js")
).href;

const sharedEnv = {
  ...process.env,
  RUKI_TYPESCRIPT_ESLINT: tseslintPath
};

execSync(`${tscBin} --project tsconfig.json`, {
  stdio: "inherit",
  cwd: fixtureDir,
  env: sharedEnv
});

execSync(`${eslintBin} src --config eslint.config.mjs`, {
  stdio: "inherit",
  cwd: fixtureDir,
  env: sharedEnv
});

console.log("Consumer fixture compiled and linted successfully.");
