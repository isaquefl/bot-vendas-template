/**
 * Comando /criar-painel - Cria paineis de venda fixos
 * Layouts centralizados e padronizados para uso profissional.
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EconomyService = require('../sys_runtime/math_core/economy');
const Database = require('../sys_runtime/vault_manager/database');
const {
  buildRobuxPanel,
  buildVPPanel,
  buildContaPanel,
  buildPersonalizadoPanel,
  buildMultiPanel,
  savePanelRecord,
  publishSingletonPanel
} = require('../sys_runtime/net_protocol/panelLayouts');

module.exports = {
  defer: true,
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('criar-painel')
    .setDescription('Cria um painel de venda fixo no canal')
    .addSubcommand(sub =>
      sub.setName('robux')
        .setDescription('Cria painel de venda de Robux')
        .addStringOption(opt =>
          opt.setName('visual')
            .setDescription('Defina se o painel usa logo, banner, ambos ou nenhum')
            .setRequired(false)
            .addChoices(
              { name: 'Ambos', value: 'ambos' },
              { name: 'Logo', value: 'logo' },
              { name: 'Banner', value: 'banner' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('vp')
        .setDescription('Cria painel de venda de Valorant Points')
        .addStringOption(opt =>
          opt.setName('visual')
            .setDescription('Defina se o painel usa logo, banner, ambos ou nenhum')
            .setRequired(false)
            .addChoices(
              { name: 'Ambos', value: 'ambos' },
              { name: 'Logo', value: 'logo' },
              { name: 'Banner', value: 'banner' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('conta')
        .setDescription('Cria anuncio de conta para venda')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome/Titulo da conta').setRequired(true))
        .addNumberOption(opt => opt.setName('preco').setDescription('Preco base da conta (taxa de 0,99% sera aplicada)').setRequired(true))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descricao da conta (skins, rank, etc)').setRequired(true))
        .addStringOption(opt => opt.setName('elo').setDescription('Elo da conta (ex: Diamante 2)').setRequired(false))
        .addStringOption(opt => opt.setName('skins').setDescription('Resumo das skins principais').setRequired(false))
        .addStringOption(opt => opt.setName('chaveiros').setDescription('Resumo dos chaveiros').setRequired(false))
        .addStringOption(opt => opt.setName('imagem_link').setDescription('URL da imagem da conta (Discord/CDN ou outro link)').setRequired(false))
        .addAttachmentOption(opt => opt.setName('imagem_upload').setDescription('Imagem por upload do PC ou colar/arrastar no Discord').setRequired(false))
        .addStringOption(opt =>
          opt.setName('visual')
            .setDescription('Escolha entre logo ou banner para o painel')
            .setRequired(false)
            .addChoices(
              { name: 'Ambos', value: 'ambos' },
              { name: 'Logo', value: 'logo' },
              { name: 'Banner', value: 'banner' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('personalizado')
        .setDescription('Cria painel de produto personalizado')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do produto').setRequired(true))
        .addNumberOption(opt => opt.setName('preco').setDescription('Preco base (taxa sera adicionada)').setRequired(true))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descricao do produto').setRequired(false))
        .addStringOption(opt =>
          opt.setName('visual')
            .setDescription('Defina se o painel usa logo, banner, ambos ou nenhum')
            .setRequired(false)
            .addChoices(
              { name: 'Ambos', value: 'ambos' },
              { name: 'Logo', value: 'logo' },
              { name: 'Banner', value: 'banner' },
              { name: 'Nenhum', value: 'nenhum' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('multi')
        .setDescription('Cria painel personalizado com multiplas opcoes de preco')
        .addStringOption(opt => opt.setName('titulo').setDescription('Titulo do painel').setRequired(true))
        .addStringOption(opt => opt.setName('opcoes').setDescription('Formato: Nome:Preco, Nome:Preco (Ex: Bronze:10, Prata:20)').setRequired(true))
        .addStringOption(opt => opt.setName('descricao').setDescription('Descricao do painel').setRequired(false))
        .addStringOption(opt =>
          opt.setName('visual')
            .setDescription('Defina se o painel usa logo, banner, ambos ou nenhum')
            .setRequired(false)
            .addChoices(
              { name: 'Ambos', value: 'ambos' },
              { name: 'Logo', value: 'logo' },
              { name: 'Banner', value: 'banner' },
              { name: 'Nenhum', value: 'nenhum' }
            )
        )
    )
    .setDefaultMemberPermissions(null),
  
  async execute(interaction, client) {
    const economy = EconomyService.getInstance();
    const db = Database.getInstance();
    const subcommand = interaction.options.getSubcommand();

    const safeReply = async (content) => {
      if (interaction.deferred && !interaction.replied) {
        return interaction.editReply({ content });
      }
      if (interaction.replied) {
        return interaction.followUp({ content, flags: 64 });
      }
      return interaction.reply({ content, flags: 64 });
    };

    if (subcommand === 'robux') {
      const visualMode = interaction.options.getString('visual') || 'banner';
      const panel = buildRobuxPanel(economy, { visualMode });
      await publishSingletonPanel(db, interaction.channel, panel.panelType, panel.payload, panel.messageData);
      await safeReply('Painel de Robux criado com sucesso!');

    } else if (subcommand === 'vp') {
      const visualMode = interaction.options.getString('visual') || 'banner';
      const panel = buildVPPanel(economy, { visualMode });
      await publishSingletonPanel(db, interaction.channel, panel.panelType, panel.payload, panel.messageData);
      await safeReply('Painel de VP criado com sucesso!');

    } else if (subcommand === 'conta') {
      const nome = interaction.options.getString('nome');
      const preco = interaction.options.getNumber('preco');
      const descricao = interaction.options.getString('descricao');
      const elo = interaction.options.getString('elo') || 'Nao informado';
      const skins = interaction.options.getString('skins') || 'Nao informado';
      const chaveiros = interaction.options.getString('chaveiros') || 'Nao informado';
      const imagemLink = interaction.options.getString('imagem_link');
      const imagemUpload = interaction.options.getAttachment('imagem_upload');
      const imagemUrl = imagemUpload?.url || imagemLink || null;
      const visualMode = interaction.options.getString('visual') || 'banner';

      const panel = buildContaPanel(economy, client, {
        nome,
        precoBase: preco,
        descricao,
        elo,
        skins,
        chaveiros,
        imagemUrl,
        visualMode
      });

      const message = await interaction.channel.send(panel.messageData);
      await savePanelRecord(db, message, panel.panelType, panel.payload);
      await safeReply('Anuncio de conta criado com sucesso!');

    } else if (subcommand === 'personalizado') {
      const nome = interaction.options.getString('nome');
      const preco = interaction.options.getNumber('preco');
      const descricao = interaction.options.getString('descricao') || 'Produto disponivel para compra.';
      const visualMode = interaction.options.getString('visual') || 'ambos';

      const panel = buildPersonalizadoPanel(economy, {
        nome,
        precoBase: preco,
        descricao,
        visualMode
      });

      await publishSingletonPanel(db, interaction.channel, panel.panelType, panel.payload, panel.messageData);
      await safeReply('Painel de produto criado com sucesso!');

    } else if (subcommand === 'multi') {
      const titulo = interaction.options.getString('titulo');
      const descricao = interaction.options.getString('descricao') || 'Selecione uma das opcoes abaixo para comprar:';
      const opcoesRaw = interaction.options.getString('opcoes');
      const visualMode = interaction.options.getString('visual') || 'ambos';

      try {
        const parsedOptions = opcoesRaw.split(',').map(item => {
          const [name, priceRaw] = item.trim().split(':');
          const basePrice = parseFloat(priceRaw);
          if (isNaN(basePrice)) throw new Error(`Preco invalido para ${name}`);

          return {
            nome: name.trim(),
            precoBase: basePrice
          };
        });

        const panel = buildMultiPanel(economy, {
          titulo,
          descricao,
          opcoes: parsedOptions,
          visualMode
        });

        await publishSingletonPanel(db, interaction.channel, panel.panelType, panel.payload, panel.messageData);
        await safeReply('Painel multi-produto criado com sucesso!');

      } catch (err) {
        await safeReply(`Erro ao processar as opcoes: ${err.message}. Use o formato Nome:Preco, Nome:Preco`);
      }
    }
  }
};
