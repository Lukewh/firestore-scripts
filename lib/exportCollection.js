#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const argparse_1 = require("argparse");
const fs_1 = require("fs");
const parser = new argparse_1.ArgumentParser({
    description: "Export a collection to a json file",
    add_help: true
});
parser.add_argument("-e", "--env", { help: "Environment to use" });
parser.add_argument("-c", "--collection", {
    help: "Collection(s) to export. Comma separated"
});
parser.add_argument("-o", "--output", { help: "Output filename" });
const args = parser.parse_args();
if (!args.env || !args.collection) {
    parser.print_help();
    process.exit(1);
}
let envFile;
switch (args.env) {
    case "prod":
    case "production":
        envFile = "production";
        break;
    case "stage":
    case "staging":
        envFile = "staging";
        break;
    default:
        envFile = "development";
}
Promise.resolve().then(() => __importStar(require(`./firebaseAdminServiceAccounts/${envFile}.json`))).then(async (serviceAccount) => {
    const serviceDeets = {
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
        projectId: serviceAccount.project_id
    };
    admin.initializeApp({
        credential: admin.credential.cert(serviceDeets)
    });
    const collections = args.collection
        .split(",")
        .map((collection) => collection.trim());
    const result = await Promise.all(collections.map((collectionName) => admin
        .firestore()
        .collection(collectionName)
        .get()));
    result.forEach((collection, index) => {
        const collectionName = collections[index];
        if (collection.empty) {
            console.error(`${args.collection} doesn't exist or is empty`);
            process.exit(1);
        }
        const data = {};
        collection.forEach((doc) => {
            if (data[doc.id]) {
                throw new Error(`${doc.id} exists already`);
            }
            data[doc.id] = Object.assign(Object.assign({}, doc.data()), { sourceCollection: collectionName });
        });
        if (args.output) {
            let fileName = `${args.output.split(".json").join("")}.json`;
            fs_1.writeFileSync(fileName, JSON.stringify(data));
        }
        else {
            console.log(data);
        }
    });
})
    .catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=exportCollection.js.map