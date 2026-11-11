// Camada de dados. Duas implementações com a mesma interface:
//  - Dropbox: os dados ficam num arquivo JSON na pasta do app no seu Dropbox. Conecta uma vez por
//    aparelho (a conexão se renova sozinha), salva automaticamente e sincroniza entre aparelhos.
//    Uma cópia fica no navegador, então a página abre na hora e funciona sem internet.
//  - Local (localStorage): usada enquanto o Dropbox não foi configurado em js/config.js.
import { dropboxConfig } from "./config.js";

export const cloudConfigured = !!dropboxConfig.appKey;
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
  const emit = () => listener({ settings: data.settings, tx: data.tx.slice(), sync: "local" });
  return {
    mode: "local", user: null,
    async start(onData) { listener = onData; emit(); },
    async saveSettings(s) { data.settings = s; save(); emit(); },
    async putTx(list) { const ids = new Set(list.map(t => t.id)); data.tx = data.tx.filter(t => !ids.has(t.id)).concat(list); save(); emit(); },
    async delTx(ids) { const set = new Set(ids); data.tx = data.tx.filter(t => !set.has(t.id)); save(); emit(); },
    async signOut() {},
  };
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
function mergeData(a, b) {
  // junta duas versões do arquivo: lançamentos pela data de alteração, exclusões pelo registro de exclusão,
  // configurações pela versão salva mais recente
  const deleted = { ...(a.deleted || {}) };
  for (const [id, ts] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, ts);
  const byId = new Map();
  for (const t of [...(a.tx || []), ...(b.tx || [])]) { const cur = byId.get(t.id); if (!cur || (t.u || t.at || 0) > (cur.u || cur.at || 0)) byId.set(t.id, t); }
  const tx = [...byId.values()].filter(t => !(deleted[t.id] >= (t.u || t.at || 0)));
  const sa = a.settings, sb = b.settings;
  const settings = !sa ? sb : !sb ? sa : ((sb._u || 0) > (sa._u || 0) ? sb : sa);
  return { app: "minhas-financas", v: 3, savedAt: Math.max(a.savedAt || 0, b.savedAt || 0), settings, tx, deleted };
}

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
  let data = cache.data || { app: "minhas-financas", v: 3, settings: null, tx: [], deleted: {} };
  let rev = cache.rev || null, dirty = !!cache.dirty, status = dirty ? "saving" : "saved", listener = () => {}, pushTimer = null, busy = false, again = false;
  const saveCache = () => lsSet(LS_CACHE, { data, rev, dirty });
  const emit = () => listener({ settings: data.settings, tx: data.tx.slice(), sync: status });
  const setStatus = (s) => { if (s !== status) { status = s; emit(); } };

  async function download() {
    const r = await call("https://content.dropboxapi.com/2/files/download", { arg: { path: PATH } });
    if (r.status === 409) { const j = await r.json().catch(() => ({})); if (JSON.stringify(j).includes("not_found")) return { notFound: true }; throw new Error("Erro ao ler o arquivo no Dropbox"); }
    if (!r.ok) throw new Error("Erro ao ler o arquivo no Dropbox (" + r.status + ")");
    let meta = null; try { meta = JSON.parse(r.headers.get("Dropbox-API-Result")); } catch {}
    const text = await r.text();
    const remote = text.trim() ? JSON.parse(text) : {};
    return { remote, rev: meta?.rev || await currentRev() };
  }
  async function currentRev() {
    const r = await call("https://api.dropboxapi.com/2/files/get_metadata", { json: { path: PATH } });
    if (r.status === 409) return null;
    if (!r.ok) throw new Error("Erro ao consultar o Dropbox (" + r.status + ")");
    return (await r.json()).rev;
  }
  async function upload() {
    const payload = { ...data, app: "minhas-financas", v: 3, savedAt: Date.now() };
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
          if (cur && cur !== rev) { const d = await download(); if (!d.notFound) { data = mergeData({ deleted: {} }, d.remote); rev = d.rev; saveCache(); emit(); } }
          else if (!cur && rev) { rev = null; dirty = true; continue; }
          break;
        }
        const res = await upload();
        if (res.conflict) {
          const d = await download();
          if (d.notFound) { rev = null; continue; }
          data = mergeData(data, d.remote); rev = d.rev; saveCache(); emit();
          continue;
        }
        rev = res.rev; dirty = false; saveCache();
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
    dirty = true; data.savedAt = Date.now(); saveCache(); status = "saving"; emit();
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
  store.saveSettings = async (s) => { data.settings = { ...s, _u: Date.now() }; changed(); };
  store.putTx = async (list) => {
    const now = Date.now(), ids = new Set(list.map(t => t.id));
    data.tx = data.tx.filter(t => !ids.has(t.id)).concat(list.map(t => ({ ...t, u: now })));
    for (const id of ids) delete data.deleted?.[id];
    changed();
  };
  store.delTx = async (ids) => {
    const now = Date.now(), set = new Set(ids);
    data.tx = data.tx.filter(t => !set.has(t.id));
    data.deleted = data.deleted || {}; for (const id of ids) data.deleted[id] = now;
    changed();
  };
  store.syncNow = () => sync();
  store.signOut = async () => {
    try { await call("https://api.dropboxapi.com/2/auth/token/revoke", { json: null }); } catch {}
    lsSet(LS_TOKEN, null); lsSet(LS_CACHE, null); location.reload();
  };
  return store;
}

export async function openStore(ui) {
  if (!cloudConfigured) return localStore();
  return dropboxStore(ui);
}
