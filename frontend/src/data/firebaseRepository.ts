import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getDatabase, onValue, ref, runTransaction, get } from 'firebase/database';
import { applyCommand, type Command } from '../domain/commands';
import { hydrate, type Repository } from './repository';
import { type State } from '../domain/model';
import { initialDemo } from '../domain/demoSetup';
const env = import.meta.env;
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
export const auth = getAuth(app);
export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const observeAuth = onAuthStateChanged;
export class FirebaseRepository implements Repository {
  mode = 'firebase' as const;
  private root = ref(getDatabase(app), 'avArsenalV2/state');
  subscribe(fn: (s: State) => void, error: (e: Error) => void) {
    return onValue(
      this.root,
      (snap) => {
        if (!snap.exists()) {
          error(
            Object.assign(new Error('Verkkotestin esimerkkiaineistoa ei ole vielä alustettu.'), {
              code: 'workspace/missing',
            }),
          );
          return;
        }
        if (snap.val().schemaVersion !== 2) {
          error(
            new Error(
              'Verkkotietokannan 2.0-siirtoa ei ole viimeistelty. Ota yhteys ylläpitäjään.',
            ),
          );
          return;
        }
        fn(hydrate(snap.val()));
      },
      error,
    );
  }
  async initializeDemo() {
    if (import.meta.env.VITE_DEMO_SETUP !== 'enabled')
      throw Error('Alustus on käytettävissä vain esikatselussa.');
    if (!auth.currentUser) throw Error('Kirjaudu ensin sisään.');
    const result = await runTransaction(this.root, initialDemo, { applyLocally: false });
    if (!result.committed) throw Error('Tietopolku sisältää jo aineistoa. Mitään ei korvattu.');
  }
  async dispatch(c: Command) {
    if (!auth.currentUser) throw Error('Kirjaudu ensin sisään.');
    if (!navigator.onLine) throw Error('Ei verkkoyhteyttä. Muutosta ei lähetetty.');
    const id = crypto.randomUUID(),
      at = new Date().toISOString();
    let failure: unknown;
    const result = await runTransaction(
      this.root,
      (raw) => {
        try {
          if (!raw || raw.schemaVersion !== 2) throw Error('Verkkotietokannan 2.0-siirto puuttuu.');
          return applyCommand(hydrate(raw), c, id, at);
        } catch (e) {
          failure = e;
          return undefined;
        }
      },
      { applyLocally: false },
    );
    if (!result.committed) throw failure ?? Error('Tallennus ei onnistunut.');
  }
  async backup() {
    return {
      format: 'av-arsenal-backup',
      version: 2,
      state: hydrate((await get(this.root)).val()),
    };
  }
}
