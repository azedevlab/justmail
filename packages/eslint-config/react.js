import base from "./index.js";
export default [
  ...base,
  {
    rules: {
      "react/jsx-no-literals": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];
