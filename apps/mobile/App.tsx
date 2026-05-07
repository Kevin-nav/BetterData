import { NETWORK_CODES } from "@betterdata/contracts";
import { StatusBar } from "expo-status-bar";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Ghana data bundles</Text>
        <Text style={styles.title}>Better Data</Text>
        <Text style={styles.copy}>
          Buy MTN, Telecel, and AirtelTigo bundles with Mobile Money, wallet balance, and status tracking.
        </Text>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Buy data</Text>
        </Pressable>
        <View style={styles.networks}>
          {Object.entries(NETWORK_CODES).map(([name, code]) => (
            <View key={code} style={styles.networkCard}>
              <Text style={styles.networkName}>{name}</Text>
              <Text style={styles.networkCode}>{code}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  content: {
    flex: 1,
    padding: 24
  },
  eyebrow: {
    color: "#0f7b45",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    marginTop: 8,
    color: "#111827",
    fontSize: 48,
    fontWeight: "900"
  },
  copy: {
    marginTop: 14,
    color: "#344054",
    fontSize: 17,
    lineHeight: 26
  },
  primaryButton: {
    alignItems: "center",
    marginTop: 28,
    borderRadius: 8,
    paddingVertical: 15,
    backgroundColor: "#0f7b45"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  networks: {
    gap: 12,
    marginTop: 36
  },
  networkCard: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#ffffff"
  },
  networkName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800"
  },
  networkCode: {
    marginTop: 4,
    color: "#667085"
  }
});
