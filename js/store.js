// Camada de dados. Implementações com a mesma interface (start, saveSettings, putTx, delTx, signOut):
//  - Firebase (padrão): login com Google; cada lançamento é um documento em financas/principal/tx e as
//    configurações ficam em financas/principal/cfg/settings. Sincroniza em tempo real entre os aparelhos
//    (você e sua esposa), abre na hora com a cópia do navegador e funciona sem internet.
//  - Local (localStorage): só com ?local=1 no endereço (testes).
//  - Dropbox: não guarda mais os dados; ficou só para TRAZER os dados antigos (mudança para o Firebase).
// O mesmo projeto Firebase guarda o Minhas Compras (casa/principal/regs): daqui se leem as compras
// finalizadas com fin = "pendente" ou "revisar" (caixa "Compras a lançar") e se marca fin = "lancado".
import { dropboxConfig, firebaseConfig } from "./config.js";
import { merge3, legacyMerge } from "./merge.js";

export const cloudConfigured = !!firebaseConfig?.apiKey;
const MODO_LOCAL = new URLSearchParams(location.search).has("local");
export const newId = (p = "t") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const LS_LOCAL = "minhas-financas-v3";
const LS_CACHE = "mf-dropbox-cache";
const LS_TOKEN = "mf-dropbox-token";
const SS_VERIFIER = "mf-dropbox-verifier";
const PATH = dropboxConfig.path || "/minhas-financas-dados.json";
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---------------- local ----------------
function localStore() {
  let data = lsGet(LS_LOCAL) || { settings: null, tx: [] };
  let listener = () => {};
  const save = () => lsSet(LS_LOCAL, data);
  let ver = 0;
  const emit = () => listener({ settings: data.settings, tx: data.tx.slice(), sync: "local", ver: ++ver });
  return {
    mode: "local", user: null,
    async start(onData) { listener = onData; emit(); },
    async saveSettings(s) { data.settings = s; save(); emit(); },
    async putTx(list) { const ids = new Set(list.map(t => t.id)); data.tx = data.tx.filter(t => !ids.has(t.id)).concat(list); save(); emit(); },
    async delTx(ids) { const set = new Set(ids); data.tx = data.tx.filter(t => !set.has(t.id)); save(); emit(); },
    async signOut() {},
    // testes: compras simuladas em window.__comprasTeste; marcações ficam em window.__comprasMarcadas
    ouvirCompras(cb) { const l = () => cb((window.__comprasTeste || []).filter(c => c.fin === "pendente" || c.fin === "revisar")); l(); window.__comprasAtualizar = l; },
    async marcarCompra(id, campos) { (window.__comprasMarcadas ||= []).push({ id, ...campos }); const c = (window.__comprasTeste || []).find(x => x.id === id); if (c) Object.assign(c, campos); window.__comprasAtualizar?.(); },
    async importar(dados) { const r = juntarImport({ settings: data.settings, tx: data.tx }, dados); data.settings = r.settings; data.tx = data.tx.concat(r.novos); save(); emit(); return r; },
    vazio: () => !data.settings && !data.tx.length,
  };
}

// Junta dados trazidos (Dropbox ou arquivo) com os atuais, sem apagar nada:
// cadastros (categorias, cartões, contas, contas fixas, objetivos) entram os que faltam (pelo id);
// lançamentos entram os que ainda não existem.
export function juntarImport(atual, novo) {
  const s = JSON.parse(JSON.stringify(atual.settings || {}));
  const src = novo.settings || {};
  const listas = ["categories", "cards", "accounts", "recurring", "goals"];
  for (const k of listas) {
    const cur = Array.isArray(s[k]) ? s[k] : [];
    const ids = new Set(cur.map(x => x.id));
    s[k] = cur.concat((src[k] || []).filter(x => x && !ids.has(x.id)));
  }
  if (!s.prefs && src.prefs) s.prefs = src.prefs;
  for (const k of Object.keys(src)) if (!(k in s)) s[k] = src[k];
  const tem = new Set((atual.tx || []).map(t => t.id));
  const novos = (novo.tx || []).filter(t => t && t.id && t.d && !tem.has(t.id)).map(t => ({ ...t, m: t.d.slice(0, 7) }));
  return { settings: s, novos };
}

