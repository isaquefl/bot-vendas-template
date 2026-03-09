/**
 * Comando /refreshpaineis - Atualiza paineis sem recriar mensagem.
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');
const EconomyService = require('../sys_runtime/math_core/economy');
const {
  buildPanelByRecord,
  getPanelRecords,
  inferRecordFromMessage,
  savePanelRecord
} = require('../sys_runtime/net_protocol/panelLayouts');

const ALLOWED_TYPES = new Set(['robux', 'vp', 'conta', 'multi', 'personalizado', 'ticket']);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('refreshpaineis')
    .setDescription('Atualiza paineis existentes para o layout mais recente')
    .addChannelOption(opt =>
      opt
        .setName('canal')
        .setDescription('Canal para varrer e atualizar paineis')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(null),

  async execute(interaction, client) {
    const db = Database.getInstance();
    const economy = EconomyService.getInstance();
    const targetChannel = interaction.options.getChannel('canal');

    await interaction.deferReply({ flags: 64 });

    const trackedRecords = await getPanelRecords(db);
    const candidateRecords = trackedRecords.filter((record) => {
      if (!ALLOWED_TYPES.has(record.panelType)) return false;
      if (targetChannel) return record.channelId === targetChannel.id;
      return interaction.guild.channels.cache.has(record.channelId);
    });

    // Fallback: também tenta inferir paineis antigos do historico recente do canal.
    let scannedMessages = 0;
    try {
      const channelsToScan = targetChannel
        ? [targetChannel]
        : interaction.guild.channels.cache.filter((ch) => ch.type === ChannelType.GuildText).values();

      for (const channel of channelsToScan) {
        const history = await channel.messages.fetch({ limit: 100 });
        scannedMessages += history.size;

        for (const message of history.values()) {
          if (!message.author || message.author.id !== client.user.id) continue;

          const alreadyTracked = candidateRecords.some((entry) => entry.messageId === message.id);
          if (alreadyTracked) continue;

          const inferred = inferRecordFromMessage(message);
          if (!inferred || !ALLOWED_TYPES.has(inferred.panelType)) continue;

          const record = {
            panelType: inferred.panelType,
            payload: inferred.payload || {},
            channelId: message.channelId,
            messageId: message.id
          };

          candidateRecords.push(record);
        }
      }
    } catch (error) {
      // Se a leitura do historico falhar, segue com os paineis ja rastreados.
    }

    if (candidateRecords.length === 0) {
      return interaction.editReply({
        content: 'Nenhum painel elegivel foi encontrado no canal informado. Use /criar-painel para publicar novos paineis e depois rode /refreshpaineis.'
      });
    }

    let refreshed = 0;
    const failed = [];

    for (const record of candidateRecords) {
      try {
        const channel = await interaction.guild.channels.fetch(record.channelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildText) continue;

        const message = await channel.messages.fetch(record.messageId);
        const panel = buildPanelByRecord(record, economy, client);
        if (!panel || !ALLOWED_TYPES.has(panel.panelType)) continue;

        await message.edit(panel.messageData);
        await savePanelRecord(db, message, panel.panelType, panel.payload);
        refreshed += 1;
      } catch (error) {
        failed.push(record.messageId);
      }
    }

    const failedText = failed.length > 0
      ? `\nFalhas: ${failed.length} painel(is) nao puderam ser editados.`
      : '';

    const targetText = targetChannel ? `${targetChannel}` : 'todos os canais de texto';

    await interaction.editReply({
      content: `Refresh concluido em ${targetText}.\nAtualizados: ${refreshed} painel(is).\nMensagens varridas: ${scannedMessages}.${failedText}`
    });
  }
};
