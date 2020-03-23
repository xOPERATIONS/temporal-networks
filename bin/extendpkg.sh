#!/bin/sh

# We need to include everything in js/ in the finished package. Copy and make adjustments to the `wasm-pack` generated imports and package.json. In the future, it would be nice to automatically handle including external JS. For now, you'll need to manually adjust the imports/exports and file list if you want to change exports or add/remove files from js/.

set -e

GREEN='\033[1;32m'
NC='\033[0m'

# TODO: fuck just append mission.js to pkg/index.js
# loop through js. append to index.js or index.d.ts based on file extension


# copy the JS files. no transpiling required
cp ./js/* ./pkg/

# add a couple lines to the end of the generated JS to import and expose the new JS
echo "const {Mission,Step,Actor,ANYTIME_INTERVAL}=require('./mission');module.exports.Mission=Mission;module.exports.Step=Step;module.exports.Actor=Actor;module.exports.ANYTIME_INTERVAL=ANYTIME_INTERVAL;" >> pkg/index.js

# rewrite package.json to add the files from js/
# good resource to play with `jq`: https://jqplay.org/
# why use the temp file? it probably has something to do with reading and writing to the same file in a single pipeline but I'm not sure
cat ./pkg/package.json | jq '.files = .files + ["mission.js", "mission.d.ts"]' | cat > ./tmp.json && mv ./tmp.json ./pkg/package.json

echo -e "${GREEN}Patched generated pkg/ to include files from js/${NC}"
