/**
 * Comando /ticket - Sistema de suporte (Kyoto Bot Enterprise)
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');
const { buildTicketSupportPanel, savePanelRecord } = require('../sys_runtime/net_protocol/panelLayouts');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema de tickets de suporte')
    .addSubcommand(subcommand =>
      subcommand
        .setName('canal')
        .setDescription('Cria painel de tickets com categorias (Suporte, Atendimento, Duvidas, Parceria)')
        .addStringOption(option =>
          option
            .setName('visual')
            .setDescription('Escolha visual do painel de ticket')
            .setRequired(false)
            .addChoices(
              { name: 'Logo', value: 'logo' },
              { name: 'Banner', value: 'banner' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('criar')
        .setDescription('Criar um novo ticket')
        .addStringOption(option =>
          option.setName('motivo')
            .setDescription('Motivo do ticket')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('fechar')
        .setDescription('Fechar o ticket atual')
    ),
  
  cooldown: 10,
  
  async execute(interaction, client) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'canal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({
            content: 'Voce precisa de permissao para gerenciar canais.',
            flags: 64
          });
        }
        
        const db = Database.getInstance();
        const visualMode = interaction.options.getString('visual') || 'banner';
        const panel = buildTicketSupportPanel({ visualMode });
        const message = await interaction.channel.send(panel.messageData);
        await savePanelRecord(db, message, panel.panelType, panel.payload);
        await interaction.reply({ content: 'Painel de tickets com categorias criado!', flags: 64 });

      } else if (subcommand === 'criar') {
        const motivo = interaction.options.getString('motivo') || 'Suporte Geral';
        
        const existingTicket = interaction.guild.channels.cache.find(
          ch => ch.name.includes(`ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)}`)
        );
        
        if (existingTicket) {
          return interaction.reply({
            content: `Voce ja tem um ticket aberto: ${existingTicket}`,
            flags: 64
          });
        }
        
        const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || interaction.user.id;
        
        const ticketChannel = await interaction.guild.channels.create({
          name: `ticket-${safeName}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
            },
            {
              id: client.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
            }
          ]
        });
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Ticket de Suporte')
          .setDescription(`Bem-vindo, ${interaction.user}!\n\nO chat já está **aberto** para você descrever seu problema.`)
          .addFields(
            { name: 'Motivo', value: motivo, inline: true },
            { name: 'Status', value: '🟢 Aberto', inline: true }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Assumir Ticket')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Fechar Ticket')
            .setStyle(ButtonStyle.Danger)
        );
        
        await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
        
        await interaction.reply({
          content: `Ticket criado com sucesso: ${ticketChannel}`,
          flags: 64
        });
        
      } else if (subcommand === 'fechar') {
        if (!interaction.channel.name.startsWith('ticket-')) {
          return interaction.reply({
            content: 'Este comando so pode ser usado dentro de um ticket.',
            flags: 64
          });
        }
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Ticket Encerrado')
          .setDescription('Este ticket sera excluido em 5 segundos.')
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        setTimeout(async () => {
          try {
            await interaction.channel.delete();
          } catch (e) {}
        }, 5000);
      }
      
    } catch (error) {
      console.error('Erro no comando ticket:', error);
      await interaction.reply({ content: 'Erro ao processar ticket.', flags: 64 });
    }
  }
};
