import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { 
    files: ["**/*.{ts,mts,cts}"],
    ignores: ["dist/**", "node_modules/**", "example/**", "tests/**"],
     languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
]);
