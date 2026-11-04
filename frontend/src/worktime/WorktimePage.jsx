import React, { useEffect, useRef, useState } from 'react';
import { WorktimeView } from './Worktime.jsx';
import { EMPTY_STATE } from './state.js';

// Uses AV Arsenal's existing repository: IndexedDB locally and its authenticated
// RTDB transaction in the shared workspace. No second Firebase app or database.
export function WorktimePage({ state, repo }) {
  const [actor, setActor] = useState(
    repo.mode === 'local' ? { uid: 'local-user', name: 'Paikallinen käyttäjä' } : null,
  );
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const pending = useRef(false),
    registration = useRef('');
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (repo.mode !== 'firebase') return;
    let alive = true,
      off;
    import('../data/firebaseRepository')
      .then((m) => {
        if (!alive) return;
        off = m.observeAuth(m.auth, (user) => {
          setActor(
            user
              ? {
                  uid: user.uid,
                  name: user.displayName || user.email?.split('@')[0] || 'Työntekijä',
                }
              : null,
          );
          setSelected(user?.uid || '');
        });
      })
      .catch(() => setError('Kirjautumistietojen lukeminen epäonnistui.'));
    return () => {
      alive = false;
      off?.();
    };
  }, [repo]);
  const people = state.worktime?.people || {};
  useEffect(() => {
    if (!actor || people[actor.uid] || registration.current === actor.uid) return;
    registration.current = actor.uid;
    repo.dispatch({ type: 'worktimeProfile', uid: actor.uid, name: actor.name }).catch((e) => {
      registration.current = '';
      setError(e.message);
    });
  }, [actor, people, repo]);
  const subject = selected || actor?.uid || '';
  const employees = Object.entries({
    ...people,
    ...(actor ? { [actor.uid]: { name: actor.name } } : {}),
  })
    .map(([uid, profile]) => ({ uid, name: profile.name }))
    .sort((a, b) =>
      a.uid === actor?.uid ? -1 : b.uid === actor?.uid ? 1 : a.name.localeCompare(b.name, 'fi'),
    );
  async function perform(operation) {
    if (pending.current || !actor || !people[subject]) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await repo.dispatch({ type: 'worktime', subject, actor: actor.uid, operation });
      return true;
    } catch (e) {
      setError(`Tallennus epäonnistui: ${e.message}`);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <WorktimeView
      key={subject}
      store={{
        state: state.worktime?.records?.[subject] || EMPTY_STATE,
        ready: !!actor && !!people[subject],
        connected: repo.mode === 'local' || online,
        busy,
        error,
        perform,
        employees,
        actorId: actor?.uid,
        selectedUserId: subject,
        selectEmployee: (uid) => {
          if (!pending.current && people[uid]) setSelected(uid);
        },
        canWrite: !!actor,
        local: repo.mode === 'local',
      }}
    />
  );
}
