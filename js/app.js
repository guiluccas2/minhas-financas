import { openStore, cloudConfigured, newId } from "./store.js";

// =====================================================================
// helpers
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (c) => BRL.format((c || 0) / 100);
const moneyS = (c) => (c < 0 ? "−" : "") + money(Math.abs(c || 0));
const money0 = (c) => "R$ " + Math.round((c || 0) / 100).toLocaleString("pt-BR");
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const ymd = (y, m, d) => { while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}-${pad(Math.min(d, lastDay(y, m)))}`; };
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoDate(new Date());
const curMonth = () => todayISO().slice(0, 7);
const addMonth = (m, k) => { const [y, mo] = m.split("-").map(Number); return ymd(y, mo + k, 1).slice(0, 7); };
const addDays = (iso, k) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + k); return isoDate(d); };
function addMonthsDate(iso, k) { const [y, m, d] = iso.split("-").map(Number); return ymd(y, m + k, d); }
const endOfMonth = (m) => { const [y, mo] = m.split("-").map(Number); return `${m}-${pad(lastDay(y, mo))}`; };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const monthName = (m, opts = { month: "long", year: "numeric" }) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", opts).replace(" de ", " ").replace(".", ""); };
const shortMonth = (m) => monthName(m, { month: "short" });
const dm = (iso) => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
const weekday = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" });
const uid8 = () => Math.random().toString(36).slice(2, 10);
const initials = (name) => { const w = String(name || "?").trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase(); };
const cmpName = (a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function parseMoney(str) {
  let s = String(str ?? "").replace(/[^\d,.-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const v = Number(s);
  return isFinite(v) ? Math.round(Math.abs(v) * 100) : null;
}
const centsToInput = (c) => c ? (c / 100).toFixed(2).replace(".", ",") : "";

const PAY = [["credito", "Crédito"], ["debito", "Débito"], ["pix", "Pix"], ["dinheiro", "Dinheiro"], ["transferencia", "Transferência"], ["boleto", "Boleto"]];
const payName = (p) => (PAY.find(x => x[0] === p) || [, ""])[1];
const ACC_TYPES = [["corrente", "Conta corrente"], ["poupanca", "Poupança"], ["investimento", "Investimento"], ["carteira", "Dinheiro / carteira"]];
const COLORS = ["#c8322b", "#1f5fa8", "#e07a1f", "#7a3fc4", "#0d6b59", "#b5367a", "#2b7a2b", "#5a6963", "#c49a00", "#00838f"];
const SUGGESTED = {
  out: {
    "Moradia": ["Aluguel/Financiamento", "Condomínio", "Água", "Energia", "Gás", "IPTU", "Internet", "Celular", "Manutenção/Reforma"],
    "Transporte": ["Táxi/Uber", "Ônibus/Metrô", "Combustível", "Estacionamento", "Seguro", "Manutenção", "Lavagem", "Licenciamento", "Pedágio", "IPVA"],
    "Mercado": ["Supermercado", "Feira", "Padaria", "Açougue"],
    "Alimentação fora": ["Restaurante", "Delivery", "Lanche/Café"],
    "Saúde": ["Plano de saúde", "Farmácia", "Consultas", "Exames", "Dentista"],
    "Lazer": ["Viagens", "Cinema/Shows", "Bares", "Passeios"],
    "Assinaturas": ["Streaming", "Aplicativos", "Academia"],
    "Educação": ["Mensalidade", "Cursos", "Livros"],
    "Compras": ["Roupas", "Eletrônicos", "Casa", "Presentes"],
    "Outros": [],
  },
  in: { "Salário": [], "Renda extra": ["Freelance", "Vendas", "Rendimentos"] },
};
const mkSubs = (names) => names.map(name => ({ id: "s" + uid8(), name, archived: false }));

const ICONS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  bank: "M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  chart: "M4 20V10M10 20V4M16 20v-7M2 20h20",
  tag: "M3 12V4h8l9 9-8 8zM7.5 7.5h.01",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  pie: "M21 12A9 9 0 1 1 12 3v9zM14 3.3A9 9 0 0 1 20.7 10H14z",
  menu: "M4 6h16M4 12h16M4 18h16",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

// =====================================================================
// state
// =====================================================================
const DEFAULT_SETTINGS = () => ({ v: 3, categories: [], cards: [], accounts: [], recurring: [], goals: [], lastPay: { p: "", k: "", a: "" }, prefs: { theme: "auto", cardMonth: "purchase", defaultAccount: "", avgMonths: 6 } });
const S = {
  store: null, settings: DEFAULT_SETTINGS(), tx: [], sync: "local", loaded: false,
  view: "inicio", month: curMonth(),
  period: { mode: "mes", start: null }, divSort: "valor", expanded: new Set(),
  txFilter: "all", search: "", editSub: null, pendingDel: null, editAcc: null, editCard: null, invoice: null,
};
const st = () => S.settings;
const catById = (id) => st().categories.find(c => c.id === id);
const subOf = (c, sid) => (c?.subs || []).find(x => x.id === sid);
const cardById = (id) => st().cards.find(k => k.id === id);
const accById = (id) => st().accounts.find(a => a.id === id);
const activeCats = (type) => st().categories.filter(c => !c.archived && (!type || c.type === type));
const activeAccs = () => st().accounts.filter(a => !a.archived);
const activeCards = () => st().cards.filter(k => !k.archived);

function normalizeSettings(s) {
  const d = DEFAULT_SETTINGS();
  if (!s) return d;
  const out = { ...d, ...s, prefs: { ...d.prefs, ...(s.prefs || {}) }, lastPay: { ...d.lastPay, ...(s.lastPay || {}) } };
  out.categories = (s.categories || []).map(c => ({ budget: 0, archived: false, ...c, subs: Array.isArray(c.subs) ? c.subs : [] }));
  out.cards = (s.cards || []).map((k, i) => ({ limit: 0, closeDay: null, dueDay: null, payAccount: "", color: COLORS[(i + 3) % COLORS.length], archived: false, ...k }));
  out.recurring = (s.recurring || []).map(r => ({ skip: [], active: true, end: "", ...r }));
  out.goals = (s.goals || []).map(g => ({ deposits: [], initial: 0, done: false, ...g }));
  out.accounts = (s.accounts || []).map((a, i) => ({ type: "corrente", initial: 0, since: "", color: COLORS[i % COLORS.length], archived: false, ...a }));
  return out;
}
function sortAll() {
  const s = st();
  s.categories.sort(cmpName);
  for (const c of s.categories) c.subs = (c.subs || []).slice().sort(cmpName);
  s.cards.sort(cmpName); s.accounts.sort(cmpName);
}
function saveSettings() {
  sortAll();
  const copy = JSON.parse(JSON.stringify(st()));
  Promise.resolve(S.store.saveSettings(copy)).catch(e => toast("Não foi possível salvar: " + (e?.message || e)));
  clearCaches(); render();
}
function putTx(list) { Promise.resolve(S.store.putTx(list)).catch(e => toast("Não foi possível salvar: " + (e?.message || e))); }
function delTx(ids) { Promise.resolve(S.store.delTx(ids)).catch(e => toast("Não foi possível apagar: " + (e?.message || e))); }
const mkTx = (body) => ({ id: newId("t"), at: Date.now(), ...body, m: body.d.slice(0, 7) });

// =====================================================================
// money logic: cards, accounts, months
// =====================================================================
let invCache = new Map();
function clearCaches() { invCache = new Map(); idx = null; }
// fatura de uma compra: compras no dia do fechamento ou depois vão para a fatura seguinte
function cycle(card, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!card || !card.closeDay) return { key: iso.slice(0, 7), close: null, due: null };
  let cm = m + (d >= card.closeDay ? 1 : 0);
  const close = ymd(y, cm, card.closeDay);
  const dueDay = card.dueDay || card.closeDay;
  const due = ymd(y, cm + (dueDay <= card.closeDay ? 1 : 0), dueDay);
  return { key: due.slice(0, 7), close, due };
}
function invoiceDates(card, key) {
  const [y, m] = key.split("-").map(Number);
  if (!card?.closeDay) return { close: null, due: card?.dueDay ? ymd(y, m, card.dueDay) : null };
  const dueDay = card.dueDay || card.closeDay;
  return { due: ymd(y, m, dueDay), close: ymd(y, m - (dueDay <= card.closeDay ? 1 : 0), card.closeDay) };
}
function invoiceOf(t) {
  let k = invCache.get(t.id);
  if (!k) { k = cycle(cardById(t.k), t.d).key; invCache.set(t.id, k); }
  return k;
}
const isCredit = (t) => t.t === "out" && t.p === "credito" && !!t.k;
// mês em que o lançamento conta para resumo/metas (opção: compra no mês da compra ou da fatura)
const monthOf = (t) => (isCredit(t) && st().prefs.cardMonth === "invoice") ? invoiceOf(t) : t.m;

function monthStats(m) {
  let inc = 0, out = 0; const byCat = {}, bySub = {};
  const rows = [];
  for (const t of S.tx) {
    if (t.t !== "in" && t.t !== "out") continue;
    if (monthOf(t) !== m) continue;
    rows.push(t);
    if (t.t === "in") inc += t.v; else out += t.v;
    byCat[t.c] = (byCat[t.c] || 0) + t.v;
    const sk = t.c + "|" + (t.s || ""); bySub[sk] = (bySub[sk] || 0) + t.v;
  }
  return { rows, inc, out, byCat, bySub };
}
const planned = (type) => activeCats(type).reduce((a, c) => a + (c.budget || 0), 0);

function accDelta(t, id) {
  if (t.t === "in" && t.a === id) return t.v;
  if (t.t === "out" && t.a === id && t.p !== "credito") return -t.v;
  if (t.t === "transfer") { if (t.a === id) return -t.v; if (t.a2 === id) return t.v; }
  if (t.t === "pay" && t.a === id) return -t.v;
  return 0;
}
// o saldo informado vale para o momento em que foi informado: contam os lançamentos de dias
// posteriores e, no próprio dia, só os que foram lançados depois de informar o saldo
const counts = (acc, t) => !acc.since || t.d > acc.since || (t.d === acc.since && (t.at || 0) > (acc.setAt || 0));
function balance(acc, upto) {
  let b = acc.initial || 0;
  if (acc.since && upto < acc.since) {
    // antes do dia do saldo informado: calcula de trás para frente, tirando o que aconteceu entre a data e o saldo informado
    for (const t of S.tx) if (t.d > upto && !counts(acc, t)) b -= accDelta(t, acc.id);
    return b;
  }
  for (const t of S.tx) if (t.d <= upto && counts(acc, t)) b += accDelta(t, acc.id);
  return b;
}
function accMonthFlow(acc, m) {
  let inn = 0, out = 0;
  for (const t of S.tx) { if (t.m !== m) continue; const d = accDelta(t, acc.id); if (d > 0) inn += d; else out -= d; }
  return { inn, out };
}
function cardInfo(card) {
  const inv = {}, paid = {};
  let charged = 0, payments = 0;
  for (const t of S.tx) {
    if (isCredit(t) && t.k === card.id) { const k = invoiceOf(t); inv[k] = (inv[k] || 0) + t.v; charged += t.v; }
    else if (t.t === "pay" && t.k === card.id) { paid[t.f] = (paid[t.f] || 0) + t.v; payments += t.v; }
  }
  const today = todayISO();
  const openKey = cycle(card, today).key;
  const unpaid = card.closeDay ? Object.keys(inv).filter(k => k < openKey && inv[k] - (paid[k] || 0) > 0).sort() : [];
  const showKey = unpaid[0] || openKey;
  const amount = inv[showKey] || 0, remaining = amount - (paid[showKey] || 0);
  const dates = invoiceDates(card, showKey);
  let status, cls;
  if (showKey < openKey) {
    const n = daysBetween(today, dates.due || today);
    if (n < 0) { status = `Vencida há ${-n} dia${n === -1 ? "" : "s"}`; cls = "late"; }
    else { status = n === 0 ? "Fechada · vence hoje" : `Fechada · vence em ${n} dia${n === 1 ? "" : "s"}`; cls = "closed"; }
  } else if (amount > 0 && remaining <= 0) { status = "Paga"; cls = "paid"; }
  else if (dates.close) { const n = daysBetween(today, dates.close); status = n <= 0 ? "Fecha hoje" : `Aberta · fecha em ${n} dia${n === 1 ? "" : "s"}`; cls = "open"; }
  else { status = "Aberta"; cls = "open"; }
  const used = Math.max(0, charged - payments);
  const future = Object.keys(inv).filter(k => k > showKey).reduce((a, k) => a + inv[k] - (paid[k] || 0), 0);
  return { inv, paid, showKey, amount, remaining, dates, status, cls, used, available: card.limit ? card.limit - used : null, future, openKey };
}

// =====================================================================
// boot
// =====================================================================
const root = $("#root");
const ui = { error: (msg) => toast(msg) };
(async () => {
  try { S.store = await openStore(ui); }
  catch (e) { root.innerHTML = `<div class="login"><div class="card"><h2>Não foi possível iniciar</h2><p class="muted">${esc(e?.message || e)}</p><p class="small muted">Confira a appKey em js/config.js e a sua conexão com a internet.</p></div></div>`; return; }
  if (S.store.needsLogin) { renderLogin(); return; }
  readHash();
  await S.store.start(({ settings, tx, sync }) => {
    S.settings = normalizeSettings(settings); sortAll();
    S.tx = tx.filter(t => t && t.d).sort((a, b) => b.d.localeCompare(a.d) || (b.at || 0) - (a.at || 0));
    S.sync = sync; S.loaded = true;
    applyTheme(); clearCaches(); render();
  });
})();

function renderLogin() {
  root.innerHTML = `<div class="login"><div class="card">
    <div class="brand" style="padding:0"><i>R$</i>Minhas Finanças</div>
    <p class="muted" style="margin:0">Conecte sua conta do Dropbox, onde seus dados ficam guardados. Você só precisa fazer isso uma vez em cada aparelho.</p>
    <button class="btn" id="signin">Conectar ao Dropbox</button>
    <details id="codeBox" ${navigator.standalone ? "open" : ""} style="width:100%;text-align:left"><summary class="small muted" style="cursor:pointer">${navigator.standalone ? "No iPhone, conecte com um código:" : "Não voltou conectado (comum no iPhone)? Conectar com um código"}</summary>
      <div style="display:grid;gap:8px;margin-top:10px">
        <div class="small">1. <button class="link" id="codeOpen">Abrir o Dropbox para gerar o código</button><br>2. Autorize, copie o código que o Dropbox mostrar e cole aqui:</div>
        <div class="actions"><input class="field" id="codeIn" placeholder="Código do Dropbox" autocomplete="off" style="flex:1"><button class="btn sm" id="codeGo">Conectar</button></div>
      </div></details>
    <div class="err" id="loginErr"></div></div></div>`;
  $("#codeOpen").onclick = () => S.store.startCode().catch(e => { $("#loginErr").textContent = e.message; });
  $("#codeGo").onclick = async () => {
    const code = $("#codeIn").value.trim(); if (!code) return $("#codeIn").focus();
    try { await S.store.finishCode(code); location.reload(); } catch (e) { $("#loginErr").textContent = "Não foi possível conectar com esse código: " + (e?.message || e) + ". Gere um código novo e tente de novo."; }
  };
  $("#signin").onclick = async () => {
    try { await S.store.signIn(); } catch (e) { $("#loginErr").textContent = "Não foi possível conectar: " + (e?.message || e); }
  };
}

function applyTheme() {
  const t = st().prefs.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("mf-theme", t); } catch {}
}

// =====================================================================
// routing + shell
// =====================================================================
const VIEWS = { inicio: ["Início", "home"], lancamentos: ["Lançamentos", "list"], contas: ["Contas", "bank"], cartoes: ["Cartões", "card"], metas: ["Metas", "target"], fixas: ["Contas fixas", "repeat"], objetivos: ["Objetivos", "flag"], analise: ["Análise", "pie"], historico: ["Histórico", "chart"], cadastros: ["Categorias", "tag"], config: ["Configurações", "gear"] };
function readHash() { const h = location.hash.slice(1); S.view = VIEWS[h] ? h : "inicio"; S.pendingDel = null; S.editSub = null; }
addEventListener("hashchange", () => { readHash(); render(); scrollTo(0, 0); });
const go = (v) => { if (location.hash !== "#" + v) location.hash = v; else { readHash(); render(); } };

function render() {
  if (!S.loaded) return;
  const ae = document.activeElement, aeId = ae && root.contains(ae) ? ae.id : null;
  const sel = aeId && "selectionStart" in ae ? [ae.selectionStart, ae.selectionEnd, ae.value] : null;
  const syncTxt = { saved: "Salvo no Dropbox", saving: "Salvando…", offline: "Sem internet: salva depois", error: "Erro ao sincronizar: tentando de novo", local: "Modo local (só neste navegador)" }[S.sync] || "";
  const nav = (v) => `<a class="nav" href="#${v}" aria-current="${S.view === v ? "page" : "false"}">${icon(VIEWS[v][1])}${VIEWS[v][0]}</a>`;
  const th = st().prefs.theme;
  const body = { inicio: viewInicio, lancamentos: viewLanc, contas: viewContas, cartoes: viewCartoes, metas: viewMetas, fixas: viewFixas, objetivos: viewObjetivos, analise: viewAnalise, historico: viewHist, cadastros: viewCats, config: viewConfig }[S.view]();
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand"><i>R$</i>Minhas Finanças</div>
      <div class="grp">Dia a dia</div>${nav("inicio")}${nav("lancamentos")}${nav("contas")}${nav("cartoes")}
      <div class="grp">Planejar</div>${nav("metas")}${nav("fixas")}${nav("objetivos")}
      <div class="grp">Analisar</div>${nav("analise")}${nav("historico")}
      <div class="grp">Ajustes</div>${nav("cadastros")}${nav("config")}
      <div class="foot">
        <div class="sync ${S.sync}"><i></i>${esc(syncTxt)}</div>
        <div class="theme" role="group" aria-label="Tema">
          <button data-act="theme" data-v="light" aria-pressed="${th === "light"}">Claro</button>
          <button data-act="theme" data-v="dark" aria-pressed="${th === "dark"}">Escuro</button>
          <button data-act="theme" data-v="auto" aria-pressed="${th === "auto"}">Auto</button>
        </div>
      </div>
    </aside>
    <main class="main">${body}</main>
    <nav class="bnav" aria-label="Navegação">
      <a href="#inicio" aria-current="${S.view === "inicio" ? "page" : "false"}">${icon("home")}Início</a>
      <a href="#lancamentos" aria-current="${S.view === "lancamentos" ? "page" : "false"}">${icon("list")}Lançamentos</a>
      <button class="plus" data-act="new-tx" aria-label="Novo lançamento"><span>+</span></button>
      <a href="#metas" aria-current="${S.view === "metas" ? "page" : "false"}">${icon("target")}Metas</a>
      <button data-act="menu" aria-current="${["inicio", "lancamentos", "metas"].includes(S.view) ? "false" : "page"}">${icon("menu")}Mais</button>
    </nav></div>`;
  $("#fab").hidden = false;
  if (aeId) { const n = document.getElementById(aeId); if (n) { n.focus(); if (sel && n.value === sel[2]) try { n.setSelectionRange(sel[0], sel[1]); } catch {} } }
  root.querySelectorAll("table.stack").forEach(t => {
    const heads = [...t.querySelectorAll("thead th")].map(th => th.textContent.trim());
    t.querySelectorAll("tbody tr, tfoot tr").forEach(tr => { let i = 0; for (const td of tr.children) { if (!td.dataset.label && heads[i]) td.dataset.label = heads[i]; i += td.colSpan || 1; } });
  });
  if (S.view === "historico") wireHistChart();
  if (S.view === "metas") wireCatChart();
  if (S.view === "inicio") updateQuickPreview();
}

function topBar(title, withMonth = true) {
  return `<div class="top"><h1><span class="mtop-sync ${S.sync}" title="${esc({ saved: "Salvo no Dropbox", saving: "Salvando…", offline: "Sem internet", error: "Erro ao sincronizar", local: "Modo local" }[S.sync] || "")}"></span>${title}</h1>${withMonth ? `<div class="month">
    <div class="arrows"><button data-act="month" data-k="-1" aria-label="Mês anterior">‹</button><button data-act="month" data-k="1" aria-label="Próximo mês">›</button></div>
    <label class="lbl"><span>${esc(monthName(S.month))}</span>▾<input type="month" id="monthPick" value="${S.month}" aria-label="Escolher mês"></label>
    <button class="today ${S.month !== curMonth() ? "show" : ""}" data-act="month-today">Hoje</button></div>` : ""}</div>`;
}

