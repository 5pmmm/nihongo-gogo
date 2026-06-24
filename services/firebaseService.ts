import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  Timestamp 
} from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCNuiLWC02GxMVutPM7SnDtCufyuw_Xx0w",
  authDomain: "fluent-emissary-m8t0d.firebaseapp.com",
  projectId: "fluent-emissary-m8t0d",
  storageBucket: "fluent-emissary-m8t0d.firebasestorage.app",
  messagingSenderId: "1496913945",
  appId: "1:1496913945:web:3a3be07a51f35d955d3288"
};

const DATABASE_ID = "ai-studio-c34d6243-4db0-4c24-8f36-a207f88307ba";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, DATABASE_ID);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreQueryItem {
  id?: string;
  syncKey: string;
  query: string;
  responseJson: string; // JSON string of AssistantResponse
  timestamp: number;
}

/**
 * Saves a new assistant query record to Firestore, which guarantees infinite persistence 
 * and across-device access.
 */
export async function saveAssistantQuery(syncKey: string, queryText: string, responseObj: any): Promise<void> {
  if (!syncKey || !queryText) return;
  try {
    const colRef = collection(db, 'assistant_queries');
    const responseJson = JSON.stringify(responseObj);
    await addDoc(colRef, {
      syncKey: syncKey.trim().toLowerCase(),
      query: queryText.trim(),
      responseJson,
      timestamp: Date.now(),
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Failed to save to Firestore:', error);
    handleFirestoreError(error, OperationType.CREATE, 'assistant_queries');
  }
}

/**
 * Fetches the assistant queries history list for a syncKey from Firestore.
 */
export async function fetchAssistantQueries(syncKey: string, maxLimit = 30): Promise<FirestoreQueryItem[]> {
  if (!syncKey) return [];
  try {
    const colRef = collection(db, 'assistant_queries');
    const q = query(
      colRef,
      where('syncKey', '==', syncKey.trim().toLowerCase()),
      orderBy('timestamp', 'desc'),
      limit(maxLimit)
    );
    const querySnapshot = await getDocs(q);
    const items: FirestoreQueryItem[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        syncKey: data.syncKey,
        query: data.query,
        responseJson: data.responseJson,
        timestamp: data.timestamp || Date.now()
      });
    });
    return items;
  } catch (error) {
    console.error('Failed to fetch from Firestore:', error);
    handleFirestoreError(error, OperationType.LIST, 'assistant_queries');
  }
}

