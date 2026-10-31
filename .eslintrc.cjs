module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2021: true, jest: true },
  ignorePatterns: ["dist/", "node_modules/", "uploads/", "seed-assets/"],
  rules: {
    // the codebase is loosely typed on purpose in places (mongoose lean results, express requests)
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_|^req$|^res$|^next$", varsIgnorePattern: "^_" }],
    "no-console": "off",
  },
};
