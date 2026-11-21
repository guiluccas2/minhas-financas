// Ligação com o Firebase (onde os dados ficam). Não é senha: o acesso depende do login Google
// e das regras do Firestore (só os e-mails da casa). Mesmo projeto do Minhas Compras.
export const firebaseConfig = {
  apiKey: "AIzaSyDTYVsR4NdzO7aN-_ywECvcgd-5vVFRe7w",
  authDomain: "minhas-compras-c9691.firebaseapp.com",
  projectId: "minhas-compras-c9691",
  storageBucket: "minhas-compras-c9691.firebasestorage.app",
  messagingSenderId: "339093723567",
  appId: "1:339093723567:web:136c4efdfc453c226db75a",
};

// Ligação com o Dropbox (usada só para trazer os dados antigos para o Firebase).
// appKey: a "App key" do app criado em https://www.dropbox.com/developers/apps (aba Settings).
// Não é senha: o acesso aos dados depende de você autorizar a conexão com a sua conta Dropbox.
// Enquanto appKey estiver vazio, o sistema funciona em "modo local" (dados só neste navegador).
export const dropboxConfig = {
  appKey: "cz870dufyyafojc",
  // arquivo onde os dados ficam, dentro da pasta do app no Dropbox (Aplicativos/<nome do app>/)
  path: "/minhas-financas-dados.json",
};
