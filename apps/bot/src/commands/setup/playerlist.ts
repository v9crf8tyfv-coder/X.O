import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type GuildMember,
} from 'discord.js';
import { queryFull } from 'minecraft-server-util';
import type { SlashCommand } from '../../types.js';
import { GRADES, getGrade, BRAND_COLOR } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { errorEmbed } from '../../lib/embeds.js';
import { highestGrade } from '../../lib/permissions.js';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;

export const playerlist: SlashCommand = {
  minLevel: GRADES.responsable.level,
  data: new SlashCommandBuilder()
    .setName('playerlist')
    .setDescription('Voir les joueurs en ligne (staff en haut, joueurs en bas)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let online: string[] = [];
    try {
      const res = await queryFull(HOST, PORT, { timeout: 5000 });
      online = res.players?.list ?? [];
    } catch {
      await interaction.editReply({
        embeds: [errorEmbed('Serveur injoignable', 'Impossible de récupérer la liste (serveur hors ligne ?).')],
      });
      return;
    }

    // Grades depuis la table staff (pseudo Minecraft -> grades)
    const staffRows = hasDatabase()
      ? await db()<{ pseudo: string; grades: string[] }[]>`
          select pseudo, grades from staff where active = true
        `
      : [];
    const gradeOf = (name: string): string | null => {
      const row = staffRows.find((s) => s.pseudo?.toLowerCase() === name.toLowerCase());
      if (!row || !row.grades?.length) return null;
      return row.grades.reduce((a, b) => (getGrade(b).level > getGrade(a).level ? b : a));
    };

    // Grade de celui qui lance : les non-fonda ne voient PAS les cofonda/fonda
    const member = interaction.member as GuildMember | null;
    const runnerLevel = member ? highestGrade(member)?.level ?? 0 : 0;
    const isFonda = runnerLevel >= GRADES.fondateur.level;

    const staff: { name: string; grade: string }[] = [];
    const joueurs: string[] = [];
    for (const name of online) {
      const g = gradeOf(name);
      if (g) {
        // Masque cofonda + fonda si celui qui lance n'est pas fonda
        if (!isFonda && getGrade(g).level >= GRADES.cofondateur.level) continue;
        staff.push({ name, grade: g });
      } else {
        joueurs.push(name);
      }
    }
    staff.sort((a, b) => getGrade(b.grade).level - getGrade(a.grade).level);

    const staffTxt = staff.length
      ? staff.map((s) => `**${getGrade(s.grade).label}** · ${s.name}`).join('\n')
      : '—';
    const joueurTxt = joueurs.length ? joueurs.join('\n') : '—';

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`👥 En ligne — ${online.length}`)
      .addFields(
        { name: '⭐ Staff', value: staffTxt.slice(0, 1024) },
        { name: '━━━━━━━━━━', value: '​' },
        { name: '🎮 Joueurs', value: joueurTxt.slice(0, 1024) },
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
