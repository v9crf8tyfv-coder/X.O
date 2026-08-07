import { EmbedBuilder } from 'discord.js';
import { BRAND_COLOR } from '@xo/shared';

/** Embed générique aux couleurs du bot */
export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder().setColor(BRAND_COLOR).setTimestamp();
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`✅ ${title}`)
    .setDescription(description ?? null)
    .setTimestamp();
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`❌ ${title}`)
    .setDescription(description ?? null)
    .setTimestamp();
}
