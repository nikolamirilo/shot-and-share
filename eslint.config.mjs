import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      ".storage/**",
      "public/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Galleries render dozens of remote thumbnails whose dimensions we do not know,
      // and next/image would proxy every one of them through the app.
      "@next/next/no-img-element": "off",
      // Written for the Pages Router's _document. In the App Router the tag belongs in
      // the root layout and applies to every page, which is what we do.
      "@next/next/no-page-custom-font": "off",
    },
  },
];

export default config;
