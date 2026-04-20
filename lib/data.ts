import { adminDb } from "./firebase-admin";
import type { Topic, KeywordDaily, Edge, Snapshot } from "@shared/schema";

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  const snap = await adminDb()
    .collection("snapshots")
    .orderBy("runAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Snapshot;
}

export async function getTopics(date: string, limit = 50): Promise<Topic[]> {
  const snap = await adminDb()
    .collection("topics")
    .where("date", "==", date)
    .orderBy("surgeScore", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as Topic);
}

export async function getKeywordDaily(date: string, limit = 500): Promise<KeywordDaily[]> {
  const snap = await adminDb()
    .collection("keyword_daily")
    .where("date", "==", date)
    .orderBy("surgeScore", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as KeywordDaily);
}

export async function getEdges(date: string, limit = 2000): Promise<Edge[]> {
  const snap = await adminDb()
    .collection("edges")
    .where("date", "==", date)
    .orderBy("weight", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as Edge);
}

export async function getTimeSeries(
  keyword: string,
  days = 30
): Promise<KeywordDaily[]> {
  const snap = await adminDb()
    .collection("keyword_daily")
    .where("keyword", "==", keyword)
    .orderBy("date", "desc")
    .limit(days)
    .get();
  return snap.docs.map((d) => d.data() as KeywordDaily).reverse();
}

export async function getTopicById(id: string): Promise<Topic | null> {
  const doc = await adminDb().collection("topics").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Topic;
}

export async function getItemsBySnapshot(
  snapshotId: string,
  limit = 1000
): Promise<any[]> {
  const snap = await adminDb()
    .collection("items")
    .where("snapshotId", "==", snapshotId)
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data());
}

export async function getRelatedEdges(
  date: string,
  keyword: string,
  limit = 30
): Promise<Edge[]> {
  const allEdges = await getEdges(date, 2000);
  return allEdges
    .filter((e) => e.a === keyword || e.b === keyword)
    .slice(0, limit);
}
