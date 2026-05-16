import { createBetterDataApiClient } from "@betterdata/api-client";
import { packageFunctions } from "@betterdata/app-api";
import { NETWORK_CODES } from "@betterdata/contracts";
import { StatusBar } from "expo-status-bar";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const betterDataApi = createBetterDataApiClient({ baseUrl: API_BASE_URL });
const sharedPackageQuery = packageFunctions.listAvailable;

const NETWORK_LABELS = {
  mtn: "MTN",
  telecel: "Telecel",
  airteltigo: "AirtelTigo"
} as const;

export default function App() {
  const backendStatus = sharedPackageQuery && betterDataApi ? "Shared backend ready" : "Backend unavailable";

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Ghana data bundles</Text>
        <Text style={styles.title}>Better Data</Text>
        <Text style={styles.copy}>
          Buy MTN, Telecel, and AirtelTigo bundles with Mobile Money, wallet balance, and status tracking.
        </Text>
        <Text style={styles.backendStatus}>{backendStatus}</Text>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Buy data</Text>
        </Pressable>
        <View style={styles.networks}>
          {Object.values(NETWORK_CODES).map((code) => (
            <View key={code} style={styles.networkCard}>
              <Text style={styles.networkName}>{NETWORK_LABELS[code]}</Text>
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
  backendStatus: {
    marginTop: 12,
    color: "#0f7b45",
    fontSize: 14,
    fontWeight: "700"
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