// =====================================================================
// INÍCIO
// =====================================================================
function viewInicio() {
  const m = S.month, prev = addMonth(m, -1);
  const cur = monthStats(m), last = monthStats(prev);
  const pOut = planned("out"), pIn = planned("in");
  const res = cur.inc - cur.out;
  const delta = (a, b, goodWhenUp) => {
    const pm = monthName(prev, { month: "long" });
    if (!b) return `<span class="kpi s">sem dados de ${esc(pm)}</span>`;
    const p = Math.round((a - b) / b * 100); if (!p) return `<span class="kpi s">igual a ${esc(pm)}</span>`;
    const good = goodWhenUp ? p > 0 : p < 0;
    return `<span class="delta ${good ? "in-c" : "out-c"}">${p > 0 ? "↗" : "↘"} ${Math.abs(p)}% vs. ${esc(pm)}</span>`;
  };
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia!" : hour < 18 ? "Boa tarde!" : "Boa noite!";
  const usedPct = pct(cur.out, pOut);

  // saldo
  const accs = st().accounts;
  const today = todayISO(), mEnd = endOfMonth(m), mStart = m + "-01";
  const isPast = mEnd < today, isFuture = mStart > today;
  const sumBal = (d) => accs.reduce((a, x) => a + balance(x, d), 0);
  const balStart = sumBal(addDays(mStart, -1));
  const balNow = sumBal(isPast ? mEnd : today);
  const cardsAll = st().cards;
  const infos = new Map(cardsAll.map(k => [k.id, cardInfo(k)]));
  const dueThisMonth = cardsAll.reduce((a, k) => { const i = infos.get(k.id); return a + Math.max(0, (i.inv[m] || 0) - (i.paid[m] || 0)); }, 0);
  const pendRec = isPast ? [] : recPending(m).filter(x => !(x.r.t === "out" && x.r.p === "credito") && x.r.a);
  const pendNet = pendRec.reduce((a, x) => a + (x.r.t === "in" ? x.r.v : -x.r.v), 0);
  const balEnd = sumBal(mEnd) - (isPast ? 0 : dueThisMonth) + pendNet;
  const I = spendIdx();
  const overCats = activeCats("out").filter(c => c.budget && ((I.cat[c.id] || {})[m] || 0) > c.budget);
  const pendAll = recPending(m);

  // faturas do mês (vencimento no mês selecionado)
  const fatRows = activeCards().map(k => { const i = infos.get(k.id); const amt = i.inv[m] || 0; const d = invoiceDates(k, m); return { k, amt, paid: i.paid[m] || 0, due: d.due }; });
  const fatTotal = fatRows.reduce((a, r) => a + r.amt, 0);
  const future = activeCards().reduce((a, k) => a + Object.keys(infos.get(k.id).inv).filter(x => x > m).reduce((s, x) => s + infos.get(k.id).inv[x], 0), 0);
  const nextDue = fatRows.filter(r => r.due && r.amt - r.paid > 0).sort((a, b) => a.due.localeCompare(b.due))[0];

  return `${topBar("Início")}
  ${quickHTML()}
  ${onboardingHTML()}
  <section class="grid3">
    <div class="card">
      <div class="hello">
        <div class="greet"><h2 style="font-size:1.3rem">${greet}</h2><span class="muted small">Resumo de <span class="cap">${esc(monthName(m, { month: "long" }))}</span></span></div>
        <div class="kpi"><span class="label">Receitas do mês</span><span class="v in-c">${money(cur.inc)}</span>${delta(cur.inc, last.inc, true)}<span class="s">${pIn ? "previsto " + money(pIn) : "&nbsp;"}</span></div>
        <div class="kpi"><span class="label">Despesas do mês</span><span class="v out-c">${money(cur.out)}</span>${delta(cur.out, last.out, false)}<span class="s">${pOut ? "meta " + money(pOut) : "&nbsp;"}</span></div>
        <div class="kpi"><span class="label">Resultado</span><span class="v">${res >= 0 ? "+" : "−"}&nbsp;${money(Math.abs(res))}</span><span class="s">${res >= 0 ? "sobrou no mês" : "gastou mais do que recebeu"}</span></div>
      </div>
      ${pOut ? `<div style="display:grid;gap:6px">
        <div class="kv small"><span class="muted">Meta de despesas usada</span><b class="${cur.out > pOut ? "out-c" : ""}">${usedPct}% · ${cur.out > pOut ? money(cur.out - pOut) + " acima" : "restam " + money(pOut - cur.out)}</b></div>
        <div class="meter"><i style="width:${Math.min(100, usedPct)}%;${cur.out > pOut ? "background:var(--bad)" : ""}"></i></div>
        ${overCats.length ? `<div class="small"><span class="status late">▲ ${overCats.length} acima da meta</span> ${overCats.map(c => esc(c.name)).join(", ")} · <a class="link" href="#metas">ver metas</a></div>` : ""}</div>`
      : `<div class="small muted">Defina metas por categoria em <a class="link" href="#cadastros">Categorias</a> para acompanhar o orçamento.</div>`}
    </div>
    <div class="card">
      ${accs.length ? `
      <div class="big"><span class="label">${isPast ? "Saldo no fim do mês" : isFuture ? "Saldo hoje" : "Saldo geral das contas"}</span><span class="v ${balNow < 0 ? "out-c" : ""}">${moneyS(balNow)}</span>
        <span class="muted small">${accs.length} conta${accs.length > 1 ? "s" : ""} · no início do mês: ${moneyS(balStart)}</span></div>
      ${isPast ? "" : `<div class="big grey"><span class="label">Previsto no fim do mês</span><span class="v ${balEnd < 0 ? "out-c" : ""}">${moneyS(balEnd)}</span><span class="muted small">${[dueThisMonth ? money(dueThisMonth) + " de faturas" : "", pendRec.length ? `${pendRec.length} conta${pendRec.length > 1 ? "s" : ""} fixa${pendRec.length > 1 ? "s" : ""} a efetivar` : ""].filter(Boolean).join(" e ") ? "considerando " + [dueThisMonth ? money(dueThisMonth) + " de faturas" : "", pendRec.length ? `${pendRec.length} conta${pendRec.length > 1 ? "s" : ""} fixa${pendRec.length > 1 ? "s" : ""} a efetivar` : ""].filter(Boolean).join(" e ") : "com os lançamentos já feitos"}</span></div>`}`
      : `<div class="big"><span class="label">Saldo geral das contas</span><span class="v muted">—</span><span class="muted small">Cadastre suas contas para ver o saldo.</span></div>`}
    </div>
    <div class="card">
      <div class="big red"><span class="label">Faturas de ${esc(monthName(m, { month: "long" }))}</span><span class="v out-c">${money(fatTotal)}</span>
        <span class="muted small">${activeCards().length ? `${activeCards().length} cartão${activeCards().length > 1 ? "es" : ""}${nextDue ? " · próximo vencimento " + dm(nextDue.due) : ""}` : "Nenhum cartão cadastrado"}</span></div>
      <div style="display:grid;gap:8px">
        ${fatRows.map(r => `<div class="kv"><span>${esc(r.k.name)}${r.due ? ` · vence ${dm(r.due)}` : ""}</span><b>${r.amt && r.paid >= r.amt ? `<span class="muted">paga</span>` : money(r.amt)}</b></div>`).join("")}
        ${future ? `<div class="kv muted"><span>Parcelas e faturas futuras</span><b>${money(future)}</b></div>` : ""}
      </div>
    </div>
  </section>
  <section class="grid2">
    <div class="card">
      <div class="card-head"><h2>Minhas contas</h2><a class="link" href="#contas">Ver contas</a></div>
      ${accs.filter(a => !a.archived).length ? `<div>${activeAccs().map(a => {
        const f = accMonthFlow(a, m); const b = balance(a, isPast ? mEnd : today); const net = f.inn - f.out;
        return `<div class="acct"><span class="mono" style="background:${esc(a.color)}">${esc(initials(a.name))}</span><span><b>${esc(a.name)}</b><small>${esc((ACC_TYPES.find(x => x[0] === a.type) || [, ""])[1])}</small></span>
          <span class="bal ${b < 0 ? "out-c" : ""}">${moneyS(b)}<small class="${net > 0 ? "in-c" : "muted"}">${net ? (net > 0 ? "+" : "−") + money(Math.abs(net)) + " no mês" : "sem movimento no mês"}</small></span></div>`;
      }).join("")}</div>` : `<div class="empty"><span>Nenhuma conta ainda.</span><a class="btn sm" href="#contas">Cadastrar conta</a></div>`}
    </div>
    <div class="card">
      <div class="card-head"><h2>Meus cartões</h2><a class="link" href="#cartoes">Ver cartões</a></div>
      ${activeCards().length ? activeCards().map(k => cardBoxHTML(k, infos.get(k.id), true)).join("") : `<div class="empty"><span>Nenhum cartão ainda.</span><a class="btn sm" href="#cartoes">Cadastrar cartão</a></div>`}
    </div>
  </section>
  <section class="grid2">
    <div class="card">
      <div class="card-head"><h2>Contas fixas a efetivar</h2><a class="link" href="#fixas">Ver contas fixas</a></div>
      ${pendAll.length ? pendingHTML(m, 6) : (st().recurring || []).length ? `<div class="muted small">Todas as contas fixas de ${esc(monthName(m, { month: "long" }))} já foram efetivadas.</div>`
        : `<div class="muted small">Cadastre o que se repete todo mês (aluguel, internet, academia, salário) em <a class="link" href="#fixas">Contas fixas</a>, ou marque <b>Conta fixa</b> ao lançar. Todo mês elas aparecem aqui para você só clicar em <b>Efetivar</b>.</div>`}
    </div>
    <div class="card">
      <div class="card-head"><h2>Objetivos</h2><a class="link" href="#objetivos">Ver objetivos</a></div>
      ${(st().goals || []).length ? (st().goals || []).filter(g => !g.done).slice(0, 4).map(g => goalCardHTML(g, true)).join("") || `<div class="muted small">Todos os objetivos foram alcançados.</div>`
        : `<div class="muted small">Crie objetivos como uma viagem ou a reserva de emergência e acompanhe quanto falta.</div>`}
    </div>
  </section>
  ${divisaoHTML()}
  <section class="card">
    <div class="card-head"><h2>Últimos lançamentos</h2><a class="link" href="#lancamentos">Ver todos de <span class="cap">${esc(monthName(m, { month: "long" }))}</span></a></div>
    ${txTableHTML(S.tx.filter(t => t.m === m).slice(0, 8), false) || `<div class="muted">Nada lançado em ${esc(monthName(m))}. Use a barra acima ou o botão <b>+ Lançar</b>.</div>`}
  </section>`;
}

function onboardingHTML() {
  const parts = [];
  if (!st().categories.length) parts.push(`<section class="card welcome"><h2>Comece pelas categorias</h2>
    <p>Categorias organizam seus gastos e receitas. Use a lista sugerida (já com subcategorias) e ajuste depois, ou importe os dados da versão anterior em Configurações.</p>
    <div class="actions"><button class="btn" data-act="seed">Usar categorias sugeridas</button><a class="btn ghost" href="#config">Importar dados da versão anterior</a></div></section>`);
  if (!st().accounts.length) parts.push(`<section class="card welcome"><h2>Cadastre suas contas bancárias</h2>
    <p>Informe o saldo de hoje de cada conta, como aparece no app do banco. A partir daí o saldo é calculado sozinho com os seus lançamentos.</p>
    <form class="formgrid" data-form="acc-quick" autocomplete="off">
      <label>Nome da conta<input class="field" name="name" id="oa-name" placeholder="Ex.: Nubank, Inter, Santander"></label>
      <label>Saldo hoje<span class="money-field"><input class="field" name="initial" id="oa-bal" inputmode="decimal" placeholder="0,00"></span></label>
      <button class="btn" type="submit">Adicionar conta</button></form></section>`);
  return parts.join("");
}

// ---------- divisão de gastos ----------
const PERIOD_N = { mes: 1, bim: 2, tri: 3, sem: 6, ano: 12 };
const PERIOD_LBL = { mes: "Mês", bim: "Bimestre", tri: "Trimestre", sem: "Semestre", ano: "Ano" };
function periodStartFor(mode, m) { const n = PERIOD_N[mode]; const [y, mo] = m.split("-").map(Number); return `${y}-${pad(Math.floor((mo - 1) / n) * n + 1)}`; }
function periodLabel(mode, start) {
  const [y, mo] = start.split("-").map(Number); const n = PERIOD_N[mode]; const idx = Math.floor((mo - 1) / n) + 1;
  if (mode === "mes") return monthName(start);
  if (mode === "ano") return String(y);
  const name = { bim: "bimestre", tri: "trimestre", sem: "semestre" }[mode];
  return `${idx}º ${name} ${y} (${shortMonth(start)}–${shortMonth(addMonth(start, n - 1))})`;
}
function divisaoHTML() {
  const mode = S.period.mode, n = PERIOD_N[mode];
  const start = S.period.start || periodStartFor(mode, S.month);
  const months = Array.from({ length: n }, (_, i) => addMonth(start, i));
  const mset = new Set(months);
  const anchor = periodStartFor(mode, S.month > curMonth() ? S.month : curMonth());
  const opts = Array.from({ length: 8 }, (_, i) => addMonth(anchor, -i * n));
  if (!opts.includes(start)) opts.unshift(start);
  let inc = 0, out = 0; const byCat = {}, bySub = {};
  for (const t of S.tx) {
    if ((t.t !== "in" && t.t !== "out") || !mset.has(monthOf(t))) continue;
    if (t.t === "in") { inc += t.v; continue; }
    out += t.v; byCat[t.c] = (byCat[t.c] || 0) + t.v;
    const sk = t.c + "|" + (t.s || ""); bySub[sk] = (bySub[sk] || 0) + t.v;
  }
  const rows = st().categories.filter(c => c.type === "out" && (byCat[c.id] || (!c.archived && c.budget))).map(c => ({ c, v: byCat[c.id] || 0, goal: (c.budget || 0) * n }));
  if (S.divSort === "valor") rows.sort((a, b) => b.v - a.v || cmpName(a.c, b.c));
  const max = Math.max(1, ...rows.map(r => Math.max(r.v, r.goal)));
  const bars = rows.map(({ c, v, goal }) => {
    const open = S.expanded.has(c.id);
    let h = `<button class="n" data-act="expand" data-id="${esc(c.id)}" title="Ver subcategorias">${open ? "▾" : "▸"} ${esc(c.name)}</button>
      <span class="t"><i style="width:${v / max * 100}%"></i>${goal ? `<u style="left:calc(${Math.min(100, goal / max * 100)}% - 1px)"></u>` : ""}</span>
      <span class="v ${goal && v > goal ? "over" : ""}">${money0(v)}<small>${pct(v, out)}%</small></span>`;
    if (open) {
      const subs = Object.entries(bySub).filter(([k]) => k.startsWith(c.id + "|")).map(([k, sv]) => [k.split("|")[1], sv]).sort((a, b) => b[1] - a[1]);
      h += subs.length ? subs.map(([sid, sv]) => `<span class="subn">${esc(sid ? (subOf(c, sid)?.name || "Removida") : "Sem subcategoria")}</span><span class="t"><i class="sub" style="width:${sv / max * 100}%"></i></span><span class="v small">${money0(sv)}<small>${pct(sv, v)}%</small></span>`).join("")
        : `<span class="subn">Sem gastos no período</span><span></span><span></span>`;
    }
    return h;
  }).join("");
  const res = inc - out, hmax = Math.max(1, inc, out, Math.abs(res));
  return `<section class="grid21">
    <div class="card">
      <div class="card-head"><h2>Divisão de gastos</h2>
        <div class="actions">
          <div class="seg" role="group" aria-label="Período">${Object.keys(PERIOD_N).map(k => `<button data-act="pmode" data-v="${k}" aria-pressed="${mode === k}">${PERIOD_LBL[k]}</button>`).join("")}</div>
          <select class="field" id="pstart" style="width:auto" aria-label="Escolher período">${opts.map(o => `<option value="${o}" ${o === start ? "selected" : ""}>${esc(periodLabel(mode, o))}</option>`).join("")}</select>
        </div></div>
      ${rows.length ? `<div class="hbars">${bars}</div>` : `<div class="empty"><span>Nenhum gasto no período.</span></div>`}
      <div class="legend"><span><i class="sw" style="background:var(--out)"></i>Gasto</span><span><i class="sw" style="background:var(--fg);width:2px;height:12px"></i>Meta do período</span>
        <span>Total ${money(out)}</span><span>Ordenar: <button class="link" data-act="divsort">${S.divSort === "valor" ? "por valor" : "A–Z"}</button></span><span>Clique na categoria para ver as subcategorias</span></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Resultado do período</h2><span class="muted small cap">${esc(periodLabel(mode, start))}</span></div>
      <div class="vbars">
        <div><span class="in-c">${money0(inc)}</span><i style="height:${inc / hmax * 130}px;background:var(--in)"></i></div>
        <div><span class="out-c">${money0(out)}</span><i style="height:${out / hmax * 130}px;background:var(--out)"></i></div>
        <div><span>${res < 0 ? "−" : ""}${money0(Math.abs(res))}</span><i style="height:${Math.abs(res) / hmax * 130}px;background:${res < 0 ? "var(--bad)" : "var(--accent)"}"></i></div>
      </div>
      <div class="vlabels"><span>Receitas</span><span>Despesas</span><span>${res < 0 ? "Faltou" : "Sobrou"}</span></div>
      <div class="muted small">${inc ? (res >= 0 ? `Você guardou ${pct(res, inc)}% do que recebeu no período.` : `Os gastos passaram as receitas em ${money(-res)}.`) : "Sem receitas lançadas no período."}</div>
    </div>
  </section>`;
}

// ---------- cartões (box) ----------
function cardBoxHTML(k, info, compact) {
  const acc = accById(k.payAccount);
  const usedPct = k.limit ? Math.min(100, info.used / k.limit * 100) : 0;
  const curPct = k.limit ? Math.min(usedPct, info.remaining / k.limit * 100) : 0;
  return `<div class="cardbox">
    <div class="h"><span style="display:flex;gap:10px;align-items:center"><span class="mono" style="background:${esc(k.color)};width:32px;height:32px;border-radius:9px;font-size:.75rem">${esc(initials(k.name))}</span><span><b>${esc(k.name)}</b>${acc ? ` <span class="muted small">· paga pela conta ${esc(acc.name)}</span>` : ""}</span></span>
      <span class="status ${info.cls}">${esc(info.status)}</span></div>
    <div class="cgrid">
      <div><span>Fatura <span class="cap">${esc(shortMonth(info.showKey))}</span></span><strong class="${info.remaining > 0 ? "out-c" : ""}">${money(info.amount)}</strong></div>
      <div><span>Limite disponível</span><strong>${info.available === null ? "—" : moneyS(info.available)}</strong></div>
      <div><span>Fechamento</span><strong>${k.closeDay ? "dia " + k.closeDay : "—"}</strong></div>
      <div><span>Vencimento</span><strong>${k.dueDay ? "dia " + k.dueDay : "—"}</strong></div>
    </div>
    ${k.limit ? `<div class="meter" title="Fatura atual e demais valores em aberto"><i style="width:${usedPct}%;background:var(--out);opacity:.45"></i><i class="b" style="width:${curPct}%"></i></div>` : ""}
    ${!k.closeDay ? `<div class="info warn small">Informe o dia de fechamento e de vencimento para o sistema saber em qual fatura cai cada compra. <button class="link" data-act="card-edit" data-id="${esc(k.id)}">Completar cartão</button></div>` : ""}
    <div class="actions" style="justify-content:space-between">
      <span class="muted small">${info.future ? "Próximas faturas: " + money(info.future) : ""}</span>
      <span class="actions">${compact ? "" : `<button class="small-btn" data-act="card-edit" data-id="${esc(k.id)}">Editar</button>`}<button class="small-btn" data-act="invoice" data-id="${esc(k.id)}">Ver fatura</button>${info.remaining > 0 ? `<button class="btn sm" data-act="pay" data-id="${esc(k.id)}">Registrar pagamento</button>` : ""}</span>
    </div></div>`;
}

