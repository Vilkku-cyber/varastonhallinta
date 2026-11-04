export function permissionsFor(actorId, subjectId, grants = {}) {
  const own = !!actorId && actorId === subjectId;
  return {
    canRead:
      !!actorId && !!subjectId && (own || grants.readAll === true || grants.writeAll === true),
    canWrite: !!actorId && !!subjectId && (own || grants.writeAll === true),
  };
}

export function employeeOptions(directory, actor, grants = {}) {
  if (!actor) return [];
  const people = { ...directory, [actor.uid]: { name: actor.name } };
  return Object.entries(people)
    .filter(([uid]) => permissionsFor(actor.uid, uid, grants).canRead)
    .map(([uid, profile]) => ({ uid, name: profile?.name || 'Nimetön käyttäjä' }))
    .sort((a, b) =>
      a.uid === actor.uid ? -1 : b.uid === actor.uid ? 1 : a.name.localeCompare(b.name, 'fi'),
    );
}
