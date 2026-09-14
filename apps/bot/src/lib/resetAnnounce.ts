import {
  EmbedBuilder, AttachmentBuilder, type Client, type TextChannel,
} from 'discord.js';
import { db, hasDatabase } from '@xo/db';

/** Salon Statut (les resets s'affichent SOUS le statut serveur, en plus petit). */
export const STATUT_CHANNEL = '1535349226626613268';
/** Rôle "Reset Monde" (statut) — pingé à chaque annonce. */
export const RESET_ROLE = '1549077052089442365';
/** Emoji EmeriaMC. */
const EMERIA = '<:EmeriaMC:1541095551511298139>';
/** Violet EmeriaMC. */
const VIOLET = 0x8b6cff;

const BANNER = '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';
const END_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADSUlEQVR4nO3dT0obYRiA8Uk6baD+idhQUYlLod7Ae/UQPYfQRc/QXTfSC1iwdFMbJZKKUSukptobfO/i5WNKn+e3HZOZhIcP3pk40/v08d1TU7B/eNBkvOhvNf+yx+fnqdf3H3aq7n+5eFbcfnp8Utx+cTErbu8Xt+q/ZwBwBgBnAHAGAGcAcAYA1/v2433xPMDKxlrxDdrBn9QcmxXtPzKf3jeZz9+1X9e3xe3zy3lxuysAnAHAGQCcAcAZAJwBwBkAXDvceln8g+Wi2zk6O+dH5yFWKs/52fMk0ZwfHb/nAVRkAHAGAGcAcAYAZwBwBgDXZufQxc1106VoDo6OPxKdJ6l9nqD253MFgDMAOAOAMwA4A4AzADgDgGuzc+Tm3rjT6/nZ41+JrqdPc9fja/8eIHL386a43RUAzgDgDADOAOAMAM4A4AwAro3+IHu9P/u7++wcHB3/Itg+WN+oenxdcwWAMwA4A4AzADgDgDMAOAOAaydfzop/MNpdqzpnd20QzPmRrj/fbFI+D+HzAlRkAHAGAGcAcAYAZwBwBgDXRnNiZPXVeup36VnZ48/a3h51+v1lP78rAJwBwBkAnAHAGQCcAcAZAFzv6v7zU+b59pH+w05T0+/HaXH76fFJao7eDub8/cOD1P0Ban8/EVcAOAOAMwA4A4AzADgDgDMAuDaao5vgPnbhDgbnqfvkZe2+GXf6+mX4+YLvvzJXADgDgDMAOAOAMwA4A4AzALjwPoFZ2fvhZ5/bl71P4TDY/3LRVFX7eQuuAHAGAGcAcAYAZwBwBgBnAHDheYBoTs8+Ny+es+s+V281+P/82vvPnufIHp8rAJwBwBkAnAHAGQCcAcAZAFybvR4fXQ+fT++r3m8/ut9//P69qnN+dJ7k8mv5eQ2be+Oqx+cKAGcAcAYAZwBwBgBnAHAGANdGc/I8uYPo/aM5Pvu7/mj/d8H9+Ievh6n9X30/S33+aM7PnkdxBYAzADgDgDMAOAOAMwA4A4Brozk0kp1Do9dn3382ua363L3Rbt3zFLW5AsAZAJwBwBkAnAHAGQCcAcD1Phy9fco8Ny/7//eR6Hp9JDvnZ2W/v9rH7woAZwBwBgBnAHAGAGcAcAYA9xcGkQYkB0ry1wAAAABJRU5ErkJggg==';    // icône verte (End)
const NETHER_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAEKUlEQVR4nO2dz0obURTGZ2RMrIkmoiGBIFSF4spNFtkVkrUirgoulC668RHcd+e7uHFZkBYKzcIXKE0rSIJBYyaamMY/pG9wvsVhSOH7fttvJpOEHxfOnXvPDfcKhUlgkMpmrTh4GgzMfJJKmXlhYcHMbx4ezHy9WAw8zNTrZj4Avy8L/h9EJpMJpsnMVJ8upo4EIEcCkCMByJEA5EgAciQAOeGHtTVzHmAxnXY94H48NvPx05OZ95+fzTw3O2vm2Vot8LCxseG6v9PpuO5H8xDo+w2HQzPXCECOBCBHApAjAciRAORIAHIkADlReWnJvODh8dHMF+bnXV/gHl0A5gFCMI8wOD8383a5HHgolUpmXgTrFU5PT818bm7ONQ+A1htoBCBHApAjAciRAORIAHIkADkSgJzwc71urgfoxnGi8wTofrQvIA32HXjnORrg80ejkZnv7+8HHtD7fC8aAciRAORIAHIkADkSgBwJQI4EICdCdf5yPu96gLfOR/0D0DzDl5cXMx+9vpp5AOr8arU61Tre219AIwA5EoAcCUCOBCBHApAjAciRAOREf66uEq3zUX8AtK4f1flonuLjzk7godVque6/vr523e/tQ1gG+x40ApAjAciRAORIAHIkADkSgBwJQE6ELvCu+0fv+/thGHi4bLfNPAfq+Izzffr3H9/MfHj/137+Itj///adq/9ADNZ7aAQgRwKQIwHIkQDkSAByJAA5EoCcaG111byg1euZ+W2366rzUb9/7zxE/+zMzJvg+28dHbnq9OblTzPP5964+gDmnfs2NAKQIwHIkQDkSAByJAA5EoAcCUBO+GlzczLN/fve/gEItO9gC9T5aH8/Wk8w7f4AOjdQmEgAciQAORKAHAlAjgQgRwKQEyVd53v7DCJ+3d2ZeeXw0FUnl53nCnppNpuu+9F6Ao0A5EgAciQAORKAHAlAjgQgRwKQE6Fz97zv8/93MuB9urdPoLePYKPRMPOV4pKrz6BGAHIkADkSgBwJQI4EIEcCkCMByIkW02nzgt+djusBSe8LyE8mia6bz4D7ve/rS6WSme/u7gZJohGAHAlAjgQgRwKQIwHIkQDkSABywr1CwSykV5aXp1rnr4N++OjzUR/D98fHZn5xcWHm3Z597mLcH5n5bafnmgcYDAaBB40A5EgAciQAORKAHAlAjgQgRwKQE6XAunFvnY/uT7q/AJoH+HpyYubZWs3Muzd2nd8D5y1Uq9XAA1r3j9YzaAQgRwKQIwHIkQDkSAByJAA5EoCcaAz66XvrfASq8y/bbdd6gjSokzcPDoIkQX36vOjcQOFCApAjAciRAORIAHIkADkSgJwIXeA9tw/NE3Tj2PV8dJ5Bbns7SLLOrlQqZh6D34dI+txBjQDkSAByJAA5EoAcCUCOBCBHApDzD47uIPupQe40AAAAAElFTkSuQmCC'; // icône rouge (Mine/Nether)

