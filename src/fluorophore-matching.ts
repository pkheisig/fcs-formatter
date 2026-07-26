export function normalizeFluorophoreToken(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("fluor", "")
    .replace(/[^a-z0-9]/g, "");
}

export function findCanonicalFluorophore(
  tokens: string[],
  candidates: string[],
): string | null {
  const normalizedTokens = new Set(
    tokens
      .map(normalizeFluorophoreToken)
      .filter((token) => token.length > 0),
  );

  return (
    candidates.find((candidate) =>
      normalizedTokens.has(normalizeFluorophoreToken(candidate))
    ) ?? null
  );
}
