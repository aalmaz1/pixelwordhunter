import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  // A config object containing ONLY `ignores` acts as a global ignore list;
  // if `ignores` shares an object with other keys it only scopes that object.
  { ignores: ["dist/**", "node_modules/**", "dev-dist/**"] },
  { languageOptions: { globals: { ...globals.browser, __dirname: "readonly" } } },
  pluginJs.configs.recommended,
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-undef": "off"
    }
  }
];
