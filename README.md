# SoundMemo

Playlist comentada para salvar músicas, memórias, autores e linha do tempo.

## Rodar localmente

```powershell
npm start
```

Abra:

```text
http://127.0.0.1:4173/playlist.html
```

## Próximo passo

Trocar o armazenamento local em `data/tracks.json` por Firebase Auth + Firestore para publicar com login fechado para duas pessoas.

## Firebase

O app usa Firebase Auth com Google e Firestore na coleção `tracks`.

No console do Firebase:

1. Ative Authentication > Google.
2. Ative Firestore.
3. Copie as regras de `firestore.rules` para Firestore > Regras.
4. Em Authentication > Settings > Authorized domains, adicione o domínio da Vercel quando publicar.

## Configuração da Vercel

O arquivo `firebase-config.js` não entra no Git. Ele é gerado no deploy a partir destas variáveis de ambiente:

```text
SOUNDMEMO_FIREBASE_API_KEY
SOUNDMEMO_FIREBASE_AUTH_DOMAIN
SOUNDMEMO_FIREBASE_PROJECT_ID
SOUNDMEMO_FIREBASE_STORAGE_BUCKET
SOUNDMEMO_FIREBASE_MESSAGING_SENDER_ID
SOUNDMEMO_FIREBASE_APP_ID
```

Para rodar localmente, copie `firebase-config.example.js` para `firebase-config.js` e preencha com a configuração do app web no Firebase.
