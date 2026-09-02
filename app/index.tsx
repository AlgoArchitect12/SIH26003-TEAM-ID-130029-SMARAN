import { StyleSheet } from 'react-native';

import { ThemedText } from '@components/themed-text';
import { ThemedView } from '@components/themed-view';
import { Spacing } from '@constants/layout';

export default function IndexScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="screenTitle">Smaran AI</ThemedText>
      <ThemedText style={styles.status}>Setup in progress.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  status: {
    marginTop: Spacing.sm,
  },
});
