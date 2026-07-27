export type UnsupportedMapped<T> = {
  [Key in keyof T]: T[Key];
};
