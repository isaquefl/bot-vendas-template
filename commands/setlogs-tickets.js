/**
 * Comando /setlogs-tickets - Define canal de logs de tickets.
 */

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs-tickets')
    .setDescription('Define canal para logs de tickets')
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal que recebera logs de tickets')
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
      [`logs_${guildId}_tickets`, channel.id, null]
    );

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('Logs de tickets configurados')
      .addFields(
        { name: 'Canal', value: `${channel}`, inline: true },
        { name: 'Fluxo', value: 'Abertura, claim, atendimento e fechamento de ticket.', inline: false }
      )
      .setFooter({ text: 'Kyoto Store | Configuracao aplicada' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
