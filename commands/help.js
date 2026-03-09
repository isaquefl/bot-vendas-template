/**
 * Comando /help - Central de Ajuda Kyoto Vendas
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra todos os comandos disponiveis'),
  
  async execute(interaction, client) {
    const stamp = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('Kyoto Vendas - Central de Ajuda')
      .setDescription('Tudo que voce precisa para configurar e operar a loja de forma simples e segura.')
      .addFields(
        {
          name: 'Comece por aqui',
          value: '1) `/setbranding` para banner/logo\n2) `/setlogs` e `/setvendas` para canais\n3) `/criar-painel` para publicar\n4) `/refreshpaineis` para atualizar layout sem duplicar mensagem',
          inline: false
        },
        {
          name: 'Area administrativa',
          value: '`/adminhelp` (somente admins)\n`/logs-check status` para revisar o que cai nos logs',
          inline: false
        },
        { 
          name: '⚙️ Configuracao', 
          value: '`/configurar` - Menu inicial\n`/autenticacao` - Configurar Mercado Pago/PIX\n`/setbranding` - Trocar, limpar e verificar banner/logo\n`/setlogs` - Definir canal de logs por categoria\n`/setvendas` - Definir canais de vendas simples/avancado\n`/setlogs-transacoes` - Canal direto de transacoes\n`/setlogs-tickets` - Canal direto de tickets\n`/setlogs-vendas-simples` - Canal direto de vendas simples\n`/setlogs-vendas-avancado` - Canal direto de vendas avancado\n`/fluxos-canais` - Mostrar mapa do que cada canal recebe\n`/paineiscalculo` - Painel fixo de calculo + configuracao de taxas',
          inline: false 
        },
        { 
          name: '🛒 Produtos', 
          value: '`/criar-painel robux` - Publica painel fixo de Robux com visual logo/banner\n`/criar-painel-robux` - Comando original do painel Robux (logo/banner)\n`/criar-painel vp` - Publica painel fixo de VP com visual logo/banner\n`/criar-painel conta` - Publica anuncio de conta com imagem por link ou upload\n`/refreshpaineis` - Atualiza paineis para o layout mais recente sem recriar mensagem\n`/loja adicionar` - Cadastro rapido de produto\n`/loja precificar` - Atualiza preco de produto\n`/loja renomear` - Atualiza nome de anuncio',
          inline: false 
        },
        { 
          name: '💰 Vendas', 
          value: '`/vender` - Inicia venda manual\n`/calcular` - Calculadora de precos com taxa MP\n`/pix-direto` - Gera PIX rapido para pagamento unico',
          inline: false 
        },
        { 
          name: '🎫 Suporte', 
          value: '`/ticket canal` - Cria painel com categorias (Suporte, Atendimento, Duvidas)\n`/ticket criar` - Abre ticket manual\n`/ticket fechar` - Fecha ticket atual',
          inline: false 
        }
      )
      .setFooter({ text: `Kyoto Bot Enterprise | Sistema de Vendas | Atualizado em ${stamp}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
