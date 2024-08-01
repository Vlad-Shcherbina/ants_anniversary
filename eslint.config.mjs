import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            globals:  globals.browser,
        },
        rules: {
            "prefer-const": "off",
            "@typescript-eslint/no-unused-vars": "warn",
        }
    },
    {
        ignores: ["vendor/**", "node_modules/**", "*.js"],
    },
];
