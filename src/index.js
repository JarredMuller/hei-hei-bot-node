import 'dotenv/config';
import crypto from 'node:crypto';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Events } from 'discord.js';

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  LINDY_WEBHOOK_URL,
  LINDY_WEBHOOK_SECRET
} = process.env;

// Validate required env
const missing = [];
if (!DISCORD_BOT_TOKEN) missing.push('DISCORD_BOT_TOKEN');
if (!DISCORD_CLIENT_ID) missing.push('DISCORD_CLIENT_ID');
if (!LINDY_WEBHOOK_URL) missing.push('LINDY_WEBHOOK_URL');
if (!LINDY_WEBHOOK_SECRET) missing.push('LINDY_WEBHOOK_SECRET');
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// ── Discord client ─────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Define slash commands
const commandDefs = [
  new SlashCommandBuilder()
    .setName('sprint')
    .setDescription('Send a project to Lindy to start/update a sprint')
    .addStringOption(opt =>
      opt.setName('project')
        .setDescription("Project name, e.g., 'Website Revamp'")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('gap')
    .setDescription('Send a project to Lindy to check for gaps')
    .addStringOption(opt =>
      opt.setName('project')
        .setDescription("Project name, e.g., 'Data Migration'")
        .setRequired(true)
    )
].map(c => c.toJSON());

// Register commands on startup
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

  if (DISCORD_GUILD_ID) {
    // Guild-scoped: instant
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commandDefs }
    );
    console.log(`🔁 Synced commands to guild ${DISCORD_GUILD_ID}`);
  } else {
    // Global: can take up to ~1 hour to propagate
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commandDefs });
    console.log('🔁 Synced global commands (may take a while to appear)');
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Logged in as ${c.user.tag} (id ${c.user.id})`);
  try {
    await registerCommands();
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

// Helpers
function signPayload(secret, bodyBuffer) {
  const hex = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
  return `sha256=${hex}`;
}

function safeUsername(user) {
  // Discord now has global display names; fallback to username
  return user.globalName ?? user.username;
}

async function postToLindy(command, project, interaction) {
  const payload = {
    command,
    project,
    user: {
      id: interaction.user.id,
      username: safeUsername(interaction.user)
    },
    channel_id: interaction.channelId,
    guild_id: interaction.guildId,
    guild_name: interaction.guild?.name ?? null,
    timestamp: new Date().toISOString()
  };

  const body = Buffer.from(JSON.stringify(payload));
  const headers = {
    'Content-Type': 'application/json',
    'X-Signature': signPayload(LINDY_WEBHOOK_SECRET, body),
    'X-Timestamp': String(Math.floor(Date.now() / 1000))
  };

  try {
    const res = await fetch(LINDY_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15_000)
    });

    let msg;
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      msg = json?.message;
    } catch {
      /* ignore non-JSON */
    }

    if (res.ok) {
      await interaction.editReply(msg ?? `${command.toUpperCase()} request for **${project}** sent to Lindy.`);
    } else {
      await interaction.editReply(`⚠️ Lindy returned ${res.status}. Project: **${project}**`);
    }
  } catch (err) {
    await interaction.editReply(`⚠️ Could not reach Lindy: \`${err}\``);
  }
}

// Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;
  const project = interaction.options.getString('project', true);

  try {
    await interaction.deferReply({ ephemeral: false });
  } catch (e) {
    console.error('Failed to defer reply:', e);
    return;
  }

  if (name === 'sprint') {
    await postToLindy('sprint', project, interaction);
  } else if (name === 'gap') {
    await postToLindy('gap', project, interaction);
  } else {
    await interaction.editReply('Unknown command.');
  }
});

// Entrypoint
client.login(DISCORD_BOT_TOKEN).catch((e) => {
  console.error('Login failed:', e);
  process.exit(1);
});
