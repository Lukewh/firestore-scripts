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
    description: 'Import a collection from a json file',
    add_help: true,
});
parser.add_argument('-e', '--env', { help: 'Environment to use' });
const args = parser.parse_args();
if (!args.env) {
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
    admin.initializeApp({
        credential: admin.credential.cert(serviceDeets),
    });
    const result = await admin.firestore().collection('people').get();
    if (!result.empty) {
        const people = result.docs.reduce((acc, resultDoc) => {
            if (!acc[resultDoc.id]) {
                acc[resultDoc.id] = resultDoc.data();
            }
            return acc;
        }, {});
        const peopleWithPerms = {};
        Object.keys(people).forEach((uid) => {
            if (people[uid].permissions && !people[uid].permissions.global) {
                peopleWithPerms[uid] = Object.assign({}, people[uid]);
            }
        });
        Object.keys(peopleWithPerms).forEach((uid) => {
            const person = peopleWithPerms[uid];
            person.permissions = Object.keys(person.permissions).reduce((acc, companyId) => {
                acc[companyId] = Object.keys(person.permissions[companyId]).reduce((acc, source) => {
                    acc[source] = person.permissions[companyId][source];
                    if (typeof acc[source] === 'string') {
                        return acc;
                    }
                    if (!acc[source].type) {
                        if (acc[source].filters) {
                            acc[source].type = 'custom';
                        }
                        else {
                            acc[source].type = 'all';
                        }
                    }
                    if (acc[source].filters && Array.isArray(acc[source].filters)) {
                        const newFilters = {};
                        // When this was written only instabase was using filters - and this logic works
                        // When permissions are used more in the future this will no longer work
                        acc[source].filters.forEach((filter) => {
                            const key = filter.key;
                            if (filter.values) {
                                filter.values.forEach((value, index) => {
                                    newFilters[`pkey${index}`] = [{ key, value }];
                                });
                            }
                        });
                        acc[source].filters = newFilters;
                    }
                    return acc;
                }, {});
                return acc;
            }, {});
        });
        // console.log(JSON.stringify(peopleWithPerms, null, 2));
        const updatePeople = await Promise.all(Object.keys(peopleWithPerms).map((uid) => {
            console.log(uid, peopleWithPerms[uid].permissions);
            return admin
                .firestore()
                .collection('people')
                .doc(uid)
                .set({ permissions: peopleWithPerms[uid].permissions }, { merge: true });
        }));
        console.log(updatePeople);
    }
});
//# sourceMappingURL=permissionsMigration.js.map