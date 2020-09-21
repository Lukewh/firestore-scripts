#!/usr/bin/env node

import * as admin from "firebase-admin";
import { ArgumentParser } from "argparse";
import { writeFileSync } from "fs";

const parser = new ArgumentParser({
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
  .then(async serviceAccount => {
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
      .map((collection: string) => collection.trim());

    const result = await Promise.all(
      collections.map((collectionName: string) =>
        admin
          .firestore()
          .collection(collectionName)
          .get()
      )
    );

    result.forEach((collection: any, index: number) => {
      const collectionName = collections[index];

      if (collection.empty) {
        console.error(`${args.collection} doesn't exist or is empty`);
        process.exit(1);
      }

      const data: any = {};
      collection.forEach((doc: any) => {
        if (data[doc.id]) {
          throw new Error(`${doc.id} exists already`);
        }
        data[doc.id] = { ...doc.data(), sourceCollection: collectionName };
      });

      if (args.output) {
        let fileName = `${args.output.split(".json").join("")}.json`;
        writeFileSync(fileName, JSON.stringify(data));
      } else {
        console.log(data);
      }
    });
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
