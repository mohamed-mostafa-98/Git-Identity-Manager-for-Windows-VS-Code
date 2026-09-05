"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidToken = void 0;
/** Accept opaque GitHub tokens while blocking whitespace/control injection and unreasonable values. */
const isValidToken = (value) => typeof value === 'string' && value.length >= 1 && value.length <= 1024 && /^[\x21-\x7E]+$/.test(value);
exports.isValidToken = isValidToken;
//# sourceMappingURL=token.js.map