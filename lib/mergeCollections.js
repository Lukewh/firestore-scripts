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
    description: 'Merge collections to a json file',
    add_help: true,
});
parser.add_argument('-e', '--env', { help: 'Environment to use' });
parser.add_argument('-c', '--collections', {
    help: 'Collections to merge. Comma separated',
});
parser.add_argument('-o', '--output', { help: 'Output filename' });
const args = parser.parse_args();
if (!args.env || !args.collections) {
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
console.log(`Using ${envFile}.json`);
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
    const getCollectionDocs = (collection) => {
        if (!collection.empty) {
            return collection.docs.map((doc) => [doc.id, doc.data()]);
        }
        return null;
    };
    const fetchCollection = async (collectionName) => {
        return await admin.firestore().collection(collectionName).get();
    };
    const getSubCollections = async (collectionName, docId) => {
        const subCollectionNames = await admin
            .firestore()
            .doc(`${collectionName}/${docId}`)
            .listCollections();
        const subCollections = [];
        const foundCollections = [];
        subCollectionNames.forEach((collection, index) => {
            foundCollections.push(collection.id);
            subCollections.push(admin
                .firestore()
                .collection(collectionName)
                .doc(docId)
                .collection(collection.id)
                .get());
        });
        if (foundCollections.length > 0) {
            const result = await Promise.all(subCollections);
            const output = {};
            result.forEach((collection, index) => {
                const collectionData = getCollectionDocs(collection);
                output[foundCollections[index]] = collectionData;
            });
            return output;
        }
        return null;
    };
    const collections = args.collections
        .split(',')
        .map((collection) => collection.trim());
    let result = await Promise.all(collections.map((collectionName) => fetchCollection(collectionName)));
    result = result.reduce((resultAcc, collection, index) => {
        const colId = collections[index];
        if (resultAcc[colId]) {
            throw new Error(`${colId} already exists`);
        }
        resultAcc[colId] = getCollectionDocs(collection).reduce((acc, [id, doc]) => {
            if (acc[id]) {
                throw new Error(`${id} already exists`);
            }
            acc[id] = Object.assign(Object.assign({}, doc), { _sourceCollection: colId });
            return acc;
        }, {});
        return resultAcc;
    }, {});
    const combos = [];
    const fetchSubCollections = Object.keys(result).map((colId) => Object.keys(result[colId]).map((docId) => {
        combos.push([colId, docId]);
        return getSubCollections(colId, docId);
    }));
    const subCollections = await Promise.all(fetchSubCollections.flat());
    combos.forEach(([colId, docId], index) => {
        if (subCollections[index]) {
            result[colId][docId]._subCollections = subCollections[index];
        }
    });
    const output = Object.keys(result).reduce((acc, key) => {
        Object.keys(result[key]).forEach((docKey) => {
            if (acc[docKey]) {
                if (acc[docKey].email !== result[key][docKey].email) {
                    console.log(acc[docKey], result[key][docKey]);
                    throw new Error("Cannot merge users, ID's match, but emails don't");
                    process.exit(1);
                }
                acc[docKey] = Object.assign(Object.assign({}, acc[docKey]), result[key][docKey]);
            }
            else {
                acc[docKey] = result[key][docKey];
            }
        });
        return acc;
    }, {});
    if (args.output) {
        let fileName = `${args.output.split('.json').join('')}.json`;
        fs_1.writeFileSync(fileName, JSON.stringify(output));
    }
    else {
        console.log(output);
    }
    process.exit(0);
})
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=mergeCollections.js.map