import { calculate, validateEntry, validateBalanceSettings } from './engine.js';
import { RULES } from './rules.js';

export const EMPTY_STATE = { entries: {}, history: {}, active: null, revision: 0 };

// Pure reducer: used inside a Firebase transaction so competing tabs/devices
// cannot silently overwrite edits or start a second running timer.
export function applyOperation(previous, operation) {
  const state = structuredClone(previous || EMPTY_STATE);
  state.entries ||= {};
  state.history ||= {};
  state.revision ||= 0;
  const before = structuredClone(state.entries);
  const activeBefore = state.active || null;
  const settingsBefore = state.settings || null;
  const { at, id, actor } = operation;
  if (operation.type === 'settings') {
    if ((operation.expectedRevision ?? -1) !== state.revision)
      throw new Error('Työaikatiedot ovat muuttuneet. Tarkista asetukset ja tallenna uudelleen.');
    validateBalanceSettings(operation.settings);
    state.settings = {
      startDate: operation.settings.startDate,
      weeklyMinutes: operation.settings.weeklyMinutes,
      workDays: [...operation.settings.workDays],
      openingMinutes: operation.settings.openingMinutes,
    };
  } else if (operation.type === 'save') {
    for (const item of operation.entries) {
      const existing = state.entries[item.id];
      if ((existing?.revision || 0) !== (item.revision || 0))
        throw new Error(
          'Merkintää on muutettu toisessa ikkunassa. Avaa uusin merkintä ennen tallennusta.',
        );
      validateEntry(item);
      state.entries[item.id] = {
        ...item,
        revision: (existing?.revision || 0) + 1,
        updatedAt: at,
        createdAt: existing?.createdAt || at,
        ruleVersion: RULES.id,
      };
    }
  } else if (operation.type === 'start') {
    if (state.active) throw new Error('Työpäivä on jo käynnissä.');
    state.active = { id, start: at, breaks: [], pause: null, revision: 1 };
  } else {
    const active = state.active;
    if (!active || active.id !== operation.activeId || active.revision !== operation.activeRevision)
      throw new Error('Ajastimen tila muuttui. Tarkista uusin tila ja yritä uudelleen.');
    if (operation.type === 'pause') {
      if (active.pause) throw new Error('Tauko on jo käynnissä.');
      active.pause = { start: at, paid: operation.paid };
    } else if (operation.type === 'resume' || operation.type === 'stop') {
      if (active.pause) {
        active.breaks = [...(active.breaks || []), { ...active.pause, end: at }];
        active.pause = null;
      } else if (operation.type === 'resume') throw new Error('Tauko ei ole käynnissä.');
      if (operation.type === 'stop') {
        const entry = {
          id: active.id,
          kind: 'work',
          start: active.start,
          end: at,
          breaks: active.breaks || [],
          breakPolicy: (active.breaks || []).length ? 'recorded' : 'assumed-taken',
          breakStatus: (active.breaks || []).length ? 'recorded' : 'assumed-taken',
          employerApproved: 'unknown',
          employeeConsent: 'unknown',
          note: '',
          revision: 1,
          createdAt: at,
          updatedAt: at,
          ruleVersion: RULES.id,
        };
        validateEntry(entry);
        state.entries[entry.id] = entry;
        state.active = null;
      }
    } else throw new Error('Tuntematon toiminto.');
    if (state.active) state.active.revision += 1;
  }
  state.revision += 1;
  state.history[id] = {
    id,
    at,
    actor,
    subject: operation.subject || actor,
    type: operation.type,
    revision: state.revision,
    changes: Object.entries(state.entries)
      .filter(([key, value]) => JSON.stringify(before[key]) !== JSON.stringify(value))
      .map(([key, value]) => ({ entryId: key, before: before[key] || null, after: value })),
    activeBefore,
    activeAfter: state.active || null,
    settingsBefore,
    settingsAfter: state.settings || null,
    calculation: calculate(
      Object.values(state.entries),
      Date.parse(at),
      state.active,
      state.settings || {},
    ),
    inputRevisions: Object.fromEntries(
      Object.entries(state.entries).map(([key, entry]) => [key, entry.revision]),
    ),
    ruleSnapshot: RULES,
  };
  return state;
}
