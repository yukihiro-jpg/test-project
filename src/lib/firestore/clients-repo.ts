/**
 * 顧問先（Client）リポジトリ
 *
 * Firestore との CRUD を集約。API Routes から利用する。
 */

import type { Client, ClientProfile } from '../types'
import { getFirestore } from './client'

const COLLECTION = 'clients'

export async function listClients(): Promise<Client[]> {
  const snap = await getFirestore().collection(COLLECTION).orderBy('name').get()
  return snap.docs.map((d) => docToClient(d))
}

export async function getClient(id: string): Promise<Client | null> {
  const doc = await getFirestore().collection(COLLECTION).doc(id).get()
  return doc.exists ? docToClient(doc) : null
}

export async function createClient(
  data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Client> {
  const now = new Date()
  const ref = getFirestore().collection(COLLECTION).doc()
  const client: Client = { ...data, id: ref.id, createdAt: now, updatedAt: now }
  await ref.set(client)
  return client
}

export async function updateClient(id: string, patch: Partial<Client>): Promise<void> {
  await getFirestore()
    .collection(COLLECTION)
    .doc(id)
    .update({ ...patch, updatedAt: new Date() })
}

export async function deleteClient(id: string): Promise<void> {
  await getFirestore().collection(COLLECTION).doc(id).delete()
}

// ---------------------------------------------------------------------------
// 社長プロファイル
// ---------------------------------------------------------------------------

const PROFILE_DOC = 'default'

export async function getProfile(clientId: string): Promise<ClientProfile | null> {
  const doc = await getFirestore()
    .collection(COLLECTION)
    .doc(clientId)
    .collection('profile')
    .doc(PROFILE_DOC)
    .get()
  return doc.exists ? (doc.data() as ClientProfile) : null
}

export async function upsertProfile(profile: ClientProfile): Promise<void> {
  await getFirestore()
    .collection(COLLECTION)
    .doc(profile.clientId)
    .collection('profile')
    .doc(PROFILE_DOC)
    .set(profile, { merge: true })
}

// ---------------------------------------------------------------------------
// 変換ヘルパ
// ---------------------------------------------------------------------------

function docToClient(doc: FirebaseFirestore.DocumentSnapshot): Client {
  const data = doc.data() as FirebaseFirestore.DocumentData
  return {
    id: doc.id,
    name: data.name,
    industryCode: data.industryCode,
    capitalScale: data.capitalScale,
    fiscalYearEndMonth: data.fiscalYearEndMonth,
    employeeCount: data.employeeCount,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate()
  }
  return new Date()
}
