export function getSpotterToken() {
  const token = process.env.EXACT_SPOTTER_TOKEN;
  if (!token) throw new Error("EXACT_SPOTTER_TOKEN missing");
  return token;
}