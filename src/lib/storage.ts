import { getStorage } from 'firebase/storage';
import { app } from '@/lib/firebase';

// Storage is only needed when uploading images/fonts (the editor), so it's kept
// in its own module to avoid pulling the Firebase Storage SDK into the entry bundle.
export const storage = getStorage(app);
