/**
 * Comando /setbranding - Atualiza banner e logo dos paineis.
 */

const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const THEME_COLOR = 0x1c6dbd;
const BRANDING_DIR = path.join(process.cwd(), 'assets', 'branding');
const BANNER_PATH = path.join(BRANDING_DIR, 'kyoto-banner.png');
const LOGO_PATH = path.join(BRANDING_DIR, 'kyoto-logo.png');

async function downloadBinary(url) {
  if (typeof fetch !== 'function') {
    throw new Error('Runtime sem suporte a fetch para download de arquivos.');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo (${response.status})`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType && !contentType.startsWith('image/')) {
    throw new Error('O link informado nao retorna uma imagem valida.');
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbranding')
    .setDescription('Atualiza as imagens de banner e logo usadas nos paineis')
    .addStringOption(option =>
      option
        .setName('acao')
        .setDescription('Acao para o branding')
        .setRequired(false)
        .addChoices(
          { name: 'Atualizar', value: 'atualizar' },
          { name: 'Status', value: 'status' },
          { name: 'Limpar Banner', value: 'limpar_banner' },
          { name: 'Limpar Logo', value: 'limpar_logo' },
          { name: 'Limpar Tudo', value: 'limpar_tudo' }
        )
    )
    .addAttachmentOption(option =>
      option
        .setName('banner_upload')
        .setDescription('Banner por upload do Discord')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('banner_link')
        .setDescription('Link do banner')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('logo_upload')
        .setDescription('Logo por upload do Discord')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('logo_link')
        .setDescription('Link da logo')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(null),

  async execute(interaction) {
    try {
      const action = interaction.options.getString('acao') || 'atualizar';
      const bannerUpload = interaction.options.getAttachment('banner_upload');
      const bannerLink = interaction.options.getString('banner_link');
      const logoUpload = interaction.options.getAttachment('logo_upload');
      const logoLink = interaction.options.getString('logo_link');

      if (!fs.existsSync(BRANDING_DIR)) {
        fs.mkdirSync(BRANDING_DIR, { recursive: true });
      }

      if (action === 'status') {
        const bannerExists = fs.existsSync(BANNER_PATH);
        const logoExists = fs.existsSync(LOGO_PATH);
        const bannerSize = bannerExists ? `${Math.round(fs.statSync(BANNER_PATH).size / 1024)} KB` : 'Nao definido';
        const logoSize = logoExists ? `${Math.round(fs.statSync(LOGO_PATH).size / 1024)} KB` : 'Nao definido';

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Status do branding')
          .addFields(
            { name: 'Banner', value: bannerExists ? `Ativo (${bannerSize})` : 'Nao definido', inline: true },
            { name: 'Logo', value: logoExists ? `Ativa (${logoSize})` : 'Nao definida', inline: true },
            { name: 'Caminho banner', value: `\`${BANNER_PATH}\``, inline: false },
            { name: 'Caminho logo', value: `\`${LOGO_PATH}\``, inline: false }
          )
          .setFooter({ text: 'Kyoto Store | Branding status' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      if (action === 'limpar_banner' || action === 'limpar_tudo') {
        if (fs.existsSync(BANNER_PATH)) fs.unlinkSync(BANNER_PATH);
      }

      if (action === 'limpar_logo' || action === 'limpar_tudo') {
        if (fs.existsSync(LOGO_PATH)) fs.unlinkSync(LOGO_PATH);
      }

      if (action === 'limpar_banner' || action === 'limpar_logo' || action === 'limpar_tudo') {
        const cleaned = action.replace('limpar_', '').replace('_', ' + ');
        return interaction.reply({
          content: `Branding atualizado: ${cleaned}. Execute /refreshpaineis para aplicar nos paineis antigos.`,
          flags: 64
        });
      }

      if (!bannerUpload && !bannerLink && !logoUpload && !logoLink) {
        return interaction.reply({
          content: 'Informe ao menos um item para atualizar: banner ou logo.',
          flags: 64
        });
      }

      const updates = [];

      if (bannerUpload || bannerLink) {
        if (bannerUpload?.contentType && !bannerUpload.contentType.startsWith('image/')) {
          return interaction.reply({ content: 'O upload de banner precisa ser uma imagem.', flags: 64 });
        }
        const bannerUrl = bannerUpload?.url || bannerLink;
        const bannerData = await downloadBinary(bannerUrl);
        fs.writeFileSync(BANNER_PATH, bannerData);
        updates.push('banner');
      }

      if (logoUpload || logoLink) {
        if (logoUpload?.contentType && !logoUpload.contentType.startsWith('image/')) {
          return interaction.reply({ content: 'O upload de logo precisa ser uma imagem.', flags: 64 });
        }
        const logoUrl = logoUpload?.url || logoLink;
        const logoData = await downloadBinary(logoUrl);
        fs.writeFileSync(LOGO_PATH, logoData);
        updates.push('logo');
      }

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('Branding atualizado')
        .setDescription(`Arquivos atualizados: ${updates.join(', ')}`)
        .addFields(
          { name: 'Banner', value: `\`${BANNER_PATH}\``, inline: false },
          { name: 'Logo', value: `\`${LOGO_PATH}\``, inline: false }
        )
        .setFooter({ text: 'Kyoto Store | Execute /refreshpaineis para aplicar nos paineis antigos' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
      console.error('Erro no comando setbranding:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Erro ao atualizar branding.', flags: 64 }).catch(() => {});
      } else {
        await interaction.reply({ content: 'Erro ao atualizar branding.', flags: 64 }).catch(() => {});
      }
    }
  }
};
