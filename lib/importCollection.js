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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const argparse_1 = require("argparse");
const fs_1 = require("fs");
const parser = new argparse_1.ArgumentParser({
    description: 'Import a collection from a json file',
    add_help: true,
});
parser.add_argument('-e', '--env', { help: 'Environment to use' });
parser.add_argument('-c', '--collection', {
    help: 'Collection to import to',
});
parser.add_argument('-i', '--input', { help: 'Input JSON file' });
const args = parser.parse_args();
if (!args.env || !args.collection || !args.input) {
    parser.print_help();
    process.exit(1);
}
let envFile;
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
Promise.resolve().then(() => __importStar(require(`../firebaseAdminServiceAccounts/${envFile}.json`))).then(async (serviceAccount) => {
    const serviceDeets = {
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
        projectId: serviceAccount.project_id,
    };
    console.log(serviceDeets.projectId);
    admin.initializeApp({
        credential: admin.credential.cert(serviceDeets),
    });
    const data = JSON.parse(fs_1.readFileSync(args.input, 'utf-8'));
    const subCollections = {};
    Object.keys(data).forEach((key) => {
        if (data[key]._subCollections) {
            subCollections[key] = JSON.parse(JSON.stringify(data[key]._subCollections));
            delete data[key]._subCollections;
        }
    });
    await Promise.all(Object.keys(data).map((personKey) => {
        return admin
            .firestore()
            .collection(args.collection)
            .doc(personKey)
            .set(data[personKey]);
    }));
    const addSubCollections = Object.keys(subCollections)
        .map((docKey) => {
        return Object.keys(subCollections[docKey])
            .map((collectionId) => {
            return subCollections[docKey][collectionId]
                .map(([docId, docData]) => {
                return admin
                    .firestore()
                    .collection(args.collection)
                    .doc(docKey)
                    .collection(collectionId)
                    .doc(docId)
                    .set(docData);
            })
                .flat();
        })
            .flat();
    })
        .flat();
    await Promise.all(addSubCollections);
})
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=importCollection.js.map