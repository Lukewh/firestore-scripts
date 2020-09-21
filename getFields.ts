#!/usr/bin/env node

import * as admin from "firebase-admin";
import { ArgumentParser } from "argparse";

const parser = new ArgumentParser({
  description: "Get some details about the firestore",
  add_help: true
});

parser.add_argument("-e", "--env", { help: "Environment to use" });

const args = parser.parse_args();

if (!args.env) {
  parser.print_help();
  process.exit(1);
}

let envFile: string;

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

import(`./firebaseAdminServiceAccounts/${envFile}.json`)
  .then(serviceAccount => {
    const serviceDeets = {
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
      projectId: serviceAccount.project_id
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceDeets)
    });

    const getRecords = async (collection: string) => {
      const collectionRef: admin.firestore.CollectionReference = admin
        .firestore()
        .collection(collection);
      const records: any = [];

      const collectionDocs: admin.firestore.DocumentData = await collectionRef.get();

      if (!collectionDocs.empty) {
        collectionDocs.forEach((document: admin.firestore.DocumentData) => {
          records.push(document.data());
        });
      }

      return records;
    };

    const getFields = (records: any[]) => {
      const fields: any = {};

      records.forEach(record => {
        Object.keys(record).forEach(recordKey => {
          if (
            Object.prototype.toString.call(record[recordKey]) ===
            "[object Object]"
          ) {
            Object.keys(record[recordKey]).forEach(recordSubKey => {
              const id = `${recordKey}.${recordSubKey}`;
              if (!fields[id]) {
                fields[id] = 0;
              }

              fields[id] += 1;
            });
          } else {
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
      data.forEach((datum, index: number) => {
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
