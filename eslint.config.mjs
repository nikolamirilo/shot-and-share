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
      // Galleries render dozens of remote thumbnails whose dimensions we do not
      // know. next/image would proxy every one of them through the app, which is
      // exactly the traffic the architecture is designed to keep off the server.
      "@next/next/no-img-element": "off",
      // Fires on any <link> to a font stylesheet. It is written for the Pages
      // Router's _document; in the App Router the tag belongs in the root layout
      // and applies to every page, which is what we do.
      "@next/next/no-page-custom-font": "off",
    },
  },
];

export default config;
