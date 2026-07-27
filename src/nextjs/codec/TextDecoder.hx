package nextjs.codec;

/** Decoder for a text value that has already crossed its host boundary. */
typedef TextDecoder<T> = (value:String, path:String) -> DecodeResult<T>;
