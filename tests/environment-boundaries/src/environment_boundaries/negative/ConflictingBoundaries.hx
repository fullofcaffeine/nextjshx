package environment_boundaries.negative;

/** First owner of this emitted ECMAScript module. */
@:next.serverOnly
class ConflictingBoundaries {}

/** A second boundary owner in the same Haxe module must fail closed. */
@:next.clientOnly
class ConflictingClient {}
