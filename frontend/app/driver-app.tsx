import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';

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
  warning: '#FF9800',
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

interface Driver {
  id: string;
  username: string;
  full_name: string;
  phone: string;
  email?: string;
  status: string;
  total_deliveries: number;
}

interface Order {
  id: string;
  order_number: string;
  items: any[];
  delivery_address: {
    full_name: string;
    phone: string;
    address: string;
    city: string;
    postal_code: string;
    additional_info?: string;
  };
  total_amount: number;
  delivery_fee: number;
  grand_total: number;
  status: string;
  created_at: string;
}

interface Stats {
  total_deliveries: number;
  today_deliveries: number;
  pending_deliveries: number;
}

export default function DriverAppScreen() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // App state
  const [currentTab, setCurrentTab] = useState<'orders' | 'scanner' | 'history' | 'profile'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Scanner state
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [showScannedModal, setShowScannedModal] = useState(false);

  // Check for existing session
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const storedDriver = await AsyncStorage.getItem('kiza_driver');
      if (storedDriver) {
        const driverData = JSON.parse(storedDriver);
        setDriver(driverData);
        setIsLoggedIn(true);
        fetchDriverData(driverData.id);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const fetchDriverData = async (driverId: string) => {
    try {
      setLoading(true);
      const [ordersRes, historyRes, statsRes] = await Promise.all([
        api.get(`/api/drivers/${driverId}/orders`),
        api.get(`/api/drivers/${driverId}/history`),
        api.get(`/api/drivers/${driverId}/stats`),
      ]);
      setOrders(ordersRes.data);
      setHistory(historyRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre identifiant et mot de passe');
      return;
    }

    try {
      setLoginLoading(true);
      const response = await api.post('/api/drivers/login', {
        username: username.trim(),
        password: password.trim(),
      });

      const driverData = response.data.driver;
      await AsyncStorage.setItem('kiza_driver', JSON.stringify(driverData));
      setDriver(driverData);
      setIsLoggedIn(true);
      fetchDriverData(driverData.id);
      Alert.alert('Bienvenue', `Bonjour ${driverData.full_name}!`);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Identifiants incorrects';
      Alert.alert('Erreur de connexion', message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('kiza_driver');
            setDriver(null);
            setIsLoggedIn(false);
            setUsername('');
            setPassword('');
            setOrders([]);
            setHistory([]);
            setStats(null);
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    if (driver) {
      setRefreshing(true);
      fetchDriverData(driver.id);
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    
    // Extract order ID from QR code URL
    // URL format: https://domain.com/navigate/{order_id}
    const match = data.match(/navigate\/([a-f0-9-]+)/i);
    
    if (match && match[1]) {
      const orderId = match[1];
      try {
        const response = await api.get(`/api/orders/${orderId}`);
        setScannedData(response.data);
        setShowScannedModal(true);
      } catch (error) {
        Alert.alert('Erreur', 'Commande non trouvée');
        setScanned(false);
      }
    } else {
      // Try to open the URL directly
      Linking.openURL(data).catch(() => {
        Alert.alert('QR Code', `Données: ${data}`);
      });
      setScanned(false);
    }
  };

  const openNavigation = (order: Order, app: 'waze' | 'google') => {
    const addr = order.delivery_address;
    const fullAddress = `${addr.address}, ${addr.postal_code} ${addr.city}, France`;
    const encodedAddress = encodeURIComponent(fullAddress);

    if (app === 'waze') {
      Linking.openURL(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
    }
  };

  const assignOrderToSelf = async (orderId: string) => {
    if (!driver) return;
    
    try {
      await api.put(`/api/orders/${orderId}/assign/${driver.id}`);
      Alert.alert('Succès', 'Commande assignée!');
      setShowScannedModal(false);
      setScanned(false);
      fetchDriverData(driver.id);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'assigner la commande');
    }
  };

  const markAsDelivered = async (orderId: string) => {
    if (!driver) return;
    
    try {
      await api.put(`/api/orders/${orderId}/deliver?driver_id=${driver.id}`);
      Alert.alert('Succès', 'Commande livrée!');
      fetchDriverData(driver.id);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de marquer comme livré');
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  // Loading screen
  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Login Screen
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
          <ScrollView contentContainerStyle={styles.loginContainer}>
            <View style={styles.loginLogo}>
              <FontAwesome5 name="crown" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>KIZA</Text>
              <Text style={styles.loginSubtitle}>Espace Livreur</Text>
            </View>

            <View style={styles.loginForm}>
              <View style={styles.inputGroup}>
                <Ionicons name="person" size={20} color={COLORS.gold} style={styles.inputIcon} />
                <TextInput
                  style={styles.loginInput}
                  placeholder="Identifiant"
                  placeholderTextColor={COLORS.gray}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed" size={20} color={COLORS.gold} style={styles.inputIcon} />
                <TextInput
                  style={styles.loginInput}
                  placeholder="Mot de passe"
                  placeholderTextColor={COLORS.gray}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={loginLoading}
              >
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.loginButtonGradient}>
                  {loginLoading ? (
                    <ActivityIndicator color={COLORS.black} />
                  ) : (
                    <>
                      <Ionicons name="log-in" size={22} color={COLORS.black} />
                      <Text style={styles.loginButtonText}>Se connecter</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.loginHelp}>
              Contactez l'admin pour obtenir vos identifiants
            </Text>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Main App - Orders Tab
  const renderOrders = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
      }
    >
      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.pending_deliveries}</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.today_deliveries}</Text>
            <Text style={styles.statLabel}>Aujourd'hui</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total_deliveries}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      )}

      {/* Assigned Orders */}
      <Text style={styles.sectionTitle}>Mes Commandes</Text>
      
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color={COLORS.gray} />
          <Text style={styles.emptyText}>Aucune commande assignée</Text>
          <Text style={styles.emptySubtext}>Scannez un QR code pour prendre une commande</Text>
        </View>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderNumber}>#{order.order_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: COLORS.gold + '30' }]}>
                <Text style={[styles.statusText, { color: COLORS.gold }]}>
                  {order.status === 'confirmed' ? 'Confirmée' : 
                   order.status === 'preparing' ? 'En préparation' : 'En livraison'}
                </Text>
              </View>
            </View>

            <View style={styles.customerInfo}>
              <Ionicons name="person" size={16} color={COLORS.gold} />
              <Text style={styles.customerName}>{order.delivery_address.full_name}</Text>
              <TouchableOpacity onPress={() => callCustomer(order.delivery_address.phone)}>
                <Ionicons name="call" size={20} color={COLORS.success} />
              </TouchableOpacity>
            </View>

            <View style={styles.addressInfo}>
              <Ionicons name="location" size={16} color={COLORS.gold} />
              <Text style={styles.addressText}>
                {order.delivery_address.address}, {order.delivery_address.postal_code} {order.delivery_address.city}
              </Text>
            </View>

            <View style={styles.orderTotal}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>{order.grand_total.toFixed(2)}€</Text>
            </View>

            <View style={styles.orderActions}>
              <TouchableOpacity
                style={styles.wazeBtn}
                onPress={() => openNavigation(order, 'waze')}
              >
                <FontAwesome5 name="waze" size={16} color="#fff" />
                <Text style={styles.navBtnText}>Waze</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gmapsBtn}
                onPress={() => openNavigation(order, 'google')}
              >
                <FontAwesome5 name="google" size={16} color="#fff" />
                <Text style={styles.navBtnText}>Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deliveredBtn}
                onPress={() => markAsDelivered(order.id)}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.deliveredBtnText}>Livré</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // Scanner Tab
  const renderScanner = () => {
    if (!permission) {
      return (
        <View style={styles.scannerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.scannerContainer}>
          <Ionicons name="camera-outline" size={64} color={COLORS.gray} />
          <Text style={styles.scannerPermissionText}>
            Permission caméra requise pour scanner les QR codes
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.permissionButtonGradient}>
              <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame}>
              <View style={[styles.scannerCorner, styles.topLeft]} />
              <View style={[styles.scannerCorner, styles.topRight]} />
              <View style={[styles.scannerCorner, styles.bottomLeft]} />
              <View style={[styles.scannerCorner, styles.bottomRight]} />
            </View>
            <Text style={styles.scannerHint}>Placez le QR code dans le cadre</Text>
          </View>
        </CameraView>

        {scanned && (
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.rescanButtonGradient}>
              <Ionicons name="refresh" size={20} color={COLORS.black} />
              <Text style={styles.rescanButtonText}>Scanner à nouveau</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // History Tab
  const renderHistory = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
      }
    >
      <Text style={styles.sectionTitle}>Historique des livraisons</Text>
      
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={COLORS.gray} />
          <Text style={styles.emptyText}>Aucune livraison effectuée</Text>
        </View>
      ) : (
        history.map((order) => (
          <View key={order.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyNumber}>#{order.order_number}</Text>
              <Text style={styles.historyDate}>
                {new Date(order.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <Text style={styles.historyAddress}>
              {order.delivery_address.address}, {order.delivery_address.city}
            </Text>
            <Text style={styles.historyTotal}>{order.grand_total.toFixed(2)}€</Text>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // Profile Tab
  const renderProfile = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <FontAwesome5 name="user" size={40} color={COLORS.black} />
        </View>
        <Text style={styles.profileName}>{driver?.full_name}</Text>
        <Text style={styles.profileUsername}>@{driver?.username}</Text>
      </View>

      <View style={styles.profileInfo}>
        <View style={styles.profileRow}>
          <Ionicons name="call" size={20} color={COLORS.gold} />
          <Text style={styles.profileLabel}>Téléphone</Text>
          <Text style={styles.profileValue}>{driver?.phone}</Text>
        </View>
        {driver?.email && (
          <View style={styles.profileRow}>
            <Ionicons name="mail" size={20} color={COLORS.gold} />
            <Text style={styles.profileLabel}>Email</Text>
            <Text style={styles.profileValue}>{driver?.email}</Text>
          </View>
        )}
        <View style={styles.profileRow}>
          <Ionicons name="bicycle" size={20} color={COLORS.gold} />
          <Text style={styles.profileLabel}>Livraisons totales</Text>
          <Text style={styles.profileValue}>{driver?.total_deliveries || 0}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Scanned Order Modal
  const renderScannedModal = () => (
    <Modal
      visible={showScannedModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setShowScannedModal(false);
        setScanned(false);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => {
              setShowScannedModal(false);
              setScanned(false);
            }}
          >
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>

          {scannedData && (
            <>
              <Text style={styles.modalTitle}>Commande trouvée!</Text>
              <Text style={styles.modalOrderNumber}>#{scannedData.order_number}</Text>

              <View style={styles.modalAddress}>
                <Ionicons name="location" size={20} color={COLORS.gold} />
                <View>
                  <Text style={styles.modalCustomer}>{scannedData.delivery_address.full_name}</Text>
                  <Text style={styles.modalAddressText}>{scannedData.delivery_address.address}</Text>
                  <Text style={styles.modalCity}>
                    {scannedData.delivery_address.postal_code} {scannedData.delivery_address.city}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalTotal}>Total: {scannedData.grand_total?.toFixed(2)}€</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalWazeBtn}
                  onPress={() => openNavigation(scannedData, 'waze')}
                >
                  <FontAwesome5 name="waze" size={18} color="#fff" />
                  <Text style={styles.modalNavText}>Waze</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalGmapsBtn}
                  onPress={() => openNavigation(scannedData, 'google')}
                >
                  <FontAwesome5 name="google" size={18} color="#fff" />
                  <Text style={styles.modalNavText}>Maps</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => assignOrderToSelf(scannedData.id)}
              >
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.assignButtonGradient}>
                  <Ionicons name="add-circle" size={20} color={COLORS.black} />
                  <Text style={styles.assignButtonText}>Prendre cette commande</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // Main App Layout
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <FontAwesome5 name="crown" size={18} color={COLORS.gold} />
            <Text style={styles.headerTitle}>KIZA Livreur</Text>
          </View>
          <Text style={styles.headerName}>{driver?.full_name}</Text>
        </View>

        {/* Tab Content */}
        {currentTab === 'orders' && renderOrders()}
        {currentTab === 'scanner' && renderScanner()}
        {currentTab === 'history' && renderHistory()}
        {currentTab === 'profile' && renderProfile()}

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navItem, currentTab === 'orders' && styles.navItemActive]}
            onPress={() => setCurrentTab('orders')}
          >
            <Ionicons name="list" size={22} color={currentTab === 'orders' ? COLORS.gold : COLORS.gray} />
            <Text style={[styles.navText, currentTab === 'orders' && styles.navTextActive]}>Commandes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentTab === 'scanner' && styles.navItemActive]}
            onPress={() => setCurrentTab('scanner')}
          >
            <Ionicons name="qr-code" size={22} color={currentTab === 'scanner' ? COLORS.gold : COLORS.gray} />
            <Text style={[styles.navText, currentTab === 'scanner' && styles.navTextActive]}>Scanner</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentTab === 'history' && styles.navItemActive]}
            onPress={() => setCurrentTab('history')}
          >
            <Ionicons name="time" size={22} color={currentTab === 'history' ? COLORS.gold : COLORS.gray} />
            <Text style={[styles.navText, currentTab === 'history' && styles.navTextActive]}>Historique</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentTab === 'profile' && styles.navItemActive]}
            onPress={() => setCurrentTab('profile')}
          >
            <Ionicons name="person" size={22} color={currentTab === 'profile' ? COLORS.gold : COLORS.gray} />
            <Text style={[styles.navText, currentTab === 'profile' && styles.navTextActive]}>Profil</Text>
          </TouchableOpacity>
        </View>

        {renderScannedModal()}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Login Styles
  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginLogo: {
    alignItems: 'center',
    marginBottom: 48,
  },
  loginTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 8,
    marginTop: 16,
  },
  loginSubtitle: {
    fontSize: 16,
    color: COLORS.gray,
    letterSpacing: 4,
    marginTop: 8,
  },
  loginForm: {
    marginBottom: 24,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  inputIcon: {
    marginRight: 12,
  },
  loginInput: {
    flex: 1,
    height: 50,
    color: COLORS.white,
    fontSize: 16,
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginLeft: 8,
  },
  loginHelp: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginLeft: 8,
    letterSpacing: 2,
  },
  headerName: {
    color: COLORS.gray,
    fontSize: 14,
  },

  // Tab Content
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },

  // Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 16,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    color: COLORS.gray,
    fontSize: 14,
    marginTop: 4,
  },

  // Order Card
  orderCard: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
    marginLeft: 8,
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    color: COLORS.gray,
    fontSize: 14,
    marginLeft: 8,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  totalLabel: {
    color: COLORS.white,
    fontSize: 14,
  },
  totalAmount: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderActions: {
    flexDirection: 'row',
  },
  wazeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#33CCFF',
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 6,
  },
  gmapsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 6,
  },
  deliveredBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 10,
    borderRadius: 8,
  },
  navBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  deliveredBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Scanner
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  scannerCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: COLORS.gold,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scannerHint: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 24,
  },
  scannerPermissionText: {
    color: COLORS.gray,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  permissionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  permissionButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: 'bold',
  },
  rescanButton: {
    position: 'absolute',
    bottom: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rescanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  rescanButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // History
  historyCard: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyNumber: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  historyDate: {
    color: COLORS.gray,
    fontSize: 12,
  },
  historyAddress: {
    color: COLORS.gray,
    fontSize: 13,
    marginBottom: 4,
  },
  historyTotal: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },

  // Profile
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileUsername: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  profileInfo: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  profileLabel: {
    flex: 1,
    color: COLORS.gray,
    fontSize: 14,
    marginLeft: 12,
  },
  profileValue: {
    color: COLORS.white,
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 12,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.blackMedium,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {},
  navText: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
  },
  navTextActive: {
    color: COLORS.gold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.blackLight,
    borderRadius: 24,
    padding: 24,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalOrderNumber: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalAddress: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalCustomer: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  modalAddressText: {
    color: COLORS.white,
    fontSize: 14,
    marginLeft: 12,
    marginTop: 4,
  },
  modalCity: {
    color: COLORS.gray,
    fontSize: 14,
    marginLeft: 12,
  },
  modalTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  modalWazeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#33CCFF',
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 8,
  },
  modalGmapsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalNavText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  assignButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  assignButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  assignButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
