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

const END_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAADSUlEQVR4nO3dT0obYRiA8Uk6baD+idhQUYlLod7Ae/UQPYfQRc/QXTfSC1iwdFMbJZKKUSukptobfO/i5WNKn+e3HZOZhIcP3pk40/v08d1TU7B/eNBkvOhvNf+yx+fnqdf3H3aq7n+5eFbcfnp8Utx+cTErbu8Xt+q/ZwBwBgBnAHAGAGcAcAYA1/v2433xPMDKxlrxDdrBn9QcmxXtPzKf3jeZz9+1X9e3xe3zy3lxuysAnAHAGQCcAcAZAJwBwBkAXDvceln8g+Wi2zk6O+dH5yFWKs/52fMk0ZwfHb/nAVRkAHAGAGcAcAYAZwBwBgDXZufQxc1106VoDo6OPxKdJ6l9nqD253MFgDMAOAOAMwA4A4AzADgDgGuzc+Tm3rjT6/nZ41+JrqdPc9fja/8eIHL386a43RUAzgDgDADOAOAMAM4A4AwAro3+IHu9P/u7++wcHB3/Itg+WN+oenxdcwWAMwA4A4AzADgDgDMAOAOAaydfzop/MNpdqzpnd20QzPmRrj/fbFI+D+HzAlRkAHAGAGcAcAYAZwBwBgDXRnNiZPXVeup36VnZ48/a3h51+v1lP78rAJwBwBkAnAHAGQCcAcAZAFzv6v7zU+b59pH+w05T0+/HaXH76fFJao7eDub8/cOD1P0Ban8/EVcAOAOAMwA4A4AzADgDgDMAuDaao5vgPnbhDgbnqfvkZe2+GXf6+mX4+YLvvzJXADgDgDMAOAOAMwA4A4AzALjwPoFZ2fvhZ5/bl71P4TDY/3LRVFX7eQuuAHAGAGcAcAYAZwBwBgBnAHDheYBoTs8+Ny+es+s+V281+P/82vvPnufIHp8rAJwBwBkAnAHAGQCcAcAZAFybvR4fXQ+fT++r3m8/ut9//P69qnN+dJ7k8mv5eQ2be+Oqx+cKAGcAcAYAZwBwBgBnAHAGANdGc/I8uYPo/aM5Pvu7/mj/d8H9+Ievh6n9X30/S33+aM7PnkdxBYAzADgDgDMAOAOAMwA4A4Brozk0kp1Do9dn3382ua363L3Rbt3zFLW5AsAZAJwBwBkAnAHAGQCcAcD1Phy9fco8Ny/7//eR6Hp9JDvnZ2W/v9rH7woAZwBwBgBnAHAGAGcAcAYA9xcGkQYkB0ry1wAAAABJRU5ErkJggg==';    // icône verte (End)
const NETHER_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAEKUlEQVR4nO2dz0obURTGZ2RMrIkmoiGBIFSF4spNFtkVkrUirgoulC668RHcd+e7uHFZkBYKzcIXKE0rSIJBYyaamMY/pG9wvsVhSOH7fttvJpOEHxfOnXvPDfcKhUlgkMpmrTh4GgzMfJJKmXlhYcHMbx4ezHy9WAw8zNTrZj4Avy8L/h9EJpMJpsnMVJ8upo4EIEcCkCMByJEA5EgAciQAOeGHtTVzHmAxnXY94H48NvPx05OZ95+fzTw3O2vm2Vot8LCxseG6v9PpuO5H8xDo+w2HQzPXCECOBCBHApAjAciRAORIAHIkADlReWnJvODh8dHMF+bnXV/gHl0A5gFCMI8wOD8383a5HHgolUpmXgTrFU5PT818bm7ONQ+A1htoBCBHApAjAciRAORIAHIkADkSgJzwc71urgfoxnGi8wTofrQvIA32HXjnORrg80ejkZnv7+8HHtD7fC8aAciRAORIAHIkADkSgBwJQI4EICdCdf5yPu96gLfOR/0D0DzDl5cXMx+9vpp5AOr8arU61Tre219AIwA5EoAcCUCOBCBHApAjAciRAOREf66uEq3zUX8AtK4f1flonuLjzk7godVque6/vr523e/tQ1gG+x40ApAjAciRAORIAHIkADkSgBwJQE6ELvCu+0fv+/thGHi4bLfNPAfq+Izzffr3H9/MfHj/137+Itj///adq/9ADNZ7aAQgRwKQIwHIkQDkSAByJAA5EoCcaG111byg1euZ+W2366rzUb9/7zxE/+zMzJvg+28dHbnq9OblTzPP5964+gDmnfs2NAKQIwHIkQDkSAByJAA5EoAcCUBO+GlzczLN/fve/gEItO9gC9T5aH8/Wk8w7f4AOjdQmEgAciQAORKAHAlAjgQgRwKQEyVd53v7DCJ+3d2ZeeXw0FUnl53nCnppNpuu+9F6Ao0A5EgAciQAORKAHAlAjgQgRwKQE6Fz97zv8/93MuB9urdPoLePYKPRMPOV4pKrz6BGAHIkADkSgBwJQI4EIEcCkCMByIkW02nzgt+djusBSe8LyE8mia6bz4D7ve/rS6WSme/u7gZJohGAHAlAjgQgRwKQIwHIkQDkSABywr1CwSykV5aXp1rnr4N++OjzUR/D98fHZn5xcWHm3Z597mLcH5n5bafnmgcYDAaBB40A5EgAciQAORKAHAlAjgQgRwKQE6XAunFvnY/uT7q/AJoH+HpyYubZWs3Muzd2nd8D5y1Uq9XAA1r3j9YzaAQgRwKQIwHIkQDkSAByJAA5EoCcaAz66XvrfASq8y/bbdd6gjSokzcPDoIkQX36vOjcQOFCApAjAciRAORIAHIkADkSgJwIXeA9tw/NE3Tj2PV8dJ5Bbns7SLLOrlQqZh6D34dI+txBjQDkSAByJAA5EoAcCUCOBCBHApDzD47uIPupQe40AAAAAElFTkSuQmCC'; // icône rouge (Mine/Nether)

/** Petit embed d'annonce de reset (violet, large, icône par type en haut-gauche, date/heure). */
export function resetEmbed(title: string, body: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(VIOLET)
    .setAuthor({ name: 'EmeriaMC', iconURL: 'https://cdn.discordapp.com/emojis/1541095551511298139.png' }) // logo
    .setThumbnail('attachment://icon.png') // icône du type dans le coin (carré, haut-droite)
    .setDescription(
      `# ${title}\n` +
        `-# ➜ <@&${RESET_ROLE}>\n\n` +
        `${body}\n` +
        `N'hésitez pas à y faire un tour !\n` +
        `Bon jeu !\n\n` +
        `> ${EMERIA}  **L'équipe d'EmeriaMC.**`,
    )
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
  const files = [new AttachmentBuilder(Buffer.from(icon, 'base64'), { name: 'icon.png' })];
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
