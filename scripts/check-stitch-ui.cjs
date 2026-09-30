const assert = require('node:assert/strict');
const { load } = require('./check-elderly-ux.cjs');
const { Colors } = load('constants/colors.ts');
const { ProgressIndicator } = load('components/ui/progress-indicator.tsx', {
  'react-native': { View: 'View' },
  '@components/themed-text': { ThemedText: 'ThemedText' },
  '@/hooks/use-theme-color': { useThemeColors: () => Colors.light },
});

// Real component: empty timelines never divide by zero, and fill/announced values agree.
for (const [current, total, percent] of [[0, 0, 0], [1, 4, 25], [4, 4, 100], [-1, 4, 0], [5, 4, 100]]) {
  const label = `${current} of ${total}`;
  const tree = ProgressIndicator({ current, total, label });
  assert.equal(tree.props.accessibilityRole, 'progressbar');
  assert.equal(tree.props.accessible, true);
  assert.equal(tree.props.accessibilityLabel, label);
  assert.deepEqual(tree.props.accessibilityValue, { min: 0, max: 100, now: percent });
  assert.equal(tree.props.children[0].props.children, label);
  assert.equal(tree.props.children[1].props.children.props.style.width, `${percent}%`);
}
console.log('PASS Stitch UI: empty, partial, complete and bounded progress with matching accessible values.');
