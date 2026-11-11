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
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

// =====================================================================
// state
// =====================================================================
const DEFAULT_SETTINGS = () => ({ v: 3, categories: [], cards: [], accounts: [], lastPay: { p: "", k: "", a: "" }, prefs: { theme: "auto", cardMonth: "purchase", defaultAccount: "" } });
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
function clearCaches() { invCache = new Map(); }
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
  for (const t of S.tx) if (t.d <= upto && counts(acc, t)) b += accDelta(t, acc.id);
  return b;
}
function accMonthFlow(acc, m) {
  let inn = 0, out = 0;
  for (const t of S.tx) { if (t.m !== m || !counts(acc, t)) continue; const d = accDelta(t, acc.id); if (d > 0) inn += d; else out -= d; }
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
    <div class="err" id="loginErr"></div></div></div>`;
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
const VIEWS = { inicio: ["Início", "home"], lancamentos: ["Lançamentos", "list"], contas: ["Contas", "bank"], cartoes: ["Cartões", "card"], historico: ["Histórico", "chart"], cadastros: ["Categorias", "tag"], config: ["Configurações", "gear"] };
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
  const body = { inicio: viewInicio, lancamentos: viewLanc, contas: viewContas, cartoes: viewCartoes, historico: viewHist, cadastros: viewCats, config: viewConfig }[S.view]();
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="brand"><i>R$</i>Minhas Finanças</div>
      <div class="grp">Dia a dia</div>${nav("inicio")}${nav("lancamentos")}${nav("contas")}${nav("cartoes")}
      <div class="grp">Analisar</div>${nav("historico")}
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
    <main class="main">${body}</main></div>`;
  $("#fab").hidden = false;
  if (aeId) { const n = document.getElementById(aeId); if (n) { n.focus(); if (sel && n.value === sel[2]) try { n.setSelectionRange(sel[0], sel[1]); } catch {} } }
  if (S.view === "historico") wireHistChart();
  if (S.view === "inicio") updateQuickPreview();
}

