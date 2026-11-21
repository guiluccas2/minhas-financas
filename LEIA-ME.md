# Minhas Finanças

Controle financeiro pessoal: contas, cartões com faturas, categorias e subcategorias, metas com sugestão pela média, contas fixas, objetivos de economia, análise de médias, parcelas, transferências e lançamento rápido.

Endereço: **https://guiluccas2.github.io/minhas-financas/**

- **A página** fica no GitHub Pages (endereço fixo, abre em qualquer computador ou celular).
- **Os dados** ficam no **Firebase** (nuvem do Google), no mesmo projeto do Minhas Compras (`minhas-compras-c9691`). Você e sua esposa entram com a própria conta Google e veem os mesmos dados, ao mesmo tempo. Uma cópia fica no navegador, então a página abre na hora e funciona sem internet, enviando o que foi lançado quando a conexão volta.
- **Quem pode entrar:** só os e-mails escritos nas regras do Firestore (console do Firebase → Firestore → Regras, trecho `match /financas/...`). Os e-mails ficam só lá, nunca no GitHub.

## Mudança do Dropbox para o Firebase (uma vez só)

Até a versão 1.6 os dados ficavam no Dropbox. Na primeira vez que abrir a versão nova, entre com o Google. Como a nuvem ainda está vazia, o Início mostra o quadro **Trazer seus dados do Dropbox**:

- **Trazer do Dropbox agora:** aparece no aparelho que já estava conectado ao Dropbox; baixa o arquivo atual e envia tudo para o Firebase.
- **Conectar ao Dropbox e trazer:** para um aparelho que não estava conectado; vai ao Dropbox, você autoriza e a mudança continua sozinha.
- **Usar a cópia deste aparelho:** usa a última cópia que o navegador guardou do Dropbox (útil se o Dropbox não responder).

Trazer junta com o que já existe, sem apagar nem duplicar (dá para repetir em *Configurações → Dados → Trazer do Dropbox*). O arquivo no Dropbox não é alterado e continua como cópia de segurança.

## Compras a lançar (ligação com o Minhas Compras)

Cada compra finalizada no Minhas Compras aparece no Início, no quadro **Compras a lançar**, com data, loja, valor, forma de pagamento e quem comprou.

- **Lançar** abre o lançamento já preenchido (valor, data, loja, pagamento). Na primeira compra de cada loja, a categoria sugerida é *Mercado › Supermercado*; depois o sistema lembra a categoria, o cartão e a conta usados em cada loja.
- **Não lançar** tira a compra do quadro (por exemplo, paga com vale-alimentação que você não controla aqui).
- Se a compra for alterada no Minhas Compras depois de lançada, ela volta ao quadro com o valor antigo e o novo: **Abrir lançamento** para corrigir, ou **Está certo** para manter.

## Instalar como aplicativo no Windows

- **Google Chrome:** abra o site, clique no menu **⋮** → **Transmitir, salvar e compartilhar** → **Instalar página como app** (ou no ícone de instalar, no fim da barra de endereço).
- **Microsoft Edge:** menu **⋯** → **Aplicativos** → **Instalar este site como um aplicativo**.

O sistema ganha ícone no menu Iniciar e na área de trabalho, e abre em janela própria. Para deixar na barra de tarefas: com ele aberto, clique com o botão direito no ícone da barra e escolha **Fixar na barra de tarefas**. As atualizações chegam sozinhas.

## Instalar como aplicativo no celular

- **Android (Chrome):** abra o site, toque no menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari):** abra o site no **Safari**, toque em **Compartilhar** (quadrado com seta para cima) → **Adicionar à Tela de Início** → **Adicionar**.

No celular, a navegação fica numa barra embaixo (Início, Lançamentos, **+**, Metas e Mais), e os lançamentos e tabelas aparecem em formato de lista.

**Entrar no celular:** abra o app e toque em **Entrar com Google**. No iPhone, o app instalado não aproveita o login feito no Safari: entre de novo dentro do app.

## Telas

