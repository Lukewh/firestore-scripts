#!/usr/bin/env node

import * as admin from 'firebase-admin';
import { ArgumentParser } from 'argparse';

const parser = new ArgumentParser({
  description: 'Import a collection from a json file',
  add_help: true,
});

parser.add_argument('-e', '--env', { help: 'Environment to use' });

const args = parser.parse_args();

if (!args.env) {
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

import(`../firebaseAdminServiceAccounts/${envFile}.json`).then(
  async (serviceAccount) => {
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
      const people = result.docs.reduce((acc: any, resultDoc: any) => {
        if (!acc[resultDoc.id]) {
          acc[resultDoc.id] = resultDoc.data();
        }
        return acc;
      }, {});

      const peopleWithPerms: any = {};
      Object.keys(people).forEach((uid: any) => {
        if (people[uid].permissions && !people[uid].permissions.global) {
          peopleWithPerms[uid] = { ...people[uid] };
        }
      });

      Object.keys(peopleWithPerms).forEach((uid: any) => {
        const person = peopleWithPerms[uid];
        person.permissions = Object.keys(person.permissions).reduce(
          (acc: any, companyId: string) => {
            acc[companyId] = Object.keys(person.permissions[companyId]).reduce(
              (acc: any, source: string) => {
                acc[source] = person.permissions[companyId][source];
                if (typeof acc[source] === 'string') {
                  return acc;
                }
                if (!acc[source].type) {
                  if (acc[source].filters) {
                    acc[source].type = 'custom';
                  } else {
                    acc[source].type = 'all';
                  }
                }

                if (acc[source].filters && Array.isArray(acc[source].filters)) {
                  const newFilters: any = {};

                  // When this was written only instabase was using filters - and this logic works
                  // When permissions are used more in the future this will no longer work
                  acc[source].filters.forEach((filter: any) => {
                    const key: string = filter.key;
                    if (filter.values) {
                      filter.values.forEach((value: string, index: number) => {
                        newFilters[`pkey${index}`] = [{ key, value }];
                      });
                    }
                  });

                  acc[source].filters = newFilters;
                }
                return acc;
              },
              {},
            );
            return acc;
          },
          {},
        );
      });

      // console.log(JSON.stringify(peopleWithPerms, null, 2));

      const updatePeople = await Promise.all(
        Object.keys(peopleWithPerms).map((uid: string) => {
          console.log(uid, peopleWithPerms[uid].permissions);
          return admin
            .firestore()
            .collection('people')
            .doc(uid)
            .set(
              { permissions: peopleWithPerms[uid].permissions },
              { merge: true },
            );
        }),
      );

      console.log(updatePeople);
    }
  },
);