// ---------------- Dropbox: autenticação (OAuth com PKCE, sem senha no código) ----------------
const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}
async function tokenRequest(params) {
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", body: new URLSearchParams({ client_id: dropboxConfig.appKey, ...params }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error_description || j.error || "Falha na autenticação do Dropbox"); e.code = j.error; throw e; }
  return j;
}
async function finishRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return null;
  history.replaceState(null, "", redirectUri() + location.hash);
  if (q.has("error")) throw new Error(q.get("error_description") || "A conexão com o Dropbox foi cancelada.");
  const verifier = sessionStorage.getItem(SS_VERIFIER); sessionStorage.removeItem(SS_VERIFIER);
  if (!verifier) throw new Error("A conexão com o Dropbox expirou. Tente conectar de novo.");
  const j = await tokenRequest({ grant_type: "authorization_code", code: q.get("code"), code_verifier: verifier, redirect_uri: redirectUri() });
  const tok = { refresh: j.refresh_token, access: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000, account: j.account_id };
  lsSet(LS_TOKEN, tok);
  return tok;
}

// ---------------- Dropbox: sincronização ----------------
const clone = (x) => JSON.parse(JSON.stringify(x));
const clean = (d) => ({ settings: d?.settings ?? null, tx: Array.isArray(d?.tx) ? d.tx : [] });

