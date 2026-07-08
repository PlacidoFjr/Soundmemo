# SoundMemo

Resumo rapido do projeto para nao depender do chat.

## O que e

SoundMemo e um app privado para duas pessoas salvarem musicas com:

- link do Spotify ou YouTube
- titulo e artista
- historia da musica
- clima e momento
- linha do tempo de quem adicionou cada faixa
- playlist final para copiar ou baixar

## Stack

- Frontend: HTML + CSS + JavaScript
- Auth: Firebase Authentication com e-mail e senha
- Banco: Cloud Firestore
- Deploy: Vercel

## Estrutura atual

- [playlist.html](C:\Users\placi\OneDrive\curriculo\Documentos\sophi\playlist.html)
- [playlist.css](C:\Users\placi\OneDrive\curriculo\Documentos\sophi\playlist.css)
- [playlist.js](C:\Users\placi\OneDrive\curriculo\Documentos\sophi\playlist.js)
- [firestore.rules](C:\Users\placi\OneDrive\curriculo\Documentos\sophi\firestore.rules)
- [scripts/build-static.js](C:\Users\placi\OneDrive\curriculo\Documentos\sophi\scripts\build-static.js)

## Visoes do app

O app agora esta organizado como um app shell com views independentes:

- `geral`
- `adicionar`
- `biblioteca`
- `timeline`
- `final`

Essas views usam `?view=` na URL para parecer mais site/app e menos landing page unica.

## Firebase esperado

Colecao principal:

- `tracks`

Cada documento guarda, em resumo:

- `platform`
- `platformLabel`
- `url`
- `title`
- `artist`
- `coverUrl`
- `embedHtml`
- `memory`
- `feeling`
- `era`
- `contributor`
- `userId`
- `userName`
- `userEmail`
- `createdAt`
- `createdAtClient`

## Regras atuais do Firestore

As regras permitem leitura e escrita apenas para:

- `placidojunior34@gmail.com`
- `pinheirosophia63@gmail.com`

Arquivo:

- [firestore.rules](C:\Users\placi\OneDrive\curriculo\Documentos\sophi\firestore.rules)

## Variaveis da Vercel

O deploy gera `firebase-config.js` a partir destas variaveis:

- `SOUNDMEMO_FIREBASE_API_KEY`
- `SOUNDMEMO_FIREBASE_AUTH_DOMAIN`
- `SOUNDMEMO_FIREBASE_PROJECT_ID`
- `SOUNDMEMO_FIREBASE_STORAGE_BUCKET`
- `SOUNDMEMO_FIREBASE_MESSAGING_SENDER_ID`
- `SOUNDMEMO_FIREBASE_APP_ID`

## Situacao atual

Ja funciona:

- login com Firebase Auth
- bloqueio para apenas os dois e-mails
- importacao manual de links
- timeline com data real
- filtro por mes na timeline
- views separadas por abas
- playlist final

Ponto que ainda precisa atencao:

- em alguns navegadores o Firestore entra em modo local pendente e nao sincroniza com o servidor

## Antes de apagar o Firebase

Nao recomendo apagar o projeto agora.

Motivo:

- o app ja aponta para o projeto certo
- o login ja funciona
- o Firestore chega a aceitar escrita local pendente
- isso parece mais problema de conexao/sincronizacao do navegador do que projeto quebrado

## Checklist de verificacao do Firestore

1. Confirmar que as regras foram publicadas.
2. Confirmar que o usuario entrou com o mesmo e-mail liberado nas regras.
3. Testar em Chrome ou Edge sem extensoes.
4. Confirmar se a colecao `tracks` aparece no console apos uma escrita bem sucedida.
5. Verificar se o navegador esta bloqueando requisicoes do Firestore.
6. So considerar refazer o projeto Firebase se tudo acima falhar em mais de um navegador.

## Comandos uteis

Rodar local:

```powershell
npm start
```

Build estatico:

```powershell
npm run build
```
