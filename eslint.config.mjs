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
            "no-constant-condition": ["warn", { "checkLoops": "allExceptWhileTrue" }],
            "prefer-const": "off",
            "@typescript-eslint/no-unused-vars": [
              // https://johnnyreilly.com/typescript-eslint-no-unused-vars
              "warn",
              {
                "args": "all",
                "argsIgnorePattern": "^_",
                "caughtErrors": "all",
                "caughtErrorsIgnorePattern": "^_",
                "destructuredArrayIgnorePattern": "^_",
                "varsIgnorePattern": "^_|^preact$",
                // Ignoring "unused" `preact` import, because JSX transpilation uses `preact.h`.
                "ignoreRestSiblings": true,
              }
            ],
            "react/react-in-jsx-scope": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    {
        ignores: ["vendor/**", "node_modules/**", "*.js"],
    },
];
