/** Accept opaque GitHub tokens while blocking whitespace/control injection and unreasonable values. */
export const isValidToken = (value: unknown): value is string =>
    typeof value === 'string' && value.length >= 1 && value.length <= 1024 && /^[\x21-\x7E]+$/.test(value);