- **Início:** resumo do mês, saldo, faturas, contas, cartões, contas fixas a efetivar, objetivos e divisão de gastos por período.
- **Lançamentos:** lista com pesquisa e filtros, e o **extrato com saldo dia a dia** (inclui contas fixas e faturas previstas).
- **Contas** e **Cartões:** saldos, faturas, pagamento de fatura.
- **Metas:** meta por categoria e subcategoria, uso em %, alertas a partir de 80%, e **sugestão pela média** de 3, 6 ou 12 meses.
- **Contas fixas:** o que se repete todo mês. Aparece para você clicar em **Efetivar** (ou **Alterar** quando o valor do mês muda, ou **Pular mês**).
- **Objetivos:** valor, data, quanto guardar por mês, depósitos e calculadora.
- **Análise:** médias de 3, 6 e 12 meses por categoria e subcategoria, comparação com a média, despesas fixas × variáveis e maiores despesas.
- **Histórico:** receitas e despesas mês a mês.

## Como o sistema calcula

- **Saldo da conta** = saldo informado + receitas − despesas (débito, Pix, dinheiro, boleto) ± transferências − pagamentos de fatura, contando o que for lançado depois de você informar o saldo.
- **Compras no crédito** não mexem no saldo da conta: entram na fatura do cartão. Compras no dia do fechamento ou depois vão para a fatura seguinte. O saldo só cai quando você registra o pagamento da fatura.
- **Em qual mês a compra no cartão conta** (resumo, metas, histórico): no mês da compra (padrão) ou no mês de vencimento da fatura. Escolha em *Configurações*.
- **Transferências e pagamentos de fatura** não contam como despesa nem receita.
- **Médias** usam os meses completos anteriores ao mês escolhido, sem contar meses antes do seu primeiro lançamento.
- **Sincronização entre aparelhos:** cada lançamento é gravado separado na nuvem e chega aos outros aparelhos em segundos, então duas pessoas lançando ao mesmo tempo não se atrapalham. As configurações (categorias, contas, cartões, contas fixas, objetivos) são juntadas item a item com a versão da nuvem antes de gravar. Se o mesmo campo for alterado em dois aparelhos ao mesmo tempo, vale o que salvou por último.
- **Última forma de pagamento** usada fica só no aparelho.
- **Saldo de dias anteriores** ao saldo informado é calculado de trás para frente, a partir dos lançamentos.

## Lançamento rápido

A barra do topo da tela Início entende frases curtas:

| Você digita | O sistema lança |
|---|---|
| `mercado 230` | despesa de R$ 230 em Mercado, hoje, na conta padrão |
| `padaria 12,50 ontem nubank` | Mercado › Padaria, ontem, crédito Nubank |
| `uber 18 dia 3 pix inter` | Transporte › Táxi/Uber, dia 3, Pix pela conta Inter |
| `+ salário 6120 05/11 nubank` | receita em Salário, 05/11, entrando na conta Nubank |
| `eletrônicos tv 2400 10x nubank` | 10 parcelas de R$ 240 em Compras › Eletrônicos, no crédito Nubank (o valor digitado é o total) |

Datas aceitas: `hoje`, `ontem`, `anteontem`, `dia 8`, `08/11`, `08/11/2026`. Para parcelas e descrição, use o botão **+ Lançar**.

## Versão

O número da versão aparece abaixo de Claro/Escuro/Auto (no menu lateral do computador e no menu **Mais** do celular). O sistema confere sozinho se há uma versão mais nova publicada e, se houver, mostra **"Nova versão: atualizar"**.

Ao publicar uma atualização, mude o número em dois lugares: `APP_VERSION` e `APP_DATE` no início de `js/app.js`, e o arquivo `version.json`.

## Arquivos

- `index.html`: estrutura e visual
- `js/app.js`: telas e cálculos
- `js/store.js`: gravação e sincronização dos dados (Firebase), mudança do Dropbox, leitura das compras do Minhas Compras
- `js/merge.js`: junção das configurações entre aparelhos
- `js/config.js`: identificação do projeto Firebase (não é senha) e App key do Dropbox (só para a mudança)
- `testes/`: testes automáticos (`bash testes/rodar.sh`)
