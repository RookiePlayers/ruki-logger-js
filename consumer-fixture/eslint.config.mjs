const moduleSpecifier = process.env.RUKI_TYPESCRIPT_ESLINT ?? "typescript-eslint";
const tseslintModule = await import(moduleSpecifier);
const tseslint = tseslintModule.default ?? tseslintModule;

export default tseslint.config(
  tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json"
      }
    },
    rules: {
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error"
    }
  }
);
