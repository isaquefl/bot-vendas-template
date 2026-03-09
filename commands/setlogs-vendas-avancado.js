/**
 * Comando /setlogs-vendas-avancado - Define canal de vendas avancado.
 */

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs-vendas-avancado')
    .setDescription('Define canal para logs de vendas avancado')
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal que recebera vendas avancadas')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(null),

  cooldown: 3,

  async execute(interaction) {
    const db = Database.getInstance();
    const guildId = interaction.guild.id;
    const channel = interaction.options.getChannel('canal');

    await db.run(
      'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
      [`logs_${guildId}_vendas_avancado`, channel.id, null]
    );

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('Logs de vendas avancado configurados')
      .addFields(
        { name: 'Canal', value: `${channel}`, inline: true },
        { name: 'Fluxo', value: 'IDs, status, transacao, tipo, quantidade e auditoria completa.', inline: false }
      )
      .setFooter({ text: 'Kyoto Store | Configuracao aplicada' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
