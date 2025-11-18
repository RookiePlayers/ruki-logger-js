import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleSpecifier = process.env.RUKI_TYPESCRIPT_ESLINT ?? "typescript-eslint";
const tseslintModule = await import(moduleSpecifier);
const tseslint = tseslintModule.default ?? tseslintModule;
const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ["eslint.config.mjs"]
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
        project: "./tsconfig.json"
      }
    }
  },
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error"
    }
  }
);