async function dropboxStore(ui) {
  let tok = await finishRedirect().catch(e => { ui.error(e.message); return null; }) || lsGet(LS_TOKEN);
  const store = { mode: "cloud", user: null };
  store.signIn = async () => {
    const { verifier, challenge } = await pkce();
    sessionStorage.setItem(SS_VERIFIER, verifier);
    const u = new URL("https://www.dropbox.com/oauth2/authorize");
    Object.entries({ client_id: dropboxConfig.appKey, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", token_access_type: "offline", redirect_uri: redirectUri() })
      .forEach(([k, v]) => u.searchParams.set(k, v));
    location.href = u.toString();
  };
  // conexão por código (sem redirecionamento): útil no app instalado no iPhone
  // gera (ou reaproveita) o link de autorização; o código que o Dropbox mostrar só funciona neste aparelho,
  // mas o link pode ser aberto em qualquer navegador (Safari, computador...)
  store.codeUrl = async (fresh) => {
    let verifier = localStorage.getItem(SS_VERIFIER);
    if (fresh || !verifier) { verifier = (await pkce()).verifier; localStorage.setItem(SS_VERIFIER, verifier); }
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const u = new URL("https://www.dropbox.com/oauth2/authorize");
    Object.entries({ client_id: dropboxConfig.appKey, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", token_access_type: "offline" })
      .forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  };
  store.startCode = async () => { window.open(await store.codeUrl(false), "_blank"); };
  store.finishCode = async (code) => {
    const verifier = localStorage.getItem(SS_VERIFIER);
    if (!verifier) throw new Error("toque antes em \"Abrir o Dropbox para gerar o código\"");
    const j = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier });
    localStorage.removeItem(SS_VERIFIER);
    lsSet(LS_TOKEN, { refresh: j.refresh_token, access: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000, account: j.account_id });
  };
  if (!tok?.refresh) { store.needsLogin = true; return store; }

  async function access() {
    if (tok.access && tok.exp > Date.now() + 60000) return tok.access;
    try {
      const j = await tokenRequest({ grant_type: "refresh_token", refresh_token: tok.refresh });
      tok = { ...tok, access: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000 }; lsSet(LS_TOKEN, tok);
      return tok.access;
    } catch (e) {
      if (e.code === "invalid_grant") { lsSet(LS_TOKEN, null); ui.error("A conexão com o Dropbox foi desfeita. Recarregue a página e conecte de novo."); }
      throw e;
    }
  }
  async function call(url, { arg, body, json } = {}, retry = true) {
    const headers = { Authorization: "Bearer " + await access() };
    if (arg) headers["Dropbox-API-Arg"] = JSON.stringify(arg).replace(/[\u007f-￿]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
    if (json !== undefined) headers["Content-Type"] = "application/json";
    else if (body !== undefined) headers["Content-Type"] = "application/octet-stream";
    const r = await fetch(url, { method: "POST", headers, body: json !== undefined ? JSON.stringify(json) : body });
    if (r.status === 401 && retry) { tok.exp = 0; return call(url, { arg, body, json }, false); }
    return r;
  }

  // estado: a última versão conhecida do arquivo, a revisão dela no Dropbox e se há alterações locais por enviar
  const cache = lsGet(LS_CACHE) || {};
  // data = versão deste aparelho; base = última versão sincronizada com o Dropbox (referência da junção em 3 vias)
  let data = clean(cache.data), base = cache.base ? clean(cache.base) : (cache.data && !cache.dirty ? clean(cache.data) : null);
  let rev = cache.rev || null, dirty = !!cache.dirty, status = dirty ? "saving" : "saved", listener = () => {}, pushTimer = null, busy = false, again = false;
  const saveCache = () => lsSet(LS_CACHE, { data, base, rev, dirty });
  const join = (remote) => base ? merge3(base, data, remote) : legacyMerge(data, remote);
  let ver = 1;                 // muda só quando os dados mudam (status de sincronização não conta)
  const emit = () => listener({ settings: data.settings, tx: data.tx.slice(), sync: status, ver });
  const bump = () => { ver++; };
  const setStatus = (s) => { if (s !== status) { status = s; emit(); } };

  async function download() {
    const r = await call("https://content.dropboxapi.com/2/files/download", { arg: { path: PATH } });
    if (r.status === 409) { const j = await r.json().catch(() => ({})); if (JSON.stringify(j).includes("not_found")) return { notFound: true }; throw new Error("Erro ao ler o arquivo no Dropbox"); }
    if (!r.ok) throw new Error("Erro ao ler o arquivo no Dropbox (" + r.status + ")");
    let meta = null; try { meta = JSON.parse(r.headers.get("Dropbox-API-Result")); } catch {}
    const text = await r.text();
    const remote = clean(text.trim() ? JSON.parse(text) : {});
    return { remote, rev: meta?.rev || await currentRev() };
  }
  async function currentRev() {
    const r = await call("https://api.dropboxapi.com/2/files/get_metadata", { json: { path: PATH } });
    if (r.status === 409) return null;
    if (!r.ok) throw new Error("Erro ao consultar o Dropbox (" + r.status + ")");
    return (await r.json()).rev;
  }
  async function upload() {
    const payload = { app: "minhas-financas", v: 4, savedAt: Date.now(), settings: data.settings, tx: data.tx };
    const mode = rev ? { ".tag": "update", update: rev } : { ".tag": "add" };
    const r = await call("https://content.dropboxapi.com/2/files/upload", { arg: { path: PATH, mode, autorename: false, mute: true, strict_conflict: true }, body: JSON.stringify(payload) });
    if (r.status === 409) return { conflict: true };
    if (!r.ok) throw new Error("Erro ao salvar no Dropbox (" + r.status + ")");
    return { rev: (await r.json()).rev };
  }
  // ciclo de sincronização: baixa se mudou, junta com o que é local, envia se houver alteração
  async function sync() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      for (let i = 0; i < 4; i++) {
        if (!dirty) {
          const cur = await currentRev();
          if (cur && cur !== rev) { const d = await download(); if (!d.notFound) { const changedData = JSON.stringify(d.remote) !== JSON.stringify(data); data = d.remote; base = clone(d.remote); rev = d.rev; saveCache(); if (changedData) { bump(); emit(); } } }
          else if (!cur && rev) { rev = null; dirty = true; continue; }
          break;
        }
        const res = await upload();
        if (res.conflict) {
          const d = await download();
          if (d.notFound) { rev = null; continue; }
          const merged = clean(join(d.remote)); const changedData = JSON.stringify(merged) !== JSON.stringify(data);
          data = merged; base = clone(d.remote); rev = d.rev; saveCache(); if (changedData) { bump(); emit(); }
          continue;
        }
        rev = res.rev; dirty = false; base = clone(data); saveCache();
        break;
      }
      setStatus(dirty ? "saving" : "saved");
    } catch (e) {
      setStatus(navigator.onLine ? "error" : "offline");
      console.warn("Sincronização com o Dropbox:", e);
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(sync, 200); }
    }
  }
  function changed() {
    dirty = true; saveCache(); status = "saving"; bump(); emit();
    clearTimeout(pushTimer); pushTimer = setTimeout(sync, 700);
  }

  store.start = async (onData) => {
    listener = onData;
    if (cache.data) emit();                 // abre na hora com a cópia do navegador
    await sync();                           // depois confere o Dropbox
    if (!cache.data) emit();
    setInterval(() => { if (document.visibilityState === "visible") sync(); }, 30000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
    addEventListener("online", sync);
    addEventListener("beforeunload", (e) => { if (dirty) { sync(); e.preventDefault(); e.returnValue = ""; } });
    call("https://api.dropboxapi.com/2/users/get_current_account", { json: null })
      .then(r => r.ok ? r.json() : null).then(j => { if (j) { store.user = { displayName: j.name?.display_name || "", email: j.email || "" }; emit(); } }).catch(() => {});
  };
  store.saveSettings = async (s) => { const { _u, lastPay, ...rest } = s; data.settings = rest; changed(); };
  store.putTx = async (list) => {
    const ids = new Set(list.map(t => t.id));
    data.tx = data.tx.filter(t => !ids.has(t.id)).concat(list.map(({ u, ...t }) => t));
    changed();
  };
  store.delTx = async (ids) => {
    const set = new Set(ids);
    data.tx = data.tx.filter(t => !set.has(t.id));
    changed();
  };
  store.syncNow = () => sync();
  store.signOut = async () => {
    try { await call("https://api.dropboxapi.com/2/auth/token/revoke", { json: null }); } catch {}
    lsSet(LS_TOKEN, null); lsSet(LS_CACHE, null); location.reload();
  };
  return store;
}

// ---------------- Dropbox: só para trazer os dados antigos ----------------
// Há conexão com o Dropbox guardada neste aparelho? (ou uma cópia do arquivo da última sincronização)
export function dropboxNoAparelho() {
  const tok = lsGet(LS_TOKEN), cache = lsGet(LS_CACHE);
  return { conectado: !!tok?.refresh, copia: cache?.data ? clean(cache.data) : null };
}
// Baixa o arquivo atual do Dropbox (usa a conexão guardada neste aparelho)
export async function baixarDoDropbox() {
  let tok = lsGet(LS_TOKEN);
  if (!tok?.refresh) throw new Error("Este aparelho não está conectado ao Dropbox.");
  if (!(tok.access && tok.exp > Date.now() + 60000)) {
    const j = await tokenRequest({ grant_type: "refresh_token", refresh_token: tok.refresh });
    tok = { ...tok, access: j.access_token, exp: Date.now() + (j.expires_in || 14400) * 1000 }; lsSet(LS_TOKEN, tok);
  }
  const r = await fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: { Authorization: "Bearer " + tok.access, "Dropbox-API-Arg": JSON.stringify({ path: PATH }) } });
  if (r.status === 409) throw new Error("O arquivo de dados não foi encontrado no Dropbox.");
  if (!r.ok) throw new Error("Erro ao ler o Dropbox (" + r.status + ")");
  const t = await r.text();
  return clean(t.trim() ? JSON.parse(t) : {});
}
// Conecta ao Dropbox (vai e volta do site do Dropbox); na volta, a mudança continua sozinha
export async function conectarDropbox() {
  const { verifier, challenge } = await pkce();
  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem("mf-migrar", "1");
  const u = new URL("https://www.dropbox.com/oauth2/authorize");
  Object.entries({ client_id: dropboxConfig.appKey, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", token_access_type: "offline", redirect_uri: redirectUri() })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  location.href = u.toString();
}

// ---------------- Firebase ----------------
const FB_V = "10.12.2", GS = `https://www.gstatic.com/firebasejs/${FB_V}/`;
const LS_FB = "mf-firebase-cache";
let FB = null, fbApp = null, fbAuth = null, fbDb = null;
async function carregarFirebase() {
  if (FB) return FB;
  const [a, b, c] = await Promise.all([import(GS + "firebase-app.js"), import(GS + "firebase-auth.js"), import(GS + "firebase-firestore.js")]);
  FB = { ...a, ...b, ...c };
  fbApp = FB.initializeApp(firebaseConfig);
  fbAuth = FB.getAuth(fbApp);
  try { fbDb = FB.initializeFirestore(fbApp, { localCache: FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }) }); }
  catch { fbDb = FB.getFirestore(fbApp); }
  return FB;
}
const semIndefinidos = (x) => JSON.parse(JSON.stringify(x));
function traduz(e) {
  const c = e?.code || "";
  if (c.includes("permission-denied")) return "Este e-mail não tem acesso aos dados. Entre com um dos e-mails liberados nas regras do Firebase.";
  if (c.includes("unauthorized-domain")) return "Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).";
  if (c.includes("network")) return "Sem conexão com a internet.";
  return e?.message || String(e);
}

