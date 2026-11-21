# Minhas Finanças — regras para qualquer alteração

PWA em JavaScript puro (módulos ES, sem build), publicado no GitHub Pages (`https://guiluccas2.github.io/minhas-financas/`). Usado pelo casal (os dois leem e lançam). Responda sempre em **português**, com passos simples (o usuário não é programador).

## Dados (desde a versão 1.7)
- **Firebase**, projeto `minhas-compras-c9691` (o mesmo do Minhas Compras), login Google. Lançamentos: `financas/principal/tx/{id}` (um documento cada; excluir = `{ id, del: true }`). Configurações: `financas/principal/cfg/settings` (`{ settings }`), gravadas com transação e `merge3` (merge.js) contra a última versão vinda da nuvem (`base`).
- Regras do Firestore (e-mails do casal) ficam **só no console do Firebase**, nunca no GitHub.
- `js/store.js` mantém a interface `start / saveSettings / putTx / delTx / signOut` que o app.js usa. Sincronização só do que mudou (`upd` > último recebido); não troque por leitura da coleção inteira (cota gratuita). Sem Firebase carregado, gravações ficam em `pendTx`/`pendSettings` e sobem depois.
- Dropbox: só para a **mudança** dos dados antigos (`baixarDoDropbox`, `conectarDropbox`, `juntarImport`, quadro `mudancaHTML`). Não volte a gravar no Dropbox.
- Valores em **centavos** (`v`). Modo local só com `?local=1` (testes).

## Ligação com o Minhas Compras (repositório `minhas-compras`)
- `store.ouvirCompras` lê `casa/principal/regs` com `fin` em `pendente`/`revisar` (compras finalizadas, com `total` em reais, `nItens`, `pag`, `loja`, `data`, `por`); nomes das lojas vêm dos registros `t: "loja"`.
- Ao lançar: o lançamento ganha `compra: <id>`; a compra recebe `fin: "lancado"`, `finTx`, `finValor` (centavos) via `store.marcarCompra`. “Não lançar” = `fin: "ignorado"`. `revisar` = compra alterada depois de lançada.
- Preferência por loja (categoria, subcategoria, pagamento, cartão, conta) em `settings.comprasPref[lojaId]`. Primeira compra de uma loja: categoria “Mercado” › “Supermercado” se existir.
- Mudou algum desses campos? Atualize os dois repositórios e os dois `CLAUDE.md`.

## Antes de publicar
1. `bash testes/rodar.sh` (Playwright já instalado; tudo ✔). Teste novo para cada funcionalidade nova.
2. Celular: tudo cabe em 390 px.
3. Versão: `APP_VERSION` e `APP_DATE` em `js/app.js` + `version.json`; subir `CACHE` em `sw.js`.
4. Commit e push na `main`.
