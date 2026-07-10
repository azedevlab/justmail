// Baseline ESLint config (flat). Shared across every JustMail workspace.
export default [
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
    },
  },
];