async function firebaseStore(ui) {
  const cache = lsGet(LS_FB) || {};
  const store = { mode: "firebase", user: null };
  try { await carregarFirebase(); }
  catch {
    if (!cache.settings && !cache.tx) throw new Error("Sem internet: no primeiro acesso é preciso estar conectado.");
    FB = null; // abre com a cópia do aparelho; grava como pendente e envia quando a conexão voltar (recarregar)
  }
  if (FB) FB.getRedirectResult(fbAuth).catch(e => ui.error(traduz(e)));
  // espera saber se há alguém conectado (no máximo 8 s)
  const user = FB ? await new Promise(res => { const t = setTimeout(() => res(fbAuth.currentUser), 8000); const off = FB.onAuthStateChanged(fbAuth, u => { clearTimeout(t); off(); res(u); }); }) : null;
  store.signIn = async () => {
    const prov = new FB.GoogleAuthProvider(); prov.setCustomParameters({ prompt: "select_account" });
    try { await FB.signInWithPopup(fbAuth, prov); location.reload(); }
    catch (e) {
      if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") return FB.signInWithRedirect(fbAuth, prov);
      if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return;
      throw new Error(traduz(e));
    }
  };
  if (FB && !user) { store.needsLogin = true; return store; }
  if (user) store.user = { displayName: user.displayName || "", email: user.email || "" };

  // estado local: settings, lançamentos por id, base (última versão das configurações vinda da nuvem)
  let settings = cache.settings ?? null, base = cache.base ?? null;
  const tx = new Map((cache.tx || []).map(t => [t.id, t]));
  let ultimo = cache.ultimo || 0;
  const pendTx = new Set(cache.pendTx || []);
  let pendSettings = !!cache.pendSettings;
  let listener = () => {}, ver = 1, status = FB ? "saving" : "offline", carregou = false, vazioNuvem = false;
  let tSalvar;
  const salvarCache = () => { clearTimeout(tSalvar); tSalvar = setTimeout(() => lsSet(LS_FB, { settings, base, tx: [...tx.values()], ultimo, pendTx: [...pendTx], pendSettings }), 150); };
  addEventListener("pagehide", () => { clearTimeout(tSalvar); lsSet(LS_FB, { settings, base, tx: [...tx.values()], ultimo, pendTx: [...pendTx], pendSettings }); });
  const emit = () => listener({ settings, tx: [...tx.values()], sync: status, ver });
  const mudou = () => { ver++; salvarCache(); emit(); };
  const setStatus = (s) => { if (s !== status) { status = s; emit(); } };

  const raiz = FB ? FB.doc(fbDb, "financas", "principal") : null;
  const colTx = FB ? FB.collection(raiz, "tx") : null;
  const refCfg = FB ? FB.doc(raiz, "cfg", "settings") : null;

  function enviarTx(t) {
    if (!FB) { pendTx.add(t.id); salvarCache(); return; }
    FB.setDoc(FB.doc(colTx, t.id), { ...semIndefinidos(t), upd: FB.serverTimestamp() }).catch(e => ui.error(traduz(e)));
    pendTx.delete(t.id);
  }
  let gravandoCfg = 0;
  async function enviarSettings() {
    if (!FB) { pendSettings = true; salvarCache(); return; }
    pendSettings = false; salvarCache();
    const local = semIndefinidos(settings);
    gravandoCfg++;
    try {
      if (navigator.onLine) {
        // junta com o que estiver na nuvem (outro aparelho pode ter mudado ao mesmo tempo)
        let final = local;
        await FB.runTransaction(fbDb, async (tr) => {
          const snap = await tr.get(refCfg);
          const remoto = snap.exists() ? snap.data().settings : null;
          final = remoto && base ? merge3(base, local, remoto) : local;
          tr.set(refCfg, { settings: semIndefinidos(final), upd: FB.serverTimestamp() });
        });
        base = semIndefinidos(final);
        if (JSON.stringify(final) !== JSON.stringify(settings)) { settings = final; mudou(); } else salvarCache();
        return;
      }
    } catch (e) {
      if ((e?.code || "").includes("permission-denied")) { ui.error(traduz(e)); return; }
    } finally { gravandoCfg--; }
    // sem internet: grava assim mesmo (o Firebase envia quando a conexão voltar)
    FB.setDoc(refCfg, { settings: local, upd: FB.serverTimestamp() }).catch(e => ui.error(traduz(e)));
    base = local;
  }

  store.start = async (onData) => {
    listener = onData;
    emit();
    if (!FB) return;
    // envia o que ficou pendente (gravado sem conexão)
    for (const id of pendTx) { const t = tx.get(id); if (t) enviarTx(t); else pendTx.delete(id); }
    if (pendSettings && settings) enviarSettings();
    let primeiraTx = true, primeiraCfg = true, okTx = false, okCfg = false;
    const pronto = () => { if (okTx && okCfg && !carregou) { carregou = true; vazioNuvem = !settings && !tx.size; ver++; emit(); } };
    FB.onSnapshot(FB.query(colTx, FB.where("upd", ">", FB.Timestamp.fromMillis(Math.max(0, ultimo - 1)))), { includeMetadataChanges: true }, (snap) => {
      let mudouAlgo = false;
      for (const ch of snap.docChanges()) {
        if (ch.doc.metadata.hasPendingWrites) continue;
        const d = ch.doc.data();
        const ms = d.upd?.toMillis ? d.upd.toMillis() : 0;
        if (ms > ultimo) ultimo = ms;
        const { upd, del, ...t } = d;
        if (del) { if (tx.delete(d.id)) mudouAlgo = true; }
        else if (JSON.stringify(tx.get(t.id)) !== JSON.stringify(t)) { tx.set(t.id, t); mudouAlgo = true; }
      }
      if (mudouAlgo) mudou(); else salvarCache();
      setStatus(snap.metadata.hasPendingWrites ? "saving" : snap.metadata.fromCache ? (navigator.onLine ? "saving" : "offline") : "saved");
      if (primeiraTx && !snap.metadata.fromCache) { primeiraTx = false; okTx = true; pronto(); }
    }, (e) => { setStatus("error"); ui.error(traduz(e)); ui.negado?.(traduz(e)); });
    FB.onSnapshot(refCfg, { includeMetadataChanges: true }, (snap) => {
      if (!snap.metadata.hasPendingWrites && !gravandoCfg && snap.exists()) {
        const remoto = snap.data().settings;
        base = semIndefinidos(remoto);
        if (JSON.stringify(remoto) !== JSON.stringify(settings)) { settings = remoto; mudou(); } else salvarCache();
      }
      if (primeiraCfg && !snap.metadata.fromCache) { primeiraCfg = false; okCfg = true; pronto(); }
    }, () => {});
  };
  store.saveSettings = async (s) => { const { _u, lastPay, ...rest } = s; settings = rest; mudou(); enviarSettings(); };
  store.putTx = async (list) => { for (const t0 of list) { const { u, ...t } = t0; tx.set(t.id, t); enviarTx(t); } mudou(); };
  store.delTx = async (ids) => {
    for (const id of ids) {
      tx.delete(id);
      if (FB) FB.setDoc(FB.doc(colTx, id), { id, del: true, upd: FB.serverTimestamp() }).catch(e => ui.error(traduz(e)));
    }
    mudou();
  };
  store.syncNow = () => location.reload();
  store.signOut = async () => { if (FB) await FB.signOut(fbAuth); lsSet(LS_FB, null); location.reload(); };
  store.vazio = () => carregou && vazioNuvem && !settings && !tx.size;
  // Mudança: junta os dados trazidos com os atuais e envia tudo de uma vez (em lotes)
  store.importar = async (dados) => {
    const r = juntarImport({ settings, tx: [...tx.values()] }, dados);
    settings = r.settings;
    for (const t of r.novos) tx.set(t.id, t);
    mudou();
    await enviarSettings();
    if (FB) {
      for (let i = 0; i < r.novos.length; i += 400) {
        const lote = FB.writeBatch(fbDb);
        for (const t of r.novos.slice(i, i + 400)) lote.set(FB.doc(colTx, t.id), { ...semIndefinidos(t), upd: FB.serverTimestamp() });
        await lote.commit();
      }
    } else for (const t of r.novos) pendTx.add(t.id);
    salvarCache();
    return r;
  };

  // ----- Minhas Compras: compras finalizadas que ainda não foram lançadas aqui -----
  const lojas = new Map();
  store.ouvirCompras = (cb) => {
    if (!FB) return cb([]);
    const regs = FB.collection(fbDb, "casa", "principal", "regs");
    let ultimaLista = [];
    const entregar = () => cb(ultimaLista.map(c => ({ ...c, lojaNome: lojas.get(c.loja) || "" })));
    FB.onSnapshot(FB.query(regs, FB.where("t", "==", "loja")), (snap) => { snap.forEach(d => lojas.set(d.id, d.data().nome)); entregar(); }, () => {});
    FB.onSnapshot(FB.query(regs, FB.where("fin", "in", ["pendente", "revisar"])), (snap) => {
      ultimaLista = snap.docs.map(d => d.data()).filter(c => c.t === "compra" && c.status === "fim" && !c.del);
      entregar();
    }, () => cb([]));
  };
  store.marcarCompra = async (id, campos) => {
    if (!FB) throw new Error("Sem conexão com a nuvem.");
    const ref = FB.doc(fbDb, "casa", "principal", "regs", id);
    await FB.setDoc(ref, { ...campos, upd: FB.serverTimestamp() }, { merge: true });
  };
  return store;
}

export async function openStore(ui) {
  if (MODO_LOCAL || !cloudConfigured) return localStore();
  // volta da conexão com o Dropbox (mudança dos dados): guarda a conexão e segue para o Firebase
  if (dropboxConfig.appKey) await finishRedirect().catch(e => ui.error(e.message));
  return firebaseStore(ui);
}
