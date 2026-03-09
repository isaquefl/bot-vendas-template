const { SlashCommandBuilder } = require('discord.js');
const EconomyService = require('../sys_runtime/math_core/economy');
const Database = require('../sys_runtime/vault_manager/database');
const { buildRobuxPanel, publishSingletonPanel } = require('../sys_runtime/net_protocol/panelLayouts');

module.exports = {
  defer: true,
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('criar-painel-robux')
    .setDescription('Cria o painel de Robux (comando original)')
    .addStringOption((opt) =>
      opt
        .setName('visual')
        .setDescription('Escolha entre logo ou banner')
        .setRequired(false)
        .addChoices(
          { name: 'Ambos', value: 'ambos' },
          { name: 'Logo', value: 'logo' },
          { name: 'Banner', value: 'banner' }
        )
    )
    .setDefaultMemberPermissions(null),

  async execute(interaction) {
    const economy = EconomyService.getInstance();
    const db = Database.getInstance();
    const visualMode = interaction.options.getString('visual') || 'banner';

    const panel = buildRobuxPanel(economy, { visualMode });
    await publishSingletonPanel(db, interaction.channel, panel.panelType, panel.payload, panel.messageData);

    if (interaction.deferred && !interaction.replied) {
      return interaction.editReply({ content: 'Painel de Robux criado com sucesso!' });
    }
    await interaction.reply({ content: 'Painel de Robux criado com sucesso!', flags: 64 });
  }
};
