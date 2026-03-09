# Kyoto Bot - Vendas Enterprise

## Comandos Principais

### Configuracao
- `/configurar` - Menu de configuracoes iniciais
- `/autenticacao` - Configurar Mercado Pago/PIX
- `/setlogs` - Definir canais de logs

### Produtos e Paineis
- `/criar-painel robux` - Cria painel fixo de venda de Robux
- `/criar-painel vp` - Cria painel fixo de venda de VP
- `/criar-painel conta` - Cria anuncio de conta para venda
- `/criar-painel personalizado` - Produto customizado
- `/criar-painel multi` - Painel com multiplos produtos e precos
- `/criar-produto` - Adiciona produto

### Vendas
- `/vender` - Inicia venda manual
- `/pix-direto` - Gera PIX rapido para pagamento unico
- `/calcular robux` - Calcula preco de Robux
- `/calcular taxa` - Calcula com taxa MP
- `/calcular gamepass` - Valor bruto gamepass

### Suporte
- `/ticket canal` - Cria painel com categorias (Suporte, Atendimento, Duvidas)
- `/ticket criar` - Abre ticket manual
- `/ticket fechar` - Fecha ticket atual
- `/help` - Central de ajuda

## Fluxo de Compra

1. Cliente seleciona produto no painel
2. Bot cria canal de carrinho (categoria: 1458500250565349514)
3. Cliente clica "Gerar PIX"
4. Bot gera QR Code + codigo copia-cola
5. Cliente clica "Ja Paguei"
6. Canal move para categoria Pago (1458532706475315435)
7. Staff entrega produto

## Motor Economico

- Taxa MP: 0.99% (aplicada automaticamente)
- Robux: R$ 38,00 / 1000 * 1.0099
- VP: R$ 0,05 / unidade * 1.0099

## Categorias Discord

- Carrinho: `1458500250565349514`
- Pago: `1458532706475315435`
