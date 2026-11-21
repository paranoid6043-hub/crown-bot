const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { error } = require('../../utils/embeds');

const WORDS = [
  'discord', 'serveur', 'moderation', 'musique', 'clavier', 'ecran', 'souris',
  'robot', 'programme', 'internet', 'ordinateur', 'telephone', 'message',
  'salon', 'vocal', 'streaming', 'gaming', 'console', 'manette', 'aventure',
  'chocolat', 'fromage', 'baguette', 'croissant', 'soleil', 'montagne',
  'riviere', 'chateau', 'dragon', 'epee', 'bouclier', 'magie', 'potion',
];

const HANGMAN = [
  '```\n  +---+\n      |\n      |\n      |\n     ===```',
  '```\n  +---+\n  O   |\n      |\n      |\n     ===```',
  '```\n  +---+\n  O   |\n  |   |\n      |\n     ===```',
  '```\n  +---+\n  O   |\n /|   |\n      |\n     ===```',
  '```\n  +---+\n  O   |\n /|\\  |\n      |\n     ===```',
  '```\n  +---+\n  O   |\n /|\\  |\n /    |\n     ===```',
  '```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n     ===```',
];

module.exports = {
  name: 'pendu',
  aliases: ['hangman'],
  description: 'Jouer au pendu',
  usage: '&pendu',
  permission: 'Public',
  category: 'Jeux',

  async execute(message) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const guessed = new Set();
    let errors = 0;

    function display() {
      return word.split('').map(l => guessed.has(l) ? l.toUpperCase() : '_ ').join(' ');
    }

    function hasWon() {
      return word.split('').every(l => guessed.has(l));
    }

    const embed = new EmbedBuilder()
      .setColor(config.accentColor)
      .setTitle('🪢 Pendu')
      .setDescription(`${HANGMAN[errors]}\n\n**${display()}**\n\nEnvoie une lettre pour jouer !`)
      .setFooter({ text: `${message.author.tag} · Lettres essayees: aucune` });

    const msg = await message.reply({ embeds: [embed] });

    const filter = m => m.author.id === message.author.id && /^[a-zA-ZÀ-ÿ]$/i.test(m.content);
    const collector = message.channel.createMessageCollector({ filter, time: 120_000 });

    collector.on('collect', async (m) => {
      const letter = m.content.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      m.delete().catch(() => {});

      if (guessed.has(letter)) return;
      guessed.add(letter);

      if (!word.includes(letter)) errors++;

      if (errors >= 6) {
        collector.stop();
        embed.setDescription(`${HANGMAN[6]}\n\n💀 Perdu ! Le mot etait **${word.toUpperCase()}**`).setColor(config.errorColor);
        return msg.edit({ embeds: [embed] });
      }

      if (hasWon()) {
        collector.stop();
        embed.setDescription(`${HANGMAN[errors]}\n\n🎉 Bravo ! Le mot etait **${word.toUpperCase()}**`).setColor(config.successColor);
        return msg.edit({ embeds: [embed] });
      }

      embed.setDescription(`${HANGMAN[errors]}\n\n**${display()}**\n\nEnvoie une lettre !`)
        .setFooter({ text: `${message.author.tag} · Lettres: ${[...guessed].join(', ')} · ${6 - errors} vie(s)` });
      msg.edit({ embeds: [embed] });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        embed.setDescription(`⏰ Temps ecoule ! Le mot etait **${word.toUpperCase()}**`);
        msg.edit({ embeds: [embed] }).catch(() => {});
      }
    });
  },
};
