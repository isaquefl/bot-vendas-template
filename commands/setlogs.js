/**
 * Comando /setlogs - Configura canais de log por categoria.
 * Uso rapido: /setlogs canal:#canal
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');

const THEME_COLOR = 0x1c6dbd;

const CATEGORY_MAP = {
  informacoes: 'info',
  transacoes: 'transacoes',
  tickets: 'tickets'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('Define canal de logs do sistema')
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal de destino dos logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('categoria')
        .setDescription('Categoria de log para este canal')
        .setRequired(false)
        .addChoices(
          { name: 'Informacoes gerais', value: 'informacoes' },
          { name: 'Transacoes', value: 'transacoes' },
          { name: 'Tickets', value: 'tickets' }
        )
    )
    .setDefaultMemberPermissions(null),

  cooldown: 5,

  async execute(interaction) {
    try {
      const db = Database.getInstance();
      const guildId = interaction.guild.id;
      const channel = interaction.options.getChannel('canal');
      const categoriaInput = interaction.options.getString('categoria') || 'informacoes';
      const categoria = CATEGORY_MAP[categoriaInput] || 'info';

      const key = `logs_${guildId}_${categoria}`;
      await db.run(
        'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
        [key, channel.id, null]
      );

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('Canal de logs configurado')
        .addFields(
          { name: 'Categoria', value: categoriaInput, inline: true },
          { name: 'Canal', value: `${channel}`, inline: true },
          { name: 'Chave', value: `\`${key}\``, inline: false },
          {
            name: 'O que cai neste canal',
            value: categoriaInput === 'informacoes'
              ? 'Comandos administrativos, alteracoes de configuracao e eventos operacionais.'
              : categoriaInput === 'transacoes'
                ? 'Eventos tecnicos de pagamento/transacao e trilha financeira.'
                : 'Abertura, claim, andamento e encerramento de tickets.',
            inline: false
          },
          {
            name: 'Exemplo rapido',
            value: categoriaInput === 'informacoes'
              ? 'Ex: /setlogs categoria:informacoes canal:#log-servidor'
              : categoriaInput === 'transacoes'
                ? 'Ex: /setlogs categoria:transacoes canal:#log-punicoes'
                : 'Ex: /setlogs categoria:tickets canal:#log-mensagens',
            inline: false
          },
          { name: 'Ajuda completa', value: 'Use `/logs-help` para ver o mapa completo de canais e exemplos.', inline: false }
        )
        .setFooter({ text: 'Kyoto Store | Configuracao aplicada' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
      console.error('Erro no comando setlogs:', error);
      await interaction.reply({ content: 'Erro ao configurar canal de logs.', flags: 64 });
    }
  }
};
