/**
 * Comando /configurar - Configurações iniciais do bot
 * Estilo Kyoto Vendas / Ease Solutions
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('configurar')
    .setDescription('Faca as configuracoes iniciais do bot por aqui de forma facil')
    .setDefaultMemberPermissions(null),
  
  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('Configuração Kyoto Vendas')
      .setDescription('Selecione uma categoria para configurar seu bot.')
      .addFields(
        { name: '🛒 Vendas', value: 'Configure canais de logs, entregas e categorias.', inline: true },
        { name: '🎫 Tickets', value: 'Configure o sistema de atendimento.', inline: true },
        { name: '💳 Pagamentos', value: 'Configure seu Mercado Pago.', inline: true }
      )
      .setFooter({ text: 'Kyoto Bot Enterprise' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('config_vendas').setLabel('Vendas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config_tickets').setLabel('Tickets').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('config_pagos').setLabel('Pagamentos').setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
  }
};
