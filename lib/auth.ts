import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'vistara_auth';
export const OWNER_COOKIE = 'vistara_owner';

export function isAuthed() {
  const c = cookies().get(AUTH_COOKIE)?.value;
  return c === process.env.APP_PASSWORD;
}

export function getOwner() {
  return cookies().get(OWNER_COOKIE)?.value || 'user';
}
