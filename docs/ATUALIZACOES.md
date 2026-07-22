# Atualizações do AtendeFlow

## Estrutura

- `VERSION`: versão oficial instalada.
- `scripts/create-update-package.ps1`: cria o ZIP incremental e `latest.json`.
- `scripts/apply-update.ps1`: valida, cria backup, aplica e reverte em caso de falha.
- `release/updates/`: pasta pronta para publicação no Firebase Hosting.
- `firebase.json`: publica somente a pasta de atualizações.

## Preparar GitHub e Firebase

1. Crie ou selecione o projeto do Firebase.
2. Instale o Firebase CLI no computador de publicação.
3. Execute `firebase login`.
4. Copie `.firebaserc.example` para `.firebaserc` e substitua o ID do projeto.
5. Crie um repositório privado no GitHub e associe esta pasta a ele.
6. Nunca envie `.env`, chaves privadas, backups, uploads ou a pasta `.updates` ao GitHub.

## Criar uma versão

1. Atualize o arquivo `VERSION` e o número exibido no painel.
2. Execute compilação e testes.
3. Gere o pacote:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-update-package.ps1 `
  -BaseUrl "https://SEU-PROJETO.web.app" `
  -MinimumVersion "3.18.0" `
  -Notes "Correção A","Melhoria B"
```

4. Confira `release/updates/latest.json` e o SHA-256.
5. Publique:

```powershell
firebase deploy --only hosting
```

6. Crie também uma tag e um Release no GitHub para manter o histórico da versão.

## Ativar nos clientes

No `.env` de cada instalação, informe:

```env
UPDATE_MANIFEST_URL=https://SEU-PROJETO.web.app/latest.json
```

Depois reinicie o AtendeFlow. A área `Configurações > Sistema` passará a consultar o Firebase.

## Segurança e recuperação

- O manifesto e o pacote precisam ser servidos por HTTPS.
- O download é limitado a 250 MB.
- O SHA-256 do ZIP é conferido antes da instalação e novamente pelo aplicador.
- O banco PostgreSQL é copiado antes de qualquer alteração.
- Código e configuração de execução recebem um ponto de restauração local.
- `.env`, uploads, backups, logs, licença e dados persistentes não são substituídos.
- Se compilação ou reinício falhar, o aplicador restaura a versão anterior.
- O histórico fica em `logs/atualizacao.log` e o estado em `.updates/status.json`.
