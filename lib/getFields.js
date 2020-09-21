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
const parser = new argparse_1.ArgumentParser({
    description: "Get some details about the firestore",
    add_help: true
});
parser.add_argument("-e", "--env", { help: "Environment to use" });
const args = parser.parse_args();
if (!args.env) {
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
Promise.resolve().then(() => __importStar(require(`./firebaseAdminServiceAccounts/${envFile}.json`))).then(serviceAccount => {
    const serviceDeets = {
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
        projectId: serviceAccount.project_id
    };
    admin.initializeApp({
        credential: admin.credential.cert(serviceDeets)
    });
    const getRecords = async (collection) => {
        const collectionRef = admin
            .firestore()
            .collection(collection);
        const records = [];
        const collectionDocs = await collectionRef.get();
        if (!collectionDocs.empty) {
            collectionDocs.forEach((document) => {
                records.push(document.data());
            });
        }
        return records;
    };
    const getFields = (records) => {
        const fields = {};
        records.forEach(record => {
            Object.keys(record).forEach(recordKey => {
                if (Object.prototype.toString.call(record[recordKey]) ===
                    "[object Object]") {
                    Object.keys(record[recordKey]).forEach(recordSubKey => {
                        const id = `${recordKey}.${recordSubKey}`;
                        if (!fields[id]) {
                            fields[id] = 0;
                        }
                        fields[id] += 1;
                    });
                }
                else {
                    if (!fields[recordKey]) {
                        fields[recordKey] = 0;
                    }
                    fields[recordKey] += 1;
                }
            });
        });
        return fields;
    };
    const csv = [[`"Field Path"`, `"Usage Count"`].join(",")];
    const order = ["users", "admins"];
    const getData = [getRecords(order[0]), getRecords(order[1])];
    Promise.all(getData).then(data => {
        data.forEach((datum, index) => {
            const name = order[index];
            const fields = getFields(datum);
            Object.keys(fields).forEach(field => {
                csv.push([`"${name}.${field}"`, `"${fields[field]}"`].join(","));
            });
        });
        console.log(csv.join("\n"));
    });
})
    .catch(() => {
    console.error(`Couldn't find file ${envFile}.json`);
    process.exit(1);
});
//# sourceMappingURL=getFields.js.map