// ---------- tabela de lançamentos ----------
function srcHTML(t) {
  if (t.t === "transfer") { const a = accById(t.a), b = accById(t.a2); return `<span class="src">${monoSm(a)}${esc(a?.name || "?")} → ${esc(b?.name || "?")}</span>`; }
  if (t.t === "pay") { const a = accById(t.a); return `<span class="src">${monoSm(a)}${esc(a?.name || "Conta não informada")}</span>`; }
  if (t.p === "credito") { const k = cardById(t.k); return `<span class="src">${k ? `<span class="mono sm" style="background:${esc(k.color)}">${esc(initials(k.name))}</span>Crédito ${esc(k.name)}` : "Crédito"}</span>`; }
  const a = accById(t.a);
  const txt = [a ? (t.t === "in" ? "Entrou em " : "") + a.name : (t.t === "in" ? "" : "Conta não informada"), payName(t.p)].filter(Boolean).join(" · ");
  return `<span class="src">${monoSm(a)}${esc(txt || "—")}</span>`;
}
const monoSm = (a) => a ? `<span class="mono sm" style="background:${esc(a.color)}">${esc(initials(a.name))}</span>` : "";
function txTitle(t) {
  const c = catById(t.c);
  if (t.t === "transfer") return t.n || "Transferência";
  if (t.t === "pay") return t.n || `Pagamento da fatura ${cardById(t.k)?.name || ""}`;
  return t.n || subOf(c, t.s)?.name || c?.name || "Sem categoria";
}
function catLabel(t) {
  if (t.t === "transfer") return `<span class="muted">Transferência entre contas</span>`;
  if (t.t === "pay") return `<span class="muted">Fatura de <span class="cap">${esc(monthName(t.f || t.m, { month: "short", year: "numeric" }))}</span></span>`;
  const c = catById(t.c); return esc(c ? c.name + (subOf(c, t.s) ? " › " + subOf(c, t.s).name : "") : "Sem categoria");
}
function amtHTML(t) {
  if (t.t === "in") return `<span class="amt-in">+ ${money(t.v)}</span>`;
  if (t.t === "transfer") return `<span class="amt-neutral">${money(t.v)}</span>`;
  return `<span class="amt-out">− ${money(t.v)}</span>`;
}
function txTableHTML(list, groupByDay) {
  if (!list.length) return "";
  let lastDay = "";
  const rows = list.map(t => {
    let pre = "";
    if (groupByDay && t.d !== lastDay) { lastDay = t.d; pre = `<tr class="dayrow"><td colspan="${groupByDay ? 4 : 5}">${dm(t.d)} · ${esc(weekday(t.d))}</td></tr>`; }
    return pre + `<tr class="click" data-act="edit" data-id="${esc(t.id)}">
      ${groupByDay ? "" : `<td class="num c-date">${dm(t.d)}</td>`}
      <td class="c-title"><b>${esc(txTitle(t))}</b>${t.pn > 1 ? `<span class="tag">${t.pi}/${t.pn}</span>` : ""}${t.o ? `<span class="note">${esc(t.o)}</span>` : ""}</td>
      <td class="c-cat">${catLabel(t)}</td><td class="c-src">${srcHTML(t)}</td><td class="r c-val">${amtHTML(t)}</td></tr>`;
  }).join("");
  return `<div class="tablewrap"><table class="txt"><thead><tr>${groupByDay ? "" : "<th>Data</th>"}<th>Onde / descrição</th><th>Categoria</th><th>Conta / cartão</th><th class="r">Valor</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// =====================================================================
// LANÇAMENTOS
// =====================================================================
function viewLanc() {
  const q = norm(S.search);
  if (!q && S.lancMode === "extrato") return `${topBar("Lançamentos")}
  <section class="card">
    <div class="search"><input class="field" id="search" type="search" placeholder="Pesquisar em todos os meses: Mercado Livre, farmácia, 45,90…" value="" autocomplete="off"></div>
    <div class="seg"><button data-act="lanc-mode" data-v="lista" aria-pressed="false">Lista</button><button data-act="lanc-mode" data-v="extrato" aria-pressed="true">Extrato com saldo dia a dia</button></div>
    ${extratoHTML(S.month)}
  </section>`;
  let list;
  if (q) {
    const qv = parseMoney(S.search);
    list = S.tx.filter(t => {
      const c = catById(t.c);
      const hay = norm([t.n, t.o, c?.name, subOf(c, t.s)?.name, cardById(t.k)?.name, accById(t.a)?.name, payName(t.p)].join(" "));
      return hay.includes(q) || (qv && t.v === qv);
    });
  } else list = S.tx.filter(t => t.m === S.month);
  const base = list;
  const f = S.txFilter;
  list = list.filter(t => f === "all" || (f === "in" && t.t === "in") || (f === "out" && t.t === "out") || (f === "mov" && (t.t === "transfer" || t.t === "pay"))
    || t.c === f || (f.startsWith("card:") && t.p === "credito" && t.k === f.slice(5)) || (f.startsWith("acc:") && (t.a === f.slice(4) || t.a2 === f.slice(4))));
  const inc = list.filter(t => t.t === "in").reduce((a, t) => a + t.v, 0), out = list.filter(t => t.t === "out").reduce((a, t) => a + t.v, 0);
  const usedCats = [...new Set(base.filter(t => t.c).map(t => t.c))].map(catById).filter(Boolean).sort(cmpName);
  const usedCards = [...new Set(base.filter(t => t.p === "credito" && t.k).map(t => t.k))].map(cardById).filter(Boolean);
  const usedAccs = [...new Set(base.flatMap(t => [t.a, t.a2]).filter(Boolean))].map(accById).filter(Boolean);
  const chip = (v, label) => `<button class="chip" data-act="filter" data-v="${esc(v)}" aria-pressed="${f === v}">${esc(label)}</button>`;
  return `${topBar("Lançamentos", !q)}
  <section class="card">
    <div class="search"><input class="field" id="search" type="search" placeholder="Pesquisar em todos os meses: Mercado Livre, farmácia, 45,90…" value="${esc(S.search)}" autocomplete="off">
      ${q ? `<span class="muted small">${list.length} resultado${list.length === 1 ? "" : "s"} em todos os meses</span>` : ""}</div>
    <div class="filters">${chip("all", "Todos")}${chip("out", "Despesas")}${chip("in", "Receitas")}${chip("mov", "Transferências e faturas")}
      ${usedCats.length ? `<span class="sep"></span>` + usedCats.map(c => chip(c.id, c.name)).join("") : ""}
      ${usedAccs.length || usedCards.length ? `<span class="sep"></span>` + usedAccs.map(a => chip("acc:" + a.id, a.name)).join("") + usedCards.map(k => chip("card:" + k.id, "Crédito " + k.name)).join("") : ""}</div>
    ${!q ? `<div class="seg"><button data-act="lanc-mode" data-v="lista" aria-pressed="${S.lancMode !== "extrato"}">Lista</button><button data-act="lanc-mode" data-v="extrato" aria-pressed="${S.lancMode === "extrato"}">Extrato com saldo dia a dia</button></div>` : ""}
    ${!q && recPending(S.month).length ? `<div class="info"><b>Contas fixas ainda não efetivadas neste mês</b>${pendingHTML(S.month)}</div>` : ""}
    <div class="kv small"><span class="muted">${list.length} lançamento${list.length === 1 ? "" : "s"}</span><span>Receitas <b class="in-c">${money(inc)}</b> · Despesas <b class="out-c">${money(out)}</b></span></div>
    ${txTableHTML(list, true) || `<div class="empty"><h3>Nenhum lançamento</h3><span>${q ? "Nada encontrado com essa pesquisa." : "Use o botão + Lançar."}</span></div>`}
    <div class="muted small">Clique num lançamento para editar, duplicar ou apagar.</div>
  </section>`;
}

// =====================================================================
// CONTAS
// =====================================================================
function viewContas() {
  const m = S.month, today = todayISO(), mEnd = endOfMonth(m), isPast = mEnd < today;
  const accs = st().accounts;
  let tIn = 0, tOut = 0, tBal = 0, tEnd = 0;
  // faturas que vencem no mês e ainda não foram pagas saem da conta que paga o cartão
  const dueBy = {};
  if (!isPast) for (const k of st().cards) { const i = cardInfo(k); const r = (i.inv[m] || 0) - (i.paid[m] || 0); if (r > 0 && k.payAccount) dueBy[k.payAccount] = (dueBy[k.payAccount] || 0) + r; }
  const rows = activeAccs().map(a => {
    const f = accMonthFlow(a, m), b = balance(a, isPast ? mEnd : today), e = balance(a, mEnd) - (dueBy[a.id] || 0);
    tIn += f.inn; tOut += f.out; tBal += b; tEnd += e;
    return `<tr class="click ${S.editAcc === a.id ? "sel" : ""}" data-act="acc-edit" data-id="${esc(a.id)}"><td><span class="src"><span class="mono sm" style="background:${esc(a.color)}">${esc(initials(a.name))}</span><b>${esc(a.name)}</b></span></td>
      <td class="muted">${esc((ACC_TYPES.find(x => x[0] === a.type) || [, ""])[1])}</td><td class="r in-c">${money(f.inn)}</td><td class="r">${money(f.out)}</td>
      <td class="r"><b class="${b < 0 ? "out-c" : ""}">${moneyS(b)}</b></td><td class="r muted" title="${dueBy[a.id] ? "Já descontando " + money(dueBy[a.id]) + " de fatura" : ""}">${moneyS(e)}${dueBy[a.id] ? `<small>− ${money(dueBy[a.id])} de fatura</small>` : ""}</td></tr>`;
  }).join("");
  const noAcc = S.tx.filter(t => (t.t === "in" || (t.t === "out" && t.p !== "credito")) && !t.a);
  const ed = S.editAcc === "new" ? { id: "new", name: "", type: "corrente", initial: 0, since: todayISO(), color: COLORS[accs.length % COLORS.length] } : accById(S.editAcc);
  const archived = accs.filter(a => a.archived);
  return `${topBar("Contas")}
  <section class="card">
    <div class="card-head"><h2>Saldos das contas</h2><button class="btn sm" data-act="acc-edit" data-id="new">+ Nova conta</button></div>
    ${rows ? `<div class="tablewrap"><table class="stack"><thead><tr><th>Conta</th><th>Tipo</th><th class="r">Entradas no mês</th><th class="r">Saídas no mês</th><th class="r">${isPast ? "Saldo no fim do mês" : "Saldo atual"}</th><th class="r">Previsto fim do mês</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td colspan="2">Total</td><td class="r in-c">${money(tIn)}</td><td class="r">${money(tOut)}</td><td class="r">${moneyS(tBal)}</td><td class="r">${moneyS(tEnd)}</td></tr></tfoot></table></div>
      <div class="muted small">Saídas incluem débitos, Pix, transferências enviadas e pagamentos de fatura. Compras no crédito só saem da conta quando a fatura é paga. Clique numa conta para editar.</div>`
    : `<div class="empty"><h3>Nenhuma conta cadastrada</h3><span>Clique em <b>+ Nova conta</b> e informe o saldo de hoje.</span></div>`}
  </section>
  ${ed ? accFormHTML(ed) : ""}
  ${noAcc.length && activeAccs().length ? `<section class="card"><h2>Lançamentos sem conta</h2>
    <div class="muted small" style="margin-top:-6px">${noAcc.length} lançamento${noAcc.length > 1 ? "s" : ""} (débito, Pix, dinheiro ou receitas) ainda não indica${noAcc.length > 1 ? "m" : ""} de qual conta saiu ou em qual entrou. Eles não mexem no saldo de nenhuma conta. Se quiser, atribua todos a uma conta de uma vez.</div>
    <div class="actions"><select class="field" id="assignAcc" style="width:auto">${activeAccs().map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select><button class="btn ghost sm" data-act="assign-acc">Atribuir os ${noAcc.length} a esta conta</button></div></section>` : ""}
  ${archived.length ? `<section class="card"><h2>Contas arquivadas</h2>${archived.map(a => `<div class="kv"><span>${esc(a.name)}</span><button class="small-btn" data-act="acc-unarchive" data-id="${esc(a.id)}">Restaurar</button></div>`).join("")}</section>` : ""}
  ${transferHint()}`;
}
const transferHint = () => activeAccs().length > 1 ? `<div class="muted small">Para mover dinheiro entre suas contas, use <b>+ Lançar → Transferência</b>. Transferências não contam como despesa nem receita.</div>` : "";
function accFormHTML(a) {
  const used = a.id !== "new" && S.tx.some(t => t.a === a.id || t.a2 === a.id);
  return `<section class="card"><div class="card-head"><h2>${a.id === "new" ? "Nova conta" : "Editar " + esc(a.name)}</h2><button class="small-btn" data-act="acc-cancel">Fechar</button></div>
    <form class="formgrid" data-form="acc" data-id="${esc(a.id)}" autocomplete="off">
      <label>Nome<input class="field" name="name" id="af-name" value="${esc(a.name)}" placeholder="Ex.: Nubank" required></label>
      <label>Tipo<select class="field" name="type" id="af-type">${ACC_TYPES.map(([k, n]) => `<option value="${k}" ${a.type === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Saldo<span class="money-field"><input class="field" name="initial" id="af-initial" inputmode="decimal" value="${esc(centsToInput(Math.abs(a.initial)))}" placeholder="0,00"></span></label>
      <label>Saldo negativo?<select class="field" name="neg" id="af-neg"><option value="0" ${a.initial >= 0 ? "selected" : ""}>Não</option><option value="1" ${a.initial < 0 ? "selected" : ""}>Sim (cheque especial)</option></select></label>
      <label>Saldo informado em<input class="field" type="date" name="since" id="af-since" value="${esc(a.since || todayISO())}"></label>
      <label>Cor<select class="field" name="color" id="af-color">${COLORS.map((c, i) => `<option value="${c}" ${a.color === c ? "selected" : ""} style="color:${c}">● Cor ${i + 1}</option>`).join("")}</select></label>
      <button class="btn" type="submit">Salvar conta</button>
    </form>
    <div class="muted small">Informe o saldo como aparece no app do banco. A partir daí, tudo o que você lançar nessa conta (com data a partir desse dia) mexe no saldo. Lançamentos de dias anteriores não mexem, porque já estão no saldo informado.</div>
    ${a.id !== "new" ? `<div><button class="small-btn bad" data-act="acc-del" data-id="${esc(a.id)}">${used ? "Arquivar conta" : "Excluir conta"}</button></div>` : ""}</section>`;
}

// =====================================================================
// CARTÕES
// =====================================================================
function viewCartoes() {
  const cards = activeCards();
  const ed = S.editCard === "new" ? { id: "new", name: "", limit: 0, closeDay: "", dueDay: "", payAccount: activeAccs()[0]?.id || "", color: COLORS[(st().cards.length + 3) % COLORS.length] } : cardById(S.editCard);
  const infos = new Map(cards.map(k => [k.id, cardInfo(k)]));
  const totAvail = cards.reduce((a, k) => a + (infos.get(k.id).available ?? 0), 0);
  const totFat = cards.reduce((a, k) => a + infos.get(k.id).remaining, 0);
  return `${topBar("Cartões", false)}
  <div class="actions" style="justify-content:space-between"><span class="muted small">${cards.length ? `Limite disponível somado: <b>${money(totAvail)}</b> · Faturas a pagar: <b class="out-c">${money(totFat)}</b>` : ""}</span><button class="btn sm" data-act="card-edit" data-id="new">+ Novo cartão</button></div>
  ${ed ? cardFormHTML(ed) : ""}
  <section class="grid2">${cards.map(k => cardBoxHTML(k, infos.get(k.id), false)).join("") || `<div class="card"><div class="empty"><h3>Nenhum cartão</h3><span>Cadastre seus cartões com limite, fechamento e vencimento.</span></div></div>`}</section>
  ${S.invoice && cardById(S.invoice.k) ? invoiceHTML() : ""}
  ${st().cards.some(k => k.archived) ? `<section class="card"><h2>Cartões arquivados</h2>${st().cards.filter(k => k.archived).map(k => `<div class="kv"><span>${esc(k.name)}</span><button class="small-btn" data-act="card-unarchive" data-id="${esc(k.id)}">Restaurar</button></div>`).join("")}</section>` : ""}`;
}
function cardFormHTML(k) {
  const used = k.id !== "new" && S.tx.some(t => t.k === k.id);
  return `<section class="card"><div class="card-head"><h2>${k.id === "new" ? "Novo cartão" : "Editar " + esc(k.name)}</h2><button class="small-btn" data-act="card-cancel">Fechar</button></div>
    <form class="formgrid" data-form="card" data-id="${esc(k.id)}" autocomplete="off">
      <label>Nome<input class="field" name="name" id="cf-name" value="${esc(k.name)}" placeholder="Ex.: Nubank" required></label>
      <label>Limite total<span class="money-field"><input class="field" name="limit" id="cf-limit" inputmode="decimal" value="${esc(centsToInput(k.limit))}" placeholder="0,00"></span></label>
      <label>Dia do fechamento<input class="field" type="number" min="1" max="31" name="closeDay" id="cf-close" value="${esc(k.closeDay || "")}" placeholder="Ex.: 8"></label>
      <label>Dia do vencimento<input class="field" type="number" min="1" max="31" name="dueDay" id="cf-due" value="${esc(k.dueDay || "")}" placeholder="Ex.: 15"></label>
      <label>Fatura paga pela conta<select class="field" name="payAccount" id="cf-acc"><option value="">—</option>${activeAccs().map(a => `<option value="${esc(a.id)}" ${k.payAccount === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
      <label>Cor<select class="field" name="color" id="cf-color">${COLORS.map((c, i) => `<option value="${c}" ${k.color === c ? "selected" : ""} style="color:${c}">● Cor ${i + 1}</option>`).join("")}</select></label>
      <button class="btn" type="submit">Salvar cartão</button>
    </form>
    <div class="muted small">Compras feitas no dia do fechamento ou depois entram na fatura seguinte.</div>
    ${k.id !== "new" ? `<div><button class="small-btn bad" data-act="card-del" data-id="${esc(k.id)}">${used ? "Arquivar cartão" : "Excluir cartão"}</button></div>` : ""}</section>`;
}
function invoiceHTML() {
  const k = cardById(S.invoice.k), key = S.invoice.key;
  const items = S.tx.filter(t => isCredit(t) && t.k === k.id && invoiceOf(t) === key);
  const pays = S.tx.filter(t => t.t === "pay" && t.k === k.id && t.f === key);
  const total = items.reduce((a, t) => a + t.v, 0), paid = pays.reduce((a, t) => a + t.v, 0);
  const d = invoiceDates(k, key);
  const byCat = {}; for (const t of items) byCat[t.c] = (byCat[t.c] || 0) + t.v;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cats.map(c => c[1]));
  return `<section class="card" id="fatura">
    <div class="card-head"><h2>Fatura ${esc(k.name)} · <span class="cap">${esc(monthName(key))}</span></h2>
      <div class="month"><div class="arrows"><button data-act="inv-nav" data-k="-1" aria-label="Fatura anterior">‹</button><button data-act="inv-nav" data-k="1" aria-label="Próxima fatura">›</button></div><button class="small-btn" data-act="inv-close">Fechar</button></div></div>
    <div class="kv"><span class="muted">${d.close ? `Fecha em ${dm(d.close)} · ` : ""}${d.due ? `vence em ${dm(d.due)}` : ""}</span><span>Total <b class="out-c">${money(total)}</b>${paid ? ` · pago <b>${money(paid)}</b>` : ""}${total - paid > 0 ? ` · falta <b>${money(total - paid)}</b>` : ""}</span></div>
    <div class="grid21" style="gap:20px">
      <div>${txTableHTML(items, false) || `<div class="muted">Nenhuma compra nesta fatura.</div>`}
        ${pays.length ? `<div class="label" style="margin:12px 0 4px">Pagamentos</div>${txTableHTML(pays, false)}` : ""}</div>
      <div style="display:grid;gap:8px;align-content:start"><div class="label">Por categoria</div>
        <div class="hbars" style="grid-template-columns:minmax(80px,120px) minmax(0,1fr) auto">${cats.map(([cid, v]) => `<span class="n">${esc(catById(cid)?.name || "Sem categoria")}</span><span class="t"><i style="width:${v / max * 100}%"></i></span><span class="v">${money0(v)}<small>${pct(v, total)}%</small></span>`).join("")}</div></div>
    </div>
    ${total - paid > 0 ? `<div><button class="btn sm" data-act="pay" data-id="${esc(k.id)}" data-key="${key}">Registrar pagamento desta fatura</button></div>` : ""}
  </section>`;
}

// =====================================================================
// HISTÓRICO
// =====================================================================
function viewHist() {
  const months = new Set(S.tx.filter(t => t.t === "in" || t.t === "out").map(monthOf)); months.add(curMonth());
  const all = [...months].sort();
  const endM = S.month > curMonth() ? S.month : curMonth();
  const data = Array.from({ length: 12 }, (_, i) => addMonth(endM, i - 11)).map(m => { const s = monthStats(m); return { m, inc: s.inc, out: s.out }; });
  const pOut = planned("out");
  const rows = all.slice().reverse().map(m => {
    const s = monthStats(m), bal = s.inc - s.out, p = pOut ? pct(s.out, pOut) : null;
    return `<tr class="click ${m === S.month ? "sel" : ""}" data-act="open-month" data-m="${m}"><td class="cap">${esc(monthName(m, { month: "short", year: "numeric" }))}</td><td class="r">${money(s.inc)}</td><td class="r">${money(s.out)}</td>
      <td class="r ${bal >= 0 ? "in-c" : "out-c"}">${bal < 0 ? "−" : "+"} ${money(Math.abs(bal))}</td><td class="r">${p === null ? "—" : p > 100 ? `<span class="out-c">▲ ${p}%</span>` : p + "%"}</td></tr>`;
  }).join("");
  S.hist = data;
  return `${topBar("Histórico")}
  <section class="card"><div class="card-head"><h2>Receitas e despesas por mês</h2><div class="legend"><span><i class="sw" style="background:var(--in)"></i>Receitas</span><span><i class="sw" style="background:var(--out)"></i>Despesas</span></div></div>
    <div class="chart" id="histChart"><svg viewBox="0 0 720 260"></svg><div class="tip" id="tip" hidden></div></div></section>
  <section class="card"><div class="card-head"><h2>Mês a mês</h2><button class="btn ghost sm" data-act="export-csv">Exportar CSV (Excel)</button></div>
    <div class="tablewrap"><table class="stack"><thead><tr><th>Mês</th><th class="r">Receitas</th><th class="r">Despesas</th><th class="r">Resultado</th><th class="r">Da meta</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="muted small">Clique num mês para abrir o início naquele mês.</div></section>`;
}
function niceMax(v) { if (v <= 0) return 100000; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
function compact(c) { const v = c / 100; return v >= 1000 ? "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : "R$ " + Math.round(v); }
function histSVG(data, W) {
  const H = 260, L = 60, R = 8, T = 12, B = 28;
  const max = niceMax(Math.max(...data.map(d => Math.max(d.inc, d.out))));
  const iw = W - L - R, ih = H - T - B, gw = iw / data.length, bw = Math.max(4, Math.min(22, gw * .32));
  const y = (v) => T + ih - v / max * ih;
  let g = "";
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${i ? "var(--grid)" : "var(--line)"}"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end">${esc(compact(v))}</text>`; }
  const bar = (x, v, col) => { if (!v) return ""; const h = Math.max(2, v / max * ih), yy = T + ih - h, r = Math.min(4, h, bw / 2); return `<path d="M${x},${T + ih} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${T + ih} Z" fill="${col}"/>`; };
  data.forEach((d, i) => {
    const cx = L + gw * i + gw / 2, sel = d.m === S.month;
    if (sel) g += `<rect x="${L + gw * i + 2}" y="${T}" width="${gw - 4}" height="${ih}" fill="var(--accent-soft)" rx="6"/>`;
    g += bar(cx - bw - 1, d.inc, "var(--in)") + bar(cx + 1, d.out, "var(--out)");
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" style="${sel ? "fill:var(--fg);font-weight:700" : ""}">${esc(shortMonth(d.m))}</text>`;
    g += `<rect class="hit" data-i="${i}" x="${L + gw * i}" y="${T}" width="${gw}" height="${ih + B}" fill="transparent"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas e despesas por mês">${g}</svg>`;
}
function wireHistChart() {
  const box = $("#histChart"), tip = $("#tip"); if (!box) return;
  const w = Math.round(box.clientWidth) || 720;
  let data = S.hist; if (w < 600) data = data.slice(-6);
  box.querySelector("svg").outerHTML = histSVG(data, Math.max(320, w));
  const svg = box.querySelector("svg");
  svg.addEventListener("pointermove", e => {
    const el = e.target.closest(".hit"); if (!el) return;
    const d = data[+el.dataset.i], r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
    tip.innerHTML = `<b class="cap">${esc(monthName(d.m))}</b><br>Receitas ${money(d.inc)}<br>Despesas ${money(d.out)}<br>Resultado ${d.inc - d.out < 0 ? "−" : "+"} ${money(Math.abs(d.inc - d.out))}`;
    tip.hidden = false; tip.style.left = Math.min(Math.max(r.left - br.left + r.width / 2, 80), br.width - 80) + "px"; tip.style.top = "8px";
  });
  svg.addEventListener("pointerleave", () => tip.hidden = true);
  svg.addEventListener("click", e => { const el = e.target.closest(".hit"); if (el) { S.month = data[+el.dataset.i].m; go("inicio"); } });
}

// =====================================================================
// CATEGORIAS
// =====================================================================
function usageCounts() { const u = {}; for (const t of S.tx) if (t.c) u[t.c] = (u[t.c] || 0) + 1; return u; }
function viewCats() {
  const u = usageCounts();
  const missingSugg = Object.entries({ ...SUGGESTED.out, ...SUGGESTED.in }).some(([name, subs]) => { const c = st().categories.find(x => norm(x.name) === norm(name)); return c && subs.some(sn => !c.subs.some(x => norm(x.name) === norm(sn))); });
  const group = (type, title, help) => {
    const cats = st().categories.filter(c => c.type === type && !c.archived);
    return `<section class="card">
      <div class="card-head"><h2>${title}</h2><span class="muted small num">${type === "out" ? "Meta" : "Previsto"} por mês: <b>${money(planned(type))}</b></span></div>
      <div class="muted small" style="margin-top:-6px">${help}</div>
      ${type === "out" && missingSugg ? `<div class="info">Adicionar as subcategorias sugeridas (Água, Energia, IPTU em Moradia; Táxi/Uber, Combustível, IPVA em Transporte…) às categorias que você já tem? <button class="link" data-act="merge-subs">Adicionar sugeridas</button></div>` : ""}
      <div class="catgroup">${cats.length ? cats.map(c => catBlockHTML(c, u)).join("") : `<div class="muted">Nenhuma categoria ainda.</div>`}</div>
      <form class="newrow" data-form="newcat" data-type="${type}" autocomplete="off">
        <input class="field" name="name" id="new-${type}-name" placeholder="Nova categoria de ${type === "out" ? "despesa" : "receita"}" aria-label="Nome da nova categoria">
        <span class="money-field"><input class="field" name="budget" id="new-${type}-budget" inputmode="decimal" placeholder="${type === "out" ? "Meta" : "Previsto"}" aria-label="Valor mensal"></span>
        <button class="btn" type="submit">Adicionar</button></form>
    </section>`;
  };
  const archived = st().categories.filter(c => c.archived);
  return `${topBar("Categorias", false)}
    ${!st().categories.length ? onboardingHTML() : Object.keys({ ...SUGGESTED.out, ...SUGGESTED.in }).some(n => !st().categories.some(c => norm(c.name) === norm(n)))
      ? `<div class="info">Algumas categorias sugeridas ainda não existem aqui (${esc(Object.keys({ ...SUGGESTED.out, ...SUGGESTED.in }).filter(n => !st().categories.some(c => norm(c.name) === norm(n))).join(", "))}). <button class="link" data-act="seed">Adicionar as que faltam</button></div>` : ""}
    ${group("out", "Categorias de despesa", "Defina a meta de gasto mensal de cada categoria. Os valores são salvos ao sair do campo. Clique numa subcategoria para renomear.")}
    ${group("in", "Categorias de receita", "Quanto você espera receber por mês (opcional).")}
    ${archived.length ? `<section class="card"><h2>Categorias arquivadas</h2><div class="muted small" style="margin-top:-6px">Não aparecem em novos lançamentos, mas o histórico continua.</div>
      ${archived.map(c => `<div class="kv"><span>${esc(c.name)} <span class="muted">(${c.type === "out" ? "despesa" : "receita"})</span></span><button class="small-btn" data-act="cat-unarchive" data-id="${esc(c.id)}">Restaurar</button></div>`).join("")}</section>` : ""}`;
}
function catBlockHTML(c, u) {
  const uses = u[c.id] || 0, confirming = S.pendingDel === c.id, es = S.editSub;
  const subs = c.subs.filter(x => !x.archived);
  return `<div class="catblock">
    <div class="catrow">
      <input class="field" id="cn-${esc(c.id)}" data-change="cat-rename" data-id="${esc(c.id)}" value="${esc(c.name)}" aria-label="Nome da categoria">
      <span class="money-field"><input class="field" id="cb-${esc(c.id)}" data-change="cat-budget" data-id="${esc(c.id)}" inputmode="decimal" value="${esc(centsToInput(c.budget))}" placeholder="0,00" aria-label="Valor mensal de ${esc(c.name)}"></span>
      ${confirming ? `<span style="display:flex;gap:4px"><button class="small-btn bad" data-act="cat-del-yes" data-id="${esc(c.id)}">${uses ? "Arquivar" : "Excluir"}</button><button class="small-btn" data-act="cat-del-no">Não</button></span>`
        : `<button class="small-btn" data-act="cat-del" data-id="${esc(c.id)}" title="${uses ? `Usada em ${uses} lançamento${uses > 1 ? "s" : ""}: será arquivada para manter o histórico` : "Sem lançamentos: pode ser excluída"}">${uses ? "Arquivar" : "Excluir"}</button>`}
    </div>
    <div class="subs">
      ${subs.map(x => es && es.c === c.id && es.s === x.id
        ? `<span class="subedit"><input class="field" id="se-${esc(x.id)}" value="${esc(x.name)}" aria-label="Nome da subcategoria"><button class="small-btn" data-act="sub-save" data-c="${esc(c.id)}" data-s="${esc(x.id)}">Salvar</button><button class="small-btn bad" data-act="sub-del" data-c="${esc(c.id)}" data-s="${esc(x.id)}">Remover</button><button class="small-btn" data-act="sub-cancel">Cancelar</button></span>`
        : `<span class="subchip"><button data-act="sub-edit" data-c="${esc(c.id)}" data-s="${esc(x.id)}" title="Renomear">${esc(x.name)}</button><button data-act="sub-del" data-c="${esc(c.id)}" data-s="${esc(x.id)}" aria-label="Remover ${esc(x.name)}">×</button></span>`).join("")}
      <form class="subadd" data-form="subadd" data-c="${esc(c.id)}" autocomplete="off"><input class="field" name="name" id="sa-${esc(c.id)}" placeholder="+ subcategoria" aria-label="Nova subcategoria de ${esc(c.name)}"><button class="small-btn" type="submit" style="color:var(--accent);font-weight:600">Adicionar</button></form>
    </div></div>`;
}
function addCategory(name, type, budget = 0) {
  name = name.trim(); if (!name) return null;
  const ex = st().categories.find(c => norm(c.name) === norm(name) && c.type === type);
  if (ex) { if (ex.archived) { ex.archived = false; saveSettings(); } return ex.id; }
  const c = { id: "c" + uid8(), name, type, budget: budget || 0, archived: false, subs: [] };
  st().categories.push(c); saveSettings(); return c.id;
}
function addSub(cid, name) {
  name = name.trim(); const c = catById(cid); if (!name || !c) return null;
  const ex = c.subs.find(x => norm(x.name) === norm(name));
  if (ex) { if (ex.archived) { ex.archived = false; saveSettings(); } return ex.id; }
  const sub = { id: "s" + uid8(), name, archived: false }; c.subs.push(sub); saveSettings(); return sub.id;
}
function addCard(name) {
  name = name.trim(); if (!name) return null;
  const ex = st().cards.find(k => norm(k.name) === norm(name));
  if (ex) { if (ex.archived) { ex.archived = false; saveSettings(); } return ex.id; }
  const k = { id: "k" + uid8(), name, limit: 0, closeDay: null, dueDay: null, payAccount: "", color: COLORS[(st().cards.length + 3) % COLORS.length], archived: false };
  st().cards.push(k); saveSettings(); return k.id;
}
function addAccount(name, initial = 0, extra = {}) {
  name = name.trim(); if (!name) return null;
  const a = { id: "a" + uid8(), name, type: "corrente", initial, since: todayISO(), setAt: Date.now(), color: COLORS[st().accounts.length % COLORS.length], archived: false, ...extra };
  st().accounts.push(a);
  if (!st().prefs.defaultAccount) st().prefs.defaultAccount = a.id;
  saveSettings(); return a.id;
}

// =====================================================================
// CONFIGURAÇÕES
// =====================================================================
function viewConfig() {
  const p = st().prefs, u = S.store.user;
  return `${topBar("Configurações", false)}
  <section class="card"><h2>Aparência</h2>
    <div class="seg">${[["light", "Claro"], ["dark", "Escuro"], ["auto", "Automático (segue o computador)"]].map(([k, n]) => `<button data-act="theme" data-v="${k}" aria-pressed="${p.theme === k}">${n}</button>`).join("")}</div></section>
  <section class="card"><h2>Compras no cartão de crédito</h2>
    <div class="muted small" style="margin-top:-6px">Em qual mês uma compra no crédito entra no resumo, nas metas e no histórico. O saldo das contas não muda: ele só cai quando a fatura é paga.</div>
    <div class="seg"><button data-act="cardmonth" data-v="purchase" aria-pressed="${p.cardMonth === "purchase"}">No mês da compra</button><button data-act="cardmonth" data-v="invoice" aria-pressed="${p.cardMonth === "invoice"}">No mês de vencimento da fatura</button></div></section>
  <section class="card"><h2>Lançamento rápido</h2>
    <label class="small muted" style="display:grid;gap:4px;max-width:340px">Conta usada quando você não digita nenhuma conta ou cartão
      <select class="field" id="defAcc" data-change="def-acc"><option value="">Nenhuma (lançar sem conta)</option>${activeAccs().map(a => `<option value="${esc(a.id)}" ${p.defaultAccount === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
    <div class="muted small">Exemplos que a barra entende: <b>mercado 230</b> · <b>padaria 12,50 ontem nubank</b> · <b>uber 18 dia 3 pix inter</b> · <b>+ salário 6120 05/11</b></div></section>
  <section class="card"><h2>Dados</h2>
    ${S.store.mode === "cloud" ? `<div class="kv"><span>Conectado ao Dropbox${u ? ` de <b>${esc(u.displayName || u.email)}</b>` : ""}. Tudo é salvo sozinho no arquivo <b>minhas-financas-dados.json</b>, na pasta do app no seu Dropbox (Aplicativos), e aparece em qualquer aparelho conectado.</span>
        <span class="actions"><button class="btn ghost sm" data-act="sync-now">Sincronizar agora</button><button class="btn ghost sm" data-act="signout">Desconectar</button></span></div>`
      : `<div class="info warn">Modo local: os dados estão só neste navegador. Para salvar no Dropbox e abrir em qualquer aparelho, configure a appKey seguindo o arquivo LEIA-ME do projeto.</div>`}
    <div class="actions">
      <button class="btn ghost sm" data-act="import">Restaurar uma cópia de segurança</button>
      <button class="btn ghost sm" data-act="export-json">Baixar cópia de segurança</button>
      <button class="btn ghost sm" data-act="export-csv">Exportar CSV (Excel)</button>
    </div>
    <div class="muted small">Restaurar junta os dados do arquivo (uma cópia de segurança baixada aqui, ou o arquivo da versão anterior) com os que já estão no sistema, sem apagar nada.</div></section>
  <section class="card"><h2>Instalar como aplicativo</h2>
    <div class="small">No Google Chrome: menu <b>⋮</b> → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar página como app</b> (ou o ícone de instalar na barra de endereço). No Microsoft Edge: menu <b>⋯</b> → <b>Aplicativos</b> → <b>Instalar este site como um aplicativo</b>. O sistema ganha ícone no menu Iniciar e abre em janela própria. Para fixar na barra de tarefas, clique com o botão direito no ícone aberto e escolha <b>Fixar na barra de tarefas</b>.</div>
    <div class="small"><b>No celular Android</b> (Chrome): abra o site, toque no menu <b>⋮</b> → <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>). <b>No iPhone</b> (Safari): toque em <b>Compartilhar</b> (quadrado com seta para cima) → <b>Adicionar à Tela de Início</b> → <b>Adicionar</b>. O ícone aparece junto com os outros apps.</div>
    ${S.installPrompt ? `<div><button class="btn sm" data-act="install">Instalar agora</button></div>` : ""}</section>
  <section class="card"><h2>Apagar todos os dados</h2>
    <div class="muted small" style="margin-top:-6px">Apaga lançamentos, contas, cartões, categorias, contas fixas e objetivos, para começar do zero. Não dá para desfazer${S.store.mode === "cloud" ? " (o Dropbox guarda versões anteriores do arquivo por 30 dias)" : ""}.</div>
    <div class="actions">${S.confirmWipe ? `<b class="out-c">Tem certeza?</b><button class="btn danger sm" data-act="wipe-yes">Sim, apagar tudo</button><button class="btn ghost sm" data-act="wipe-no">Não</button>` : `<button class="btn ghost sm" data-act="wipe">Apagar todos os dados</button>`}</div></section>`;
}

// =====================================================================
// LANÇAMENTO RÁPIDO
// =====================================================================
function quickHTML() {
  return `<section class="quick"><form class="qbox" data-form="quick" autocomplete="off">
    <input id="quickInput" placeholder="${matchMedia("(max-width: 860px)").matches ? "Rápido: padaria 12,50 ontem" : "Lançamento rápido: padaria 12,50 ontem nubank"}" aria-label="Lançamento rápido"><button class="btn" type="submit">Lançar</button></form>
    <div class="parse" id="qprev"><span class="muted qhint">Ex.: <b>mercado 230</b> · <b>uber 18 dia 3 pix inter</b> · <b>+ salário 6120 05/11</b>. Para parcelas e descrição, use <b>+ Lançar</b>.</span></div></section>`;
}
const PAY_WORDS = { pix: "pix", debito: "debito", dinheiro: "dinheiro", especie: "dinheiro", credito: "credito", cartao: "credito", boleto: "boleto", transferencia: "transferencia", ted: "transferencia", doc: "transferencia" };
function defaultDate() { return S.month === curMonth() ? todayISO() : S.month + "-01"; }
function parseQuick(text) {
  let s = text.trim(); if (!s) return null;
  let type = null;
  if (/^\+/.test(s)) { type = "in"; s = s.slice(1).trim(); } else if (/^-/.test(s)) { type = "out"; s = s.slice(1).trim(); }
  const tk = s.split(/\s+/).filter(Boolean);
  const used = new Array(tk.length).fill(false);
  const today = todayISO(); const [ty, tm] = today.split("-").map(Number);
  let d = null, dLabel = "";
  // datas
  tk.forEach((w, i) => {
    if (d) return; const nw = norm(w);
    let mm;
    if (nw === "hoje") { d = today; used[i] = true; }
    else if (nw === "ontem") { d = addDays(today, -1); used[i] = true; }
    else if (nw === "anteontem") { d = addDays(today, -2); used[i] = true; }
    else if ((mm = nw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
      const dd = +mm[1], mo = +mm[2]; let y = mm[3] ? +mm[3] : ty; if (y < 100) y += 2000;
      if (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) { d = ymd(y, mo, dd); used[i] = true; }
    } else if (nw === "dia" && /^\d{1,2}$/.test(tk[i + 1] || "")) {
      const dd = +tk[i + 1]; if (dd >= 1 && dd <= 31) { let cand = ymd(ty, tm, dd); if (cand > today) cand = ymd(ty, tm - 1, dd); d = cand; used[i] = used[i + 1] = true; }
    }
  });
  // valor
  let v = null;
  tk.forEach((w, i) => { if (v !== null || used[i]) return; if (/^(r\$)?\d[\d.]*(,\d{1,2})?$/i.test(w) || /^\d+\.\d{1,2}$/.test(w)) { v = parseMoney(w); used[i] = true; } });
  // forma de pagamento
  let p = "";
  tk.forEach((w, i) => { if (used[i]) return; const pw = PAY_WORDS[norm(w)]; if (pw && !p) { p = pw; used[i] = true; } });
  // conta / cartão
  const nameHit = (list, w) => { const nw = norm(w); if (nw.length < 3) return []; return list.filter(x => norm(x.name).split(/[\s/]+/).some(t => t === nw || (nw.length >= 4 && t.startsWith(nw)))); };
  let k = "", a = "";
  tk.forEach((w, i) => {
    if (used[i] || (k && a)) return;
    const cards = nameHit(activeCards(), w), accs = nameHit(activeAccs(), w);
    const wantAcc = p && p !== "credito";
    if (!wantAcc && cards.length === 1 && !k && type !== "in") { k = cards[0].id; used[i] = true; }
    else if (accs.length === 1 && !a) { a = accs[0].id; used[i] = true; }
  });
  if (k) p = "credito";
  // categoria / subcategoria
  const rest = tk.map((w, i) => used[i] ? null : w);
  const words = rest.filter(Boolean); const nw = norm(words.join(" "));
  let best = null, bestLen = 0;
  for (const c of activeCats(type)) { const cn = norm(c.name); if (cn && (` ${nw} `).includes(` ${cn} `) && cn.length > bestLen) { best = c; bestLen = cn.length; } }
  let catWords = best ? norm(best.name).split(" ").length : 0;
  if (!best && words[0] && norm(words[0]).length >= 3) { const f = norm(words[0]); const hits = activeCats(type).filter(c => norm(c.name).split(/\s+/).some(x => x.startsWith(f))); if (hits.length === 1) { best = hits[0]; catWords = -1; } }
  let sub = null, subIdx = -1;
  const pool = best ? [best] : activeCats(type);
  words.forEach((w, i) => {
    if (sub) return; const f = norm(w); if (f.length < 3) return;
    const hits = []; for (const c of pool) for (const x of c.subs.filter(x => !x.archived)) if (norm(x.name).split(/[\s/]+/).some(t => t === f || t.startsWith(f))) hits.push([c, x]);
    if (hits.length === 1) { sub = hits[0][1]; best = best || hits[0][0]; subIdx = i; }
  });
  // título: palavras que sobraram (tira nome da categoria e da subcategoria)
  let titleWords = words.filter((_, i) => i !== subIdx);
  if (best) { const cn = norm(best.name); if (norm(titleWords.join(" ")) === cn) titleWords = []; else if (catWords === -1 || (titleWords[0] && cn.startsWith(norm(titleWords[0])))) titleWords = titleWords.slice(1); }
  const t = type || best?.type || "out";
  if (!a && t === "out" && p !== "credito") a = st().prefs.defaultAccount || "";
  if (!a && t === "in") a = st().prefs.defaultAccount || "";
  if (!d) d = defaultDate();
  return { v, t, cat: best, sub, d, p: p === "credito" && !k ? "" : p, k, a: p === "credito" ? "" : a, n: titleWords.join(" ") };
}
function updateQuickPreview() {
  const box = $("#qprev"), inp = $("#quickInput"); if (!box || !inp) return;
  const q = parseQuick(inp.value);
  if (!q) { box.innerHTML = `<span class="muted qhint">Ex.: <b>mercado 230</b> · <b>uber 18 dia 3 pix inter</b> · <b>+ salário 6120 05/11</b>. Para parcelas e descrição, use <b>+ Lançar</b>.</span>`; return; }
  const pills = [];
  pills.push(q.v ? `<span class="pill ${q.t === "in" ? "in" : "out"}">${q.t === "in" ? "+" : "−"} ${money(q.v)}</span>` : `<span class="pill warn">falta o valor</span>`);
  pills.push(q.cat ? `<span class="pill">${esc(q.cat.name)}${q.sub ? " › " + esc(q.sub.name) : ""}</span>` : `<span class="pill warn">categoria não reconhecida</span>`);
  pills.push(`<span class="pill date">${dm(q.d)} (${esc(weekday(q.d).split("-")[0])})</span>`);
  if (q.k) pills.push(`<span class="pill">Crédito ${esc(cardById(q.k)?.name)}</span>`);
  else if (q.a) pills.push(`<span class="pill">${q.t === "in" ? "Entra em" : "Sai de"} ${esc(accById(q.a)?.name)}${q.p ? " · " + payName(q.p) : ""}</span>`);
  else if (q.p) pills.push(`<span class="pill">${payName(q.p)}</span>`);
  if (q.n) pills.push(`<span class="pill">“${esc(q.n)}”</span>`);
  box.innerHTML = `<span class="muted">Vou lançar:</span>${pills.join("")}<span class="muted">· ${q.v && q.cat ? "Enter para salvar" : "Enter abre o formulário para completar"}</span>`;
}
function submitQuick() {
  const inp = $("#quickInput"); const q = parseQuick(inp.value);
  if (!q) { openSheet(); return; }
  inp.value = "";
  if (q.v && q.cat) {
    putTx([mkTx({ t: q.cat.type, v: q.v, c: q.cat.id, s: q.sub?.id || "", d: q.d, p: q.p, k: q.k, a: q.a, n: q.n, o: "" })]);
    toast(`Salvo: ${q.cat.type === "in" ? "+" : "−"} ${money(q.v)} em ${q.cat.name}${q.sub ? " › " + q.sub.name : ""}, ${dm(q.d)}`);
  } else openSheet({ v: q.v, c: q.cat?.id || null, s: q.sub?.id || null, t: q.t, n: q.n, d: q.d, p: q.p, k: q.k, a: q.a });
  updateQuickPreview();
}

// =====================================================================
// SHEET: novo / editar lançamento, transferência, pagamento de fatura
// =====================================================================
const sheet = $("#sheet"), scrim = $("#scrim");
let sheetState = null;
function openSheet(init = {}) {
  const lp = st().lastPay;
  sheetState = { kind: "tx", id: null, t: "out", v: null, c: null, s: null, p: lp.p || "", k: lp.k || "", a: lp.a || st().prefs.defaultAccount || "", a2: "", n: "", o: "", d: defaultDate(),
    pn: 1, mode: "total", rec: false, r: null, rm: null, newCat: false, newSub: false, newCard: false, confirmDel: false, ...init };
  renderSheet(); sheet.hidden = false; scrim.hidden = false;
  setTimeout(() => $("#f-v")?.focus(), 30);
}
function openPay(cardId, key) {
  const k = cardById(cardId), info = cardInfo(k); key = key || info.showKey;
  const remaining = (info.inv[key] || 0) - (info.paid[key] || 0);
  sheetState = { kind: "pay", k: cardId, f: key, v: remaining > 0 ? remaining : null, a: k.payAccount || st().prefs.defaultAccount || "", d: todayISO() };
  renderSheet(); sheet.hidden = false; scrim.hidden = false;
}
function closeSheet() { sheet.hidden = true; scrim.hidden = true; sheetState = null; }
function instPlan(f) {
  const n = Math.max(1, Math.min(120, parseInt(f.pn, 10) || 1));
  if (!f.v) return { n, parts: [] };
  const total = f.mode === "each" ? f.v * n : f.v, per = Math.floor(total / n), rest = total - per * n;
  return { n, total, parts: Array.from({ length: n }, (_, i) => per + (i === 0 ? rest : 0)) };
}
function previewText(f) {
  const { n, total, parts } = instPlan(f); if (n < 2) return "";
  if (!parts.length) return "Digite o valor para ver as parcelas.";
  return `<b>${n}x de ${money(parts[n - 1])}</b>${parts[0] !== parts[n - 1] ? ` (1ª de ${money(parts[0])})` : ""} · total <b>${money(total)}</b> · uma por mês, até <span class="cap">${esc(monthName(addMonthsDate(f.d, n - 1).slice(0, 7), { month: "short", year: "numeric" }))}</span>`;
}
const lbl = (t) => `<div class="label" style="margin-bottom:6px">${t}</div>`;
function accChips(attr, sel, label) {
  const accs = activeAccs();
  return `<div>${lbl(label)}<div class="chips">${accs.map(a => `<button class="chip" data-act="${attr}" data-v="${esc(a.id)}" aria-pressed="${sel === a.id}">${esc(a.name)}</button>`).join("") || `<span class="muted small">Nenhuma conta. Cadastre em <a class="link" href="#contas" data-act="close">Contas</a>.</span>`}</div></div>`;
}
function renderSheet() {
  const f = sheetState; if (!f) return;
  if (f.kind === "pay") return renderPaySheet();
  if (f.kind === "menu") return renderMenuSheet();
  const orig = f.id ? S.tx.find(t => t.id === f.id) : null;
  const isInst = orig && orig.pn > 1;
  const cats = activeCats(f.t === "transfer" ? "out" : f.t);
  const cat = catById(f.c);
  const subs = (cat?.subs || []).filter(x => !x.archived || x.id === f.s);
  const cards = st().cards.filter(k => !k.archived || k.id === f.k);
  const yest = addDays(todayISO(), -1);
  const isTr = f.t === "transfer";
  sheet.innerHTML = `
    <div class="sheet-head"><h2>${f.id ? "Editar lançamento" : "Novo lançamento"}</h2><button class="iconbtn" data-act="close" aria-label="Fechar">✕</button></div>
    <div class="seg" role="group" aria-label="Tipo">
      <button class="out" data-act="s-type" data-v="out" aria-pressed="${f.t === "out"}">− Despesa</button>
      <button class="in" data-act="s-type" data-v="in" aria-pressed="${f.t === "in"}">+ Receita</button>
      <button data-act="s-type" data-v="transfer" aria-pressed="${isTr}">⇄ Transferência</button>
    </div>
    <label class="bigmoney"><span>R$</span><input id="f-v" inputmode="decimal" placeholder="0,00" value="${esc(centsToInput(f.v))}" aria-label="Valor"></label>
    ${isTr ? `${accChips("s-acc", f.a, "Sai da conta")}${accChips("s-acc2", f.a2, "Entra na conta")}` : `
    ${isInst ? `<div class="info">Parcela <b>${orig.pi} de ${orig.pn}</b>. As alterações valem só para esta parcela.</div>`
      : !f.id && f.t === "out" ? `<div>${lbl("Parcelas")}<div class="instrow"><input class="field num" id="f-pn" type="number" min="1" max="120" value="${esc(f.pn)}" aria-label="Número de parcelas">
        ${f.pn > 1 ? `<div class="seg"><button data-act="s-mode" data-v="total" aria-pressed="${f.mode === "total"}">Valor total</button><button data-act="s-mode" data-v="each" aria-pressed="${f.mode === "each"}">Valor de cada parcela</button></div>` : `<span class="preview">1 = à vista</span>`}</div>
        <div class="preview" id="f-prev" style="margin-top:6px">${previewText(f)}</div></div>` : ""}
    <div>${lbl("Categoria")}<div class="chips">
      ${cats.map(c => `<button class="chip" data-act="s-cat" data-v="${esc(c.id)}" aria-pressed="${f.c === c.id}">${esc(c.name)}</button>`).join("")}
      ${f.newCat ? `<span style="display:flex;gap:6px;flex:1;min-width:220px"><input class="field" id="f-newcat" placeholder="Nome da nova categoria"><button class="btn" data-act="s-newcat-save">Criar</button></span>` : `<button class="chip add" data-act="s-newcat">+ Nova categoria</button>`}</div></div>
    ${cat ? `<div>${lbl(`Subcategoria de ${esc(cat.name)} <span style="text-transform:none;letter-spacing:0;font-weight:500">(opcional)</span>`)}<div class="chips">
      ${subs.map(x => `<button class="chip" data-act="s-sub" data-v="${esc(x.id)}" aria-pressed="${f.s === x.id}">${esc(x.name)}</button>`).join("")}
      ${f.newSub ? `<span style="display:flex;gap:6px;flex:1;min-width:220px"><input class="field" id="f-newsub" placeholder="Nome da subcategoria"><button class="btn" data-act="s-newsub-save">Criar</button></span>` : `<button class="chip add" data-act="s-newsub">+ Nova subcategoria</button>`}</div></div>` : ""}
    <div>${lbl("Forma de pagamento")}<div class="chips">${PAY.filter(([k]) => f.t === "out" || k !== "credito").map(([k, n]) => `<button class="chip" data-act="s-pay" data-v="${k}" aria-pressed="${f.p === k}">${n}</button>`).join("")}</div></div>
    ${f.p === "credito" && f.t === "out" ? `<div>${lbl("Qual cartão")}<div class="chips">
      ${cards.map(k => `<button class="chip" data-act="s-card" data-v="${esc(k.id)}" aria-pressed="${f.k === k.id}">${esc(k.name)}</button>`).join("")}
      ${f.newCard ? `<span style="display:flex;gap:6px;flex:1;min-width:220px"><input class="field" id="f-newcard" placeholder="Ex.: Nubank"><button class="btn" data-act="s-newcard-save">Criar</button></span>` : `<button class="chip add" data-act="s-newcard">+ Novo cartão</button>`}</div>
      ${f.k && cardById(f.k)?.closeDay ? `<div class="preview" style="margin-top:6px">Entra na fatura de <b class="cap">${esc(monthName(cycle(cardById(f.k), f.d).key))}</b> (vence ${dm(cycle(cardById(f.k), f.d).due)})</div>` : ""}</div>`
      : accChips("s-acc", f.a, f.t === "in" ? "Entrou na conta" : "Saiu da conta")}`}
    <div class="row2">
      <div>${lbl(isTr ? "Descrição (opcional)" : "Onde / título")}<input class="field" id="f-n" value="${esc(f.n)}" placeholder="${isTr ? "Ex.: reserva de emergência" : "Ex.: Mercado Livre"}" autocomplete="off"></div>
      <div>${lbl("Data")}<input class="field" type="date" id="f-d" value="${esc(f.d)}" aria-label="Data"></div>
    </div>
    <div class="chips" style="margin-top:-6px;justify-content:flex-end"><button class="chip" data-act="s-date" data-v="${todayISO()}" aria-pressed="${f.d === todayISO()}">Hoje</button><button class="chip" data-act="s-date" data-v="${yest}" aria-pressed="${f.d === yest}">Ontem</button></div>
    ${isTr ? "" : `<div>${lbl("Descrição (opcional)")}<textarea class="field" id="f-o" rows="2" placeholder="Ex.: fone de ouvido, capinha do celular">${esc(f.o)}</textarea></div>`}
    ${f.r ? `<div class="info small">Conta fixa <b>${esc(recTitle((st().recurring || []).find(r => r.id === f.r) || {}))}</b> de <span class="cap">${esc(monthName(f.rm || f.d.slice(0, 7)))}</span>.</div>`
      : !f.id && !isTr && !(f.t === "out" && f.pn > 1) ? `<label class="check"><input type="checkbox" id="f-rec" ${f.rec ? "checked" : ""}> <span><b>Conta fixa:</b> repetir todo mês no dia ${+f.d.slice(8)}. Nos próximos meses ela aparece para você só clicar em <b>Efetivar</b>.</span></label>` : ""}
    <div class="err" id="f-err"></div>
    <div class="sheet-foot">
      ${f.id ? (f.confirmDel ? `<span class="actions">${isInst ? `<button class="btn danger" data-act="s-del-yes">Apagar só esta</button><button class="btn danger" data-act="s-del-all">Apagar as ${orig.pn} parcelas</button>` : `<button class="btn danger" data-act="s-del-yes">Apagar mesmo</button>`}<button class="btn ghost" data-act="s-del-no">Não</button></span>`
        : `<span class="actions"><button class="btn ghost" data-act="s-del">Apagar</button><button class="btn ghost" data-act="s-dup">Duplicar</button></span>`) : ""}
      <div class="right">${f.id ? "" : `<button class="btn ghost" data-act="s-save-more">Salvar e lançar outro</button>`}<button class="btn" data-act="s-save">Salvar</button></div>
    </div>`;
}
function renderMenuSheet() {
  const th = st().prefs.theme;
  const syncTxt = { saved: "Salvo no Dropbox", saving: "Salvando…", offline: "Sem internet: salva depois", error: "Erro ao sincronizar: tentando de novo", local: "Modo local (só neste aparelho)" }[S.sync] || "";
  sheet.innerHTML = `<div class="sheet-head"><h2>Menu</h2><button class="iconbtn" data-act="close" aria-label="Fechar">✕</button></div>
    <div class="menu-list">${Object.keys(VIEWS).map(v => `<a class="nav" href="#${v}" data-act="close" aria-current="${S.view === v ? "page" : "false"}">${icon(VIEWS[v][1])}${VIEWS[v][0]}</a>`).join("")}</div>
    <div class="theme" role="group" aria-label="Tema"><button data-act="theme" data-v="light" aria-pressed="${th === "light"}">Claro</button><button data-act="theme" data-v="dark" aria-pressed="${th === "dark"}">Escuro</button><button data-act="theme" data-v="auto" aria-pressed="${th === "auto"}">Auto</button></div>
    <div class="sync ${S.sync}"><i></i>${esc(syncTxt)}</div>`;
}
function renderPaySheet() {
  const f = sheetState, k = cardById(f.k), info = cardInfo(k);
  const keys = [...new Set([...Object.keys(info.inv), info.openKey])].sort();
  sheet.innerHTML = `
    <div class="sheet-head"><h2>Pagamento da fatura ${esc(k.name)}</h2><button class="iconbtn" data-act="close" aria-label="Fechar">✕</button></div>
    <div>${lbl("Fatura")}<select class="field" id="p-f">${keys.map(x => `<option value="${x}" ${x === f.f ? "selected" : ""}>${esc(monthName(x))} · ${money(info.inv[x] || 0)}${info.paid[x] ? " (pago " + money(info.paid[x]) + ")" : ""}</option>`).join("")}</select></div>
    <label class="bigmoney"><span>R$</span><input id="f-v" inputmode="decimal" placeholder="0,00" value="${esc(centsToInput(f.v))}" aria-label="Valor pago"></label>
    ${accChips("s-acc", f.a, "Pago com a conta")}
    <div>${lbl("Data do pagamento")}<input class="field" type="date" id="f-d" value="${esc(f.d)}" style="max-width:220px"></div>
    <div class="muted small">O pagamento tira o valor da conta, mas não conta como despesa: as compras já foram contadas quando foram feitas.</div>
    <div class="err" id="f-err"></div>
    <div class="sheet-foot"><div class="right"><button class="btn" data-act="p-save">Registrar pagamento</button></div></div>`;
}
function syncForm() {
  const f = sheetState; if (!f) return;
  const v = $("#f-v"); if (v) f.v = parseMoney(v.value);
  const n = $("#f-n"); if (n) f.n = n.value.trim();
  const o = $("#f-o"); if (o) f.o = o.value.trim();
  const d = $("#f-d"); if (d && d.value) f.d = d.value;
  const pn = $("#f-pn"); if (pn) f.pn = Math.max(1, Math.min(120, parseInt(pn.value, 10) || 1));
  const pf = $("#p-f"); if (pf) f.f = pf.value;
  const rc = $("#f-rec"); if (rc) f.rec = rc.checked;
}
function saveSheet(more) {
  syncForm(); const f = { ...sheetState }; const err = $("#f-err");
  if (!f.v) { err.textContent = "Digite o valor (ex.: 45,90)."; $("#f-v").focus(); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.d)) { err.textContent = "Escolha uma data válida."; return; }
  if (f.kind === "pay") {
    if (!f.a) { err.textContent = "Escolha a conta usada no pagamento."; return; }
    putTx([mkTx({ t: "pay", v: f.v, k: f.k, f: f.f, a: f.a, d: f.d, n: "" })]);
    closeSheet(); toast(`Pagamento de ${money(f.v)} registrado`); return;
  }
  if (f.t === "transfer") {
    if (!f.a || !f.a2) { err.textContent = "Escolha a conta de saída e a de entrada."; return; }
    if (f.a === f.a2) { err.textContent = "As contas de saída e de entrada precisam ser diferentes."; return; }
    const body = { t: "transfer", v: f.v, a: f.a, a2: f.a2, d: f.d, n: f.n };
    if (f.id) putTx([{ ...S.tx.find(t => t.id === f.id), ...body, m: f.d.slice(0, 7) }]); else putTx([mkTx(body)]);
    more ? openSheet({ t: "transfer", d: f.d }) : closeSheet(); toast("Transferência salva"); return;
  }
  if (!f.c) { err.textContent = "Escolha uma categoria."; return; }
  if (f.p === "credito" && f.t === "out" && !f.k) { err.textContent = "Escolha qual cartão (ou cadastre um novo)."; return; }
  const credit = f.p === "credito" && f.t === "out";
  const base = { t: f.t, c: f.c, s: f.s || "", p: f.p || "", k: credit ? f.k : "", a: credit ? "" : (f.a || ""), n: f.n, o: f.o };
  st().lastPay = { p: base.p, k: base.k, a: base.a || st().lastPay.a };
  const orig = f.id ? S.tx.find(t => t.id === f.id) : null;
  // configurações (última forma de pagamento, nova conta fixa) são salvas antes dos lançamentos,
  // para a atualização que vem depois de gravar o lançamento não desfazer a mudança
  let list, msg;
  if (orig) { list = [{ ...orig, ...base, v: f.v, d: f.d, m: f.d.slice(0, 7) }]; msg = "Lançamento atualizado"; }
  else {
    const plan = f.t === "out" ? instPlan(f) : { n: 1 };
    if (plan.n > 1) {
      const g = "g" + uid8(), at = Date.now();
      list = plan.parts.map((v, i) => mkTx({ ...base, v, d: addMonthsDate(f.d, i), g, pi: i + 1, pn: plan.n, at: at + i }));
      msg = `Salvo em ${plan.n} parcelas de ${money(plan.parts[plan.n - 1])}`;
    } else if (f.r) { list = [mkTx({ ...base, v: f.v, d: f.d, r: f.r, rm: f.rm || f.d.slice(0, 7) })]; msg = "Conta fixa efetivada"; }
    else if (f.rec) {
      const rec = { id: "r" + uid8(), t: f.t, v: f.v, c: f.c, s: f.s || "", p: base.p, k: base.k, a: base.a, n: f.n, day: +f.d.slice(8), start: f.d.slice(0, 7), end: "", skip: [], active: true };
      st().recurring.push(rec);
      list = [mkTx({ ...base, v: f.v, d: f.d, r: rec.id, rm: rec.start })]; msg = "Salvo e cadastrado como conta fixa";
    } else { list = [mkTx({ ...base, v: f.v, d: f.d })]; msg = `Salvo em ${catById(f.c)?.name || ""}`; }
  }
  saveSettings();
  putTx(list); toast(msg);
  if (more) openSheet({ t: f.t, d: f.d }); else closeSheet();
}

// =====================================================================
// ETAPA 2: médias, metas, contas fixas, extrato, objetivos, análise
// =====================================================================
let idx = null;
// gastos por categoria/subcategoria e mês (para médias)
function spendIdx() {
  if (idx) return idx;
  const cat = {}, sub = {}; let first = null;
  for (const t of S.tx) {
    if (t.t !== "out" && t.t !== "in") continue;
    const m = monthOf(t); if (!first || m < first) first = m;
    const c = (cat[t.c] ||= {}); c[m] = (c[m] || 0) + t.v;
    const sk = t.c + "|" + (t.s || ""); const s = (sub[sk] ||= {}); s[m] = (s[m] || 0) + t.v;
  }
  return (idx = { cat, sub, first });
}
// meses completos antes do mês de referência, sem contar meses anteriores ao primeiro lançamento
function prevMonths(n, ref = S.month) { const first = spendIdx().first; if (!first) return []; const out = []; for (let i = 1; i <= n; i++) { const m = addMonth(ref, -i); if (m >= first) out.push(m); } return out; }
function avgOf(map, n, ref = S.month) { const ms = prevMonths(n, ref); if (!ms.length) return null; return Math.round(ms.reduce((a, m) => a + ((map || {})[m] || 0), 0) / ms.length); }
const suggest = (avg) => avg ? Math.ceil(avg / 1000) * 1000 : 0;   // arredonda para cima, de R$ 10 em R$ 10
const avgN = () => st().prefs.avgMonths || 6;
function usePill(spent, goal) {
  if (!goal) return `<span class="muted small">sem meta</span>`;
  const p = pct(spent, goal), cls = p > 100 ? "late" : p >= 80 ? "closed" : "open";
  return `<span class="usebar"><span class="meter"><i style="width:${Math.min(100, p)}%;background:${p > 100 ? "var(--bad)" : p >= 80 ? "var(--warn)" : "var(--bar)"}"></i></span><span class="status ${cls}">${p > 100 ? "▲ " : p >= 80 ? "⚠ " : ""}${p}%</span></span>`;
}
function vsAvg(cur, avg) {
  if (avg === null) return `<span class="muted">—</span>`;
  if (!avg) return cur ? `<span class="out-c">novo</span>` : `<span class="muted">—</span>`;
  const p = Math.round((cur - avg) / avg * 100);
  if (Math.abs(p) < 5) return `<span class="muted">≈ média</span>`;
  return `<span class="${p > 0 ? "out-c" : "in-c"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p)}%</span>`;
}

// ---------- METAS ----------
function viewMetas() {
  const m = S.month, n = avgN(), I = spendIdx();
  const cats = activeCats("out");
  const pend = recPending(m).filter(x => x.r.t === "out");
  const pendBy = {}; for (const x of pend) pendBy[x.r.c] = (pendBy[x.r.c] || 0) + x.r.v;
  let tGoal = 0, tSpent = 0, tProj = 0;
  const noGoalWithSugg = cats.filter(c => !c.budget && suggest(avgOf(I.cat[c.id], n)));
  const rows = cats.map(c => {
    const spent = (I.cat[c.id] || {})[m] || 0, avg = avgOf(I.cat[c.id], n), sug = suggest(avg), goal = c.budget || 0;
    const proj = spent + (pendBy[c.id] || 0);
    tGoal += goal; tSpent += spent; tProj += proj;
    const open = S.expanded.has("m:" + c.id);
    let h = `<tr class="${S.metaDetail === c.id ? "sel" : ""}">
      <td><button class="link" style="color:var(--fg);font-weight:600" data-act="expand" data-id="m:${esc(c.id)}">${c.subs.length ? (open ? "▾ " : "▸ ") : ""}${esc(c.name)}</button></td>
      <td class="r"><span class="money-field" style="display:inline-block;width:120px"><input class="field" id="mb-${esc(c.id)}" data-change="cat-budget" data-id="${esc(c.id)}" inputmode="decimal" value="${esc(centsToInput(goal))}" placeholder="0,00" aria-label="Meta de ${esc(c.name)}"></span></td>
      <td class="r">${money(spent)}</td>
      <td class="r ${goal && spent > goal ? "out-c" : ""}">${goal ? moneyS(goal - spent) : "—"}</td>
      <td>${usePill(spent, goal)}</td>
      <td class="r muted" title="Gasto + contas fixas ainda não efetivadas no mês">${proj !== spent ? money(proj) : ""}</td>
      <td class="r">${avg === null ? "—" : money(avg)}</td>
      <td class="r">${sug && sug !== goal ? `<button class="link" data-act="use-sugg" data-id="${esc(c.id)}" data-v="${sug}" title="Usar como meta">${money(sug)}</button>` : sug ? `<span class="muted">${money(sug)}</span>` : "—"}</td>
      <td class="r"><button class="small-btn" data-act="meta-detail" data-id="${esc(c.id)}">Gráfico</button></td></tr>`;
    if (open) h += c.subs.filter(x => !x.archived).map(x => {
      const map = I.sub[c.id + "|" + x.id], sp = (map || {})[m] || 0, av = avgOf(map, n), sg = suggest(av), g = x.budget || 0;
      return `<tr class="subrow"><td><span style="padding-left:18px" class="muted">${esc(x.name)}</span></td>
        <td class="r"><span class="money-field" style="display:inline-block;width:120px"><input class="field" id="sb-${esc(x.id)}" data-change="sub-budget" data-c="${esc(c.id)}" data-s="${esc(x.id)}" inputmode="decimal" value="${esc(centsToInput(g))}" placeholder="0,00" aria-label="Meta de ${esc(x.name)}"></span></td>
        <td class="r">${money(sp)}</td><td class="r ${g && sp > g ? "out-c" : ""}">${g ? moneyS(g - sp) : "—"}</td><td>${usePill(sp, g)}</td><td></td>
        <td class="r">${av === null ? "—" : money(av)}</td>
        <td class="r">${sg && sg !== g ? `<button class="link" data-act="use-sugg-sub" data-c="${esc(c.id)}" data-s="${esc(x.id)}" data-v="${sg}">${money(sg)}</button>` : sg ? `<span class="muted">${money(sg)}</span>` : "—"}</td><td></td></tr>`;
    }).join("");
    return h;
  }).join("");
  const det = S.metaDetail && catById(S.metaDetail);
  const over = cats.filter(c => c.budget && ((I.cat[c.id] || {})[m] || 0) > c.budget);
  const near = cats.filter(c => c.budget && pct((I.cat[c.id] || {})[m] || 0, c.budget) >= 80 && ((I.cat[c.id] || {})[m] || 0) <= c.budget);
  return `${topBar("Metas")}
  <section class="grid3">
    <div class="card"><div class="big"><span class="label">Meta geral do mês</span><span class="v">${money(tGoal)}</span><span class="muted small">soma das metas das categorias</span></div>
      <div style="display:grid;gap:6px"><div class="kv small"><span class="muted">Gasto até agora</span><b class="${tSpent > tGoal && tGoal ? "out-c" : ""}">${money(tSpent)} · ${pct(tSpent, tGoal)}%</b></div>
      <div class="meter"><i style="width:${Math.min(100, pct(tSpent, tGoal))}%;${tSpent > tGoal && tGoal ? "background:var(--bad)" : ""}"></i></div></div></div>
    <div class="card"><div class="big ${tGoal - tSpent < 0 ? "red" : ""}"><span class="label">${tGoal - tSpent < 0 ? "Acima da meta" : "Ainda pode gastar"}</span><span class="v">${money(Math.abs(tGoal - tSpent))}</span>
      <span class="muted small">${tProj > tSpent ? `contas fixas ainda por pagar: ${money(tProj - tSpent)}` : "nenhuma conta fixa pendente"}</span></div></div>
    <div class="card"><span class="label">Alertas</span>
      ${over.length ? `<div class="small"><span class="status late">▲ Acima da meta</span> ${over.map(c => esc(c.name)).join(", ")}</div>` : ""}
      ${near.length ? `<div class="small"><span class="status closed">⚠ Acima de 80%</span> ${near.map(c => esc(c.name)).join(", ")}</div>` : ""}
      ${!over.length && !near.length ? `<div class="small muted">Nenhuma categoria perto de estourar a meta.</div>` : ""}</div>
  </section>
  <section class="card">
    <div class="card-head"><h2>Metas por categoria</h2>
      <div class="actions"><span class="muted small">Sugestão pela média de</span><div class="seg">${[3, 6, 12].map(k => `<button data-act="avg-n" data-v="${k}" aria-pressed="${n === k}">${k} meses</button>`).join("")}</div>
      ${noGoalWithSugg.length ? `<button class="btn ghost sm" data-act="use-all-sugg">Usar sugestão nas ${noGoalWithSugg.length} sem meta</button>` : ""}</div></div>
    <div class="tablewrap"><table class="metas stack"><thead><tr><th>Categoria</th><th class="r">Meta</th><th class="r">Gasto</th><th class="r">Restante</th><th>Uso</th><th class="r">Previsto</th><th class="r">Média ${n}m</th><th class="r">Sugestão</th><th></th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td>Total</td><td class="r">${money(tGoal)}</td><td class="r">${money(tSpent)}</td><td class="r">${moneyS(tGoal - tSpent)}</td><td>${usePill(tSpent, tGoal)}</td><td class="r">${tProj !== tSpent ? money(tProj) : ""}</td><td></td><td></td><td></td></tr></tfoot></table></div>
    <div class="muted small">A sugestão é a média dos últimos ${n} meses completos (sem contar meses antes do seu primeiro lançamento), arredondada para cima. Clique numa sugestão para usá-la como meta, ou digite a meta que quiser. Clique no nome para ver as subcategorias.</div>
  </section>
  ${det ? catDetailHTML(det) : ""}`;
}
function catDetailHTML(c) {
  const I = spendIdx(), n = avgN();
  const data = Array.from({ length: 12 }, (_, i) => addMonth(S.month, i - 11)).map(m => ({ m, v: (I.cat[c.id] || {})[m] || 0 }));
  const avg = avgOf(I.cat[c.id], n);
  const subs = c.subs.map(x => ({ x, cur: (I.sub[c.id + "|" + x.id] || {})[S.month] || 0, a3: avgOf(I.sub[c.id + "|" + x.id], 3), a6: avgOf(I.sub[c.id + "|" + x.id], 6), a12: avgOf(I.sub[c.id + "|" + x.id], 12) })).filter(r => r.cur || r.a12);
  return `<section class="card" id="catdetail">
    <div class="card-head"><h2>${esc(c.name)}: últimos 12 meses</h2><div class="legend"><span><i class="sw" style="background:var(--out)"></i>Gasto</span>${c.budget ? `<span><i class="sw" style="background:var(--fg);height:2px"></i>Meta ${money(c.budget)}</span>` : ""}${avg !== null ? `<span><i class="sw" style="background:var(--accent);height:2px"></i>Média ${n}m ${money(avg)}</span>` : ""}<button class="small-btn" data-act="meta-detail" data-id="">Fechar</button></div></div>
    <div class="chart" id="catChart" data-cat="${esc(c.id)}">${catBarsSVG(data, 720, c.budget, avg)}<div class="tip" id="tip2" hidden></div></div>
    ${subs.length ? `<div class="tablewrap"><table class="stack"><thead><tr><th>Subcategoria</th><th class="r">Este mês</th><th class="r">Média 3m</th><th class="r">Média 6m</th><th class="r">Média 12m</th></tr></thead><tbody>
      ${subs.map(r => `<tr><td>${esc(r.x.name)}</td><td class="r">${money(r.cur)}</td><td class="r">${r.a3 === null ? "—" : money(r.a3)}</td><td class="r">${r.a6 === null ? "—" : money(r.a6)}</td><td class="r">${r.a12 === null ? "—" : money(r.a12)}</td></tr>`).join("")}</tbody></table></div>` : ""}
  </section>`;
}
function catBarsSVG(data, W, goal, avg) {
  const H = 220, L = 60, R = 8, T = 12, B = 28;
  const max = niceMax(Math.max(1, goal || 0, avg || 0, ...data.map(d => d.v)));
  const iw = W - L - R, ih = H - T - B, gw = iw / data.length, bw = Math.max(6, Math.min(28, gw * .5));
  const y = (v) => T + ih - v / max * ih;
  let g = "";
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${i ? "var(--grid)" : "var(--line)"}"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end">${esc(compact(v))}</text>`; }
  data.forEach((d, i) => {
    const cx = L + gw * i + gw / 2, sel = d.m === S.month, over = goal && d.v > goal;
    if (d.v) { const h = Math.max(2, d.v / max * ih), yy = T + ih - h, r = Math.min(4, h, bw / 2), x = cx - bw / 2;
      g += `<path d="M${x},${T + ih} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${T + ih} Z" fill="${over ? "var(--bad)" : "var(--out)"}" opacity="${sel ? 1 : .8}"/>`; }
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" style="${sel ? "fill:var(--fg);font-weight:700" : ""}">${esc(shortMonth(d.m))}</text>`;
    g += `<rect class="hit" data-i="${i}" x="${L + gw * i}" y="${T}" width="${gw}" height="${ih + B}" fill="transparent"/>`;
  });
  if (goal) g += `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--fg)" stroke-width="2"/>`;
  if (avg) g += `<line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 4"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto mensal da categoria">${g}</svg>`;
}
function wireCatChart() {
  const box = $("#catChart"); if (!box) return;
  const c = catById(box.dataset.cat); const I = spendIdx();
  const w = Math.round(box.clientWidth) || 720;
  let data = Array.from({ length: 12 }, (_, i) => addMonth(S.month, i - 11)).map(m => ({ m, v: (I.cat[c.id] || {})[m] || 0 }));
  if (w < 600) data = data.slice(-6);
  box.querySelector("svg").outerHTML = catBarsSVG(data, Math.max(320, w), c.budget, avgOf(I.cat[c.id], avgN()));
  const svg = box.querySelector("svg"), tip = $("#tip2");
  svg.addEventListener("pointermove", e => { const el = e.target.closest(".hit"); if (!el) return; const d = data[+el.dataset.i], r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
    tip.innerHTML = `<b class="cap">${esc(monthName(d.m))}</b><br>${money(d.v)}${c.budget ? ` · ${pct(d.v, c.budget)}% da meta` : ""}`; tip.hidden = false;
    tip.style.left = Math.min(Math.max(r.left - br.left + r.width / 2, 70), br.width - 70) + "px"; tip.style.top = "4px"; });
  svg.addEventListener("pointerleave", () => tip.hidden = true);
}

// ---------- ANÁLISE ----------
function viewAnalise() {
  const m = S.month, I = spendIdx(), type = S.anType || "out";
  const cats = st().categories.filter(c => c.type === type && (!c.archived || (I.cat[c.id] || {})[m]));
  const rows = cats.map(c => {
    const map = I.cat[c.id], cur = (map || {})[m] || 0, a3 = avgOf(map, 3), a6 = avgOf(map, 6), a12 = avgOf(map, 12);
    return { c, cur, a3, a6, a12 };
  }).filter(r => r.cur || r.a12).sort((a, b) => (b.a6 || b.cur) - (a.a6 || a.cur));
  const n = avgN();
  const ref = (r) => n === 3 ? r.a3 : n === 12 ? r.a12 : r.a6;
  const body = rows.map(r => {
    const open = S.expanded.has("a:" + r.c.id);
    let h = `<tr><td><button class="link" style="color:var(--fg);font-weight:600" data-act="expand" data-id="a:${esc(r.c.id)}">${r.c.subs.length ? (open ? "▾ " : "▸ ") : ""}${esc(r.c.name)}</button></td>
      <td class="r"><b>${money(r.cur)}</b></td><td class="r">${r.a3 === null ? "—" : money(r.a3)}</td><td class="r">${r.a6 === null ? "—" : money(r.a6)}</td><td class="r">${r.a12 === null ? "—" : money(r.a12)}</td>
      <td class="r">${r.c.budget ? money(r.c.budget) : "—"}</td><td class="r">${vsAvg(r.cur, ref(r))}</td>
      <td class="r">${type === "out" ? `<button class="small-btn" data-act="meta-detail" data-id="${esc(r.c.id)}" data-go="metas">Gráfico</button>` : ""}</td></tr>`;
    if (open) h += r.c.subs.map(x => {
      const map = I.sub[r.c.id + "|" + x.id], cur = (map || {})[m] || 0, a3 = avgOf(map, 3), a6 = avgOf(map, 6), a12 = avgOf(map, 12);
      if (!cur && !a12) return "";
      const rr = { a3, a6, a12 };
      return `<tr class="subrow"><td><span class="muted" style="padding-left:18px">${esc(x.name)}</span></td><td class="r">${money(cur)}</td><td class="r">${a3 === null ? "—" : money(a3)}</td><td class="r">${a6 === null ? "—" : money(a6)}</td><td class="r">${a12 === null ? "—" : money(a12)}</td><td class="r">${x.budget ? money(x.budget) : "—"}</td><td class="r">${vsAvg(cur, ref(rr))}</td><td></td></tr>`;
    }).join("") + (() => { const map = I.sub[r.c.id + "|"]; const cur = (map || {})[m] || 0, a12 = avgOf(map, 12); return cur || a12 ? `<tr class="subrow"><td><span class="muted" style="padding-left:18px">Sem subcategoria</span></td><td class="r">${money(cur)}</td><td class="r">${fmtAvg(avgOf(map, 3))}</td><td class="r">${fmtAvg(avgOf(map, 6))}</td><td class="r">${fmtAvg(a12)}</td><td></td><td></td><td></td></tr>` : ""; })();
    return h;
  }).join("");
  // fixas x variáveis
  const outs = S.tx.filter(t => t.t === "out" && monthOf(t) === m);
  const fixed = outs.filter(t => t.r).reduce((a, t) => a + t.v, 0), variable = outs.filter(t => !t.r).reduce((a, t) => a + t.v, 0), tot = fixed + variable;
  const pendFix = recPending(m).filter(x => x.r.t === "out").reduce((a, x) => a + x.r.v, 0);
  const top = outs.slice().sort((a, b) => b.v - a.v).slice(0, 6);
  const firstM = spendIdx().first;
  return `${topBar("Análise de gastos")}
  <section class="card">
    <div class="card-head"><h2>Média por categoria</h2>
      <div class="actions"><div class="seg"><button data-act="an-type" data-v="out" aria-pressed="${type === "out"}">Despesas</button><button data-act="an-type" data-v="in" aria-pressed="${type === "in"}">Receitas</button></div>
      <span class="muted small">Comparar com a média de</span><div class="seg">${[3, 6, 12].map(k => `<button data-act="avg-n" data-v="${k}" aria-pressed="${n === k}">${k} meses</button>`).join("")}</div></div></div>
    ${rows.length ? `<div class="tablewrap"><table class="stack"><thead><tr><th>Categoria</th><th class="r cap">${esc(monthName(m, { month: "short", year: "numeric" }))}</th><th class="r">Média 3m</th><th class="r">Média 6m</th><th class="r">Média 12m</th><th class="r">${type === "out" ? "Meta" : "Previsto"}</th><th class="r">vs. média ${n}m</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`
      : `<div class="empty"><span>Ainda não há lançamentos suficientes.</span></div>`}
    <div class="muted small">As médias usam os meses completos antes de <span class="cap">${esc(monthName(m))}</span>${firstM ? `, a partir do seu primeiro lançamento (${esc(monthName(firstM))})` : ""}. Clique numa categoria para ver as subcategorias.</div>
  </section>
  <section class="grid2">
    <div class="card"><h2>Despesas fixas × variáveis</h2>
      ${tot || pendFix ? `<div class="meter" style="height:14px"><i style="width:${pct(fixed, tot) || 0}%;background:var(--accent)"></i></div>
      <div class="kv"><span><i class="sw" style="background:var(--accent)"></i> Fixas (contas fixas efetivadas)</span><b>${money(fixed)} · ${pct(fixed, tot)}%</b></div>
      <div class="kv"><span><i class="sw" style="background:var(--track)"></i> Variáveis</span><b>${money(variable)} · ${pct(variable, tot)}%</b></div>
      ${pendFix ? `<div class="kv muted"><span>Contas fixas ainda não efetivadas</span><b>${money(pendFix)}</b></div>` : ""}`
      : `<div class="muted small">Sem despesas neste mês.</div>`}
      <div class="muted small">Despesas lançadas a partir de uma conta fixa contam como fixas. As demais, como variáveis.</div></div>
    <div class="card"><h2>Maiores despesas do mês</h2>${txTableHTML(top, false) || `<div class="muted small">Sem despesas neste mês.</div>`}</div>
  </section>`;
}
const fmtAvg = (v) => v === null ? "—" : money(v);

// ---------- CONTAS FIXAS ----------
function recPending(m) {
  const done = new Set(S.tx.filter(t => t.r && t.rm === m).map(t => t.r));
  const [y, mo] = m.split("-").map(Number);
  return (st().recurring || []).filter(r => r.active !== false && m >= r.start && (!r.end || m <= r.end) && !(r.skip || []).includes(m) && !done.has(r.id))
    .map(r => ({ r, d: ymd(y, mo, r.day || 1), m })).sort((a, b) => a.d.localeCompare(b.d));
}
function effectivate(r, m, d, v) {
  const credit = r.t === "out" && r.p === "credito";
  putTx([mkTx({ t: r.t, v: v || r.v, c: r.c, s: r.s || "", p: r.p || "", k: credit ? r.k : "", a: credit ? "" : (r.a || ""), n: r.n || "", o: "", d, r: r.id, rm: m })]);
}
const recTitle = (r) => r.n || subOf(catById(r.c), r.s)?.name || catById(r.c)?.name || "Conta fixa";
function pendingHTML(m, limit) {
  const list = recPending(m); if (!list.length) return "";
  const today = todayISO();
  return `<div class="tablewrap"><table class="pendt"><tbody>${list.slice(0, limit || 999).map(({ r, d }) => `<tr>
    <td class="num p-date">${dm(d)}${d < today ? `<small class="out-c">atrasada</small>` : ""}</td>
    <td class="p-title"><b>${esc(recTitle(r))}</b><small>${catLabel(r)}</small></td><td class="p-src">${srcHTML(r)}</td><td class="r p-val">${amtHTML(r)}</td>
    <td class="r p-act"><span class="actions" style="justify-content:flex-end;flex-wrap:nowrap"><button class="small-btn" data-act="rec-edit-eff" data-id="${esc(r.id)}" data-m="${m}" title="Abrir para mudar valor ou data antes de efetivar">Alterar</button><button class="btn sm" data-act="rec-eff" data-id="${esc(r.id)}" data-m="${m}">Efetivar</button></span></td></tr>`).join("")}</tbody></table></div>
    ${list.length > (limit || 999) ? `<a class="link" href="#fixas">+ ${list.length - limit} outras</a>` : ""}`;
}
function viewFixas() {
  const m = S.month, recs = (st().recurring || []).slice().sort((a, b) => (a.day || 0) - (b.day || 0) || recTitle(a).localeCompare(recTitle(b)));
  const done = new Map(S.tx.filter(t => t.r && t.rm === m).map(t => [t.r, t]));
  const active = recs.filter(r => r.active !== false && m >= r.start && (!r.end || m <= r.end));
  const totOut = active.filter(r => r.t === "out").reduce((a, r) => a + r.v, 0), totIn = active.filter(r => r.t === "in").reduce((a, r) => a + r.v, 0);
  const pend = recPending(m);
  const rows = recs.map(r => {
    const tx = done.get(r.id);
    let sit;
    if (r.active === false) sit = `<span class="status paid">Pausada</span>`;
    else if (m < r.start) sit = `<span class="status paid">Começa em ${esc(monthName(r.start, { month: "short", year: "numeric" }))}</span>`;
    else if (r.end && m > r.end) sit = `<span class="status paid">Encerrada</span>`;
    else if (tx) sit = `<span class="status open">✓ Efetivada ${dm(tx.d)}${tx.v !== r.v ? " · " + money(tx.v) : ""}</span>`;
    else if ((r.skip || []).includes(m)) sit = `<span class="status paid">Pulada</span> <button class="link" data-act="rec-unskip" data-id="${esc(r.id)}">Desfazer</button>`;
    else sit = `<span class="actions" style="flex-wrap:nowrap"><button class="btn sm" data-act="rec-eff" data-id="${esc(r.id)}" data-m="${m}">Efetivar</button><button class="small-btn" data-act="rec-skip" data-id="${esc(r.id)}">Pular mês</button></span>`;
    return `<tr class="${S.editRec === r.id ? "sel" : ""}"><td><b>${esc(recTitle(r))}</b><small>${catLabel(r)}</small></td><td class="num">dia ${r.day}</td><td>${srcHTML(r)}</td><td class="r">${amtHTML(r)}</td><td>${sit}</td>
      <td class="r"><button class="small-btn" data-act="rec-edit" data-id="${esc(r.id)}">Editar</button></td></tr>`;
  }).join("");
  const ed = S.editRec === "new" ? { id: "new", t: "out", n: "", v: 0, c: activeCats("out")[0]?.id || "", s: "", p: "", k: "", a: st().prefs.defaultAccount || "", day: 10, start: S.month, end: "", active: true } : (st().recurring || []).find(r => r.id === S.editRec);
  return `${topBar("Contas fixas")}
  <section class="grid3">
    <div class="card"><div class="big red"><span class="label">Despesas fixas por mês</span><span class="v">${money(totOut)}</span><span class="muted small">${active.filter(r => r.t === "out").length} contas ativas</span></div></div>
    <div class="card"><div class="big"><span class="label">Receitas fixas por mês</span><span class="v in-c">${money(totIn)}</span><span class="muted small">${active.filter(r => r.t === "in").length} receitas ativas</span></div></div>
    <div class="card"><div class="big grey"><span class="label">Ainda não efetivadas em <span class="cap">${esc(monthName(m, { month: "long" }))}</span></span><span class="v">${pend.length}</span><span class="muted small">${money(pend.filter(x => x.r.t === "out").reduce((a, x) => a + x.r.v, 0))} em despesas</span></div></div>
  </section>
  ${ed ? recFormHTML(ed) : ""}
  <section class="card">
    <div class="card-head"><h2>Contas que se repetem todo mês</h2><button class="btn sm" data-act="rec-edit" data-id="new">+ Nova conta fixa</button></div>
    ${rows ? `<div class="tablewrap"><table class="stack"><thead><tr><th>Conta</th><th>Dia</th><th>Pago com</th><th class="r">Valor</th><th>Situação em <span class="cap">${esc(monthName(m, { month: "short" }))}</span></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><h3>Nenhuma conta fixa</h3><span>Cadastre aluguel, condomínio, internet, academia, escola, salário… Todo mês elas aparecem para você só clicar em <b>Efetivar</b>.</span></div>`}
    <div class="muted small">Ao efetivar, o lançamento é criado com o valor cadastrado. Use <b>Alterar</b> quando o valor do mês for diferente (conta de luz, por exemplo). Também dá para marcar <b>Conta fixa</b> ao fazer um lançamento novo.</div>
  </section>`;
}
function recFormHTML(r) {
  const catOpts = (type) => st().categories.filter(c => c.type === type && (!c.archived || c.id === r.c)).flatMap(c => [`<option value="${esc(c.id)}|" ${r.c === c.id && !r.s ? "selected" : ""}>${esc(c.name)}</option>`,
    ...c.subs.filter(x => !x.archived || x.id === r.s).map(x => `<option value="${esc(c.id)}|${esc(x.id)}" ${r.c === c.id && r.s === x.id ? "selected" : ""}>${esc(c.name)} › ${esc(x.name)}</option>`)]).join("");
  const t = S.recType || r.t;
  return `<section class="card"><div class="card-head"><h2>${r.id === "new" ? "Nova conta fixa" : "Editar " + esc(recTitle(r))}</h2><button class="small-btn" data-act="rec-cancel">Fechar</button></div>
    <form class="formgrid" data-form="rec" data-id="${esc(r.id)}" autocomplete="off">
      <label>Tipo<select class="field" name="t" id="rf-t" data-change="rec-type"><option value="out" ${t === "out" ? "selected" : ""}>Despesa</option><option value="in" ${t === "in" ? "selected" : ""}>Receita</option></select></label>
      <label>Nome<input class="field" name="n" id="rf-n" value="${esc(r.n)}" placeholder="Ex.: Aluguel, Internet, Academia"></label>
      <label>Valor por mês<span class="money-field"><input class="field" name="v" id="rf-v" inputmode="decimal" value="${esc(centsToInput(r.v))}" placeholder="0,00"></span></label>
      <label>Dia do mês<input class="field" type="number" min="1" max="31" name="day" id="rf-day" value="${esc(r.day)}"></label>
      <label>Categoria<select class="field" name="cat" id="rf-cat">${catOpts(t)}</select></label>
      <label>Forma de pagamento<select class="field" name="p" id="rf-p"><option value="">—</option>${PAY.filter(([k]) => t === "out" || k !== "credito").map(([k, nm]) => `<option value="${k}" ${r.p === k ? "selected" : ""}>${nm}</option>`).join("")}</select></label>
      <label>Conta (se não for crédito)<select class="field" name="a" id="rf-a"><option value="">—</option>${activeAccs().map(a => `<option value="${esc(a.id)}" ${r.a === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
      ${t === "out" ? `<label>Cartão (se for crédito)<select class="field" name="k" id="rf-k"><option value="">—</option>${activeCards().map(k => `<option value="${esc(k.id)}" ${r.k === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select></label>` : ""}
      <label>A partir de<input class="field" type="month" name="start" id="rf-start" value="${esc(r.start)}"></label>
      <label>Até (opcional)<input class="field" type="month" name="end" id="rf-end" value="${esc(r.end || "")}"></label>
      <button class="btn" type="submit">Salvar</button>
    </form>
    ${r.id !== "new" ? `<div class="actions"><button class="small-btn" data-act="rec-toggle" data-id="${esc(r.id)}">${r.active === false ? "Reativar" : "Pausar"}</button><button class="small-btn bad" data-act="rec-del" data-id="${esc(r.id)}">Excluir conta fixa</button><span class="muted small">Excluir não apaga os lançamentos já efetivados.</span></div>` : ""}
  </section>`;
}

// ---------- EXTRATO (saldo dia a dia, com previstos) ----------
function extratoHTML(m) {
  if (!activeAccs().length) return `<div class="empty"><span>Cadastre suas contas para ver o extrato com saldo.</span><a class="btn sm" href="#contas">Cadastrar conta</a></div>`;
  const sumBal = (d) => st().accounts.reduce((a, x) => a + balance(x, d), 0);
  const start = m + "-01", today = todayISO();
  const ev = [];
  for (const t of S.tx) {
    if (t.m !== m) continue;
    if (isCredit(t)) continue;                                  // compra no crédito só sai da conta quando a fatura é paga
    if ((t.t === "in" || t.t === "out") && !t.a) continue;      // sem conta: não mexe em saldo
    ev.push({ d: t.d, t });
  }
  for (const x of recPending(m)) { if (x.r.t === "out" && x.r.p === "credito") continue; ev.push({ d: x.d, rec: x, delta: x.r.t === "in" ? x.r.v : -x.r.v }); }
  for (const k of st().cards) { const i = cardInfo(k), rem = (i.inv[m] || 0) - (i.paid[m] || 0); if (rem > 0) ev.push({ d: invoiceDates(k, m).due || endOfMonth(m), inv: k, delta: -rem }); }
  ev.sort((a, b) => a.d.localeCompare(b.d) || (a.t ? 0 : 1) - (b.t ? 0 : 1));
  const days = [...new Set(ev.map(e => e.d))];
  let pend = 0;
  const rows = [`<tr class="dayrow"><td colspan="3" style="text-transform:none">Saldo no início do mês</td><td class="r">${moneyS(sumBal(addDays(start, -1)))}</td></tr>`];
  for (const d of days) {
    rows.push(`<tr class="dayrow"><td colspan="4">${dm(d)} · ${esc(weekday(d))}</td></tr>`);
    for (const e of ev.filter(e => e.d === d)) {
      if (e.t) { const t = e.t; rows.push(`<tr class="click" data-act="edit" data-id="${esc(t.id)}"><td><b>${esc(txTitle(t))}</b></td><td>${catLabel(t)}</td><td>${srcHTML(t)}</td><td class="r">${amtHTML(t)}</td></tr>`); }
      else if (e.rec) { pend += e.delta; const r = e.rec.r; rows.push(`<tr class="pend"><td><b>${esc(recTitle(r))}</b> <span class="tag">previsto</span></td><td>${catLabel(r)}</td><td>${srcHTML(r)}</td><td class="r"><span class="actions" style="justify-content:flex-end;flex-wrap:nowrap">${amtHTML(r)}<button class="btn sm" data-act="rec-eff" data-id="${esc(r.id)}" data-m="${m}">Efetivar</button></span></td></tr>`); }
      else { pend += e.delta; const k = e.inv; rows.push(`<tr class="pend"><td><b>Fatura ${esc(k.name)}</b> <span class="tag">previsto</span></td><td class="muted">Vencimento da fatura</td><td>${srcHTML({ t: "pay", a: k.payAccount })}</td><td class="r"><span class="actions" style="justify-content:flex-end;flex-wrap:nowrap"><span class="amt-out">− ${money(-e.delta)}</span><button class="btn sm" data-act="pay" data-id="${esc(k.id)}" data-key="${m}">Pagar</button></span></td></tr>`); }
    }
    const bal = sumBal(d) + pend;
    rows.push(`<tr><td colspan="3" class="muted small">${d < today && !pend ? "Saldo no fim do dia" : "Saldo previsto no fim do dia"}</td><td class="r"><b class="${bal < 0 ? "out-c" : ""}">${moneyS(bal)}</b></td></tr>`);
  }
  return `<div class="tablewrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="r">Valor</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <div class="muted small">O extrato mostra o que entra e sai das suas contas, somando todas. Compras no crédito aparecem como a fatura, no vencimento. Itens marcados como <b>previsto</b> ainda não aconteceram: contas fixas não efetivadas e faturas não pagas.</div>`;
}

// ---------- OBJETIVOS ----------
function goalSaved(g) { return (g.initial || 0) + (g.deposits || []).reduce((a, x) => a + x.v, 0); }
function monthsUntil(date) { if (!date) return null; const [y1, m1] = curMonth().split("-").map(Number), [y2, m2] = date.split("-").map(Number); return (y2 - y1) * 12 + (m2 - m1); }
function ringSVG(p, color) {
  const r = 36, c = 2 * Math.PI * r, f = Math.min(1, Math.max(0, p / 100));
  return `<svg viewBox="0 0 90 90" width="96" height="96" aria-hidden="true"><circle cx="45" cy="45" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/>
    <circle cx="45" cy="45" r="${r}" fill="none" stroke="${esc(color)}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 45 45)"/>
    <text x="45" y="50" text-anchor="middle" style="font: 700 17px var(--f-display); fill: var(--fg)">${Math.round(p)}%</text></svg>`;
}
function goalCardHTML(g, compact) {
  const saved = goalSaved(g), rem = Math.max(0, g.target - saved), p = g.target ? saved / g.target * 100 : 0;
  const ml = monthsUntil(g.date), ideal = ml === null ? null : rem / Math.max(1, ml);
  const color = g.color || "#0d6b59";
  if (compact) return `<div style="display:grid;gap:5px"><div class="kv"><span><b>${esc(g.name)}</b>${g.done ? ` <span class="status open">alcançado</span>` : ""}</span><span class="small">${money(saved)} de ${money(g.target)}</span></div>
    <div class="meter"><i style="width:${Math.min(100, p)}%;background:${esc(color)}"></i></div>
    <div class="muted small">${g.done ? "Objetivo alcançado" : rem ? `Faltam ${money(rem)}${ideal !== null ? ` · ideal ${money(ideal)}/mês` : ""}` : "Valor atingido"}</div></div>`;
  const open = S.goalOpen === g.id;
  return `<div class="card goal">
    <div class="card-head"><div><h2>${esc(g.name)}</h2>${g.desc ? `<div class="muted small">${esc(g.desc)}</div>` : ""}</div>
      <span class="actions"><button class="small-btn" data-act="goal-edit" data-id="${esc(g.id)}">Editar</button></span></div>
    <div class="goalbody">
      <div style="display:grid;gap:8px">
        <div><span class="label">Objetivo</span><div class="kpi"><span class="v">${money(g.target)}</span></div></div>
        ${g.date ? `<div><span class="label">Espero alcançar em</span><div><b>${esc(g.date.split("-").reverse().join("/"))}</b> <span class="muted small">${ml > 0 ? `faltam ${ml} ${ml === 1 ? "mês" : "meses"}` : ml === 0 ? "este mês" : "data já passou"}</span></div></div>` : ""}
        ${ideal !== null && rem && !g.done ? `<div><span class="label">Ideal por mês</span><div><b>${money(ideal)}</b></div></div>` : ""}
      </div>
      <div style="display:grid;justify-items:center;gap:2px">${ringSVG(p, color)}<b style="color:${esc(color)}">${money(saved)}</b><span class="muted small">${g.done ? "alcançado" : rem ? "faltam " + money(rem) : "valor atingido"}</span></div>
    </div>
    <form class="actions" data-form="deposit" data-id="${esc(g.id)}" autocomplete="off">
      <span class="money-field" style="width:140px"><input class="field" name="v" id="gd-${esc(g.id)}" inputmode="decimal" placeholder="Depósito"></span>
      <input class="field" type="date" name="d" value="${todayISO()}" style="width:auto" aria-label="Data do depósito">
      <button class="btn sm" type="submit">+ Depositar</button>
      <button class="small-btn" type="button" data-act="goal-open" data-id="${esc(g.id)}">${open ? "Esconder" : "Depósitos e calculadora"}</button>
    </form>
    ${open ? `<div style="display:grid;gap:10px;border-top:1px solid var(--line);padding-top:12px">
      <div class="small">Se eu guardar por mês <span class="money-field" style="display:inline-block;width:130px;vertical-align:middle"><input class="field" id="calc-${esc(g.id)}" data-calc="${esc(g.id)}" inputmode="decimal" placeholder="0,00"></span>
        <span id="calcr-${esc(g.id)}" class="muted">digite um valor para ver quando alcança</span></div>
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-change="goal-done" data-id="${esc(g.id)}" ${g.done ? "checked" : ""}> Objetivo alcançado</label>
      <div class="label">Depósitos</div>
      ${(g.initial ? `<div class="kv small"><span>Saldo inicial</span><b>${money(g.initial)}</b></div>` : "") + ((g.deposits || []).slice().sort((a, b) => b.d.localeCompare(a.d)).map(x => `<div class="kv small"><span>${esc(x.d.split("-").reverse().join("/"))}</span><span><b>${money(x.v)}</b> <button class="small-btn bad" data-act="goal-dep-del" data-id="${esc(g.id)}" data-dep="${esc(x.id)}" aria-label="Apagar depósito">×</button></span></div>`).join("") || `<div class="muted small">Nenhum depósito ainda.</div>`)}
    </div>` : ""}
  </div>`;
}
function viewObjetivos() {
  const goals = st().goals || [];
  const ed = S.editGoal === "new" ? { id: "new", name: "", desc: "", target: 0, date: "", initial: 0, color: COLORS[(goals.length + 4) % COLORS.length] } : goals.find(g => g.id === S.editGoal);
  const totSaved = goals.reduce((a, g) => a + goalSaved(g), 0);
  return `${topBar("Objetivos", false)}
  <div class="actions" style="justify-content:space-between"><span class="muted small">${goals.length ? `Guardado em ${goals.length} objetivo${goals.length > 1 ? "s" : ""}: <b>${money(totSaved)}</b>` : ""}</span><button class="btn sm" data-act="goal-edit" data-id="new">+ Novo objetivo</button></div>
  ${ed ? `<section class="card"><div class="card-head"><h2>${ed.id === "new" ? "Novo objetivo" : "Editar " + esc(ed.name)}</h2><button class="small-btn" data-act="goal-cancel">Fechar</button></div>
    <form class="formgrid" data-form="goal" data-id="${esc(ed.id)}" autocomplete="off">
      <label>Nome<input class="field" name="name" id="gf-name" value="${esc(ed.name)}" placeholder="Ex.: Viagem, Carro, Reserva de emergência"></label>
      <label>Descrição<input class="field" name="desc" value="${esc(ed.desc || "")}" placeholder="Ex.: Descansar e viver"></label>
      <label>Valor do objetivo<span class="money-field"><input class="field" name="target" inputmode="decimal" value="${esc(centsToInput(ed.target))}" placeholder="0,00"></span></label>
      <label>Quando quero alcançar<input class="field" type="date" name="date" value="${esc(ed.date || "")}"></label>
      <label>Já tenho guardado<span class="money-field"><input class="field" name="initial" inputmode="decimal" value="${esc(centsToInput(ed.initial))}" placeholder="0,00"></span></label>
      <label>Cor<select class="field" name="color">${COLORS.map((c, i) => `<option value="${c}" ${ed.color === c ? "selected" : ""} style="color:${c}">● Cor ${i + 1}</option>`).join("")}</select></label>
      <button class="btn" type="submit">Salvar objetivo</button></form>
    ${ed.id !== "new" ? `<div><button class="small-btn bad" data-act="goal-del" data-id="${esc(ed.id)}">Excluir objetivo</button></div>` : ""}</section>` : ""}
  <section class="grid2">${goals.map(g => goalCardHTML(g, false)).join("") || `<div class="card"><div class="empty"><h3>Nenhum objetivo ainda</h3><span>Crie objetivos como uma viagem, um carro ou a reserva de emergência. O sistema mostra quanto guardar por mês para chegar lá.</span></div></div>`}</section>
  <div class="muted small">Os depósitos dos objetivos são um controle à parte e não mexem no saldo das contas. Se você separa o dinheiro numa conta própria (uma poupança, por exemplo), registre também uma transferência para ela.</div>`;
}
function calcGoal(id, val) {
  const g = (st().goals || []).find(x => x.id === id), out = $("#calcr-" + id); if (!g || !out) return;
  const v = parseMoney(val), rem = Math.max(0, g.target - goalSaved(g));
  if (!v) { out.textContent = "digite um valor para ver quando alcança"; return; }
  if (!rem) { out.textContent = "o objetivo já foi atingido"; return; }
  const n = Math.ceil(rem / v);
  out.innerHTML = `alcança em <b>${n} ${n === 1 ? "mês" : "meses"}</b>, em <b class="cap">${esc(monthName(addMonth(curMonth(), n)))}</b>`;
}

// =====================================================================
// events
// =====================================================================
const ACTIONS = {
  theme: (el) => { st().prefs.theme = el.dataset.v; applyTheme(); saveSettings(); if (sheetState?.kind === "menu") renderSheet(); },
  month: (el) => { S.month = addMonth(S.month, +el.dataset.k); S.period.start = null; S.txFilter = "all"; render(); },
  "month-today": () => { S.month = curMonth(); S.period.start = null; render(); },
  "open-month": (el) => { S.month = el.dataset.m; S.period.start = null; go("inicio"); },
  seed: () => {
    for (const type of ["out", "in"]) for (const [name, subs] of Object.entries(SUGGESTED[type])) if (!st().categories.some(c => norm(c.name) === norm(name))) st().categories.push({ id: "c" + uid8(), name, type, budget: 0, archived: false, subs: mkSubs(subs) });
    saveSettings(); toast("Categorias criadas. Ajuste as metas em Categorias.");
  },
  "merge-subs": () => {
    let added = 0; const all = { ...SUGGESTED.out, ...SUGGESTED.in };
    for (const c of st().categories) { const sg = Object.entries(all).find(([n]) => norm(n) === norm(c.name)); if (!sg) continue; const miss = sg[1].filter(sn => !c.subs.some(x => norm(x.name) === norm(sn))); added += miss.length; c.subs.push(...mkSubs(miss)); }
    saveSettings(); toast(`${added} subcategorias adicionadas`);
  },
  pmode: (el) => { S.period = { mode: el.dataset.v, start: null }; render(); },
  divsort: () => { S.divSort = S.divSort === "valor" ? "az" : "valor"; render(); },
  expand: (el) => { const id = el.dataset.id; S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id); render(); },
  filter: (el) => { S.txFilter = el.dataset.v; render(); },
  edit: (el) => {
    const t = S.tx.find(x => x.id === el.dataset.id); if (!t) return;
    if (t.t === "pay") { sheetState = { kind: "pay", id: t.id, k: t.k, f: t.f, v: t.v, a: t.a, d: t.d }; renderSheet(); sheet.hidden = false; scrim.hidden = false;
      sheet.querySelector(".sheet-foot").insertAdjacentHTML("afterbegin", `<button class="btn ghost" data-act="p-del">Apagar pagamento</button>`); return; }
    openSheet({ id: t.id, t: t.t, v: t.v, c: t.c || null, s: t.s || null, p: t.p || "", k: t.k || "", a: t.a || "", a2: t.a2 || "", n: t.n || "", o: t.o || "", d: t.d });
  },
  // contas
  "acc-edit": (el) => { S.editAcc = el.dataset.id; render(); setTimeout(() => $("#af-name")?.focus(), 0); },
  "acc-cancel": () => { S.editAcc = null; render(); },
  "acc-del": (el) => { const id = el.dataset.id, used = S.tx.some(t => t.a === id || t.a2 === id); const a = accById(id);
    if (used) a.archived = true; else st().accounts = st().accounts.filter(x => x.id !== id);
    if (st().prefs.defaultAccount === id) st().prefs.defaultAccount = activeAccs().find(x => x.id !== id)?.id || "";
    S.editAcc = null; saveSettings(); toast(used ? "Conta arquivada" : "Conta excluída"); },
  "acc-unarchive": (el) => { accById(el.dataset.id).archived = false; saveSettings(); },
  "assign-acc": () => { const a = $("#assignAcc").value; const list = S.tx.filter(t => (t.t === "in" || (t.t === "out" && t.p !== "credito")) && !t.a).map(t => ({ ...t, a })); putTx(list); toast(`${list.length} lançamentos atribuídos a ${accById(a)?.name}`); },
  // cartões
  "card-edit": (el) => { S.editCard = el.dataset.id; if (S.view !== "cartoes") go("cartoes"); else render(); setTimeout(() => $("#cf-name")?.focus(), 0); },
  "card-cancel": () => { S.editCard = null; render(); },
  "card-del": (el) => { const id = el.dataset.id, used = S.tx.some(t => t.k === id); if (used) cardById(id).archived = true; else st().cards = st().cards.filter(k => k.id !== id); S.editCard = null; saveSettings(); toast(used ? "Cartão arquivado" : "Cartão excluído"); },
  "card-unarchive": (el) => { cardById(el.dataset.id).archived = false; saveSettings(); },
  invoice: (el) => { const k = cardById(el.dataset.id); S.invoice = { k: k.id, key: cardInfo(k).showKey }; if (S.view !== "cartoes") go("cartoes"); else render(); setTimeout(() => $("#fatura")?.scrollIntoView({ behavior: "smooth" }), 50); },
  "inv-nav": (el) => { S.invoice.key = addMonth(S.invoice.key, +el.dataset.k); render(); },
  "inv-close": () => { S.invoice = null; render(); },
  pay: (el) => openPay(el.dataset.id, el.dataset.key),
  // categorias
  "cat-del": (el) => { S.pendingDel = el.dataset.id; render(); },
  "cat-del-no": () => { S.pendingDel = null; render(); },
  "cat-del-yes": (el) => { const id = el.dataset.id, used = S.tx.some(t => t.c === id); S.pendingDel = null;
    if (used) catById(id).archived = true; else st().categories = st().categories.filter(c => c.id !== id); saveSettings(); toast(used ? "Categoria arquivada" : "Categoria excluída"); },
  "cat-unarchive": (el) => { catById(el.dataset.id).archived = false; saveSettings(); },
  "sub-edit": (el) => { S.editSub = { c: el.dataset.c, s: el.dataset.s }; render(); setTimeout(() => { const i = $("#se-" + el.dataset.s); i?.focus(); i?.select(); }, 0); },
  "sub-cancel": () => { S.editSub = null; render(); },
  "sub-save": (el) => { const name = $("#se-" + el.dataset.s)?.value.trim(); S.editSub = null; const x = subOf(catById(el.dataset.c), el.dataset.s); if (name && x) { x.name = name; saveSettings(); } else render(); },
  "sub-del": (el) => { const c = catById(el.dataset.c), sid = el.dataset.s, used = S.tx.some(t => t.s === sid), x = subOf(c, sid); S.editSub = null;
    if (used) x.archived = true; else c.subs = c.subs.filter(y => y.id !== sid); saveSettings(); toast(used ? `"${x.name}" saiu da lista. Lançamentos antigos continuam com ela.` : `"${x.name}" removida`); },
  // config
  cardmonth: (el) => { st().prefs.cardMonth = el.dataset.v; saveSettings(); },
  signout: () => S.store.signOut(),
  "sync-now": () => { S.store.syncNow?.(); toast("Sincronizando com o Dropbox…"); },
  import: () => $("#importInput").click(),
  "export-json": () => downloadText(`financas-backup-${todayISO()}.json`, JSON.stringify({ app: "minhas-financas", v: 3, exportedAt: new Date().toISOString(), settings: st(), transactions: S.tx }, null, 1), "application/json"),
  "export-csv": () => exportCSV(),
  // etapa 2
  "lanc-mode": (el) => { S.lancMode = el.dataset.v; render(); },
  "avg-n": (el) => { st().prefs.avgMonths = +el.dataset.v; saveSettings(); },
  "an-type": (el) => { S.anType = el.dataset.v; render(); },
  "use-sugg": (el) => { const c = catById(el.dataset.id); c.budget = +el.dataset.v; saveSettings(); toast(`Meta de ${c.name}: ${money(c.budget)}`); },
  "use-sugg-sub": (el) => { const x = subOf(catById(el.dataset.c), el.dataset.s); x.budget = +el.dataset.v; saveSettings(); toast(`Meta de ${x.name}: ${money(x.budget)}`); },
  "use-all-sugg": () => { let n = 0; for (const c of activeCats("out")) { const sg = suggest(avgOf(spendIdx().cat[c.id], avgN())); if (!c.budget && sg) { c.budget = sg; n++; } } saveSettings(); toast(`Meta definida em ${n} categorias`); },
  "meta-detail": (el) => { S.metaDetail = el.dataset.id || null; if (el.dataset.go && S.view !== el.dataset.go) go(el.dataset.go); else render(); if (S.metaDetail) setTimeout(() => $("#catdetail")?.scrollIntoView({ behavior: "smooth" }), 60); },
  "rec-eff": (el) => { const r = st().recurring.find(x => x.id === el.dataset.id); const m = el.dataset.m; const [y, mo] = m.split("-").map(Number); const d = ymd(y, mo, r.day || 1); effectivate(r, m, d); toast(`${recTitle(r)} efetivada: ${money(r.v)}`); },
  "rec-edit-eff": (el) => { const r = st().recurring.find(x => x.id === el.dataset.id); const m = el.dataset.m; const [y, mo] = m.split("-").map(Number);
    openSheet({ t: r.t, v: r.v, c: r.c, s: r.s || null, p: r.p || "", k: r.k || "", a: r.a || "", n: r.n || "", d: ymd(y, mo, r.day || 1), r: r.id, rm: m }); },
  "rec-skip": (el) => { const r = st().recurring.find(x => x.id === el.dataset.id); r.skip = [...(r.skip || []), S.month]; saveSettings(); toast(`${recTitle(r)} pulada em ${monthName(S.month, { month: "long" })}`); },
  "rec-unskip": (el) => { const r = st().recurring.find(x => x.id === el.dataset.id); r.skip = (r.skip || []).filter(x => x !== S.month); saveSettings(); },
  "rec-edit": (el) => { S.editRec = el.dataset.id; S.recType = null; render(); setTimeout(() => $("#rf-n")?.focus(), 0); },
  "rec-cancel": () => { S.editRec = null; S.recType = null; render(); },
  "rec-toggle": (el) => { const r = st().recurring.find(x => x.id === el.dataset.id); r.active = r.active === false; saveSettings(); toast(r.active ? "Conta fixa reativada" : "Conta fixa pausada"); },
  "rec-del": (el) => { st().recurring = st().recurring.filter(x => x.id !== el.dataset.id); S.editRec = null; saveSettings(); toast("Conta fixa excluída"); },
  "goal-edit": (el) => { S.editGoal = el.dataset.id; render(); scrollTo(0, 0); setTimeout(() => $("#gf-name")?.focus(), 0); },
  "goal-cancel": () => { S.editGoal = null; render(); },
  "goal-del": (el) => { st().goals = st().goals.filter(g => g.id !== el.dataset.id); S.editGoal = null; saveSettings(); toast("Objetivo excluído"); },
  "goal-open": (el) => { S.goalOpen = S.goalOpen === el.dataset.id ? null : el.dataset.id; render(); },
  "goal-dep-del": (el) => { const g = st().goals.find(x => x.id === el.dataset.id); g.deposits = g.deposits.filter(x => x.id !== el.dataset.dep); saveSettings(); },
  install: async () => { const p = S.installPrompt; if (!p) return; p.prompt(); await p.userChoice.catch(() => {}); S.installPrompt = null; render(); },
  "wipe": () => { S.confirmWipe = true; render(); },
  "wipe-no": () => { S.confirmWipe = false; render(); },
  "wipe-yes": () => { S.confirmWipe = false; delTx(S.tx.map(t => t.id)); S.settings = DEFAULT_SETTINGS(); S.settings.prefs.theme = "auto"; saveSettings(); toast("Todos os dados foram apagados"); go("inicio"); },
  // sheet
  close: () => closeSheet(),
  menu: () => { sheetState = { kind: "menu" }; renderSheet(); sheet.hidden = false; scrim.hidden = false; },
  "new-tx": () => openSheet(),
  "s-type": (el) => { syncForm(); const f = sheetState; if (f.t !== el.dataset.v) { f.t = el.dataset.v; f.c = null; f.s = null; if (f.t === "in" && f.p === "credito") f.p = ""; } renderSheet(); },
  "s-cat": (el) => { syncForm(); const f = sheetState; if (f.c !== el.dataset.v) f.s = null; f.c = el.dataset.v; f.newSub = false; renderSheet(); },
  "s-sub": (el) => { syncForm(); sheetState.s = sheetState.s === el.dataset.v ? null : el.dataset.v; renderSheet(); },
  "s-pay": (el) => { syncForm(); sheetState.p = sheetState.p === el.dataset.v ? "" : el.dataset.v; renderSheet(); },
  "s-card": (el) => { syncForm(); sheetState.k = el.dataset.v; renderSheet(); },
  "s-acc": (el) => { syncForm(); sheetState.a = el.dataset.v; renderSheet(); },
  "s-acc2": (el) => { syncForm(); sheetState.a2 = el.dataset.v; renderSheet(); },
  "s-mode": (el) => { syncForm(); sheetState.mode = el.dataset.v; renderSheet(); },
  "s-date": (el) => { syncForm(); sheetState.d = el.dataset.v; renderSheet(); },
  "s-newcat": () => { syncForm(); sheetState.newCat = true; renderSheet(); $("#f-newcat")?.focus(); },
  "s-newcat-save": () => { const name = $("#f-newcat").value; syncForm(); if (!name.trim()) return; const id = addCategory(name, sheetState.t); sheetState.c = id; sheetState.newCat = false; renderSheet(); },
  "s-newsub": () => { syncForm(); sheetState.newSub = true; renderSheet(); $("#f-newsub")?.focus(); },
  "s-newsub-save": () => { const name = $("#f-newsub").value; syncForm(); if (!name.trim()) return; const id = addSub(sheetState.c, name); sheetState.s = id; sheetState.newSub = false; renderSheet(); },
  "s-newcard": () => { syncForm(); sheetState.newCard = true; renderSheet(); $("#f-newcard")?.focus(); },
  "s-newcard-save": () => { const name = $("#f-newcard").value; syncForm(); if (!name.trim()) return; const id = addCard(name); sheetState.k = id; sheetState.newCard = false; renderSheet(); toast("Cartão criado. Complete limite, fechamento e vencimento em Cartões."); },
  "s-save": () => saveSheet(false),
  "s-save-more": () => saveSheet(true),
  "s-del": () => { syncForm(); sheetState.confirmDel = true; renderSheet(); },
  "s-del-no": () => { sheetState.confirmDel = false; renderSheet(); },
  "s-del-yes": () => { const id = sheetState.id; closeSheet(); delTx([id]); toast("Lançamento apagado"); },
  "s-del-all": () => { const t = S.tx.find(x => x.id === sheetState.id); closeSheet(); if (t?.g) { delTx(S.tx.filter(x => x.g === t.g).map(x => x.id)); toast(`${t.pn} parcelas apagadas`); } },
  "s-dup": () => { syncForm(); const f = sheetState; openSheet({ t: f.t, v: f.v, c: f.c, s: f.s, p: f.p, k: f.k, a: f.a, a2: f.a2, n: f.n, o: f.o, d: todayISO() }); toast("Cópia pronta. Confira a data e salve."); },
  "p-save": () => { const f = sheetState; if (f.id) { syncForm(); const o = S.tx.find(t => t.id === f.id); if (!f.v) return; putTx([{ ...o, v: f.v, a: f.a, f: f.f, d: f.d, m: f.d.slice(0, 7) }]); closeSheet(); toast("Pagamento atualizado"); } else saveSheet(false); },
  "p-del": () => { const id = sheetState.id; closeSheet(); delTx([id]); toast("Pagamento apagado"); },
};
document.addEventListener("click", e => {
  if (e.target.id === "monthPick") { try { e.target.showPicker(); } catch {} return; }
  const el = e.target.closest("[data-act]"); if (!el) return;
  const fn = ACTIONS[el.dataset.act]; if (!fn) return;
  if (el.tagName !== "A") e.preventDefault();
  fn(el, e);
});
scrim.addEventListener("click", closeSheet);
$("#fab").addEventListener("click", () => openSheet());
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && sheetState) closeSheet();
  if (e.key === "Enter" && sheetState && !e.shiftKey) {
    const id = e.target.id;
    if (id === "f-newcat") { e.preventDefault(); ACTIONS["s-newcat-save"](); }
    else if (id === "f-newsub") { e.preventDefault(); ACTIONS["s-newsub-save"](); }
    else if (id === "f-newcard") { e.preventDefault(); ACTIONS["s-newcard-save"](); }
    else if (id === "f-v" || id === "f-n") { e.preventDefault(); sheetState.kind === "pay" ? ACTIONS["p-save"]() : saveSheet(false); }
  }
  if (e.target.id?.startsWith("se-")) { if (e.key === "Enter") { e.preventDefault(); root.querySelector('[data-act="sub-save"]')?.click(); } if (e.key === "Escape") { S.editSub = null; render(); } }
  if (e.key === "Enter" && e.target.dataset?.change) e.target.blur();
});
document.addEventListener("input", e => {
  const id = e.target.id;
  if (id === "quickInput") updateQuickPreview();
  if (id === "search") { S.search = e.target.value; render(); }
  if (e.target.dataset?.calc) calcGoal(e.target.dataset.calc, e.target.value);
  if (sheetState && (id === "f-pn" || id === "f-v" || id === "f-d")) {
    const before = sheetState.pn > 1; syncForm();
    if (id === "f-pn" && (sheetState.pn > 1) !== before) { const val = e.target.value; renderSheet(); const i = $("#f-pn"); i.focus(); i.value = val; }
    const pv = $("#f-prev"); if (pv) pv.innerHTML = previewText(sheetState);
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "monthPick" && el.value) { S.month = el.value; S.period.start = null; render(); return; }
  if (el.id === "pstart") { S.period.start = el.value; render(); return; }
  if (el.id === "p-f" && sheetState) { syncForm(); const info = cardInfo(cardById(sheetState.k)); const r = (info.inv[sheetState.f] || 0) - (info.paid[sheetState.f] || 0); sheetState.v = r > 0 ? r : sheetState.v; renderSheet(); return; }
  const ch = el.dataset.change;
  if (ch === "cat-budget") { const c = catById(el.dataset.id), v = parseMoney(el.value) || 0; if (c && c.budget !== v) { c.budget = v; saveSettings(); toast(`${c.type === "out" ? "Meta" : "Previsto"} de ${c.name}: ${money(v)}`); } }
  if (ch === "cat-rename") { const c = catById(el.dataset.id), name = el.value.trim(); if (c && name && name !== c.name) { c.name = name; saveSettings(); } else if (c) el.value = c.name; }
  if (ch === "def-acc") { st().prefs.defaultAccount = el.value; saveSettings(); }
  if (ch === "sub-budget") { const x = subOf(catById(el.dataset.c), el.dataset.s), v = parseMoney(el.value) || 0; if (x && (x.budget || 0) !== v) { x.budget = v; saveSettings(); toast(`Meta de ${x.name}: ${money(v)}`); } }
  if (ch === "goal-done") { const g = st().goals.find(x => x.id === el.dataset.id); g.done = el.checked; saveSettings(); }
  if (ch === "rec-type") { S.recType = el.value; const f = el.form; const keep = { n: f.n.value, v: f.v.value, day: f.day.value }; render(); const nf = $("form[data-form=rec]"); if (nf) { nf.n.value = keep.n; nf.v.value = keep.v; nf.day.value = keep.day; } }
});
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const kind = f.dataset.form, el = f.elements;
  if (kind === "quick") return submitQuick();
  if (kind === "newcat") { const name = el.name.value; if (!name.trim()) return el.name.focus(); addCategory(name, f.dataset.type, parseMoney(el.budget.value) || 0); toast(`Categoria "${name.trim()}" criada`); setTimeout(() => $(`#new-${f.dataset.type}-name`)?.focus(), 0); }
  if (kind === "subadd") { const name = el.name.value; if (!name.trim()) return; addSub(f.dataset.c, name); setTimeout(() => $("#sa-" + f.dataset.c)?.focus(), 0); }
  if (kind === "acc-quick") { const name = el.name.value; if (!name.trim()) return el.name.focus(); addAccount(name, parseMoney(el.initial.value) || 0); toast(`Conta "${name.trim()}" criada`); setTimeout(() => $("#oa-name")?.focus(), 0); }
  if (kind === "acc") {
    const name = el.name.value.trim(); if (!name) return el.name.focus();
    const v = (parseMoney(el.initial.value) || 0) * (el.neg.value === "1" ? -1 : 1);
    const data = { name, type: el.type.value, initial: v, since: el.since.value || todayISO(), color: el.color.value };
    const old = accById(f.dataset.id); if (!old || old.initial !== v || old.since !== data.since) data.setAt = Date.now();
    if (f.dataset.id === "new") addAccount(name, v, data); else { Object.assign(accById(f.dataset.id), data); saveSettings(); }
    S.editAcc = null; render(); toast("Conta salva");
  }
  if (kind === "rec") {
    const v = parseMoney(el.v.value); if (!v) return el.v.focus();
    const [c, sId] = (el.cat.value || "|").split("|"); if (!c) { toast("Escolha uma categoria (cadastre em Categorias)."); return; }
    const day = Math.min(31, Math.max(1, parseInt(el.day.value, 10) || 1));
    const t = el.t.value, p = el.p.value, credit = t === "out" && p === "credito";
    const data = { t, n: el.n.value.trim(), v, day, c, s: sId || "", p, a: credit ? "" : el.a.value, k: credit ? (el.k?.value || "") : "", start: el.start.value || S.month, end: el.end.value || "" };
    if (credit && !data.k) { toast("Escolha o cartão da conta fixa."); return; }
    if (f.dataset.id === "new") st().recurring.push({ id: "r" + uid8(), skip: [], active: true, ...data }); else Object.assign(st().recurring.find(r => r.id === f.dataset.id), data);
    S.editRec = null; S.recType = null; saveSettings(); toast("Conta fixa salva");
  }
  if (kind === "goal") {
    const name = el.name.value.trim(), target = parseMoney(el.target.value); if (!name) return el.name.focus(); if (!target) return el.target.focus();
    const data = { name, desc: el.desc.value.trim(), target, date: el.date.value, initial: parseMoney(el.initial.value) || 0, color: el.color.value };
    if (f.dataset.id === "new") st().goals.push({ id: "g" + uid8(), deposits: [], done: false, ...data }); else Object.assign(st().goals.find(g => g.id === f.dataset.id), data);
    S.editGoal = null; saveSettings(); toast("Objetivo salvo");
  }
  if (kind === "deposit") {
    const v = parseMoney(el.v.value); if (!v) return el.v.focus();
    const g = st().goals.find(x => x.id === f.dataset.id); g.deposits.push({ id: "d" + uid8(), d: el.d.value || todayISO(), v });
    saveSettings(); toast(`Depósito de ${money(v)} em ${g.name}`);
  }
  if (kind === "card") {
    const name = el.name.value.trim(); if (!name) return el.name.focus();
    const day = (x) => { const n = parseInt(x, 10); return n >= 1 && n <= 31 ? n : null; };
    const data = { name, limit: parseMoney(el.limit.value) || 0, closeDay: day(el.closeDay.value), dueDay: day(el.dueDay.value), payAccount: el.payAccount.value, color: el.color.value };
    if (f.dataset.id === "new") st().cards.push({ id: "k" + uid8(), archived: false, ...data }); else Object.assign(cardById(f.dataset.id), data);
    S.editCard = null; saveSettings(); toast("Cartão salvo");
  }
});

