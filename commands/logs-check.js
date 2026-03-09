/**
 * Comando /logs-check - Verifica e testa fluxos de logs.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');

const THEME_COLOR = 0x1c6dbd;

async function cacheValue(db, key) {
  const row = await db.get('SELECT value FROM cache WHERE key = ? LIMIT 1', [key]).catch(() => null);
  return row?.value || null;
}

function channelLabel(guild, id) {
  if (!id) return 'Nao configurado';
  const channel = guild.channels.cache.get(id);
  return channel ? `${channel}` : `ID salvo: ${id}`;
}

function buildStatusEmbed(interaction, mapping) {
  const nowStamp = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short'
  });

  return new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle('Logs Check | Status')
    .setDescription('Mapa do que vai cair em cada log configurado.')
    .addFields(
      {
        name: 'Logs gerais',
        value: `${channelLabel(interaction.guild, mapping.info)}\nFluxo: eventos operacionais do sistema e auditoria administrativa.`,
        inline: false
      },
      {
        name: 'Logs de transacoes',
        value: `${channelLabel(interaction.guild, mapping.transacoes)}\nFluxo: trilha tecnica de transacoes e eventos financeiros.`,
        inline: false
      },
      {
        name: 'Logs de tickets',
        value: `${channelLabel(interaction.guild, mapping.tickets)}\nFluxo: abertura, atendimento e fechamento de tickets.`,
        inline: false
      },
      {
        name: 'Vendas simples',
        value: `${channelLabel(interaction.guild, mapping.vendasSimples)}\nFluxo: comprador, entregador, produto, valor, data/hora.`,
        inline: false
      },
      {
        name: 'Vendas avancado',
        value: `${channelLabel(interaction.guild, mapping.vendasAvancado)}\nFluxo: IDs, status, transacao, quantidade, tipo e canal.`,
        inline: false
      },
      {
        name: 'Atualizacao',
        value: `Verificado em: **${nowStamp}**`,
        inline: false
      }
    )
    .setFooter({ text: 'Kyoto Store | Diagnostico de logs' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs-check')
    .setDescription('Verifica configuracao e envia teste de logs')
    .addStringOption(opt =>
      opt
        .setName('modo')
        .setDescription('Acao de verificacao dos logs')
        .setRequired(true)
        .addChoices(
          { name: 'Status', value: 'status' },
          { name: 'Testar', value: 'testar' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  cooldown: 5,

  async execute(interaction) {
    const db = Database.getInstance();
    const guildId = interaction.guild.id;
    const mode = interaction.options.getString('modo');

    const mapping = {
      info: await cacheValue(db, `logs_${guildId}_info`),
      transacoes: await cacheValue(db, `logs_${guildId}_transacoes`),
      tickets: await cacheValue(db, `logs_${guildId}_tickets`),
      vendasSimples: await cacheValue(db, `logs_${guildId}_vendas_simples`) || await cacheValue(db, `logs_${guildId}_vendas`),
      vendasAvancado: await cacheValue(db, `logs_${guildId}_vendas_avancado`)
    };

    if (mode === 'status') {
      return interaction.reply({ embeds: [buildStatusEmbed(interaction, mapping)], flags: 64 });
    }

    const channelsToTest = [
      { id: mapping.info, label: 'logs gerais' },
      { id: mapping.transacoes, label: 'logs de transacoes' },
      { id: mapping.tickets, label: 'logs de tickets' },
      { id: mapping.vendasSimples, label: 'vendas simples' },
      { id: mapping.vendasAvancado, label: 'vendas avancado' }
    ].filter(entry => entry.id);

    if (channelsToTest.length === 0) {
      return interaction.reply({
        content: 'Nenhum canal de log foi configurado ainda. Configure com /setlogs e /setvendas.',
        flags: 64
      });
    }

    let sent = 0;
    for (const entry of channelsToTest) {
      const channel = interaction.guild.channels.cache.get(entry.id) || await interaction.guild.channels.fetch(entry.id).catch(() => null);
      if (!channel) continue;

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('TESTE DE LOG')
        .setDescription('Mensagem de validacao de fluxo de log.')
        .addFields(
          { name: 'Canal alvo', value: entry.label, inline: true },
          { name: 'Executado por', value: `${interaction.user.tag}`, inline: true },
          { name: 'Comando', value: '/logs-check testar', inline: true }
        )
        .setFooter({ text: 'Kyoto Store | Teste manual de logs' })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
      sent += 1;
    }

    return interaction.reply({
      content: `Teste concluido. Mensagens enviadas em ${sent} canal(is) de log.`,
      flags: 64
    });
  }
};
