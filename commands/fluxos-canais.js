/**
 * Comando /fluxos-canais - Mapa dos fluxos de canais do servidor.
 * Exclusivo para administradores.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');

const THEME_COLOR = 0x1c6dbd;

async function getCacheValue(db, key) {
  const row = await db.get('SELECT value FROM cache WHERE key = ? LIMIT 1', [key]).catch(() => null);
  return row?.value || null;
}

function formatChannel(guild, channelId) {
  if (!channelId) return 'Nao configurado';
  const channel = guild.channels.cache.get(channelId);
  return channel ? `${channel}` : `ID salvo: ${channelId}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fluxos-canais')
    .setDescription('Mostra o que cada canal recebe no fluxo do bot')
    .setDefaultMemberPermissions(null),

  cooldown: 3,

  async execute(interaction) {
    try {
      const db = Database.getInstance();
      const guildId = interaction.guild.id;

      const logInfoId = await getCacheValue(db, `logs_${guildId}_info`);
      const logTransacoesId = await getCacheValue(db, `logs_${guildId}_transacoes`);
      const logTicketsId = await getCacheValue(db, `logs_${guildId}_tickets`);
      const vendasSimplesId = await getCacheValue(db, `logs_${guildId}_vendas_simples`) || await getCacheValue(db, `logs_${guildId}_vendas`);
      const vendasAvancadoId = await getCacheValue(db, `logs_${guildId}_vendas_avancado`);
      const cartCategoryId = await getCacheValue(db, `channels_${guildId}_cart_category`) || await getCacheValue(db, `channels_${guildId}_cart`);
      const paidCategoryId = await getCacheValue(db, `channels_${guildId}_paid_category`) || await getCacheValue(db, `channels_${guildId}_paid`);

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('Fluxo de Canais - Kyoto Store')
        .setDescription('Mapa objetivo do que cada canal/categoria recebe.')
        .addFields(
          {
            name: 'Logs gerais',
            value: `${formatChannel(interaction.guild, logInfoId)}\nRecebe: informacoes operacionais e acoes gerais do sistema.`,
            inline: false
          },
          {
            name: 'Logs de transacoes',
            value: `${formatChannel(interaction.guild, logTransacoesId)}\nRecebe: eventos tecnicos de transacao e trilha de operacao.`,
            inline: false
          },
          {
            name: 'Logs de tickets',
            value: `${formatChannel(interaction.guild, logTicketsId)}\nRecebe: abertura, atendimento e encerramento de tickets.`,
            inline: false
          },
          {
            name: 'Vendas simples',
            value: `${formatChannel(interaction.guild, vendasSimplesId)}\nRecebe: resumo curto da venda (comprador, entregador, produto, valor).`,
            inline: false
          },
          {
            name: 'Vendas avancado',
            value: `${formatChannel(interaction.guild, vendasAvancadoId)}\nRecebe: auditoria completa (IDs, status, canal, transacao, tipo, quantidade).`,
            inline: false
          },
          {
            name: 'Categoria carrinho',
            value: `${formatChannel(interaction.guild, cartCategoryId)}\nRecebe: canais temporarios de carrinho.`,
            inline: false
          },
          {
            name: 'Categoria pago',
            value: `${formatChannel(interaction.guild, paidCategoryId)}\nRecebe: canais movidos apos confirmacao de pagamento.`,
            inline: false
          },
          {
            name: 'Comandos rapidos de configuracao',
            value: '`/setlogs canal:#canal categoria:informacoes|transacoes|tickets`\n`/setvendas canal:#canal modo:simples|avancado|ambos canal_avancado:#canal`',
            inline: false
          }
        )
        .setFooter({ text: 'Kyoto Store | Comando administrativo' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
      console.error('Erro no comando fluxos-canais:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao consultar fluxo de canais.', flags: 64 }).catch(() => {});
      }
    }
  }
};
