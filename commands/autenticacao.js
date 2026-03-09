/**
 * Comando /autenticacao - Configuração de pagamento
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autenticacao')
    .setDescription('Realiza a autenticacao com seu Mercado Pago, Efi ou Chave Pix')
    .setDefaultMemberPermissions(null),
  
  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('Autenticação de Pagamentos')
      .setDescription('Clique no botão abaixo para configurar seu Access Token do Mercado Pago.');
    
    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
