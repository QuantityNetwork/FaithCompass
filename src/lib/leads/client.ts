'use client';
/** Browser access to the user's own Deep Analysis profile (user_profiles/{uid}), under firestore.rules. */
import { firestoreClient } from '@/lib/firebase/client';
import { PROFILE_COLLECTION, type ProfileFields } from './profile';

export interface StoredProfile extends ProfileFields {
  updatedAt: string | null;
}

export async function loadProfile(uid: string): Promise<StoredProfile | null> {
  const db = await firestoreClient();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, PROFILE_COLLECTION, uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    organisation: String(d.organisation ?? ''),
    role: d.role,
    pilotInterest: d.pilotInterest === true,
    consentVersion: String(d.consentVersion ?? ''),
    privacyVersion: String(d.privacyVersion ?? ''),
    email: typeof d.email === 'string' ? d.email : null,
    source: d.source,
    updatedAt: d.updatedAt?.toDate?.().toISOString?.() ?? null,
  };
}

/** Creates the profile, or updates it keeping its creation time. */
export async function saveProfile(uid: string, fields: ProfileFields, exists: boolean): Promise<void> {
  const db = await firestoreClient();
  const { doc, serverTimestamp, setDoc, updateDoc } = await import('firebase/firestore');
  const ref = doc(db, PROFILE_COLLECTION, uid);
  if (exists) await updateDoc(ref, { ...fields, updatedAt: serverTimestamp() });
  else await setDoc(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function deleteProfile(uid: string): Promise<void> {
  const db = await firestoreClient();
  const { deleteDoc, doc } = await import('firebase/firestore');
  await deleteDoc(doc(db, PROFILE_COLLECTION, uid));
}
