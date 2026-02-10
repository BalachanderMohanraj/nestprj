import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';

export const firebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN,
  useFactory: () => {
    if (admin.apps.length) return admin;

    const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!p) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is missing');

    const absolute = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(absolute);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    return admin;
  },
};
