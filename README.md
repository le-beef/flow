# AtendeFlow

Atendimento automático determinístico (sem IA) para a primeira etapa do WhatsApp, com menu, gatilhos, mídia e transferência para atendimento humano.

## Executar

### Instalação de um clique no Windows

Clique duas vezes em `Instalar-AtendeFlow.cmd`. O instalador solicita permissão de administrador, verifica a virtualização, habilita WSL 2, instala Node.js LTS e Docker Desktop, reinicia quando necessário e continua automaticamente. Ao terminar, cria um atalho na Área de Trabalho e configura o AtendeFlow para iniciar com o Windows.

Se a virtualização estiver desativada no firmware, o instalador informa que é necessário ativar Intel VT-x/VT-d ou AMD-V/SVM na BIOS/UEFI.

Para criar o arquivo que será enviado ao cliente, clique em `Criar-Pacote-Cliente.cmd`. O ZIP gerado em `release` exclui `.env`, backups, logs, banco, dependências locais e arquivos privados. O cliente extrai o ZIP e clica em `Instalar-AtendeFlow.cmd`.

### Instalação manual

1. Copie `.env.example` para `.env` e ajuste as chaves.
2. Suba PostgreSQL, Redis e Evolution API: `docker compose up -d`.
3. No Windows, execute `powershell -ExecutionPolicy Bypass -File scripts/install.ps1`.
4. Inicie com `npm run dev`.
5. Na Evolution API, aponte o webhook de mensagens para `POST http://SEU_HOST:3333/webhooks/evolution` e envie o header `x-webhook-secret`.

Painel: `http://localhost:5173`. API: `http://localhost:3333`.

As atualizações oficiais são verificadas em `https://flow-54846.web.app/latest.json`.

Primeiro acesso local: `admin@lebeef.local`. A senha inicial fica em `ADMIN_PASSWORD` no arquivo `.env`; troque-a antes de publicar o sistema.

## Recursos operacionais

- Login com perfis de administrador e atendente.
- Fila de saída com até cinco tentativas e intervalo progressivo.
- Estado real da conexão do WhatsApp.
- Upload validado de imagem, PDF e áudio (até 15 MB).
- Notas internas, etiquetas, respostas rápidas e auditoria.
- Backup imediato: `powershell -ExecutionPolicy Bypass -File scripts/backup.ps1`.
- Backup automático: `powershell -ExecutionPolicy Bypass -File scripts/schedule-backup.ps1`.
- Restauração: `powershell -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupFile CAMINHO.sql`.
- Atualização segura: `powershell -ExecutionPolicy Bypass -File scripts/update.ps1`.
- A restauração exige confirmação escrita e substitui os dados atuais.

## Primeira configuração

Em uma instalação nova, o painel abre um assistente para cadastrar empresa, responsável e horário. Depois direciona para a conexão do WhatsApp. A senha inicial deve ser trocada no primeiro acesso.

## Segurança e operação

- Bloqueio temporário após cinco tentativas de login inválidas.
- Senhas temporárias e troca obrigatória no primeiro acesso.
- Perfis de administrador e atendente, presença e auditoria.
- Diagnóstico de API, PostgreSQL, WhatsApp e fila de envio.
- Exportação de dados, relatórios de 30 dias e alertas do navegador.
- Gatilhos com prioridade, simulador e variáveis `{{nome}}`, `{{empresa}}`, `{{telefone}}` e `{{endereco}}`.

Evolution Manager: `http://localhost:8080/manager`. Abra a instância `lebeef` e leia o QR Code com **WhatsApp > Aparelhos conectados > Conectar um aparelho**.

## Licenciamento para venda

O painel exige uma licença Ed25519 válida, vinculada ao código único da instalação e com data de vencimento assinada. Uma chave copiada para outra instalação ou editada manualmente é rejeitada.

O gerador e sua chave privada ficam fora deste projeto, em `C:\Users\estev\Documents\LeBeef-Licencas`. Eles são exclusivos do vendedor e **nunca devem ser enviados ao cliente**. Para distribuir o produto, entregue apenas este projeto; a API contém somente a chave pública de validação.

## Regras importantes

- Uma saudação por contato a cada 24h (controle transacional no PostgreSQL).
- Em atendimento humano, toda automação é interrompida até a finalização.
- Mensagens do próprio número são registradas, mas nunca disparam automações.
- Menu e gatilhos são configuráveis e podem ser desativados.
