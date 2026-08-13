"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushGuardMode = exports.AuthenticationMethod = void 0;
/**
 * Authentication strategy supported per profile.
 */
var AuthenticationMethod;
(function (AuthenticationMethod) {
    AuthenticationMethod["BROWSER_OAUTH"] = "BROWSER_OAUTH";
    AuthenticationMethod["HTTPS"] = "HTTPS";
    AuthenticationMethod["SSH"] = "SSH";
    AuthenticationMethod["GITHUB_CLI"] = "GITHUB_CLI";
})(AuthenticationMethod = exports.AuthenticationMethod || (exports.AuthenticationMethod = {}));
/**
 * Account Push Guard warning mode.
 */
var PushGuardMode;
(function (PushGuardMode) {
    PushGuardMode["Warn"] = "Warn";
    PushGuardMode["Strict"] = "Strict";
    PushGuardMode["Disabled"] = "Disabled";
})(PushGuardMode = exports.PushGuardMode || (exports.PushGuardMode = {}));
//# sourceMappingURL=AccountProfile.js.map