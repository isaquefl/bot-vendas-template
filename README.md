# Bot Vendas Template

<p align="center">
  <img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExc3R3dW1teW4ycGl6dWQwZnQ3dHpsN2N5Y3c5MTRpYWhxN2oxM3J4cCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0HU7JIy8WQ6Bf7W0/giphy.gif" alt="Preview do bot" width="680" />
</p>

<p align="center">
Template completo de bot de vendas para Discord, com fluxo de produtos, paineis, ticket e integracao com PIX/Mercado Pago.
</p>

## Visao Geral

Este projeto foi preparado para ser publicado como template limpo no GitHub, sem arquivos sensiveis.

Principais recursos:

- Sistema de paineis de venda (Robux, VP e contas)
- Cadastro e gestao de produtos
- Ticket de suporte com categorias
- Logs organizados por tipo de evento
- Calculadora de preco e taxa
- Integracao com PIX (Mercado Pago)
- Nucleo com anti-crash, monitoramento de saude e lock de instancia

## Estrutura do Projeto

```txt
commands/            # Comandos slash (admin, loja, ticket, vendas)
events/              # Eventos do Discord (ready, interaction, message)
sys_runtime/         # Nucleo interno do bot
  math_core/         # Regras de negocio (economia, pix, monitor)
  net_protocol/      # Handlers de comando/interacao/evento
  vault_manager/     # Config, logger, banco, anticrash
data/                # Dados locais e backups
assets/branding/     # Arte de branding (logo/banner)
```

## Passo a Passo de Setup

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Criar o arquivo de ambiente

Copie `.env.example` para `.env` e preencha com suas chaves:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Iniciar o bot

```bash
npm start
```

## Variaveis de Ambiente

Use estas variaveis no `.env`:

- `PORT`: porta local (opcional)
- `NODE_ENV`: ambiente (`development` ou `production`)
- `CLIENT_ID`: ID da aplicacao Discord
- `DISCORD_TOKEN`: token do bot Discord
- `MP_ACCESS_TOKEN`: token de acesso Mercado Pago
- `MP_CLIENT_ID`: client id Mercado Pago
- `MP_CLIENT_SECRET`: client secret Mercado Pago
- `MP_PUBLIC_KEY`: chave publica Mercado Pago

## Funcao de Cada Grupo de Comandos

### Configuracao

- `/configurar`: menu inicial de configuracao
- `/autenticacao`: conecta e valida credenciais de pagamento
- `/setbranding`: define logo e banner usados nos paineis
- `/setlogs`: configura canal base de logs
- `/setvendas`: configura canais de vendas
- `/setlogs-transacoes`: log exclusivo de transacoes
- `/setlogs-tickets`: log exclusivo de tickets
- `/setlogs-vendas-simples`: log exclusivo de vendas simples
- `/setlogs-vendas-avancado`: log exclusivo de vendas avancadas
- `/fluxos-canais`: mostra o mapa de destino dos eventos
- `/paineiscalculo`: publica/atualiza painel de calculo e taxa

### Loja e Produtos

- `/criar-painel`: publica painel principal de vendas
- `/criar-painel-robux`: publica painel de Robux
- `/refreshpaineis`: atualiza layout dos paineis sem duplicar mensagem
- `/criar-produto`: cria produto no catalogo
- `/loja adicionar`: adiciona item rapido
- `/loja precificar`: altera preco de item
- `/loja renomear`: renomeia anuncio/produto
- `/loja remover`: remove produto

### Vendas

- `/vender`: inicia uma venda manual
- `/calcular`: calcula preco final com taxa
- `/pix-direto`: gera cobranca PIX rapida

### Suporte

- `/ticket canal`: cria painel de abertura de ticket
- `/ticket criar`: abre ticket manualmente
- `/ticket fechar`: fecha ticket atual

### Ajuda e Auditoria

- `/help`: central geral para usuarios
- `/adminhelp`: guia de comandos administrativos
- `/logs-check status`: verifica estado dos logs
- `/logs-check testar`: valida roteamento de logs

## Como o Runtime Funciona

Resumo do nucleo em `sys_runtime/`:

- `index.js`: inicializacao geral, lock de instancia unica e login no Discord
- `net_protocol/commandHandler.js`: carrega e registra comandos slash
- `net_protocol/eventHandler.js`: conecta eventos da pasta `events/`
- `net_protocol/interactionHandler.js`: processa interacoes de comandos/botoes
- `math_core/economy.js`: regras economicas e sincronizacao de configuracoes
- `math_core/pixGenerator.js`: fluxo de geracao de PIX
- `math_core/healthMonitor.js`: monitor de saude do processo
- `vault_manager/database.js`: banco local SQLite
- `vault_manager/config.js`: central de leitura e validacao de config
- `vault_manager/anticrash.js`: protecoes de execucao e recuperacao
- `vault_manager/logger.js`: logs estruturados por categoria

## Publicacao no GitHub (Template)

### 1. Inicializar git local

```bash
git init
git add .
git commit -m "chore: inicializa bot-vendas-template"
```

### 2. Criar repositorio remoto

Crie no GitHub um repo chamado `bot-vendas-template`.

### 3. Conectar e enviar

```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bot-vendas-template.git
git push -u origin main
```

### 4. Marcar como template no GitHub

No repositorio: `Settings > General > Template repository`.

## Seguranca

Este projeto foi ajustado para template:

- Arquivo `.env` removido do repositorio
- Arquivo `.env.example` criado com placeholders
- `.gitignore` mantendo bloqueio de arquivos de ambiente

Recomendacao importante:

- Nunca suba tokens reais no Git
- Se algum token foi exposto, revogue e gere outro imediatamente

## Licenca

Uso livre para personalizacao em projetos proprios.
