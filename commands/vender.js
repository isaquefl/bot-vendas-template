/**
 * Comando /vender - Sistema de vendas de Robux/VP
 * Versao: 2.0.0
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const EconomyService = require('../sys_runtime/math_core/economy');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vender')
    .setDescription('Inicia o processo de venda')
    .addSubcommand(subcommand =>
      subcommand
        .setName('robux')
        .setDescription('Vender Robux')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('vp')
        .setDescription('Vender Valorant Points')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('personalizado')
        .setDescription('Venda personalizada')
        .addStringOption(option =>
          option.setName('produto')
            .setDescription('Nome do produto')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option.setName('preco')
            .setDescription('Preco em reais')
            .setRequired(true)
        )
    ),
  
  cooldown: 5,
  
  async execute(interaction, client) {
    try {
      const economy = EconomyService.getInstance();
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'robux') {
        const options = economy.generateQuantityOptions('robux');
        
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('vender_robux_qty')
          .setPlaceholder('Selecione a quantidade de Robux')
          .addOptions(options.slice(0, 7).map(opt => ({
            label: opt.label,
            description: opt.description,
            value: opt.value
          })));
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Venda de Robux')
          .setDescription('Selecione a quantidade de Robux que deseja vender.\n\n**Os precos ja incluem a taxa de 0.99% do Mercado Pago.**')
          .addFields(
            { name: 'Base', value: 'R$ 38,00 / 1000 Robux', inline: true },
            { name: 'Taxa MP', value: '**+0.99%** incluida', inline: true }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        
      } else if (subcommand === 'vp') {
        const options = economy.generateQuantityOptions('vp');
        
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('vender_vp_qty')
          .setPlaceholder('Selecione a quantidade de VP')
          .addOptions(options.map(opt => ({
            label: opt.label,
            description: opt.description,
            value: opt.value
          })));
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('✨ Venda de Valorant Points')
          .setDescription('Escolha o pacote de VP para gerar uma proposta com visual moderno.\n\n**Os precos ja incluem a taxa de 0.99% do Mercado Pago.**')
          .addFields(
            { name: 'Base', value: 'R$ 0,05 / VP', inline: true },
            { name: 'Taxa MP', value: '**+0.99%** incluida', inline: true },
            { name: 'Categoria', value: 'Valorant', inline: true }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        
      } else if (subcommand === 'personalizado') {
        const produto = interaction.options.getString('produto');
        const preco = interaction.options.getNumber('preco');
        const precoFinal = economy.applyMPTax(preco);
        const taxa = precoFinal - preco;
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Venda Personalizada')
          .addFields(
            { name: 'Produto', value: produto, inline: true },
            { name: 'Seu Lucro', value: economy.formatCurrency(preco), inline: true },
            { name: 'Taxa MP (0.99%)', value: economy.formatCurrency(taxa), inline: true },
            { name: 'Cobrar do Cliente', value: `**${economy.formatCurrency(precoFinal)}**`, inline: false }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`vender_confirm_custom_${precoFinal.toFixed(2)}`)
            .setLabel('Gerar PIX')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('vender_cancel')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
      }
      
    } catch (error) {
      console.error('Erro no comando vender:', error);
      await interaction.reply({ 
        content: 'Erro ao processar venda.', 
        flags: 64 
      });
    }
  }
};
