#!/bin/bash

set -e
set -u
set -o pipefail
set -x

VERSION=10.23.1
curl -LO https://github.com/preactjs/preact/releases/download/$VERSION/preact-$VERSION.tgz
tar -xzf preact-$VERSION.tgz

cp package/LICENSE ./

cp package/dist/preact.module.js ./preact.js
cp package/hooks/dist/hooks.module.js ./hooks.js
cp package/devtools/dist/devtools.module.js ./devtools.js
cp package/debug/dist/debug.module.js ./debug.js

# TODO: I suspect preact source map is incorrect, but I haven't investigated.
# All different ways of packaging preact (preact.module.js, preact.js, preact.umd.js)
# refer to the same source map, that can't be right.
# cp package/dist/preact.module.js.map ./
# cp package/hooks/dist/hooks.module.js.map ./  # we patch hooks.js, so the map will be invalid anywai

cp package/src/index.d.ts ./preact.d.ts
cp package/src/jsx.d.ts ./
cp package/hooks/src/index.d.ts ./hooks.d.ts
cp package/devtools/src/index.d.ts ./devtools.d.ts

# Instead of these ugly patches, we could use the "paths" option in tsconfig.json
# for .d.ts and HTML importmaps for .js
# However, with the current approach the ugliness is contained in vendor/
# and doesn't show in the project itself.

replace_in_file() {
    local file="$1"
    local search="$2"
    local replace="$3"
    if grep -q "$search" "$file"; then
        sed -i '' "s|$search|$replace|g" "$file"
        echo "Replaced '$search' with '$replace' in $file"
    else
        echo "Error: Pattern '$search' not found in $file" >&2
        exit 1
    fi
}
replace_in_file "jsx.d.ts"    "from './index'"          "from './preact'"
replace_in_file "hooks.d.ts"  "from '../..'"            "from './preact'"
replace_in_file "hooks.js"    'from"preact"'            'from"./preact.js"'
replace_in_file "devtools.js" 'from"preact"'            'from"./preact.js"'
replace_in_file "debug.js"    'from"preact"'            'from"./preact.js"'
replace_in_file "debug.js"    'import"preact/devtools"' 'import"./devtools.js"'
