import {
  describeFixture,
  fixtureMarker,
  type FixtureRecord,
} from "@nextjshx/package-shape-fixture";

const record: FixtureRecord = {
  marker: fixtureMarker,
  label: describeFixture("consumer"),
};

console.log(JSON.stringify(record));
