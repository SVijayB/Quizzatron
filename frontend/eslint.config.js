import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Colour lives in src/styles/tokens.css and is consumed through the
    // Tailwind theme. A raw hex literal in a component means the design system
    // was bypassed.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/]",
          message:
            "No raw hex colours. Add the value to src/styles/tokens.css and use the Tailwind token (e.g. `text-acid`) or `var(--color-…)`.",
        },
        {
          selector:
            "TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/]",
          message:
            "No raw hex colours. Add the value to src/styles/tokens.css and use the Tailwind token (e.g. `text-acid`) or `var(--color-…)`.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "dangerouslySetInnerHTML is not allowed.",
        },
      ],
    },
  }
);
