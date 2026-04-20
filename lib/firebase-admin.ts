import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App;

export function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!;
  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
  return adminApp;
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}
