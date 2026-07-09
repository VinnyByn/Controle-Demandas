# Firebase — hospedagem e banco de dados

O sistema salva no **Cloud Firestore** com **uma demanda por documento** (`demandas/{id}`). Diárias e atividade dos projetistas ficam em `demandasSistema/meta`. O documento antigo `demandasSistema/state` (campo `payload`) serve só para **migração**. Uma cópia continua no `localStorage` como backup.

## 1. Criar projeto no Firebase

1. Acesse [https://console.firebase.google.com](https://console.firebase.google.com) e crie um projeto.
2. Em **Build → Authentication → Sign-in method**, ative **E-mail/senha** (Email/Password).
3. Em **Authentication → Users**, clique em **Add user** e cadastre o e-mail e a senha de cada pessoa da equipe.
4. Em **Build → Firestore Database**, crie o banco (modo produção; região próxima ao Brasil, ex.: `southamerica-east1`).
5. Em **Configurações do projeto → Seus apps**, adicione um app **Web** e copie o objeto `firebaseConfig`.

## 2. Configurar o app

Edite `demandas-projetos/firebase-config.js` com os valores do console (substitua os `COLOQUE_...`).

Na raiz do repositório, edite `.firebaserc` e troque `SEU_PROJECT_ID` pelo ID do projeto.

## 3. Publicar regras e site

Instale a CLI (uma vez):

```bash
npm install -g firebase-tools
firebase login
```

Na pasta **Sistema Demandas** (onde está o `firebase.json`):

```bash
cd "c:\Users\rvini\OneDrive\Área de Trabalho\Sistema Demandas"
firebase use SEU_PROJECT_ID
firebase deploy
```

Isso publica o site (`demandas-projetos/`) e as regras do Firestore.

Somente regras:

```bash
firebase deploy --only firestore:rules
```

Somente site:

```bash
firebase deploy --only hosting
```

URL do site: **https://demproj-fdeac.web.app** (também visível no cabeçalho do app)

## 4. Migração do formato antigo (payload único)

Se ainda existir tudo dentro de `demandasSistema/state`:

1. Faça login no site.
2. Clique **5 vezes** no título **Projetos** no topo.
3. Confirme a migração — cada demanda vira um documento em `demandas/{id}`.

O documento `state` não é apagado; recebe apenas `migratedAt` / `migratedCount`.

Dados só no `localStorage` são mesclados automaticamente na primeira sincronização.

## 5. Sincronização

- Vários usuários veem atualizações em tempo real (listener do Firestore).
- O indicador no topo mostra: **Conectando**, **Salvando**, **Sincronizado** ou **Somente neste navegador** (sem Firebase configurado).
- **Exportar / Importar JSON** continua disponível para backup manual.

## Limitações

- Cada **demanda** é um documento (limite **~1 MB por projeto**). Imagens grandes em base64 ainda podem estourar um único doc; use Storage no futuro.
- Edições simultâneas em **demandas diferentes** não se sobrescrevem mais (Vinicius e Matheus podem trabalhar juntos).
- O app exige **login com e-mail e senha** antes de abrir o painel. As regras do Firestore só permitem leitura/escrita com usuário autenticado (`request.auth != null`).
- As chaves do `firebase-config.js` são públicas no front-end; a proteção vem das **regras** e do **Authentication**. Cadastre apenas usuários da equipe no console.
