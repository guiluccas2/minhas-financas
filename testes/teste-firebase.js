// Abertura com as bibliotecas reais do Firebase (sem acesso aos servidores do Google):
// não pode ficar preso em "Carregando…"; sem ninguém conectado mostra "Entrar com Google".
// node testes/teste-firebase.js <endereço> <pasta do pacote firebase@10.12.2>
const { chromium } = require("playwright");
const [BASE, FB] = [process.argv[2] || "http://localhost:8766/", process.argv[3]];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = [];
  p.on("pageerror", e => erros.push(e.message));
  await p.route(/www\.gstatic\.com\/firebasejs\/10\.12\.2\/(.*)$/, r => r.fulfill({ path: FB + "/" + r.request().url().split("/").pop(), contentType: "text/javascript" }));
  await p.goto(BASE + "#inicio");
  await p.waitForTimeout(4000);
  const tela = (await p.textContent("#root")).replace(/\s+/g, " ");
  const ok = tela.includes("Entrar com Google") && !erros.length;
  console.log((ok ? "✔ " : "✘ ") + "com Firebase, abre na tela de login" + (ok ? "" : ` → ${tela.slice(0, 100)} ${erros.join(" | ")}`));
  await b.close();
  process.exit(ok ? 0 : 1);
})();
