#!/usr/bin/env node

import * as admin from 'firebase-admin';
import { ArgumentParser } from 'argparse';
import { writeFileSync } from 'fs';

const parser = new ArgumentParser({
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

let envFile: string;

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

import(`../firebaseAdminServiceAccounts/${envFile}.json`)
  .then(async (serviceAccount) => {
    const serviceDeets = {
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
      projectId: serviceAccount.project_id,
    };

    console.log(serviceDeets.projectId);

    admin.initializeApp({
      credential: admin.credential.cert(serviceDeets),
    });

    const getCollectionDocs = (collection: any) => {
      if (!collection.empty) {
        return collection.docs.map((doc: any) => [doc.id, doc.data()]);
      }

      return null;
    };

    const fetchCollection = async (collectionName: string) => {
      return await admin.firestore().collection(collectionName).get();
    };

    const getSubCollections = async (collectionName: string, docId: string) => {
      const subCollectionNames: any = await admin
        .firestore()
        .doc(`${collectionName}/${docId}`)
        .listCollections();

      const subCollections: any[] = [];
      const foundCollections: string[] = [];
      subCollectionNames.forEach((collection: any, index: number) => {
        foundCollections.push(collection.id);
        subCollections.push(
          admin
            .firestore()
            .collection(collectionName)
            .doc(docId)
            .collection(collection.id)
            .get(),
        );
      });

      if (foundCollections.length > 0) {
        const result = await Promise.all(subCollections);

        const output: any = {};
        result.forEach((collection: any, index: number) => {
          const collectionData = getCollectionDocs(collection);
          output[foundCollections[index]] = collectionData;
        });

        return output;
      }

      return null;
    };

    const collections = args.collections
      .split(',')
      .map((collection: string) => collection.trim());

    let result: any = await Promise.all(
      collections.map((collectionName: string) =>
        fetchCollection(collectionName),
      ),
    );

    result = result.reduce((resultAcc: any, collection: any, index: number) => {
      const colId = collections[index];
      if (resultAcc[colId]) {
        throw new Error(`${colId} already exists`);
      }
      resultAcc[colId] = getCollectionDocs(collection).reduce(
        (acc: any, [id, doc]: any) => {
          if (acc[id]) {
            throw new Error(`${id} already exists`);
          }

          acc[id] = { ...doc, _sourceCollection: colId };

          return acc;
        },
        {},
      );
      return resultAcc;
    }, {});

    const combos: any = [];
    const fetchSubCollections: any = Object.keys(result).map((colId: string) =>
      Object.keys(result[colId]).map((docId: string) => {
        combos.push([colId, docId]);
        return getSubCollections(colId, docId);
      }),
    );

    const subCollections = await Promise.all(fetchSubCollections.flat());

    combos.forEach(([colId, docId]: any, index: number) => {
      if (subCollections[index]) {
        result[colId][docId]._subCollections = subCollections[index];
      }
    });

    const output: any = Object.keys(result).reduce((acc: any, key: string) => {
      Object.keys(result[key]).forEach((docKey: string) => {
        if (acc[docKey]) {
          if (acc[docKey].email !== result[key][docKey].email) {
            console.log(acc[docKey], result[key][docKey]);
            throw new Error("Cannot merge users, ID's match, but emails don't");
            process.exit(1);
          }
          acc[docKey] = { ...acc[docKey], ...result[key][docKey] };
        } else {
          acc[docKey] = result[key][docKey];
        }
      });

      return acc;
    }, {});

    if (args.output) {
      let fileName = `${args.output.split('.json').join('')}.json`;
      writeFileSync(fileName, JSON.stringify(output));
    } else {
      console.log(output);
    }

    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
