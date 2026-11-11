// Junção em 3 vias: compara a versão deste aparelho (local) e a do Dropbox (remote) com a última versão
// que os dois tinham em comum (base, a última sincronizada). Assim cada lado só "ganha" no que ele mudou,
// sem depender do relógio dos aparelhos e sem precisar guardar registro de exclusões.
//
// - Objetos: junta campo a campo.
// - Listas de itens com "id" (lançamentos, categorias, subcategorias, contas, cartões, contas fixas,
//   objetivos, depósitos): junta item a item. Item apagado num aparelho some, a não ser que o outro
//   aparelho o tenha alterado (a alteração prevalece sobre a exclusão).
// - Listas simples (ex.: meses pulados de uma conta fixa): junta o que cada lado acrescentou e tira o
//   que cada lado removeu.
// - O mesmo campo alterado nos dois aparelhos com valores diferentes: vale o deste aparelho.

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => a === b || (a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b));
const hasIds = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((x) => isObj(x) && x.id != null);

export function merge3(base, local, remote) {
  if (same(local, remote)) return local;
  if (same(base, local)) return remote;
  if (same(base, remote)) return local;
  // os dois lados mudaram
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const v = merge3(b[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote) && (hasIds(local) || hasIds(remote) || hasIds(base))) {
    const bArr = Array.isArray(base) ? base : [];
    const B = new Map(bArr.map((x) => [x.id, x])), L = new Map(local.map((x) => [x.id, x])), R = new Map(remote.map((x) => [x.id, x]));
    const out = [];
    for (const id of new Set([...remote.map((x) => x.id), ...local.map((x) => x.id)])) {
      const b = B.get(id), l = L.get(id), r = R.get(id);
      let v;
      if (l === undefined) v = b !== undefined && same(b, r) ? undefined : r;        // apagado aqui
      else if (r === undefined) v = b !== undefined && same(b, l) ? undefined : l;   // apagado no outro aparelho
      else v = merge3(b, l, r);
      if (v !== undefined) out.push(v);
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const key = (x) => JSON.stringify(x);
    const bs = new Set((Array.isArray(base) ? base : []).map(key)), ls = new Set(local.map(key)), rs = new Set(remote.map(key));
    const seen = new Set(), out = [];
    for (const x of [...remote, ...local]) {
      const k = key(x); if (seen.has(k)) continue; seen.add(k);
      if (bs.has(k) && (!ls.has(k) || !rs.has(k))) continue;                          // removido por um dos lados
      out.push(x);
    }
    return out;
  }
  return local;
}

// versão antiga do arquivo (antes da junção em 3 vias): usada uma única vez, quando ainda não existe "base"
export function legacyMerge(a, b) {
  const deleted = { ...(a.deleted || {}) };
  for (const [id, ts] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, ts);
  const byId = new Map();
  for (const t of [...(a.tx || []), ...(b.tx || [])]) { const cur = byId.get(t.id); if (!cur || (t.u || t.at || 0) > (cur.u || cur.at || 0)) byId.set(t.id, t); }
  const tx = [...byId.values()].filter((t) => !(deleted[t.id] >= (t.u || t.at || 0)));
  const sa = a.settings, sb = b.settings;
  const settings = !sa ? sb : !sb ? sa : ((sb._u || 0) > (sa._u || 0) ? sb : sa);
  return { settings, tx };
}
