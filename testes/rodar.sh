#!/bin/bash
# Roda todos os testes: bash testes/rodar.sh
cd "$(dirname "$0")/.."
PORTA=8766
python3 -m http.server $PORTA >/dev/null 2>&1 &
SRV=$!
trap "kill $SRV" EXIT
sleep 1
for f in js/*.js sw.js; do node --check "$f" || exit 1; done
FALHA=0
node testes/teste-financas.js "http://localhost:$PORTA/" || FALHA=1
FB=testes/firebase-lib/node_modules/firebase
if [ ! -f "$FB/firebase-app.js" ]; then (mkdir -p testes/firebase-lib && cd testes/firebase-lib && echo '{"name":"firebase-lib","private":true}' > package.json && npm i firebase@10.12.2 --silent >/dev/null 2>&1); fi
if [ -f "$FB/firebase-app.js" ]; then node testes/teste-firebase.js "http://localhost:$PORTA/" "$PWD/$FB" || FALHA=1; else echo "⚠ teste do Firebase pulado (sem npm)"; fi
exit $FALHA
