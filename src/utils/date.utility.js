export function getCurrentTimestamp() {
  return new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
}