/** Petit embed d'annonce de reset (violet, large, icône par type en haut-gauche, date/heure). */
export function resetEmbed(title: string, body: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(VIOLET)
    .setAuthor({ name: 'EmeriaMC', iconURL: 'attachment://icon.png' })
    .setDescription(
      `# ${title}\n` +
        `-# ➜ <@&${RESET_ROLE}>\n\n` +
        `${body}\n` +
        `N'hésitez pas à y faire un tour !\n` +
        `Bon jeu !\n\n` +
        `> ${EMERIA}  **L'équipe d'EmeriaMC.**`,
    )
    .setImage('attachment://wide.png')
    .setTimestamp(new Date());
}

/**
 * Poste l'annonce dans le salon Statut, en SINGLETON PAR TYPE :
 * un nouveau reset du même type supprime l'ancien. Icône verte (end) / rouge (monde).
 */
export async function postReset(client: Client, embed: EmbedBuilder, type: 'end' | 'monde'): Promise<void> {
  const ch = await client.channels.fetch(STATUT_CHANNEL).catch(() => null);
  if (!ch?.isTextBased()) return;
  const chan = ch as TextChannel;
  const key = `reset_${type}`;

  if (hasDatabase()) {
    const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${key}`;
    if (rows.length) await chan.messages.delete(rows[0]!.value).catch(() => {});
  }

  const icon = type === 'end' ? END_ICON : NETHER_ICON;
  const files = [
    new AttachmentBuilder(Buffer.from(BANNER, 'base64'), { name: 'wide.png' }),
    new AttachmentBuilder(Buffer.from(icon, 'base64'), { name: 'icon.png' }),
  ];
  const msg = await chan.send({
    content: `<@&${RESET_ROLE}>`,
    embeds: [embed],
    files,
    allowedMentions: { roles: [RESET_ROLE] },
  });

  if (hasDatabase()) {
    await db()`insert into bot_state (key, value) values (${key}, ${msg.id})
               on conflict (key) do update set value = excluded.value`;
  }
}
