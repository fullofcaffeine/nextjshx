export interface FixtureRecord {
  readonly marker: typeof fixtureMarker;
  readonly label: string;
}

export declare const fixtureMarker: "packed-local-artifact";
export declare function describeFixture(label: string): string;
