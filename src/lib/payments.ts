import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const SQUARE_LINKS: Record<string, string> = {
  pro: 'https://square.link/u/t3wedRic?src=sheet',
  business: 'https://square.link/u/PhQ6IzOn?src=sheet',
};

export async function createPendingUpgrade(uid: string, plan: string, price: number) {
  const ref = await addDoc(collection(db, 'pendingUpgrades'), {
    uid,
    plan,
    price: price || null,
    createdAt: serverTimestamp(),
    used: false,
  });
  return ref.id;
}

export async function applyPendingUpgrades(uid: string) {
  const snap = await getDocs(query(collection(db, 'pendingUpgrades'), where('uid', '==', uid)));
  if (snap.empty) return { applied: 0 };

  let applied = 0;
  for (const d of snap.docs) {
    const data = d.data();
    await addDoc(collection(db, 'upgrades'), {
      uid,
      plan: data.plan,
      price: data.price,
      createdAt: serverTimestamp(),
      appliedAt: serverTimestamp(),
      source: 'auto_success_page',
    });
    await updateDoc(doc(db, 'users', uid), {
      plan: data.plan,
      planUpdatedAt: serverTimestamp(),
    });
    await deleteDoc(d.ref);
    applied++;
  }
  return { applied };
}

export async function cancelPendingUpgrades(uid: string) {
  const snap = await getDocs(query(collection(db, 'pendingUpgrades'), where('uid', '==', uid)));
  const promises = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(promises);
}