function topBar(title, withMonth = true) {
  return `<div class="top"><h1>${title}</h1>${withMonth ? `<div class="month">
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
  const balEnd = sumBal(mEnd) - (isPast ? 0 : dueThisMonth);

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
        <div class="meter"><i style="width:${Math.min(100, usedPct)}%;${cur.out > pOut ? "background:var(--bad)" : ""}"></i></div></div>`
      : `<div class="small muted">Defina metas por categoria em <a class="link" href="#cadastros">Categorias</a> para acompanhar o orçamento.</div>`}
    </div>
    <div class="card">
      ${accs.length ? `
      <div class="big"><span class="label">${isPast ? "Saldo no fim do mês" : isFuture ? "Saldo hoje" : "Saldo geral das contas"}</span><span class="v ${balNow < 0 ? "out-c" : ""}">${moneyS(balNow)}</span>
        <span class="muted small">${accs.length} conta${accs.length > 1 ? "s" : ""} · no início do mês: ${moneyS(balStart)}</span></div>
      ${isPast ? "" : `<div class="big grey"><span class="label">Previsto no fim do mês</span><span class="v ${balEnd < 0 ? "out-c" : ""}">${moneyS(balEnd)}</span><span class="muted small">${dueThisMonth ? "já descontando " + money(dueThisMonth) + " de faturas" : "com os lançamentos já feitos"}</span></div>`}`
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
      ${groupByDay ? "" : `<td class="num">${dm(t.d)}</td>`}
      <td><b>${esc(txTitle(t))}</b>${t.pn > 1 ? `<span class="tag">${t.pi}/${t.pn}</span>` : ""}${t.o ? `<span class="note">${esc(t.o)}</span>` : ""}</td>
      <td>${catLabel(t)}</td><td>${srcHTML(t)}</td><td class="r">${amtHTML(t)}</td></tr>`;
  }).join("");
  return `<div class="tablewrap"><table><thead><tr>${groupByDay ? "" : "<th>Data</th>"}<th>Onde / descrição</th><th>Categoria</th><th>Conta / cartão</th><th class="r">Valor</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// =====================================================================
// LANÇAMENTOS
// =====================================================================
function viewLanc() {
  const q = norm(S.search);
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
    ${rows ? `<div class="tablewrap"><table><thead><tr><th>Conta</th><th>Tipo</th><th class="r">Entradas no mês</th><th class="r">Saídas no mês</th><th class="r">${isPast ? "Saldo no fim do mês" : "Saldo atual"}</th><th class="r">Previsto fim do mês</th></tr></thead>
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
    <div class="tablewrap"><table><thead><tr><th>Mês</th><th class="r">Receitas</th><th class="r">Despesas</th><th class="r">Resultado</th><th class="r">Da meta</th></tr></thead><tbody>${rows}</tbody></table></div>
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
      <button class="btn ghost sm" data-act="import">Importar dados da versão anterior (financas-dados.json)</button>
      <button class="btn ghost sm" data-act="export-json">Baixar cópia de segurança</button>
      <button class="btn ghost sm" data-act="export-csv">Exportar CSV (Excel)</button>
    </div>
    <div class="muted small">A importação junta os lançamentos do arquivo com os que já estão aqui, sem apagar nada. Lançamentos repetidos (mesmo código) são substituídos.</div></section>`;
}

// =====================================================================
// LANÇAMENTO RÁPIDO
// =====================================================================
function quickHTML() {
  return `<section class="quick"><form class="qbox" data-form="quick" autocomplete="off">
    <input id="quickInput" placeholder="Lançamento rápido: padaria 12,50 ontem nubank" aria-label="Lançamento rápido"><button class="btn" type="submit">Lançar</button></form>
    <div class="parse" id="qprev"><span class="muted">Ex.: <b>mercado 230</b> · <b>uber 18 dia 3 pix inter</b> · <b>+ salário 6120 05/11</b>. Para parcelas e descrição, use <b>+ Lançar</b>.</span></div></section>`;
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
  if (!q) { box.innerHTML = `<span class="muted">Ex.: <b>mercado 230</b> · <b>uber 18 dia 3 pix inter</b> · <b>+ salário 6120 05/11</b>. Para parcelas e descrição, use <b>+ Lançar</b>.</span>`; return; }
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
    pn: 1, mode: "total", newCat: false, newSub: false, newCard: false, confirmDel: false, ...init };
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
    <div class="err" id="f-err"></div>
    <div class="sheet-foot">
      ${f.id ? (f.confirmDel ? `<span class="actions">${isInst ? `<button class="btn danger" data-act="s-del-yes">Apagar só esta</button><button class="btn danger" data-act="s-del-all">Apagar as ${orig.pn} parcelas</button>` : `<button class="btn danger" data-act="s-del-yes">Apagar mesmo</button>`}<button class="btn ghost" data-act="s-del-no">Não</button></span>`
        : `<span class="actions"><button class="btn ghost" data-act="s-del">Apagar</button><button class="btn ghost" data-act="s-dup">Duplicar</button></span>`) : ""}
      <div class="right">${f.id ? "" : `<button class="btn ghost" data-act="s-save-more">Salvar e lançar outro</button>`}<button class="btn" data-act="s-save">Salvar</button></div>
    </div>`;
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
  if (orig) {
    putTx([{ ...orig, ...base, v: f.v, d: f.d, m: f.d.slice(0, 7) }]); toast("Lançamento atualizado");
  } else {
    const plan = f.t === "out" ? instPlan(f) : { n: 1 };
    if (plan.n > 1) {
      const g = "g" + uid8(), at = Date.now();
      putTx(plan.parts.map((v, i) => mkTx({ ...base, v, d: addMonthsDate(f.d, i), g, pi: i + 1, pn: plan.n, at: at + i })));
      toast(`Salvo em ${plan.n} parcelas de ${money(plan.parts[plan.n - 1])}`);
    } else { putTx([mkTx({ ...base, v: f.v, d: f.d })]); toast(`Salvo em ${catById(f.c)?.name || ""}`); }
  }
  saveSettings(); // guarda a última forma de pagamento usada
  if (more) openSheet({ t: f.t, d: f.d }); else closeSheet();
}

// =====================================================================
// events
// =====================================================================
const ACTIONS = {
  theme: (el) => { st().prefs.theme = el.dataset.v; applyTheme(); saveSettings(); },
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
  // sheet
  close: () => closeSheet(),
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
