#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var admin = require("firebase-admin");
var argparse_1 = require("argparse");
var parser = new argparse_1.ArgumentParser({
    description: 'Import a collection from a json file',
    add_help: true,
});
parser.add_argument('-e', '--env', { help: 'Environment to use' });
var args = parser.parse_args();
if (!args.env) {
    parser.print_help();
    process.exit(1);
}
var envFile;
switch (args.env) {
    case 'prod':
    case 'production':
        envFile = 'production';
        break;
    case 'stage':
    case 'staging':
        envFile = 'staging';
        break;
    default:
        envFile = 'development';
}
Promise.resolve().then(function () { return require("../firebaseAdminServiceAccounts/" + envFile + ".json"); }).then(function (serviceAccount) { return __awaiter(void 0, void 0, void 0, function () {
    var serviceDeets, result, people;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                serviceDeets = {
                    clientEmail: serviceAccount.client_email,
                    privateKey: serviceAccount.private_key,
                    projectId: serviceAccount.project_id,
                };
                admin.initializeApp({
                    credential: admin.credential.cert(serviceDeets),
                });
                return [4 /*yield*/, admin.firestore().collection('people').get()];
            case 1:
                result = _a.sent();
                if (!result.empty) {
                    people = result.docs.map(function (resultDoc) { return resultDoc.data(); });
                    return [2 /*return*/, people];
                }
                return [2 /*return*/, []];
        }
    });
}); });
