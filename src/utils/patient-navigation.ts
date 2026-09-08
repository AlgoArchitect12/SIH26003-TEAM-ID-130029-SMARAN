// Exact browsing routes only: new detail/activity routes stay immersive by default.
export function isPatientNavigationVisible(pathname: string): boolean {
  return [
    '/patient/home',
    '/patient/games',
    '/patient/my-day',
    '/patient/my-memories',
    '/patient/menu',
    '/patient/profile',
    '/patient/settings',
    '/patient/support',
    '/patient/my-home',
  ].includes(pathname);
}
