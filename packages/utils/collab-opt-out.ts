export interface CollabOptOutUser {
  collab_opt_out?: boolean | null;
}

export function resolveCollabOptOut(user: CollabOptOutUser | null | undefined, defaultValue = false): boolean {
  if (typeof user?.collab_opt_out === "boolean") return user.collab_opt_out;
  return defaultValue;
}

export function participantOptOutSnapshot(user: CollabOptOutUser | null | undefined): { opt_out_teamwork: boolean } {
  return { opt_out_teamwork: resolveCollabOptOut(user) };
}
