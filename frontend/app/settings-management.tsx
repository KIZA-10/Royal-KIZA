import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';

const COLORS = {
  black: '#0D0D0D',
  blackLight: '#1A1A1A',
  blackMedium: '#252525',
  gold: '#D4AF37',
  goldLight: '#E8D48A',
  goldDark: '#B8962E',
  white: '#FFFFFF',
  gray: '#888888',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
};

const getBackendUrl = () => {
  return Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
    || process.env.EXPO_PUBLIC_BACKEND_URL 
    || '';
};

const API_BASE_URL = getBackendUrl();
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Admin password
const ADMIN_PASSWORD = 'kiza2024admin';

interface Settings {
  opening_hour: string;
  closing_hour: string;
  is_ramadan_mode: boolean;
  ramadan_opening_hour: string;
  ramadan_closing_hour: string;
  is_open: boolean;
}

interface StockItem {
  item_id: string;
  name: string;
  category: string;
  in_stock: boolean;
}

export default function SettingsManagementScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'hours' | 'stock'>('hours');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<Settings>({
    opening_hour: '09:00',
    closing_hour: '23:50',
    is_ramadan_mode: false,
    ramadan_opening_hour: '18:00',
    ramadan_closing_hour: '02:00',
    is_open: true,
  });
  
  // Stock state
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockFilter, setStockFilter] = useState<string>('all');

  const handleLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchSettings();
      fetchStock();
    } else {
      Alert.alert('Erreur', 'Mot de passe incorrect');
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStock = async () => {
    try {
      const response = await api.get('/api/menu/stock');
      setStockItems(response.data);
    } catch (error) {
      console.error('Error fetching stock:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchSettings(), fetchStock()]).finally(() => {
      setRefreshing(false);
    });
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.put('/api/settings', settings);
      Alert.alert('Succès', 'Paramètres enregistrés');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const toggleStock = async (item: StockItem) => {
    const newStock = !item.in_stock;
    try {
      await api.put(`/api/menu/${item.item_id}/stock`, { in_stock: newStock });
      setStockItems(prev => 
        prev.map(i => i.item_id === item.item_id ? { ...i, in_stock: newStock } : i)
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le stock');
    }
  };

  const getCategoryName = (cat: string) => {
    const names: Record<string, string> = {
      'entrees': 'Entrées',
      'grillades': 'Grillades',
      'plats': 'Plats',
      'poissons': 'Poissons',
      'accompagnements': 'Accompagnements',
      'desserts': 'Desserts',
      'boissons': 'Boissons',
    };
    return names[cat] || cat;
  };

  const filteredStockItems = stockItems.filter(item => {
    if (stockFilter === 'all') return true;
    if (stockFilter === 'out') return !item.in_stock;
    return item.category === stockFilter;
  });

  const categories = ['all', 'out', ...new Set(stockItems.map(i => i.category))];

  // Login Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
          <View style={styles.loginContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
            </TouchableOpacity>

            <View style={styles.loginHeader}>
              <MaterialIcons name="settings" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Paramètres</Text>
              <Text style={styles.loginSubtitle}>Horaires & Stock</Text>
            </View>

            <View style={styles.loginForm}>
              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed" size={20} color={COLORS.gold} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe admin"
                  placeholderTextColor={COLORS.gray}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.loginButtonGradient}>
                  <Text style={styles.loginButtonText}>Accéder</Text>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.black} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'hours' && styles.tabButtonActive]}
            onPress={() => setActiveTab('hours')}
          >
            <Ionicons 
              name="time" 
              size={20} 
              color={activeTab === 'hours' ? COLORS.black : COLORS.gold} 
            />
            <Text style={[styles.tabText, activeTab === 'hours' && styles.tabTextActive]}>
              Horaires
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'stock' && styles.tabButtonActive]}
            onPress={() => setActiveTab('stock')}
          >
            <Ionicons 
              name="cube" 
              size={20} 
              color={activeTab === 'stock' ? COLORS.black : COLORS.gold} 
            />
            <Text style={[styles.tabText, activeTab === 'stock' && styles.tabTextActive]}>
              Stock
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
            }
          >
            {activeTab === 'hours' ? (
              /* Hours Tab */
              <View>
                {/* Restaurant Open/Closed Toggle */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons 
                        name={settings.is_open ? "storefront" : "storefront-outline"} 
                        size={24} 
                        color={settings.is_open ? COLORS.success : COLORS.error} 
                      />
                      <Text style={styles.cardTitle}>État du Restaurant</Text>
                    </View>
                  </View>
                  <View style={styles.toggleRow}>
                    <View>
                      <Text style={styles.toggleLabel}>
                        Restaurant {settings.is_open ? 'Ouvert' : 'Fermé'}
                      </Text>
                      <Text style={styles.toggleHint}>
                        {settings.is_open ? 'Les clients peuvent commander' : 'Commandes désactivées'}
                      </Text>
                    </View>
                    <Switch
                      value={settings.is_open}
                      onValueChange={(value) => setSettings({ ...settings, is_open: value })}
                      trackColor={{ false: COLORS.error, true: COLORS.success }}
                      thumbColor={COLORS.white}
                    />
                  </View>
                </View>

                {/* Normal Hours */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name="sunny" size={24} color={COLORS.gold} />
                      <Text style={styles.cardTitle}>Horaires Normaux</Text>
                    </View>
                  </View>
                  
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Ouverture</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={settings.opening_hour}
                        onChangeText={(text) => setSettings({ ...settings, opening_hour: text })}
                        placeholder="09:00"
                        placeholderTextColor={COLORS.gray}
                      />
                    </View>
                    <View style={styles.timeSeparator}>
                      <Text style={styles.timeSeparatorText}>→</Text>
                    </View>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Fermeture</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={settings.closing_hour}
                        onChangeText={(text) => setSettings({ ...settings, closing_hour: text })}
                        placeholder="23:50"
                        placeholderTextColor={COLORS.gray}
                      />
                    </View>
                  </View>
                </View>

                {/* Ramadan Mode */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name="moon" size={24} color={COLORS.goldLight} />
                      <Text style={styles.cardTitle}>Mode Ramadan</Text>
                    </View>
                  </View>
                  
                  <View style={styles.toggleRow}>
                    <View>
                      <Text style={styles.toggleLabel}>Activer le mode Ramadan</Text>
                      <Text style={styles.toggleHint}>Utilise les horaires spéciaux ci-dessous</Text>
                    </View>
                    <Switch
                      value={settings.is_ramadan_mode}
                      onValueChange={(value) => setSettings({ ...settings, is_ramadan_mode: value })}
                      trackColor={{ false: COLORS.blackMedium, true: COLORS.gold }}
                      thumbColor={COLORS.white}
                    />
                  </View>

                  {settings.is_ramadan_mode && (
                    <View style={[styles.timeRow, { marginTop: 16 }]}>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Ouverture (Iftar)</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={settings.ramadan_opening_hour}
                          onChangeText={(text) => setSettings({ ...settings, ramadan_opening_hour: text })}
                          placeholder="18:00"
                          placeholderTextColor={COLORS.gray}
                        />
                      </View>
                      <View style={styles.timeSeparator}>
                        <Text style={styles.timeSeparatorText}>→</Text>
                      </View>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Fermeture</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={settings.ramadan_closing_hour}
                          onChangeText={(text) => setSettings({ ...settings, ramadan_closing_hour: text })}
                          placeholder="02:00"
                          placeholderTextColor={COLORS.gray}
                        />
                      </View>
                    </View>
                  )}
                </View>

                {/* Save Button */}
                <TouchableOpacity style={styles.saveButton} onPress={saveSettings} disabled={saving}>
                  <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveButtonGradient}>
                    {saving ? (
                      <ActivityIndicator color={COLORS.black} />
                    ) : (
                      <>
                        <Ionicons name="save" size={20} color={COLORS.black} />
                        <Text style={styles.saveButtonText}>Enregistrer</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              /* Stock Tab */
              <View>
                {/* Stock Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stockItems.length}</Text>
                    <Text style={styles.statLabel}>Articles</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: COLORS.success }]}>
                      {stockItems.filter(i => i.in_stock).length}
                    </Text>
                    <Text style={styles.statLabel}>En stock</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: COLORS.error }]}>
                      {stockItems.filter(i => !i.in_stock).length}
                    </Text>
                    <Text style={styles.statLabel}>Rupture</Text>
                  </View>
                </View>

                {/* Category Filter */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                  contentContainerStyle={styles.filterContent}
                >
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.filterChip,
                        stockFilter === cat && styles.filterChipActive
                      ]}
                      onPress={() => setStockFilter(cat)}
                    >
                      <Text style={[
                        styles.filterChipText,
                        stockFilter === cat && styles.filterChipTextActive
                      ]}>
                        {cat === 'all' ? 'Tous' : cat === 'out' ? 'Ruptures' : getCategoryName(cat)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Stock List */}
                {filteredStockItems.map((item) => (
                  <View key={item.item_id} style={styles.stockCard}>
                    <View style={styles.stockInfo}>
                      <Text style={styles.stockName}>{item.name}</Text>
                      <Text style={styles.stockCategory}>{getCategoryName(item.category)}</Text>
                    </View>
                    <View style={styles.stockToggle}>
                      <Text style={[
                        styles.stockStatus,
                        { color: item.in_stock ? COLORS.success : COLORS.error }
                      ]}>
                        {item.in_stock ? 'En stock' : 'Rupture'}
                      </Text>
                      <Switch
                        value={item.in_stock}
                        onValueChange={() => toggleStock(item)}
                        trackColor={{ false: COLORS.error, true: COLORS.success }}
                        thumbColor={COLORS.white}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  gradient: { flex: 1 },

  // Login
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  backButton: { position: 'absolute', top: 20, left: 0 },
  loginHeader: { alignItems: 'center', marginBottom: 40 },
  loginTitle: { fontSize: 32, fontWeight: 'bold', color: COLORS.gold, marginTop: 16 },
  loginSubtitle: { fontSize: 16, color: COLORS.gray, marginTop: 8 },
  loginForm: { marginBottom: 20 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  input: { flex: 1, height: 50, color: COLORS.white, fontSize: 16, marginLeft: 12 },
  loginButton: { borderRadius: 12, overflow: 'hidden' },
  loginButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  loginButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.black, marginRight: 8 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.2)' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },

  // Tab Navigation
  tabNav: { flexDirection: 'row', padding: 16, gap: 12 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.blackMedium, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  tabButtonActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabText: { fontSize: 15, fontWeight: '600', color: COLORS.gold, marginLeft: 8 },
  tabTextActive: { color: COLORS.black },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Content
  content: { flex: 1 },
  contentContainer: { padding: 16 },

  // Card
  card: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  cardHeader: { marginBottom: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white, marginLeft: 12 },

  // Toggle Row
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 16, color: COLORS.white, fontWeight: '500' },
  toggleHint: { fontSize: 13, color: COLORS.gray, marginTop: 4 },

  // Time Fields
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 13, color: COLORS.gold, marginBottom: 8 },
  timeInput: { backgroundColor: COLORS.blackLight, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: 18, fontWeight: '600', textAlign: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  timeSeparator: { paddingHorizontal: 16, paddingTop: 24 },
  timeSeparatorText: { fontSize: 20, color: COLORS.gold },

  // Save Button
  saveButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, marginLeft: 8 },

  // Stats Row
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 14, marginHorizontal: 4, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },

  // Filter
  filterScroll: { marginBottom: 16 },
  filterContent: { paddingHorizontal: 4 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.blackMedium, marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  filterChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterChipText: { fontSize: 14, color: COLORS.gold, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.black },

  // Stock Card
  stockCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
  stockInfo: { flex: 1, marginRight: 12 },
  stockName: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  stockCategory: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  stockToggle: { flexDirection: 'row', alignItems: 'center' },
  stockStatus: { fontSize: 12, fontWeight: '600', marginRight: 10 },
});
