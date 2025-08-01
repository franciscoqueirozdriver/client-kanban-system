export default function generateMessageId() {
  // Gera identificador único no formato "timestamp-random"
  const random = Math.random().toString(36).slice(2, 7);
  return `${Date.now()}-${random}`;
}