// importação da versão anterior (arquivo financas-dados.json) ou de uma cópia de segurança
$("#importInput").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d || d.app !== "minhas-financas") throw new Error("formato");
    const src = d.settings ? d.settings : { categories: d.categories, cards: d.cards, lastPay: d.lastPay };
    const s = st();
    const mergeList = (cur, inc) => { const ids = new Set(cur.map(x => x.id)); return cur.concat((inc || []).filter(x => !ids.has(x.id))); };
    s.categories = mergeList(s.categories, src.categories);
    s.cards = mergeList(s.cards, src.cards);
    s.accounts = mergeList(s.accounts, src.accounts);
    S.settings = normalizeSettings(s);
    saveSettings();
    const tx = (d.transactions || []).filter(t => t && t.id && t.d).map(t => ({ ...t, m: t.d.slice(0, 7) }));
    putTx(tx);
    toast(`Importado: ${tx.length} lançamentos e ${(src.categories || []).length} categorias`);
  } catch { toast("Esse arquivo não é um arquivo de dados do Minhas Finanças."); }
});

function downloadText(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportCSV() {
  const head = ["data", "tipo", "categoria", "subcategoria", "onde", "descricao", "forma de pagamento", "conta", "cartao", "fatura", "parcela", "valor"];
  const tipo = { in: "receita", out: "despesa", transfer: "transferencia", pay: "pagamento de fatura" };
  const lines = [head.join(";")];
  for (const t of S.tx.slice().sort((a, b) => a.d.localeCompare(b.d))) {
    const c = catById(t.c);
    lines.push([t.d.split("-").reverse().join("/"), tipo[t.t] || t.t, c?.name || "", subOf(c, t.s)?.name || "", t.n || "", t.o || "", payName(t.p),
      t.t === "transfer" ? `${accById(t.a)?.name || ""} > ${accById(t.a2)?.name || ""}` : accById(t.a)?.name || "",
      cardById(t.k)?.name || "", isCredit(t) ? invoiceOf(t) : (t.f || ""), t.pn > 1 ? `${t.pi}/${t.pn}` : "", (t.v / 100).toFixed(2).replace(".", ",")]
      .map(x => `"${String(x).replace(/"/g, '""')}"`).join(";"));
  }
  downloadText(`financas-${todayISO()}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
}

let toastT;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3000); }

// instalação como aplicativo (Chrome/Edge) e funcionamento sem internet
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); S.installPrompt = e; if (S.view === "config") render(); });
