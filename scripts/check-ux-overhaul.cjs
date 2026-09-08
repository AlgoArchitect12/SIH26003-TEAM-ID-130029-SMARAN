const assert = require('node:assert/strict');
const { load } = require('./check-elderly-ux.cjs');
const { StackRouter, StackActions, CommonActions } = require('@react-navigation/routers');

async function main() {
  const { parseDateOfBirth: parse, ageFromDateOfBirth: age, displayDateOfBirth: display } = load('src/utils/date-of-birth.ts');
  const today = new Date(2026, 8, 8, 12);
  assert.equal(parse('26/02/1954', today), '1954-02-26');
  assert.equal(age('1954-02-26', today), 72);
  assert.equal(age('1954-02-26', new Date(2026, 1, 25)), 71);
  assert.equal(age('1954-02-26', new Date(2026, 1, 26)), 72);
  assert.equal(display('1954-02-26'), '26/02/1954');
  for (const invalid of ['', '31/02/1954', '29/02/1900', '31/04/1954', '00/02/1954', '26/13/1954', '26/00/1954', '26/02/0000', '09/09/2026', '26/02/54', '1954-02-26']) assert.equal(parse(invalid, today), null, invalid);
  assert.equal(parse('29/02/2000', today), '2000-02-29');
  assert.equal(parse('08/09/2026', today), '2026-09-08');
  assert.equal(age('2026-09-08', today), 0);
  assert.equal(age('2000-02-29', new Date(2025, 1, 28)), 24);
  assert.equal(age('2000-02-29', new Date(2025, 2, 1)), 25);
  const values = new Map(); let fail = false;
  const storage = { SecureStorageKeys: { appearance: 'smaran.appearance' },
    getSecureValue: async key => values.get(key) ?? null,
    setSecureValue: async (key, value) => { if (fail) throw new Error('Unavailable'); values.set(key, value); },
  };
  const details = load('src/services/profile-details.service.ts', { './secure-storage.service': storage });
  assert.equal(await details.getDateOfBirth('legacy-patient'), null);
  await details.saveDateOfBirth('one', '1954-02-26');
  await details.saveDateOfBirth('two', '1960-10-01');
  assert.equal(await details.getDateOfBirth('one'), '1954-02-26');
  assert.equal(await load('src/services/profile-details.service.ts', { './secure-storage.service': storage }).getDateOfBirth('two'), '1960-10-01');
  await assert.rejects(details.saveDateOfBirth('one', '1954-02-31'));
  await assert.rejects(details.saveDateOfBirth('', '1954-02-26'));
  fail = true; await assert.rejects(details.saveDateOfBirth('one', '1955-02-26'));
  assert.equal(await details.getDateOfBirth('one'), '1954-02-26'); fail = false;
  const overrides = { zustand: require('zustand'), '../services/secure-storage.service': storage };
  const appearance = load('src/stores/appearance.store.ts', overrides);
  for (const mode of appearance.AppearanceModes) {
    await appearance.saveAppearance(mode);
    const reopened = load('src/stores/appearance.store.ts', overrides);
    await reopened.loadAppearance(); assert.equal(reopened.useAppearanceStore.getState().mode, mode);
  }
  fail = true; await assert.rejects(appearance.saveAppearance('light'));
  assert.equal(appearance.useAppearanceStore.getState().mode, 'high-contrast-dark'); fail = false;
  await assert.rejects(appearance.saveAppearance('bad'));

  const { Colors } = load('constants/colors.ts');
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  for (const [name,c] of Object.entries(Colors)) {
    for (const bg of ['background','surface','surfaceRaised','surfaceMuted']) {
      for (const fg of ['text','textSecondary','link']) assert.ok(contrast(c[fg],c[bg]) >= 4.5, `${name}: ${fg}/${bg}`);
      assert.ok(contrast(c.border,c[bg]) >= 3, `${name}: border/${bg}`);
    }
    for (const action of ['Primary','Secondary','Accent']) assert.ok(contrast(c['onAction'+action],c['action'+action]) >= 4.5, `${name}: action${action}`);
  }
  const { isPatientNavigationVisible } = load('src/utils/patient-navigation.ts');
  for (const route of ['home', 'games', 'my-day', 'my-memories', 'menu', 'profile', 'settings', 'support', 'my-home']) {
    assert.equal(isPatientNavigationVisible(`/patient/${route}`), true, route);
    assert.equal(isPatientNavigationVisible(`/patient/${route}/detail`), false, `${route} nested detail`);
  }
  for (const pathname of [
    '/patient/games/memory-match', '/patient/games/pattern-recognition', '/patient/games/routine-recall',
    '/patient/games/result', '/patient/games/why-level', '/patient/my-day-reminder',
    '/patient/my-memory', '/patient/my-memory-editor', '/patient/my-home-memory',
    '/caregiver/home', '/patient/unknown', '/patient', '/onboarding/profile', '/', '',
  ]) assert.equal(isPatientNavigationVisible(pathname), false, pathname);

  const names = ['home','games','my-day','my-memories','menu','profile','settings'];
  const router = StackRouter({ initialRouteName: 'home' });
  const options = { routeNames: names, routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  for (let i=0;i<4;i++) for (const name of names.slice(1,5)) {
    state = router.getStateForAction(state, StackActions.popTo('home'), options);
    state = router.getStateForAction(state, CommonActions.navigate(name), options);
    assert.deepEqual(state.routes.map(r=>r.name), ['home',name]);
    const back = router.getStateForAction(state, CommonActions.goBack(), options);
    assert.deepEqual(back.routes.map(r=>r.name), ['home'], 'Back from a primary section returns Home');
  }
  state = router.getStateForAction(state, StackActions.popTo('home'), options);
  assert.deepEqual(state.routes.map(r=>r.name),['home']);
  console.log('PASS: DOB calendar/age boundaries, patient-scoped save/reopen/failure, five appearance modes/reopen/failure, contrast ratios, browsing-only navigation visibility, duplicate-free primary stack navigation');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
