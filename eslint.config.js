import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  { languageOptions: { globals: { ...globals.browser, __dirname: "readonly" } } },
  pluginJs.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-undef": "off"
    }
  }
];
