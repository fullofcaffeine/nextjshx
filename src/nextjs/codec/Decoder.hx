package nextjs.codec;

import genes.ts.Unknown;

/** Decoder for one untrusted JavaScript boundary value. */
typedef Decoder<T> = (value:Unknown, path:String) -> DecodeResult<T>;
