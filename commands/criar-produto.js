/**
 * Comando /criar-produto - Criação de produtos (Kyoto Vendas)
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');
const EconomyService = require('../sys_runtime/math_core/economy');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-produto')
    .setDescription('Cria um novo produto')
    .addSubcommand(sub => 
      sub.setName('novo-canal')
        .setDescription('Cria um novo canal para o produto e cria o produto')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do produto').setRequired(true))
        .addNumberOption(opt => opt.setName('preco').setDescription('Preco do produto').setRequired(true))
    )
    .setDefaultMemberPermissions(null),
  
  async execute(interaction, client) {
    try {
      const nome = interaction.options.getString('nome');
      const preco = interaction.options.getNumber('preco');

      const db = Database.getInstance();
      const economy = EconomyService.getInstance();
      const precoFinal = economy.applyMPTax(preco);

      const saved = await db.run(
        'INSERT INTO products (name, price, description, active, created_at) VALUES (?, ?, ?, 1, datetime("now"))',
        [nome, preco, `Produto criado via /criar-produto em ${new Date().toISOString()}`]
      );

      const channelName = `produto-${nome.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80)}`;
      const createdChannel = await interaction.guild.channels.create({
        name: channelName,
        reason: `Canal de produto criado por ${interaction.user.tag}`
      }).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('✅ Produto Criado')
        .setDescription('Produto registrado com sucesso na loja.')
        .addFields(
          { name: 'Nome', value: nome, inline: true },
          { name: 'ID', value: `${saved.lastID}`, inline: true },
          { name: 'Preço Base', value: economy.formatCurrency(preco), inline: true },
          { name: 'Preço Final (com taxa)', value: economy.formatCurrency(precoFinal), inline: true },
          { name: 'Canal', value: createdChannel ? `${createdChannel}` : 'Canal não criado', inline: true }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
      console.error('Erro no comando criar-produto:', error);
      await interaction.reply({ content: 'Erro ao criar produto.', flags: 64 });
    }
  }
};
