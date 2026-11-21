// Testes do Minhas Finanças (modo local, com compras simuladas do Minhas Compras):
// node testes/teste-financas.js [endereço]
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8766/";
let falhas = 0;
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) falhas++; };
const COMPRAS = [
  { id: "co-1", t: "compra", status: "fim", fin: "pendente", data: "2026-11-21", loja: "lj-atacadao", lojaNome: "Atacadão", total: 170, nItens: 3, pag: "Crédito", por: "Gui" },
  { id: "co-2", t: "compra", status: "fim", fin: "pendente", data: "2026-11-20", loja: "lj-atacadao", lojaNome: "Atacadão", total: 45.5, nItens: 2, pag: "Pix", por: "Esposa" },
  { id: "co-4", t: "compra", status: "fim", fin: "pendente", data: "2026-11-18", loja: "lj-tauste", lojaNome: "Tauste", total: 180.5, nItens: 9, pag: "Pix", porCat: { "Mercearia": 100, "Limpeza": 30.5, "Carnes": 50 } },
  { id: "co-5", t: "compra", status: "fim", fin: "pendente", data: "2026-11-17", loja: "lj-tauste", lojaNome: "Tauste", total: 40, nItens: 2, pag: "Pix", porCat: { "Mercearia": 25, "Limpeza": 15 } },
  { id: "co-3", t: "compra", status: "fim", fin: "pendente", data: "2026-11-19", loja: "lj-estrela", lojaNome: "Estrela", total: 12, nItens: 1, pag: "Dinheiro" },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = [];
  p.on("pageerror", e => erros.push(e.message));
  await p.addInitScript(c => { if (!window.__comprasTeste) window.__comprasTeste = c; }, COMPRAS);
  await p.goto(BASE + "?local=1#inicio");
  await p.waitForSelector("#compras-lancar");
  ok(await p.locator("text=Trazer seus dados do Dropbox").count() === 1, "sem dados: mostra o quadro de mudança do Dropbox");
  ok(await p.locator("#compras-lancar .kv").count() === 5, "caixa Compras a lançar mostra 5 compras");
  await p.click('[data-act="seed"]');
  await p.waitForTimeout(150);
  ok(await p.locator("text=Trazer seus dados do Dropbox").count() === 0, "com dados: quadro de mudança some");

  // 1ª compra: crédito → cadastra cartão, categoria Mercado › Supermercado já vem marcada
  await p.click('[data-act="compra-lancar"][data-id="co-1"]');
  ok((await p.inputValue("#f-v")) === "170,00", "valor da compra preenchido (170,00)");
  ok((await p.inputValue("#f-n")) === "Atacadão", "loja preenchida no título");
  ok((await p.inputValue("#f-d")) === "2026-11-21", "data da compra preenchida");
  ok(await p.locator('[data-act="s-pay"][data-v="credito"][aria-pressed="true"]').count() === 1, "pagamento Crédito marcado");
  ok(await p.locator('[data-act="s-cat"][aria-pressed="true"]', { hasText: "Mercado" }).count() === 1, "categoria Mercado sugerida");
  ok(await p.locator('[data-act="s-sub"][aria-pressed="true"]', { hasText: "Supermercado" }).count() === 1, "subcategoria Supermercado sugerida");
  await p.click('[data-act="s-newcard"]');
  await p.fill("#f-newcard", "Nubank");
  await p.click('[data-act="s-newcard-save"]');
  await p.click('[data-act="s-save"]');
  await p.waitForTimeout(150);
  let marc = await p.evaluate(() => window.__comprasMarcadas || []);
  const m1 = marc.find(x => x.id === "co-1");
  ok(m1 && m1.fin === "lancado" && m1.finValor === 17000 && m1.finTx, "compra 1 marcada como lançada (R$ 170,00) no Minhas Compras");
  const dados = () => p.evaluate(() => JSON.parse(localStorage.getItem("minhas-financas-v3")));
  let d = await dados();
  const t1 = d.tx.find(t => t.compra === "co-1");
  ok(t1 && t1.v === 17000 && t1.p === "credito" && t1.k, "lançamento criado no cartão, ligado à compra");
  ok(d.settings.comprasPref?.["lj-atacadao"]?.c === t1.c, "categoria lembrada para o Atacadão");

  // 2ª compra mesma loja, Pix: categoria lembrada, pagamento vem da compra
  await p.click('[data-act="compra-lancar"][data-id="co-2"]');
  ok((await p.inputValue("#f-v")) === "45,50", "valor da 2ª compra (45,50)");
  ok(await p.locator('[data-act="s-pay"][data-v="pix"][aria-pressed="true"]').count() === 1, "pagamento Pix vem da compra");
  ok(await p.locator('[data-act="s-cat"][aria-pressed="true"]', { hasText: "Mercado" }).count() === 1, "categoria lembrada da loja");
  await p.click('[data-act="s-save"]');
  await p.waitForTimeout(150);
  // C. dividir por categoria
  await p.click('[data-act="compra-dividir"][data-id="co-4"]');
  await p.waitForSelector("text=Dividir compra");
  ok(await p.locator(".divlin").count() === 3, "divisão mostra as 3 categorias da compra");
  ok((await p.textContent('[data-act="div-save"]')).includes("2 lançamentos"), "Mercearia e Limpeza caem em Mercado › Supermercado; Carnes em Mercado › Açougue (2 lançamentos)");
  ok((await p.textContent(".divlin >> nth=2")).includes("Limpeza"), "partes em ordem de valor (Limpeza é a 3ª)");
  const idCompras = await p.evaluate(() => [...document.querySelectorAll('[data-change="div-cat"][data-i="2"] option')].find(o => o.textContent === "Compras").value);
  await p.selectOption('[data-change="div-cat"][data-i="2"]', idCompras);
  await p.waitForTimeout(80);
  ok((await p.textContent('[data-act="div-save"]')).includes("3 lançamentos"), "trocando Limpeza para Compras ficam 3 lançamentos");
  await p.click('[data-act="div-save"]');
  await p.waitForTimeout(150);
  d = await dados();
  const div = d.tx.filter(t => t.compra === "co-4");
  ok(div.length === 3 && div.reduce((a, t) => a + t.v, 0) === 18050 && div.every(t => t.p === "pix"), "3 lançamentos somando R$ 180,50, no Pix");
  marc = await p.evaluate(() => window.__comprasMarcadas);
  ok(marc.some(x => x.id === "co-4" && x.fin === "lancado" && x.finTxs?.length === 3 && x.finValor === 18050), "compra dividida marcada como lançada, com os 3 lançamentos");
  ok(d.settings.comprasCatMap?.["Limpeza"]?.c === idCompras, "escolha de Limpeza → Compras lembrada");
  await p.click('[data-act="compra-dividir"][data-id="co-5"]');
  ok(await p.locator('[data-change="div-cat"][data-i="1"]').inputValue() === idCompras, "na próxima compra, Limpeza já vem em Compras");
  await p.click('[data-act="div-save"]');
  await p.waitForTimeout(150);
  // compra dividida alterada depois: refazer a divisão
  await p.evaluate(() => { const c = window.__comprasTeste.find(x => x.id === "co-4"); const m = window.__comprasMarcadas.filter(x => x.id === "co-4").at(-1); Object.assign(c, { fin: "revisar", total: 190.5, porCat: { "Mercearia": 110, "Limpeza": 30.5, "Carnes": 50 }, finTxs: m.finTxs, finValor: 18050 }); window.__comprasAtualizar(); });
  await p.waitForTimeout(120);
  await p.click('[data-act="compra-redividir"]');
  await p.waitForSelector("text=Dividir compra");
  await p.click('[data-act="div-save"]');
  await p.waitForTimeout(150);
  d = await dados();
  const div2 = d.tx.filter(t => t.compra === "co-4");
  ok(div2.length === 3 && div2.reduce((a, t) => a + t.v, 0) === 19050, "refazer a divisão troca os lançamentos antigos pelos novos (R$ 190,50, sem duplicar)");

  // 3ª: não lançar
  await p.click('[data-act="compra-ignorar"][data-id="co-3"]');
  await p.waitForTimeout(150);
  ok(await p.locator("#compras-lancar").count() === 0, "caixa some quando tudo foi lançado ou ignorado");
  marc = await p.evaluate(() => window.__comprasMarcadas);
  ok(marc.some(x => x.id === "co-3" && x.fin === "ignorado"), "compra ignorada marcada como fora do financeiro");

  // compra alterada depois de lançada → revisar
  await p.evaluate((tx) => { const c = window.__comprasTeste[0]; Object.assign(c, { fin: "revisar", total: 180, finValor: 17000, finTx: tx }); window.__comprasAtualizar(); }, t1.id);
  await p.waitForTimeout(150);
  ok(await p.locator("text=era R$ 170,00, agora R$ 180,00").count() === 1, "compra alterada aparece para revisar (170 → 180)");
  await p.click('[data-act="compra-revisar"]');
  ok((await p.inputValue("#f-v")) === "180,00", "lançamento abre com o valor novo");
  await p.click('[data-act="s-save"]');
  await p.waitForTimeout(150);
  d = await dados();
  ok(d.tx.find(t => t.id === t1.id).v === 18000, "lançamento corrigido para R$ 180,00");
  marc = await p.evaluate(() => window.__comprasMarcadas);
  ok(marc.at(-1).fin === "lancado" && marc.at(-1).finValor === 18000, "compra volta a 'lançada' com o novo valor");

  // junção dos dados trazidos (mudança do Dropbox)
  const j = await p.evaluate(async () => {
    const { juntarImport } = await import("/js/store.js");
    const atual = { settings: { categories: [{ id: "c1", name: "Mercado" }], cards: [], accounts: [{ id: "a1", name: "Inter" }] }, tx: [{ id: "t1", d: "2026-11-01", v: 100 }] };
    const novo = { settings: { categories: [{ id: "c1", name: "Mercado (antigo)" }, { id: "c2", name: "Lazer" }], cards: [{ id: "k1", name: "Nubank" }], accounts: [], recurring: [{ id: "r1" }], goals: [] }, tx: [{ id: "t1", d: "2026-11-01", v: 999 }, { id: "t2", d: "2026-10-05", v: 50 }] };
    const r = juntarImport(atual, novo);
    return { cats: r.settings.categories.map(c => c.name), cards: r.settings.cards.length, rec: r.settings.recurring.length, novos: r.novos.map(t => t.id + ":" + t.m) };
  });
  ok(JSON.stringify(j) === JSON.stringify({ cats: ["Mercado", "Lazer"], cards: 1, rec: 1, novos: ["t2:2026-10"] }), "trazer dados junta sem duplicar nem sobrescrever: " + JSON.stringify(j));

  for (const v of ["inicio", "lancamentos", "config"]) {
    await p.goto(BASE + "?local=1#" + v);
    await p.waitForTimeout(100);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(w <= 390, `390 px sem rolagem lateral: ${v} (${w})`);
  }
  ok(!erros.length, "sem erros na página" + (erros.length ? ": " + erros.join(" | ") : ""));
  await b.close();
  console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
})();
