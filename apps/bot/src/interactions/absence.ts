import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { db, hasDatabase } from '@xo/db';
import { CHANNELS, GRADES } from '@xo/shared';
import { highestGrade, isFounderTierMember } from '../lib/permissions.js';
import { successEmbed, errorEmbed } from '../lib/embeds.js';
import {
  buildAbsenceEmbed,
  buildAbsenceButtons,
  type AbsenceRecord,
} from '../lib/absence.js';
import { parseFrDate, toIsoDate } from '../lib/dates.js';
import { publishEffectif } from '../lib/effectifPublish.js';

// ---------- helpers ----------

async function needDb(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<boolean> {
  if (hasDatabase()) return true;
  await interaction.reply({
    embeds: [
      errorEmbed('Base non configurée', 'Configure Supabase (DATABASE_URL) pour les absences.'),
    ],
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

async function getAbsence(id: string): Promise<AbsenceRecord | null> {
  const rows = await db()<AbsenceRecord[]>`
    select id, discord_id, discord_tag, reason,
           to_char(start_date,'YYYY-MM-DD') as start_date,
           to_char(end_date,'YYYY-MM-DD') as end_date,
           status, message_id, archive_message_id
    from absences where id = ${id}
  `;
  return rows[0] ?? null;
}

/** Auteur de l'absence, fondateur/co-fonda, ou admin+ peuvent la gérer */
function canManage(member: GuildMember | null, absence: AbsenceRecord): boolean {
  if (!member) return false;
  if (member.id === absence.discord_id) return true;
  if (isFounderTierMember(member)) return true;
  const g = highestGrade(member);
  return (g?.level ?? 0) >= GRADES.admin.level;
}

function buildModal(id: string | null, prefill?: Partial<AbsenceRecord>): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(id ? `absence:editsubmit:${id}` : 'absence:create')
    .setTitle(id ? 'Modifier une absence' : 'Poser une absence');

  const pseudo = new TextInputBuilder()
    .setCustomId('pseudo')
    .setLabel('Ton pseudo')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('TonPseudo')
    .setRequired(true);

  const start = new TextInputBuilder()
    .setCustomId('start')
    .setLabel('Début (JJ/MM/AAAA)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('01/08/2026')
    .setRequired(true);

  const end = new TextInputBuilder()
    .setCustomId('end')
    .setLabel('Fin (JJ/MM/AAAA)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('06/08/2026')
    .setRequired(true);

  const reason = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Raison')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  if (prefill) {
    if (prefill.discord_tag) pseudo.setValue(prefill.discord_tag);
    if (prefill.start_date) start.setValue(prefill.start_date.split('-').reverse().join('/'));
    if (prefill.end_date) end.setValue(prefill.end_date.split('-').reverse().join('/'));
    if (prefill.reason) reason.setValue(prefill.reason);
  }

  return modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(pseudo),
    new ActionRowBuilder<TextInputBuilder>().addComponents(start),
    new ActionRowBuilder<TextInputBuilder>().addComponents(end),
    new ActionRowBuilder<TextInputBuilder>().addComponents(reason),
  );
}

function parseModalDates(interaction: ModalSubmitInteraction) {
  const pseudo = interaction.fields.getTextInputValue('pseudo');
  const startStr = interaction.fields.getTextInputValue('start');
  const endStr = interaction.fields.getTextInputValue('end');
  const reason = interaction.fields.getTextInputValue('reason');
  const start = parseFrDate(startStr);
  const end = parseFrDate(endStr);
  return { pseudo, start, end, reason };
}

// ---------- handlers ----------

/** Bouton "Poser une absence" -> ouvre le modal */
export const absenceNew: ComponentHandler<ButtonInteraction> = {
  prefix: 'absence:new',
  async execute(interaction) {
    if (!hasDatabase()) {
      await interaction.reply({
        embeds: [errorEmbed('Base non configurée', 'Configure Supabase (DATABASE_URL).')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.showModal(buildModal(null));
  },
};

/** Soumission du modal de création */
export const absenceCreate: ComponentHandler<ModalSubmitInteraction> = {
  prefix: 'absence:create',
  async execute(interaction) {
    if (!(await needDb(interaction))) return;
    const { pseudo, start, end, reason } = parseModalDates(interaction);
    if (!start || !end) {
      await interaction.reply({
        embeds: [errorEmbed('Date invalide', 'Format attendu : `JJ/MM/AAAA`.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rows = await db()<{ id: string }[]>`
      insert into absences (discord_id, discord_tag, reason, start_date, end_date, status)
      values (${interaction.user.id}, ${pseudo}, ${reason},
              ${toIsoDate(start)}, ${toIsoDate(end)}, 'active')
      returning id
    `;
    const id = rows[0]!.id;

    // marque le staff "en absence" (si présent dans la liste)
    await db()`update staff set is_absent = true where discord_id = ${interaction.user.id}`;
    await publishEffectif(interaction.client).catch(() => {});

    const absence = (await getAbsence(id))!;
    const channel = (await interaction.client.channels.fetch(CHANNELS.absences)) as TextChannel;
    const msg = await channel.send({
      embeds: [buildAbsenceEmbed(absence)],
      components: [buildAbsenceButtons(id)],
    });
    await db()`update absences set message_id = ${msg.id} where id = ${id}`;

    await interaction.reply({
      embeds: [successEmbed('Absence posée', 'Ton absence a été enregistrée.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Bouton Archiver */
export const absenceArchive: ComponentHandler<ButtonInteraction> = {
  prefix: 'absence:archive',
  async execute(interaction) {
    if (!(await needDb(interaction))) return;
    const id = interaction.customId.split(':')[2]!;
    const absence = await getAbsence(id);
    if (!absence) {
      await interaction.reply({
        embeds: [errorEmbed('Introuvable', 'Cette absence n\'existe plus.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!canManage(interaction.member as GuildMember | null, absence)) {
      await interaction.reply({
        embeds: [errorEmbed('Accès refusé', 'Tu ne peux pas archiver cette absence.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    absence.status = 'finished';
    // poste dans le salon archives
    const archiveChannel = (await interaction.client.channels.fetch(
      CHANNELS.archivesAbsence,
    )) as TextChannel;
    const archiveMsg = await archiveChannel.send({
      embeds: [buildAbsenceEmbed(absence, true)],
    });

    await db()`
      update absences
      set status = 'finished', finished_at = now(), archive_message_id = ${archiveMsg.id}
      where id = ${id}
    `;
    await db()`update staff set is_absent = false where discord_id = ${absence.discord_id}`;
    await publishEffectif(interaction.client).catch(() => {});

    // supprime le message original dans le salon absences
    await interaction.message.delete().catch(() => {});
    await interaction.reply({
      embeds: [successEmbed('Absence archivée', 'Déplacée dans les archives.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Bouton Supprimer */
export const absenceDelete: ComponentHandler<ButtonInteraction> = {
  prefix: 'absence:delete',
  async execute(interaction) {
    if (!(await needDb(interaction))) return;
    const id = interaction.customId.split(':')[2]!;
    const absence = await getAbsence(id);
    if (!absence) {
      await interaction.message.delete().catch(() => {});
      await interaction.reply({
        embeds: [errorEmbed('Introuvable', 'Déjà supprimée.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!canManage(interaction.member as GuildMember | null, absence)) {
      await interaction.reply({
        embeds: [errorEmbed('Accès refusé', 'Tu ne peux pas supprimer cette absence.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await db()`update staff set is_absent = false where discord_id = ${absence.discord_id}`;
    await publishEffectif(interaction.client).catch(() => {});
    await db()`delete from absences where id = ${id}`;
    await interaction.message.delete().catch(() => {});
    await interaction.reply({
      embeds: [successEmbed('Absence supprimée', 'L\'absence a été supprimée.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Bouton Modifier -> modal prérempli */
export const absenceEdit: ComponentHandler<ButtonInteraction> = {
  prefix: 'absence:edit',
  async execute(interaction) {
    if (!hasDatabase()) {
      await interaction.reply({
        embeds: [errorEmbed('Base non configurée', 'Configure Supabase (DATABASE_URL).')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const id = interaction.customId.split(':')[2]!;
    const absence = await getAbsence(id);
    if (!absence) {
      await interaction.reply({
        embeds: [errorEmbed('Introuvable', 'Cette absence n\'existe plus.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!canManage(interaction.member as GuildMember | null, absence)) {
      await interaction.reply({
        embeds: [errorEmbed('Accès refusé', 'Tu ne peux pas modifier cette absence.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.showModal(buildModal(id, absence));
  },
};

/** Soumission du modal de modification */
export const absenceEditSubmit: ComponentHandler<ModalSubmitInteraction> = {
  prefix: 'absence:editsubmit',
  async execute(interaction) {
    if (!(await needDb(interaction))) return;
    const id = interaction.customId.split(':')[2]!;
    const { pseudo, start, end, reason } = parseModalDates(interaction);
    if (!start || !end) {
      await interaction.reply({
        embeds: [errorEmbed('Date invalide', 'Format attendu : `JJ/MM/AAAA`.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await db()`
      update absences
      set discord_tag = ${pseudo}, start_date = ${toIsoDate(start)},
          end_date = ${toIsoDate(end)}, reason = ${reason}
      where id = ${id}
    `;
    const absence = await getAbsence(id);
    if (absence?.message_id) {
      const channel = (await interaction.client.channels.fetch(CHANNELS.absences)) as TextChannel;
      const msg = await channel.messages.fetch(absence.message_id).catch(() => null);
      await msg?.edit({
        embeds: [buildAbsenceEmbed(absence)],
        components: [buildAbsenceButtons(id)],
      });
    }

    await interaction.reply({
      embeds: [successEmbed('Absence modifiée', 'Les informations ont été mises à jour.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
