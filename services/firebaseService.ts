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
    return [];
  }
}
