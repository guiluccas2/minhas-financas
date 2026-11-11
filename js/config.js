// Ligação com o Dropbox.
// appKey: a "App key" do app criado em https://www.dropbox.com/developers/apps (aba Settings).
// Não é senha: o acesso aos dados depende de você autorizar a conexão com a sua conta Dropbox.
// Enquanto appKey estiver vazio, o sistema funciona em "modo local" (dados só neste navegador).
export const dropboxConfig = {
  appKey: "",
  // arquivo onde os dados ficam, dentro da pasta do app no Dropbox (Aplicativos/<nome do app>/)
  path: "/minhas-financas-dados.json",
};
