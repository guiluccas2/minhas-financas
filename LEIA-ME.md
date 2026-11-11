# Minhas Finanças

Controle financeiro pessoal: contas, cartões com faturas, categorias e subcategorias, metas com sugestão pela média, contas fixas, objetivos de economia, análise de médias, parcelas, transferências e lançamento rápido.

Endereço: **https://guiluccas2.github.io/minhas-financas/**

- **A página** fica no GitHub Pages (endereço fixo, abre em qualquer computador ou celular).
- **Os dados** ficam num arquivo no seu **Dropbox** (pasta *Aplicativos*). Você conecta o Dropbox uma vez por aparelho e tudo é salvo sozinho e sincronizado entre os aparelhos. Uma cópia fica no navegador, então a página abre na hora e funciona sem internet, enviando as alterações quando a conexão volta.
- Enquanto o Dropbox não estiver configurado, o sistema funciona em **modo local** (dados só naquele navegador).

## Configuração (uma vez só, uns 10 minutos)

### 1. Ativar o GitHub Pages

1. No repositório `guiluccas2/minhas-financas`, vá em *Settings → Pages*.
2. Em *Build and deployment*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`, e clique em *Save*.
3. Em um ou dois minutos o site estará em **https://guiluccas2.github.io/minhas-financas/**

### 2. Criar o app no Dropbox (gratuito)

1. Acesse <https://www.dropbox.com/developers/apps> e clique em **Create app**.
   - *Choose an API*: **Scoped access**
   - *Choose the type of access*: **App folder** (o app só enxerga a própria pasta, nunca o resto do seu Dropbox)
   - *Name your app*: um nome único, por exemplo `minhas-financas-guiluccas`
2. Na aba **Permissions**, marque `files.metadata.read`, `files.content.read` e `files.content.write` e clique em *Submit*.
3. Na aba **Settings**:
   - Em *OAuth 2 → Redirect URIs*, adicione **`https://guiluccas2.github.io/minhas-financas/`** (com a barra no final) e clique em *Add*.
   - Em *Allow public clients (Implicit Grant & PKCE)*, deixe **Allow**.
   - Copie a **App key**.
4. Coloque a App key no arquivo `js/config.js` (ou mande para o Claude, que atualiza o arquivo). A App key **não é senha**: ninguém acessa seus dados sem entrar na sua conta do Dropbox e autorizar.

> Já tem um app do Dropbox de outro sistema? Dá para reaproveitar, adicionando a Redirect URI acima e as permissões. Mas um app separado mantém os arquivos dos dois sistemas em pastas diferentes.

### 3. Primeiro acesso

1. Abra o site e clique em **Conectar ao Dropbox**. Autorize o app.
2. Em **Configurações → Importar dados da versão anterior**, escolha o arquivo `financas-dados.json` da pasta do Google Drive. Categorias, cartões e lançamentos são trazidos.
3. Em **Contas**, cadastre cada conta com o saldo de hoje.
4. Em **Cartões**, complete limite, dia de fechamento, dia de vencimento e a conta que paga cada fatura.

Nos outros aparelhos, basta abrir o endereço e conectar o mesmo Dropbox.

Os dados ficam em `Dropbox/Aplicativos/minhas-financas/minhas-financas-dados.json`. O próprio Dropbox guarda as versões anteriores desse arquivo, o que também serve de cópia de segurança.

## Instalar como aplicativo no Windows

- **Google Chrome:** abra o site, clique no menu **⋮** → **Transmitir, salvar e compartilhar** → **Instalar página como app** (ou no ícone de instalar, no fim da barra de endereço).
- **Microsoft Edge:** menu **⋯** → **Aplicativos** → **Instalar este site como um aplicativo**.

O sistema ganha ícone no menu Iniciar e na área de trabalho, e abre em janela própria. Para deixar na barra de tarefas: com ele aberto, clique com o botão direito no ícone da barra e escolha **Fixar na barra de tarefas**. As atualizações chegam sozinhas.

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
- **Saldo de dias anteriores** ao saldo informado é calculado de trás para frente, a partir dos lançamentos.

## Lançamento rápido

A barra do topo da tela Início entende frases curtas:

| Você digita | O sistema lança |
|---|---|
| `mercado 230` | despesa de R$ 230 em Mercado, hoje, na conta padrão |
| `padaria 12,50 ontem nubank` | Mercado › Padaria, ontem, crédito Nubank |
| `uber 18 dia 3 pix inter` | Transporte › Táxi/Uber, dia 3, Pix pela conta Inter |
| `+ salário 6120 05/11 nubank` | receita em Salário, 05/11, entrando na conta Nubank |

Datas aceitas: `hoje`, `ontem`, `anteontem`, `dia 8`, `08/11`, `08/11/2026`. Para parcelas e descrição, use o botão **+ Lançar**.

## Arquivos

- `index.html`: estrutura e visual
- `js/app.js`: telas e cálculos
- `js/store.js`: gravação e sincronização dos dados (Dropbox ou modo local)
- `js/config.js`: App key do Dropbox
