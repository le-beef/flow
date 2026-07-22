import { config } from "./config.js";
export type Outgoing = {
  number: string;
  text: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
};
export async function showTyping(number: string, delay: number) {
  const response = await fetch(
    `${config.EVOLUTION_API_URL}/chat/sendPresence/${config.EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number, presence: "composing", delay }),
    },
  );
  if (!response.ok)
    throw new Error(
      `Evolution presence ${response.status}: ${await response.text()}`,
    );
}
export async function sendWhatsApp(m: Outgoing) {
  const media = m.mediaUrl && m.mediaType;
  const path = media
    ? `/message/sendMedia/${config.EVOLUTION_INSTANCE}`
    : `/message/sendText/${config.EVOLUTION_INSTANCE}`;
  const body = media
    ? {
        number: m.number,
        mediatype: m.mediaType,
        media: m.mediaUrl,
        caption: m.text,
      }
    : { number: m.number, text: m.text };
  const response = await fetch(`${config.EVOLUTION_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.EVOLUTION_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      `Evolution API ${response.status}: ${await response.text()}`,
    );
  return response.json() as Promise<Record<string, unknown>>;
}
