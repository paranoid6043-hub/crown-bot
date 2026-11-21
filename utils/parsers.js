function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d|j|sem)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, j: 86400000, sem: 604800000 };
  return n * (multipliers[unit] || 0);
}

function formatDuration(ms) {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return `${Math.floor(ms / 86400000)}j`;
}

function parseUser(text, message) {
  if (!text) return null;
  const mention = text.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(text)) return text;
  return null;
}

function parseChannel(text) {
  if (!text) return null;
  const mention = text.match(/^<#(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(text)) return text;
  return null;
}

module.exports = { parseDuration, formatDuration, parseUser, parseChannel };
