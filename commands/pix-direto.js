/**
 * Comando /pix-direto - Gera um PIX rápido para pagamento único ou testes
 * Kyoto Bot Enterprise
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const PixGenerator = require('../sys_runtime/math_core/pixGenerator');
const EconomyService = require('../sys_runtime/math_core/economy');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pix-direto')
    .setDescription('Gera um PIX rapido para pagamento único ou testes')
    .addNumberOption(option => 
      option.setName('valor')
        .setDescription('Valor do PIX (Ex: 10.50)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Descricao do pagamento')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply();

      const valorBase = interaction.options.getNumber('valor');
      const descricao = interaction.options.getString('descricao') || 'Pagamento Unico';
      
      const economy = EconomyService.getInstance();
      const pix = PixGenerator.getInstance();

      // Aplica taxa MP silenciosamente
      const valorFinal = economy.applyMPTax(valorBase);

      const loadingEmbed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('Gerando PIX...')
        .setDescription(`Aguarde enquanto geramos o pagamento de **${economy.formatCurrency(valorFinal)}**.`);

      await interaction.editReply({ embeds: [loadingEmbed] });

      const result = await pix.generatePix(valorFinal, descricao, interaction.user.id, {
        product_type: 'pix-direto',
        product_name: descricao,
        quantity: 1,
        source: 'pix-direto',
        channel_id: interaction.channelId,
        channel_name: interaction.channel?.name || 'dm'
      });

      if (result.success && result.qrCode) {
        const pixEmbed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('💳 Pagamento Unico - PIX')
          .setDescription(`Pagamento gerado para: **${descricao}**`)
          .addFields(
            { name: 'Valor', value: `**${economy.formatCurrency(result.amount)}**`, inline: true },
            { name: 'ID', value: `\`${result.paymentId}\``, inline: true }
          )
          .setFooter({ text: 'Kyoto Vendas | O pagamento sera detectado automaticamente' })
          .setTimestamp();

        const codeEmbed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Codigo PIX (Copia e Cola)')
          .setDescription(`\`\`\`${result.qrCode}\`\`\``);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`marcar_pago_${result.paymentId}`)
            .setLabel('Verificar Pagamento')
            .setStyle(ButtonStyle.Success)
        );

        if (result.qrCodeBase64) {
          const buffer = Buffer.from(result.qrCodeBase64, 'base64');
          const attachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });
          pixEmbed.setImage('attachment://qrcode.png');

          await interaction.editReply({ 
            embeds: [pixEmbed, codeEmbed], 
            files: [attachment], 
            components: [row] 
          });
        } else {
          await interaction.editReply({ 
            embeds: [pixEmbed, codeEmbed], 
            components: [row] 
          });
        }
      } else {
        await interaction.editReply({ 
          content: 'Erro ao gerar PIX. Verifique se o token do Mercado Pago está configurado corretamente.' 
        });
      }

    } catch (error) {
      console.error('Erro no comando pix-direto:', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: 'Erro fatal ao processar o PIX.' });
      }
    }
  }
};
