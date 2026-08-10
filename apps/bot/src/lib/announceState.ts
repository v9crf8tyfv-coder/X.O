// Mode annonce : userId -> channelId où ses messages sont repostés par le bot.
// En mémoire (se réinitialise si le bot redémarre — normal pour un mode temporaire).
const announcers = new Map<string, string>();

export function startAnnounce(userId: string, channelId: string): void {
  announcers.set(userId, channelId);
}
export function stopAnnounce(userId: string): boolean {
  return announcers.delete(userId);
}
export function getAnnounceChannel(userId: string): string | undefined {
  return announcers.get(userId);
}
