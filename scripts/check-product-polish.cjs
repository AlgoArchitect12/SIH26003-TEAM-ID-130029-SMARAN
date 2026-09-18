const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { StackRouter, StackActions } = require('@react-navigation/routers');

// Exercise the return actions used by the screens against the installed stack router.
// Native hardware Back and nested Expo stacks still need device/browser QA.
const screens = [
  'app/patient/games/index.tsx', 'app/patient/games/memory-match.tsx',
  'app/patient/games/result.tsx', 'app/patient/games/why-level.tsx',
  'components/games/selection-activity-screen.tsx', 'app/caregiver/home.tsx',
  'components/my-day/my-day-content.tsx',
  'app/patient/my-memories.tsx', 'app/patient/my-memory.tsx',
  'app/patient/my-memory-editor.tsx', 'app/patient/my-home.tsx',
  'app/patient/my-home-memory.tsx',
];
const router = StackRouter({ initialRouteName: 'parent' });
const options = { routeNames: ['parent', 'detail'], routeParamList: {}, routeGetIdList: {} };
let checked = 0;
for (const file of screens) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const calls = [...source.matchAll(/router\.(dismissTo|replace)\(.*?['"\/](patient|caregiver)\/(home|games|my-day|my-memories|my-home)['"].*?\)/gu)];
  assert.ok(calls.length, file + ': parent return action exists');
  for (const [, method, target] of calls) {
    const action = method === 'dismissTo' ? StackActions.popTo('parent') : StackActions.replace('parent');
    const initial = router.getInitialState(options);
    const pushed = router.getStateForAction(initial, StackActions.push('detail'), options);
    const returned = router.getStateForAction(pushed, action, options);
    assert.deepEqual(returned.routes.map(route => route.name), ['parent'], file + ': ' + target + ' must not duplicate its parent');
    assert.equal(returned.routes[0].key, initial.routes[0].key, 'Existing parent is preserved');
    const directEntry = { ...pushed, routes: [pushed.routes[1]], index: 0 };
    assert.deepEqual(router.getStateForAction(directEntry, action, options).routes.map(route => route.name), ['parent'], 'Direct entry can return without a parent in history');
    checked++;
  }
}
console.log(`PASS: ${checked} parent return actions preserve the existing screen, remove the detail, and support direct entry`);
