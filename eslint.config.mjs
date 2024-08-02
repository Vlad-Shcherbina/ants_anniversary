import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ...react.configs.flat.recommended,
        settings: {
            react: {
                version: "18",
            },
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            globals: globals.browser,
        },
        plugins: {
            "react-hooks": hooks,
        },
        rules: {
            "prefer-const": "off",
            "@typescript-eslint/no-unused-vars": "warn",
            "react/react-in-jsx-scope": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    {
        ignores: ["vendor/**", "node_modules/**", "*.js"],
    },
];
