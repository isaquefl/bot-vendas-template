/**
 * Comando /paineiscalculo - Painel fixo para base de calculo e configuracao de taxas.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const EconomyService = require('../sys_runtime/math_core/economy');
const Database = require('../sys_runtime/vault_manager/database');

const THEME_COLOR = 0x1c6dbd;
const PANEL_CACHE_PREFIX = 'panel:calculo:';
const PANEL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

function buildCalculationEmbed(economy, title = 'Painel de Calculo Base') {
  const exampleBase = economy.robuxPer1k;
  const exampleFinal = economy.applyMPTax(exampleBase);
  const exampleTax = exampleFinal - exampleBase;

  return new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(title)
    .setDescription('Referencias oficiais para precificacao da loja e conferencias rapidas.')
    .addFields(
      { name: 'Robux (base por 1000)', value: economy.formatCurrency(economy.robuxPer1k), inline: true },
      { name: 'Taxa Mercado Pago', value: `${(economy.mpTaxRate * 100).toFixed(2)}%`, inline: true },
      { name: 'Markup VP', value: `${(economy.vpMarkupRate * 100).toFixed(2)}%`, inline: true },
      {
        name: 'Exemplo pratico',
        value: `1000 Robux = ${economy.formatCurrency(exampleBase)}\nTaxa MP = ${economy.formatCurrency(exampleTax)}\nPreco final = **${economy.formatCurrency(exampleFinal)}**`,
        inline: false
      },
      {
        name: 'Formula base',
        value: '`PrecoFinal = PrecoBase * (1 + taxaMP)`',
        inline: false
      }
    )
    .setFooter({ text: 'Kyoto Store | Painel fixo de calculo' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('paineiscalculo')
    .setDescription('Gerencia o painel fixo de calculo e a configuracao economica')
    .addSubcommand(sub =>
      sub
        .setName('publicar')
        .setDescription('Publica o painel fixo de calculo')
        .addChannelOption(opt =>
          opt
            .setName('canal')
            .setDescription('Canal para publicar o painel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('nome_anuncio')
            .setDescription('Titulo customizado do painel')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('atualizar')
        .setDescription('Atualiza o painel fixo sem enviar nova mensagem')
    )
    .addSubcommand(sub =>
      sub
        .setName('configurar')
        .setDescription('Atualiza parametros base de precificacao')
        .addNumberOption(opt =>
          opt
            .setName('robux_mil')
            .setDescription('Preco base para 1000 Robux (ex: 38)')
            .setRequired(false)
            .setMinValue(0.01)
        )
        .addNumberOption(opt =>
          opt
            .setName('taxa_mp_percentual')
            .setDescription('Taxa MP em percentual (ex: 0.99)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(100)
        )
        .addNumberOption(opt =>
          opt
            .setName('markup_vp_percentual')
            .setDescription('Markup do VP em percentual (ex: 5)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(200)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('ver')
        .setDescription('Mostra os parametros atuais de precificacao')
    )
    .setDefaultMemberPermissions(null),

  cooldown: 3,

  async execute(interaction) {
    const db = Database.getInstance();
    const economy = EconomyService.getInstance();

    try {
      await economy.syncFromDatabase();
      const subcommand = interaction.options.getSubcommand();
      const cacheKey = `${PANEL_CACHE_PREFIX}${interaction.guild.id}`;

      if (subcommand === 'configurar') {
        const robuxMil = interaction.options.getNumber('robux_mil');
        const taxaPercent = interaction.options.getNumber('taxa_mp_percentual');
        const markupPercent = interaction.options.getNumber('markup_vp_percentual');

        if (robuxMil === null && taxaPercent === null && markupPercent === null) {
          return interaction.reply({
            content: 'Informe pelo menos um parametro para atualizar.',
            flags: 64
          });
        }

        await economy.updateSettings({
          robuxPer1k: robuxMil !== null ? robuxMil : undefined,
          mpTaxRate: taxaPercent !== null ? (taxaPercent / 100) : undefined,
          vpMarkupRate: markupPercent !== null ? (markupPercent / 100) : undefined
        });

        return interaction.reply({
          embeds: [buildCalculationEmbed(economy, 'Parametros de Calculo Atualizados')],
          flags: 64
        });
      }

      if (subcommand === 'ver') {
        return interaction.reply({ embeds: [buildCalculationEmbed(economy)], flags: 64 });
      }

      if (subcommand === 'publicar') {
        const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
        const title = interaction.options.getString('nome_anuncio') || 'Painel de Calculo Base';

        const message = await targetChannel.send({ embeds: [buildCalculationEmbed(economy, title)] });
        await db.setCache(cacheKey, { channelId: targetChannel.id, messageId: message.id, title }, PANEL_TTL_SECONDS);

        return interaction.reply({
          content: `Painel de calculo publicado em ${targetChannel}.`,
          flags: 64
        });
      }

      if (subcommand === 'atualizar') {
        const panelRef = await db.getCache(cacheKey);
        if (!panelRef?.channelId || !panelRef?.messageId) {
          return interaction.reply({
            content: 'Painel fixo nao encontrado. Use /paineiscalculo publicar primeiro.',
            flags: 64
          });
        }

        const channel = await interaction.guild.channels.fetch(panelRef.channelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildText) {
          return interaction.reply({ content: 'Canal do painel nao esta disponivel.', flags: 64 });
        }

        const message = await channel.messages.fetch(panelRef.messageId).catch(() => null);
        if (!message) {
          return interaction.reply({ content: 'Mensagem do painel nao foi encontrada.', flags: 64 });
        }

        await message.edit({ embeds: [buildCalculationEmbed(economy, panelRef.title || 'Painel de Calculo Base')] });
        return interaction.reply({ content: 'Painel de calculo atualizado com sucesso.', flags: 64 });
      }
    } catch (error) {
      console.error('Erro no comando paineiscalculo:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao processar o painel de calculo.', flags: 64 }).catch(() => {});
      }
    }
  }
};
