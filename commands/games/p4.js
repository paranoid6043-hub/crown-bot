const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { error } = require('../../utils/embeds');
const { parseUser } = require('../../utils/parsers');

module.exports = {
  name: 'p4',
  aliases: ['puissance4', 'connect4'],
  description: 'Jouer a Puissance 4',
  usage: '&p4 <@user>',
  permission: 'Public',
  category: 'Jeux',

  async execute(message, args) {
    const opponentId = parseUser(args[0]);
    if (!opponentId || opponentId === message.author.id) return message.reply({ embeds: [error('Mentionne un autre membre.')] });

    const opponent = await message.guild.members.fetch(opponentId).catch(() => null);
    if (!opponent || opponent.user.bot) return message.reply({ embeds: [error('Joueur introuvable.')] });

    const ROWS = 6, COLS = 7;
    const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    let current = 0;
    const players = [message.author, opponent.user];
    const discs = ['🔴', '🟡'];

    function render() {
      let s = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          s += board[r][c] === 0 ? '⚫' : discs[board[r][c] - 1];
        }
        s += '\n';
      }
      s += '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
      return s;
    }

    function drop(col, player) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) { board[r][col] = player; return r; }
      }
      return -1;
    }

    function checkWin(r, c, p) {
      const dirs = [[0,1],[1,0],[1,1],[1,-1]];
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let d = 1; d < 4; d++) { const nr = r+dr*d, nc = c+dc*d; if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[nr][nc]===p) count++; else break; }
        for (let d = 1; d < 4; d++) { const nr = r-dr*d, nc = c-dc*d; if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[nr][nc]===p) count++; else break; }
        if (count >= 4) return true;
      }
      return false;
    }

    function buildButtons() {
      const row = new ActionRowBuilder();
      for (let c = 0; c < COLS; c++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`p4_${c}`)
            .setLabel(`${c + 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(board[0][c] !== 0),
        );
      }
      return [row];
    }

    const embed = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('🔴🟡 Puissance 4')
      .setDescription(`${render()}\n\n${players[current]} (${discs[current]}), choisis une colonne !`);

    const msg = await message.reply({ embeds: [embed], components: buildButtons() });
    const collector = msg.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== players[current].id) return i.reply({ content: 'Pas ton tour.', ephemeral: true });

      const col = parseInt(i.customId.split('_')[1]);
      const row = drop(col, current + 1);
      if (row === -1) return i.reply({ content: 'Colonne pleine.', ephemeral: true });

      if (checkWin(row, col, current + 1)) {
        collector.stop();
        embed.setDescription(`${render()}\n\n🏆 ${players[current]} gagne !`);
        return i.update({ embeds: [embed], components: [] });
      }

      if (board[0].every(v => v !== 0)) {
        collector.stop();
        embed.setDescription(`${render()}\n\n🤝 Egalite !`);
        return i.update({ embeds: [embed], components: [] });
      }

      current = 1 - current;
      embed.setDescription(`${render()}\n\n${players[current]} (${discs[current]}), choisis une colonne !`);
      await i.update({ embeds: [embed], components: buildButtons() });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        embed.setDescription(`${render()}\n\n⏰ Temps ecoule.`);
        msg.edit({ embeds: [embed], components: [] }).catch(() => {});
      }
    });
  },
};
