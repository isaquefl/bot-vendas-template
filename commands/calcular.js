/**
 * Comando /calcular - Calculadora de precos com taxa MP
 * Versao: 2.0.0
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyService = require('../sys_runtime/math_core/economy');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calcular')
    .setDescription('Calcula precos com taxa do Mercado Pago')
    .addSubcommand(subcommand =>
      subcommand
        .setName('robux')
        .setDescription('Calcula preco de Robux')
        .addIntegerOption(option =>
          option.setName('quantidade')
            .setDescription('Quantidade de Robux')
            .setRequired(true)
            .setMinValue(1)
        )
        .addNumberOption(option =>
          option.setName('preco_por_mil')
            .setDescription('Preco por 1000 Robux (padrao: R$38)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('taxa')
        .setDescription('Calcula preco final com taxa MP')
        .addNumberOption(option =>
          option.setName('valor')
            .setDescription('Valor desejado a receber')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('gamepass')
        .setDescription('Calcula valor bruto para Gamepass Roblox (taxa 30%)')
        .addIntegerOption(option =>
          option.setName('robux_desejado')
            .setDescription('Quantidade de Robux que quer receber')
            .setRequired(true)
            .setMinValue(1)
        )
    ),
  
  cooldown: 3,
  
  async execute(interaction, client) {
    try {
      const economy = EconomyService.getInstance();
      await economy.syncFromDatabase();
      const subcommand = interaction.options.getSubcommand();
      const taxPercentText = `${(economy.mpTaxRate * 100).toFixed(2)}%`;
      
      let embed;
      
      if (subcommand === 'robux') {
        const quantidade = interaction.options.getInteger('quantidade');
        const precoMil = interaction.options.getNumber('preco_por_mil');
        
        const calc = economy.calculateRobuxPrice(quantidade, precoMil);
        
        embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Calculo de Robux')
          .addFields(
            { name: 'Quantidade', value: `${quantidade.toLocaleString('pt-BR')} Robux`, inline: true },
            { name: 'Preco Base', value: economy.formatCurrency(calc.basePrice), inline: true },
            { name: `Taxa MP (${taxPercentText})`, value: economy.formatCurrency(calc.mpTax), inline: true },
            { name: 'Preco Final', value: economy.formatCurrency(calc.finalPrice), inline: false }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise | Motor Economico' })
          .setTimestamp();
          
      } else if (subcommand === 'taxa') {
        const valorDesejado = interaction.options.getNumber('valor');
        const precoFinal = economy.applyMPTax(valorDesejado);
        const taxaMP = precoFinal - valorDesejado;
        
        embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Calculo de Taxa MP')
          .setDescription('Para receber o valor desejado, cobre do cliente o preco final.')
          .addFields(
            { name: 'Valor Desejado', value: `**${economy.formatCurrency(valorDesejado)}**`, inline: true },
            { name: `Taxa MP (${taxPercentText})`, value: `+${economy.formatCurrency(taxaMP)}`, inline: true },
            { name: 'Cobrar do Cliente', value: `**${economy.formatCurrency(precoFinal)}**`, inline: false }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
          
      } else if (subcommand === 'gamepass') {
        const robuxDesejado = interaction.options.getInteger('robux_desejado');
        const valorBruto = economy.calculateGamepassGross(robuxDesejado);
        const taxaRoblox = valorBruto - robuxDesejado;
        
        embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Calculo de Gamepass')
          .addFields(
            { name: 'Robux Desejado', value: `${robuxDesejado.toLocaleString('pt-BR')} R$`, inline: true },
            { name: 'Taxa Roblox (30%)', value: `${taxaRoblox.toLocaleString('pt-BR')} R$`, inline: true },
            { name: 'Valor no Gamepass', value: `${valorBruto.toLocaleString('pt-BR')} R$`, inline: false }
          )
          .setDescription('O cliente deve comprar um gamepass com este valor para voce receber o desejado.')
          .setFooter({ text: 'Kyoto Bot Enterprise | Motor Economico' })
          .setTimestamp();
      }
      
      await interaction.reply({ embeds: [embed], flags: 64 });
      
    } catch (error) {
      console.error('Erro no comando calcular:', error);
      await interaction.reply({ 
        content: 'Erro ao calcular valores.', 
        flags: 64 
      });
    }
  }
};
