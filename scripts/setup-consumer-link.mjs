import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const fixtureDir = path.join(projectRoot, "consumer-fixture");
const moduleDir = path.join(fixtureDir, "node_modules", "ruki-logger");

console.log("Linking local dist to consumer-fixture/node_modules/ruki-logger");

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

console.log("consumer-fixture now resolves ruki-logger from local dist/");
