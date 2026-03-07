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
  Modal,
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

// Admin password (simple protection)
const ADMIN_PASSWORD = 'kiza2024admin';

interface Driver {
  id: string;
  username: string;
  full_name: string;
  phone: string;
  email?: string;
  status: string;
  total_deliveries: number;
  created_at: string;
}

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Add driver modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDriver, setNewDriver] = useState({
    username: '',
    password: 'kiza2024',
    full_name: '',
    phone: '',
    email: '',
  });
  const [addingDriver, setAddingDriver] = useState(false);

  // Edit driver modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const handleLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchDrivers();
    } else {
      Alert.alert('Erreur', 'Mot de passe incorrect');
    }
  };

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/drivers');
      setDrivers(response.data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      Alert.alert('Erreur', 'Impossible de charger les livreurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDrivers();
  };

  const generateUsername = (fullName: string) => {
    const parts = fullName.toLowerCase().trim().split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[parts.length - 1];
    }
    return parts[0].substring(0, 8);
  };

  const handleAddDriver = async () => {
    if (!newDriver.full_name.trim() || !newDriver.phone.trim()) {
      Alert.alert('Erreur', 'Nom et téléphone sont obligatoires');
      return;
    }

    const username = newDriver.username || generateUsername(newDriver.full_name);

    try {
      setAddingDriver(true);
      await api.post('/api/drivers/register', {
        ...newDriver,
        username,
      });
      Alert.alert('Succès', `Livreur "${newDriver.full_name}" créé!\n\nIdentifiant: ${username}\nMot de passe: ${newDriver.password}`);
      setShowAddModal(false);
      setNewDriver({
        username: '',
        password: 'kiza2024',
        full_name: '',
        phone: '',
        email: '',
      });
      fetchDrivers();
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erreur lors de la création';
      Alert.alert('Erreur', message);
    } finally {
      setAddingDriver(false);
    }
  };

  const handleDeleteDriver = (driver: Driver) => {
    Alert.alert(
      'Supprimer le livreur',
      `Voulez-vous vraiment supprimer "${driver.full_name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/drivers/${driver.id}`);
              Alert.alert('Succès', 'Livreur supprimé');
              fetchDrivers();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le livreur');
            }
          },
        },
      ]
    );
  };

  const toggleDriverStatus = async (driver: Driver) => {
    const newStatus = driver.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/api/drivers/${driver.id}/status?status=${newStatus}`);
      fetchDrivers();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le statut');
    }
  };

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
              <FontAwesome5 name="user-shield" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Administration</Text>
              <Text style={styles.loginSubtitle}>Gestion des livreurs</Text>
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

  // Main Admin Panel
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Administration</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle" size={28} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.adminNav}>
          <TouchableOpacity
            style={styles.adminNavButton}
            onPress={() => router.push('/orders-management')}
          >
            <LinearGradient colors={[COLORS.warning, '#E65100']} style={styles.adminNavGradient}>
              <Ionicons name="receipt" size={24} color="#fff" />
              <Text style={styles.adminNavText}>Commandes</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={[styles.adminNavButton, styles.adminNavButtonActive]}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.adminNavGradient}>
              <Ionicons name="people" size={24} color={COLORS.black} />
              <Text style={[styles.adminNavText, { color: COLORS.black }]}>Livreurs</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{drivers.length}</Text>
            <Text style={styles.statLabel}>Livreurs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{drivers.filter(d => d.status === 'active').length}</Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{drivers.reduce((sum, d) => sum + d.total_deliveries, 0)}</Text>
            <Text style={styles.statLabel}>Livraisons</Text>
          </View>
        </View>

        {/* Drivers List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <ScrollView
            style={styles.driversList}
            contentContainerStyle={styles.driversContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
            }
          >
            {drivers.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="users" size={48} color={COLORS.gray} />
                <Text style={styles.emptyText}>Aucun livreur</Text>
                <Text style={styles.emptySubtext}>Appuyez sur + pour ajouter</Text>
              </View>
            ) : (
              drivers.map((driver) => (
                <View key={driver.id} style={styles.driverCard}>
                  <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                      <FontAwesome5 name="user" size={20} color={COLORS.black} />
                    </View>
                    <View style={styles.driverDetails}>
                      <Text style={styles.driverName}>{driver.full_name}</Text>
                      <Text style={styles.driverUsername}>@{driver.username}</Text>
                      <Text style={styles.driverPhone}>{driver.phone}</Text>
                    </View>
                  </View>

                  <View style={styles.driverStats}>
                    <Text style={styles.driverDeliveries}>{driver.total_deliveries} livraisons</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: driver.status === 'active' ? COLORS.success + '30' : COLORS.error + '30' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: driver.status === 'active' ? COLORS.success : COLORS.error }
                      ]}>
                        {driver.status === 'active' ? 'Actif' : 'Inactif'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.driverActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.toggleButton]}
                      onPress={() => toggleDriverStatus(driver)}
                    >
                      <Ionicons 
                        name={driver.status === 'active' ? 'pause' : 'play'} 
                        size={18} 
                        color={COLORS.white} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteDriver(driver)}
                    >
                      <Ionicons name="trash" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Add Driver Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowAddModal(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Nouveau Livreur</Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ex: Mohamed Traoré"
                  placeholderTextColor={COLORS.gray}
                  value={newDriver.full_name}
                  onChangeText={(text) => setNewDriver({ ...newDriver, full_name: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Téléphone *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ex: 0612345678"
                  placeholderTextColor={COLORS.gray}
                  value={newDriver.phone}
                  onChangeText={(text) => setNewDriver({ ...newDriver, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Identifiant (auto-généré si vide)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ex: mtraore"
                  placeholderTextColor={COLORS.gray}
                  value={newDriver.username}
                  onChangeText={(text) => setNewDriver({ ...newDriver, username: text.toLowerCase() })}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mot de passe</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="kiza2024"
                  placeholderTextColor={COLORS.gray}
                  value={newDriver.password}
                  onChangeText={(text) => setNewDriver({ ...newDriver, password: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email (optionnel)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ex: email@exemple.com"
                  placeholderTextColor={COLORS.gray}
                  value={newDriver.email}
                  onChangeText={(text) => setNewDriver({ ...newDriver, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddDriver}
                disabled={addingDriver}
              >
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.submitGradient}>
                  {addingDriver ? (
                    <ActivityIndicator color={COLORS.black} />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={20} color={COLORS.black} />
                      <Text style={styles.submitText}>Créer le livreur</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  hint: { textAlign: 'center', color: COLORS.gray, fontSize: 12 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.2)' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },

  // Stats
  statsRow: { flexDirection: 'row', padding: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 14, marginHorizontal: 4, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Drivers List
  driversList: { flex: 1 },
  driversContent: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: COLORS.white, fontSize: 18, marginTop: 16 },
  emptySubtext: { color: COLORS.gray, fontSize: 14, marginTop: 8 },

  // Driver Card
  driverCard: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  driverInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  driverDetails: { flex: 1, marginLeft: 12 },
  driverName: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  driverUsername: { fontSize: 13, color: COLORS.gold, marginTop: 2 },
  driverPhone: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  driverStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  driverDeliveries: { color: COLORS.gray, fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600' },
  driverActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionButton: { padding: 10, borderRadius: 10, marginLeft: 8 },
  toggleButton: { backgroundColor: COLORS.gold },
  deleteButton: { backgroundColor: COLORS.error },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.blackLight, borderRadius: 20, padding: 24 },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold, textAlign: 'center', marginBottom: 24 },
  formGroup: { marginBottom: 16 },
  formLabel: { color: COLORS.gold, fontSize: 14, marginBottom: 8 },
  formInput: { backgroundColor: COLORS.blackMedium, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.white, fontSize: 15, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  submitButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  submitText: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, marginLeft: 8 },

  // Admin Navigation
  adminNav: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  adminNavButton: { flex: 1, marginHorizontal: 4, borderRadius: 12, overflow: 'hidden' },
  adminNavButtonActive: {},
  adminNavGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  adminNavText: { fontSize: 15, fontWeight: '600', color: '#fff', marginLeft: 8 },
});
