#!/bin/sh

# We need to include everything in js/ in the finished package. Append to the `wasm-pack` generated code

set -e

GREEN='\033[1;32m'
NC='\033[0m'

for f in lib/*.js
do
    cat $f >> pkg/index.js
done

for f in lib/*.d.ts
do
    cat $f >> pkg/index.d.ts
done

echo -e "${GREEN}Patched generated pkg/ to include files from js/${NC}"
