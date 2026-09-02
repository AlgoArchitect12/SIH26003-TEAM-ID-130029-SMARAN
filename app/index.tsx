import { StyleSheet, Text, View } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smaran AI</Text>
      <Text style={styles.status}>Setup in progress.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F9F8F5',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#1C2526',
    fontSize: 32,
    fontWeight: '700',
  },
  status: {
    color: '#405052',
    fontSize: 18,
    marginTop: 12,
  },
});
