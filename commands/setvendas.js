/**
 * Comando /setvendas - Configura logs de vendas simples e avancado.
 * Uso rapido: /setvendas canal:#canal
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvendas')
    .setDescription('Define canais para logs de vendas simples e avancado')
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal principal de vendas (resumo simples)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('modo')
        .setDescription('Modo de configuracao do log de vendas')
        .setRequired(false)
        .addChoices(
          { name: 'Simples', value: 'simples' },
          { name: 'Avancado', value: 'avancado' },
          { name: 'Ambos', value: 'ambos' }
        )
    )
    .addChannelOption(option =>
      option
        .setName('canal_avancado')
        .setDescription('Canal dedicado ao log avancado (opcional)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(null),

  cooldown: 5,

  async execute(interaction) {
    try {
      const db = Database.getInstance();
      const guildId = interaction.guild.id;
      const simpleChannel = interaction.options.getChannel('canal');
      const advancedChannelInput = interaction.options.getChannel('canal_avancado');
      const mode = interaction.options.getString('modo') || 'simples';

      const writes = [];
      const now = new Date().toISOString();

      const setCache = (key, value) => {
        writes.push(
          db.run(
            'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
            [key, value, null]
          )
        );
      };

      if (mode === 'simples' || mode === 'ambos') {
        setCache(`logs_${guildId}_vendas_simples`, simpleChannel.id);
        setCache(`logs_${guildId}_vendas`, simpleChannel.id); // compatibilidade com fluxo antigo
      }

      if (mode === 'avancado' || mode === 'ambos') {
        const advancedChannel = advancedChannelInput || simpleChannel;
        setCache(`logs_${guildId}_vendas_avancado`, advancedChannel.id);
      }

      await Promise.all(writes);

      await db.run(
        'INSERT INTO logs (type, action, details, created_at) VALUES (?, ?, ?, ?)',
        ['vendas_channel', 'setvendas', JSON.stringify({ mode, simple: simpleChannel.id, advanced: advancedChannelInput?.id || simpleChannel.id }), now]
      ).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('Canais de vendas configurados')
        .addFields(
          { name: 'Modo', value: mode, inline: true },
          { name: 'Canal simples', value: `${simpleChannel}`, inline: true },
          {
            name: 'Canal avancado',
            value: (mode === 'avancado' || mode === 'ambos')
              ? `${advancedChannelInput || simpleChannel}`
              : 'Nao alterado',
            inline: true
          },
          { name: 'Vendas simples envia', value: 'Comprador, entregador, produto, valor, data/hora.', inline: false },
          { name: 'Vendas avancado envia', value: 'IDs, status, transacao, quantidade, tipo, canal e trilha completa.', inline: false },
          {
            name: 'Exemplos prontos',
            value: '`/setvendas canal:#log-mensagens modo:simples`\n`/setvendas canal:#log-mensagens modo:avancado canal_avancado:#log-punicoes`\n`/setvendas canal:#log-mensagens modo:ambos canal_avancado:#log-punicoes`',
            inline: false
          },
          { name: 'Ajuda completa', value: 'Use `/logs-help` para ver o mapa completo de logs.', inline: false }
        )
        .setFooter({ text: 'Kyoto Store | Logs de vendas prontos' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
      console.error('Erro no comando setvendas:', error);
      await interaction.reply({ content: 'Erro ao configurar canais de vendas.', flags: 64 });
    }
  }
};
