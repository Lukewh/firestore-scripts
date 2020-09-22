#!/usr/bin/env node

import * as admin from 'firebase-admin';
import { ArgumentParser } from 'argparse';
import { readFileSync } from 'fs';

const parser = new ArgumentParser({
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

import(`./firebaseAdminServiceAccounts/${envFile}.json`)
  .then(async serviceAccount => {
    const serviceDeets = {
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
      projectId: serviceAccount.project_id,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceDeets),
    });

    const data = JSON.parse(readFileSync(args.input, 'utf-8'));

    const subCollections: any = {};

    Object.keys(data).forEach((key: string) => {
      if (data[key]._subCollections) {
        subCollections[key] = JSON.parse(
          JSON.stringify(data[key]._subCollections),
        );
        delete data[key]._subCollections;
      }
    });

    await Promise.all(
      Object.keys(data).map((personKey: string) => {
        return admin
          .firestore()
          .collection(args.collection)
          .doc(personKey)
          .set(data[personKey]);
      }),
    );

    const addSubCollections: any = Object.keys(subCollections)
      .map((docKey: string) => {
        return Object.keys(subCollections[docKey])
          .map((collectionId: string) => {
            return subCollections[docKey][collectionId]
              .map(([docId, docData]: any) => {
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
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
