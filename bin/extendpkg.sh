#!/bin/sh

# We need to include everything in js/ in the finished package. Append to the `wasm-pack` generated code

set -e

GREEN='\033[1;32m'
NC='\033[0m'

echo -ne "export { createMission } from './mission.js';\n" >> ./pkg/index.js

cat ./pkg/package.json | jq '.files = .files + ["mission.js", "mission.d.ts"]' | cat > ./tmp.json && mv ./tmp.json ./pkg/package.json

echo -e "${GREEN}Patched generated pkg/ to include files from js/${NC}"
