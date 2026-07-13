import react from "./react.js";
import next from "@next/eslint-plugin-next";

export default [
  ...react,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: { "@next/next": next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs["core-web-vitals"].rules,
    },
  },
];
