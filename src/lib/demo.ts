import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { slugify } from '@/lib/utils';

export async function createDemoCard(uid: string) {
  const slug = 'demo-' + Math.random().toString(36).slice(2, 8);
  const cardRef = doc(collection(db, 'cards'));
  const card = {
    ownerUid: uid,
    slug: slugify(slug),
    prefix: 'Dr.',
    firstName: 'Jane',
    middleName: 'Elizabeth',
    lastName: 'Doe',
    suffix: 'PhD',
    nickname: 'Janey',
    jobTitle: 'Product Designer',
    department: 'Design',
    company: 'Acme Corp',
    phones: [{ type: 'Cell', number: '+1 (555) 123-4567' }, { type: 'Work', number: '+1 (555) 987-6543' }],
    emails: [{ type: 'Work', address: 'jane.doe@acme.com' }, { type: 'Personal', address: 'jane@gmail.com' }],
    addresses: [{ type: 'Work', street: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'USA' }],
    websites: [{ type: 'Work', url: 'https://acme.com' }, { type: 'Portfolio', url: 'https://janedoe.design' }],
    socialLinks: [
      { platform: 'LinkedIn', url: 'https://linkedin.com/in/janedoe' },
      { platform: 'Twitter', url: 'https://twitter.com/janedoe' },
      { platform: 'GitHub', url: 'https://github.com/janedoe' },
    ],
    birthday: '1990-05-15',
    bio: 'Passionate product designer with 10+ years of experience building digital products that people love.',
    accentColor: '#d4a34a',
    isPublic: true,
    viewCount: 0,
    saveCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(cardRef, card);
  return { id: cardRef.id, slug: card.slug };
}
