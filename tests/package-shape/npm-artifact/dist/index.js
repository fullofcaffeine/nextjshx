export const fixtureMarker = "packed-local-artifact";

export function describeFixture(label) {
  return `${fixtureMarker}:${label}`;
}
