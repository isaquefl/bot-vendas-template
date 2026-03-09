/**
 * Comando /loja - Configuracao da loja
 * Kyoto Bot Enterprise
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const Database = require('../sys_runtime/vault_manager/database');
const EconomyService = require('../sys_runtime/math_core/economy');

const THEME_COLOR = 0x1c6dbd;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Gerenciamento da loja')
    .addSubcommand(subcommand =>
      subcommand
        .setName('precos')
        .setDescription('Configurar precos dos produtos')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('produtos')
        .setDescription('Listar produtos ativos')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('adicionar')
        .setDescription('Adicionar novo produto')
        .addStringOption(option =>
          option.setName('nome')
            .setDescription('Nome do produto')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option.setName('preco')
            .setDescription('Preco em reais')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('descricao')
            .setDescription('Descricao do produto')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remover')
        .setDescription('Remover produto')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID do produto')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('precificar')
        .setDescription('Atualizar preco de um produto existente')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID do produto')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option.setName('preco')
            .setDescription('Novo preco base em reais')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('renomear')
        .setDescription('Alterar nome de exibicao do produto')
        .addStringOption(option =>
          option.setName('id')
            .setDescription('ID do produto')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('nome')
            .setDescription('Novo nome de anuncio')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('painel')
        .setDescription('Criar painel de loja no canal')
    )
    .setDefaultMemberPermissions(null),
  
  cooldown: 3,
  
  async execute(interaction, client) {
    try {
      const db = Database.getInstance();
      const economy = EconomyService.getInstance();
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'precos') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('loja_precos_select')
          .setPlaceholder('Selecione o produto para editar')
          .addOptions([
            { label: 'Robux (por 1000)', value: 'robux_1k', description: 'Preco base: R$ 38,00' },
            { label: 'Valorant Points', value: 'vp', description: 'Preco por VP' },
            { label: 'Taxa de Servico', value: 'taxa', description: 'Taxa adicional %' }
          ]);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Configuracao de Precos')
          .setDescription('Selecione o produto que deseja configurar:')
          .addFields(
            { name: 'Robux/1k', value: `R$ ${economy.robuxPer1k.toFixed(2)}`, inline: true },
            { name: 'Taxa MP', value: `${(economy.mpTaxRate * 100).toFixed(2)}%`, inline: true },
            { name: 'Taxa Servico', value: `0%`, inline: true }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        
      } else if (subcommand === 'produtos') {
        const products = await db.all('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC');
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Produtos Ativos')
          .setTimestamp();
        
        if (products.length === 0) {
          embed.setDescription('Nenhum produto cadastrado. Use `/loja adicionar` para criar.');
        } else {
          embed.setDescription(`Total: ${products.length} produto(s)`);
          for (const product of products.slice(0, 10)) {
            const finalPrice = economy.applyMPTax(product.price);
            embed.addFields({
              name: `${product.name} (ID: ${product.id})`,
              value: `Base: ${economy.formatCurrency(product.price)} | **Cobrar: ${economy.formatCurrency(finalPrice)}**\n${product.description || 'Sem descricao'}`,
              inline: false
            });
          }
        }
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        
      } else if (subcommand === 'adicionar') {
        const nome = interaction.options.getString('nome');
        const preco = interaction.options.getNumber('preco');
        const descricao = interaction.options.getString('descricao') || '';
        
        const result = await db.run(
          'INSERT INTO products (name, price, description, active, created_at) VALUES (?, ?, ?, 1, datetime("now"))',
          [nome, preco, descricao]
        );
        
        const finalPrice = economy.applyMPTax(preco);
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Produto Adicionado')
          .addFields(
            { name: 'Nome', value: nome, inline: true },
            { name: 'ID', value: `${result.lastID}`, inline: true },
            { name: 'Preco Base', value: economy.formatCurrency(preco), inline: true },
            { name: 'Preco Final', value: economy.formatCurrency(finalPrice), inline: true },
            { name: 'Descricao', value: descricao || 'N/A', inline: false }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
        
      } else if (subcommand === 'remover') {
        const id = interaction.options.getString('id');
        
        const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
        
        if (!product) {
          return interaction.reply({ content: 'Produto nao encontrado.', flags: 64 });
        }
        
        await db.run('UPDATE products SET active = 0 WHERE id = ?', [id]);
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Produto Removido')
          .addFields(
            { name: 'Nome', value: product.name, inline: true },
            { name: 'ID', value: `${id}`, inline: true }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });

      } else if (subcommand === 'precificar') {
        const id = interaction.options.getString('id');
        const novoPreco = interaction.options.getNumber('preco');

        const product = await db.get('SELECT * FROM products WHERE id = ? AND active = 1', [id]);
        if (!product) {
          return interaction.reply({ content: 'Produto nao encontrado.', flags: 64 });
        }

        await db.run('UPDATE products SET price = ? WHERE id = ?', [novoPreco, id]);

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Preco atualizado')
          .addFields(
            { name: 'Produto', value: product.name, inline: true },
            { name: 'ID', value: `${id}`, inline: true },
            { name: 'Novo preco base', value: economy.formatCurrency(novoPreco), inline: true },
            { name: 'Novo preco final', value: economy.formatCurrency(economy.applyMPTax(novoPreco)), inline: true }
          )
          .setFooter({ text: 'Kyoto Store | Precificacao atualizada' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: 64 });

      } else if (subcommand === 'renomear') {
        const id = interaction.options.getString('id');
        const novoNome = interaction.options.getString('nome');

        const product = await db.get('SELECT * FROM products WHERE id = ? AND active = 1', [id]);
        if (!product) {
          return interaction.reply({ content: 'Produto nao encontrado.', flags: 64 });
        }

        await db.run('UPDATE products SET name = ? WHERE id = ?', [novoNome, id]);

        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Nome de anuncio atualizado')
          .addFields(
            { name: 'ID', value: `${id}`, inline: true },
            { name: 'Nome anterior', value: product.name, inline: true },
            { name: 'Novo nome', value: novoNome, inline: true }
          )
          .setFooter({ text: 'Kyoto Store | Anuncio atualizado' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: 64 });
        
      } else if (subcommand === 'painel') {
        const products = await db.all('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC LIMIT 10');
        
        const embed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Loja Kyoto')
          .setDescription('Selecione um produto para comprar:')
          .setImage('https://i.imgur.com/7J5h8Ox.png')
          .setFooter({ text: 'Kyoto Bot Enterprise | Pagamento via PIX' })
          .setTimestamp();
        
        if (products.length === 0) {
          embed.addFields({ name: 'Status', value: 'Nenhum produto disponivel no momento.', inline: false });
          await interaction.channel.send({ embeds: [embed] });
        } else {
          const options = products.map(p => ({
            label: p.name,
            description: `${economy.formatCurrency(economy.applyMPTax(p.price))}`,
            value: `${p.id}`
          }));
          
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('loja_comprar')
            .setPlaceholder('Escolha um produto')
            .addOptions(options);
          
          const row = new ActionRowBuilder().addComponents(selectMenu);
          
          for (const product of products) {
            const finalPrice = economy.applyMPTax(product.price);
            embed.addFields({
              name: product.name,
              value: `**${economy.formatCurrency(finalPrice)}**`,
              inline: true
            });
          }
          
          await interaction.channel.send({ embeds: [embed], components: [row] });
        }
        
        await interaction.reply({ content: 'Painel de loja criado!', flags: 64 });
      }
      
    } catch (error) {
      console.error('Erro no comando loja:', error);
      await interaction.reply({ 
        content: 'Erro ao executar comando.', 
        flags: 64 
      });
    }
  }
};
