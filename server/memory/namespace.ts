const USER_ID = /^[0-9a-f-]{8,}$/i;

export function namespaceForUser(userId: string) {
  if (!USER_ID.test(userId)) {
    throw new Error("Invalid user id");
  }
  return `frimz-user-${userId}`;
}
