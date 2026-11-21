const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');

module.exports = {
  name: 'morpion',
  aliases: ['tictactoe', 'ttt'],
  description: 'Jouer au morpion',
  usage: '&morpion <@user>',
  permission: 'Public',
  category: 'Jeux',

  async execute(message, args) {
    const opponentId = parseUser(args[0]);
    if (!opponentId || opponentId === message.author.id) return message.reply({ embeds: [error('Mentionne un autre membre.')] });

    const opponent = await message.guild.members.fetch(opponentId).catch(() => null);
    if (!opponent || opponent.user.bot) return message.reply({ embeds: [error('Joueur introuvable.')] });

    const board = Array(9).fill(null);
    let currentPlayer = 0;
    const players = [message.author, opponent.user];
    const symbols = ['❌', '⭕'];

    function buildBoard() {
      const rows = [];
      for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
          const i = r * 3 + c;
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`ttt_${i}`)
              .setLabel(board[i] ? symbols[board[i] - 1] : '⬜')
              .setStyle(board[i] ? (board[i] === 1 ? ButtonStyle.Danger : ButtonStyle.Primary) : ButtonStyle.Secondary)
              .setDisabled(board[i] !== null),
          );
        }
        rows.push(row);
      }
      return rows;
    }

    function checkWin() {
      const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
      }
      return board.every(v => v !== null) ? 'draw' : null;
    }

    const embed = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('🎮 Morpion')
      .setDescription(`${players[currentPlayer]} (${symbols[currentPlayer]}), c'est ton tour !`);

    const msg = await message.reply({ embeds: [embed], components: buildBoard() });

    const collector = msg.createMessageComponentCollector({ time: 120_000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== players[currentPlayer].id) {
        return i.reply({ content: 'Ce n\'est pas ton tour.', ephemeral: true });
      }

      const idx = parseInt(i.customId.split('_')[1]);
      board[idx] = currentPlayer + 1;

      const result = checkWin();
      if (result) {
        collector.stop();
        const desc = result === 'draw' ? '🤝 Egalite !' : `🏆 ${players[result - 1]} a gagne !`;
        embed.setDescription(desc);
        return i.update({ embeds: [embed], components: buildBoard().map(r => { r.components.forEach(b => b.setDisabled(true)); return r; }) });
      }

      currentPlayer = 1 - currentPlayer;
      embed.setDescription(`${players[currentPlayer]} (${symbols[currentPlayer]}), c'est ton tour !`);
      await i.update({ embeds: [embed], components: buildBoard() });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        embed.setDescription('⏰ Partie terminee (temps ecoule).');
        msg.edit({ embeds: [embed], components: [] }).catch(() => {});
      }
    });
  },
};
