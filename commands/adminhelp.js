/**
 * Comando /adminhelp - Guia exclusivo de administradores.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const THEME_COLOR = 0x1c6dbd;

function getDateStamp() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminhelp')
    .setDescription('Mostra os comandos administrativos e o fluxo recomendado')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  cooldown: 3,

  async execute(interaction) {
    const stamp = getDateStamp();

    const embed = new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('Kyoto Store | Admin Help')
      .setDescription('Painel administrativo com comandos organizados por funcao.')
      .addFields(
        {
          name: 'Setup inicial',
          value: '`/setbranding`\n`/setlogs`\n`/setvendas`\n`/setlogs-transacoes`\n`/setlogs-tickets`\n`/setlogs-vendas-simples`\n`/setlogs-vendas-avancado`\n`/fluxos-canais`',
          inline: false
        },
        {
          name: 'Gestao de paineis',
          value: '`/criar-painel`\n`/criar-painel-robux`\n`/refreshpaineis`\n`/paineiscalculo publicar|atualizar`',
          inline: false
        },
        {
          name: 'Precificacao e catalogo',
          value: '`/paineiscalculo configurar|ver`\n`/loja adicionar`\n`/loja precificar`\n`/loja renomear`\n`/loja remover`',
          inline: false
        },
        {
          name: 'Auditoria e diagnostico',
          value: '`/logs-check status`\n`/logs-check testar`\n`/fluxos-canais`',
          inline: false
        },
        {
          name: 'Atualizacao',
          value: `Conteudo revisado em: **${stamp}**`,
          inline: false
        }
      )
      .setFooter({ text: 'Kyoto Store | Apenas administradores' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
