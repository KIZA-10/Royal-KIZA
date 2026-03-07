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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

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

// API Configuration - Will be set based on environment
const getBackendUrl = () => {
  const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
    || process.env.EXPO_PUBLIC_BACKEND_URL 
    || '';
  return backendUrl;
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

export default function App() {
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

  // GPS Tracking state
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    checkExistingSession();
    requestLocationPermission();
  }, []);

  // GPS Tracking - Start when logged in
  useEffect(() => {
    if (isLoggedIn && driver && locationPermission) {
      startLocationTracking();
    }
    return () => {
      stopLocationTracking();
    };
  }, [isLoggedIn, driver, locationPermission]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status !== 'granted') {
        console.log('Location permission denied');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const startLocationTracking = async () => {
    if (!driver || isTracking) return;
    
    try {
      setIsTracking(true);
      
      // Watch position continuously
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, // Update every 3 seconds
          distanceInterval: 10, // Or when moved 10 meters
        },
        async (location) => {
          setCurrentLocation(location);
          
          // Send location to backend
          try {
            await api.put(`/api/drivers/${driver.id}/location`, {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setIsTracking(false);
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);
  };

  const checkExistingSession = async () => {
    try {
      const storedDriver = await AsyncStorage.getItem('kiza_driver_session');
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
      await AsyncStorage.setItem('kiza_driver_session', JSON.stringify(driverData));
      setDriver(driverData);
      setIsLoggedIn(true);
      fetchDriverData(driverData.id);
      Alert.alert('Bienvenue', `Bonjour ${driverData.full_name} !`);
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
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('kiza_driver_session');
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
      Linking.openURL(data).catch(() => {
        Alert.alert('QR Code scanné', `Données: ${data}`);
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
      Alert.alert('Succès', 'Commande assignée !');
      setShowScannedModal(false);
      setScanned(false);
      fetchDriverData(driver.id);
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'assigner la commande");
    }
  };

  const markAsDelivered = async (orderId: string) => {
    if (!driver) return;
    
    Alert.alert(
      'Confirmer la livraison',
      'Marquer cette commande comme livrée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              await api.put(`/api/orders/${orderId}/deliver?driver_id=${driver.id}`);
              Alert.alert('Succès', 'Commande livrée !');
              fetchDriverData(driver.id);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de marquer comme livré');
            }
          },
        },
      ]
    );
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/api/orders/${orderId}/status?status=${newStatus}`);
      fetchDriverData(driver!.id);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  // Loading screen
  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <FontAwesome5 name="crown" size={48} color={COLORS.gold} />
            <Text style={styles.loadingTitle}>KIZA Livreur</Text>
            <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 20 }} />
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
          <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.loginLogo}>
              <FontAwesome5 name="crown" size={56} color={COLORS.gold} />
              <Text style={styles.loginTitle}>KIZA</Text>
              <Text style={styles.loginSubtitle}>LIVREUR</Text>
            </View>

            <View style={styles.loginForm}>
              <View style={styles.inputGroup}>
                <Ionicons name="person" size={22} color={COLORS.gold} style={styles.inputIcon} />
                <TextInput
                  style={styles.loginInput}
                  placeholder="Identifiant"
                  placeholderTextColor={COLORS.gray}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed" size={22} color={COLORS.gold} style={styles.inputIcon} />
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
                      <Ionicons name="log-in" size={24} color={COLORS.black} />
                      <Text style={styles.loginButtonText}>Se connecter</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.loginFooter}>
              <Ionicons name="information-circle" size={18} color={COLORS.gray} />
              <Text style={styles.loginHelp}>
                Contactez l'administrateur pour{'\n'}obtenir vos identifiants
              </Text>
            </View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Orders Tab
  const renderOrders = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
      }
    >
      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color={COLORS.warning} />
            <Text style={styles.statNumber}>{stats.pending_deliveries}</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="today" size={24} color={COLORS.success} />
            <Text style={styles.statNumber}>{stats.today_deliveries}</Text>
            <Text style={styles.statLabel}>Aujourd'hui</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={24} color={COLORS.gold} />
            <Text style={styles.statNumber}>{stats.total_deliveries}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Mes Commandes</Text>
      
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyText}>Aucune commande assignée</Text>
          <Text style={styles.emptySubtext}>Scannez un QR code pour prendre une commande</Text>
          <TouchableOpacity 
            style={styles.scanPromptButton}
            onPress={() => setCurrentTab('scanner')}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.scanPromptGradient}>
              <Ionicons name="qr-code" size={20} color={COLORS.black} />
              <Text style={styles.scanPromptText}>Scanner un QR code</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderNumber}>#{order.order_number}</Text>
                <Text style={styles.orderDate}>
                  {new Date(order.created_at).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
              </View>
              <View style={[styles.statusBadge, { 
                backgroundColor: order.status === 'delivering' ? COLORS.success + '30' : COLORS.gold + '30' 
              }]}>
                <Ionicons 
                  name={order.status === 'delivering' ? 'car' : 'restaurant'} 
                  size={14} 
                  color={order.status === 'delivering' ? COLORS.success : COLORS.gold} 
                />
                <Text style={[styles.statusText, { 
                  color: order.status === 'delivering' ? COLORS.success : COLORS.gold 
                }]}>
                  {order.status === 'confirmed' ? 'Confirmée' : 
                   order.status === 'preparing' ? 'Préparation' : 'En livraison'}
                </Text>
              </View>
            </View>

            <View style={styles.customerSection}>
              <View style={styles.customerInfo}>
                <Ionicons name="person" size={18} color={COLORS.gold} />
                <Text style={styles.customerName}>{order.delivery_address.full_name}</Text>
              </View>
              <TouchableOpacity 
                style={styles.callButton}
                onPress={() => callCustomer(order.delivery_address.phone)}
              >
                <Ionicons name="call" size={20} color={COLORS.black} />
              </TouchableOpacity>
            </View>

            <View style={styles.addressSection}>
              <Ionicons name="location" size={18} color={COLORS.gold} />
              <View style={styles.addressInfo}>
                <Text style={styles.addressText}>{order.delivery_address.address}</Text>
                <Text style={styles.addressCity}>
                  {order.delivery_address.postal_code} {order.delivery_address.city}
                </Text>
              </View>
            </View>

            {/* Order Items */}
            <View style={styles.itemsSection}>
              <Text style={styles.itemsTitle}>Articles:</Text>
              {order.items.map((item, idx) => (
                <Text key={idx} style={styles.itemText}>
                  {item.quantity}x {item.name}
                </Text>
              ))}
            </View>

            <View style={styles.orderTotal}>
              <Text style={styles.totalLabel}>Total à encaisser:</Text>
              <Text style={styles.totalAmount}>{order.grand_total.toFixed(2)}€</Text>
            </View>

            {/* Navigation Buttons */}
            <View style={styles.navButtons}>
              <TouchableOpacity
                style={styles.wazeBtn}
                onPress={() => openNavigation(order, 'waze')}
              >
                <FontAwesome5 name="waze" size={18} color="#fff" />
                <Text style={styles.navBtnText}>Waze</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gmapsBtn}
                onPress={() => openNavigation(order, 'google')}
              >
                <FontAwesome5 name="google" size={18} color="#fff" />
                <Text style={styles.navBtnText}>Maps</Text>
              </TouchableOpacity>
            </View>

            {/* Status Update Button */}
            {order.status === 'confirmed' && (
              <TouchableOpacity
                style={styles.statusButton}
                onPress={() => updateOrderStatus(order.id, 'preparing')}
              >
                <LinearGradient colors={[COLORS.warning, '#E65100']} style={styles.statusButtonGradient}>
                  <Ionicons name="restaurant" size={18} color="#fff" />
                  <Text style={styles.statusButtonText}>Commencer préparation</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {order.status === 'preparing' && (
              <TouchableOpacity
                style={styles.statusButton}
                onPress={() => updateOrderStatus(order.id, 'delivering')}
              >
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.statusButtonGradient}>
                  <Ionicons name="car" size={18} color={COLORS.black} />
                  <Text style={[styles.statusButtonText, { color: COLORS.black }]}>Partir en livraison</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {order.status === 'delivering' && (
              <TouchableOpacity
                style={styles.statusButton}
                onPress={() => markAsDelivered(order.id)}
              >
                <LinearGradient colors={[COLORS.success, '#2E7D32']} style={styles.statusButtonGradient}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.statusButtonText}>Marquer comme livré</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
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
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={72} color={COLORS.gold} />
            <Text style={styles.permissionTitle}>Accès caméra requis</Text>
            <Text style={styles.permissionText}>
              Pour scanner les QR codes des commandes, autorisez l'accès à la caméra
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.permissionButtonGradient}>
                <Ionicons name="camera" size={20} color={COLORS.black} />
                <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
            <Text style={styles.scannerTitle}>Scanner le QR code</Text>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scannerHint}>Placez le QR code dans le cadre</Text>
          </View>
        </CameraView>

        {scanned && (
          <View style={styles.rescanContainer}>
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={() => setScanned(false)}
            >
              <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.rescanGradient}>
                <Ionicons name="refresh" size={22} color={COLORS.black} />
                <Text style={styles.rescanText}>Scanner à nouveau</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // History Tab
  const renderHistory = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
      }
    >
      <Text style={styles.sectionTitle}>Historique des livraisons</Text>
      
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyText}>Aucune livraison effectuée</Text>
          <Text style={styles.emptySubtext}>Vos livraisons terminées apparaîtront ici</Text>
        </View>
      ) : (
        history.map((order) => (
          <View key={order.id} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyNumber}>#{order.order_number}</Text>
                <Text style={styles.historyCustomer}>{order.delivery_address.full_name}</Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyTotal}>{order.grand_total.toFixed(2)}€</Text>
                <Text style={styles.historyDate}>
                  {new Date(order.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </View>
            <View style={styles.historyAddress}>
              <Ionicons name="location-outline" size={14} color={COLORS.gray} />
              <Text style={styles.historyAddressText}>
                {order.delivery_address.address}, {order.delivery_address.city}
              </Text>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // Profile Tab
  const renderProfile = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
      <View style={styles.profileHeader}>
        <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.profileAvatar}>
          <FontAwesome5 name="user" size={40} color={COLORS.black} />
        </LinearGradient>
        <Text style={styles.profileName}>{driver?.full_name}</Text>
        <Text style={styles.profileUsername}>@{driver?.username}</Text>
        <View style={styles.profileStatusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.profileStatusText}>En service</Text>
        </View>
      </View>

      <View style={styles.profileStats}>
        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatNumber}>{stats?.total_deliveries || 0}</Text>
          <Text style={styles.profileStatLabel}>Livraisons totales</Text>
        </View>
        <View style={styles.profileStatDivider} />
        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatNumber}>{stats?.today_deliveries || 0}</Text>
          <Text style={styles.profileStatLabel}>Aujourd'hui</Text>
        </View>
      </View>

      <View style={styles.profileInfo}>
        <View style={styles.profileRow}>
          <Ionicons name="call" size={22} color={COLORS.gold} />
          <View style={styles.profileRowContent}>
            <Text style={styles.profileLabel}>Téléphone</Text>
            <Text style={styles.profileValue}>{driver?.phone}</Text>
          </View>
        </View>
        {driver?.email && (
          <View style={styles.profileRow}>
            <Ionicons name="mail" size={22} color={COLORS.gold} />
            <View style={styles.profileRowContent}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{driver?.email}</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={22} color={COLORS.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>KIZA Livreur v1.0.0</Text>
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
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>

          {scannedData && (
            <>
              <View style={styles.modalHeader}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.modalTitle}>Commande trouvée !</Text>
                <Text style={styles.modalOrderNumber}>#{scannedData.order_number}</Text>
              </View>

              <View style={styles.modalAddress}>
                <Ionicons name="location" size={24} color={COLORS.gold} />
                <View style={styles.modalAddressContent}>
                  <Text style={styles.modalCustomer}>{scannedData.delivery_address.full_name}</Text>
                  <Text style={styles.modalAddressText}>{scannedData.delivery_address.address}</Text>
                  <Text style={styles.modalCity}>
                    {scannedData.delivery_address.postal_code} {scannedData.delivery_address.city}
                  </Text>
                  <Text style={styles.modalPhone}>📞 {scannedData.delivery_address.phone}</Text>
                </View>
              </View>

              <View style={styles.modalTotal}>
                <Text style={styles.modalTotalLabel}>Total à encaisser</Text>
                <Text style={styles.modalTotalAmount}>{scannedData.grand_total?.toFixed(2)}€</Text>
              </View>

              <View style={styles.modalNavButtons}>
                <TouchableOpacity
                  style={styles.modalWazeBtn}
                  onPress={() => openNavigation(scannedData, 'waze')}
                >
                  <FontAwesome5 name="waze" size={20} color="#fff" />
                  <Text style={styles.modalNavText}>Waze</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalGmapsBtn}
                  onPress={() => openNavigation(scannedData, 'google')}
                >
                  <FontAwesome5 name="google" size={20} color="#fff" />
                  <Text style={styles.modalNavText}>Maps</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => assignOrderToSelf(scannedData.id)}
              >
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.assignGradient}>
                  <Ionicons name="add-circle" size={22} color={COLORS.black} />
                  <Text style={styles.assignText}>Prendre cette commande</Text>
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
            <FontAwesome5 name="crown" size={20} color={COLORS.gold} />
            <Text style={styles.headerTitle}>KIZA Livreur</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerName}>{driver?.full_name.split(' ')[0]}</Text>
          </View>
        </View>

        {/* Tab Content */}
        {currentTab === 'orders' && renderOrders()}
        {currentTab === 'scanner' && renderScanner()}
        {currentTab === 'history' && renderHistory()}
        {currentTab === 'profile' && renderProfile()}

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('orders')}
          >
            <Ionicons 
              name={currentTab === 'orders' ? 'list' : 'list-outline'} 
              size={24} 
              color={currentTab === 'orders' ? COLORS.gold : COLORS.gray} 
            />
            <Text style={[styles.navText, currentTab === 'orders' && styles.navTextActive]}>
              Commandes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItemCenter}
            onPress={() => setCurrentTab('scanner')}
          >
            <LinearGradient 
              colors={currentTab === 'scanner' ? [COLORS.gold, COLORS.goldDark] : [COLORS.blackMedium, COLORS.blackMedium]} 
              style={styles.navItemCenterGradient}
            >
              <Ionicons 
                name="qr-code" 
                size={28} 
                color={currentTab === 'scanner' ? COLORS.black : COLORS.gold} 
              />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('history')}
          >
            <Ionicons 
              name={currentTab === 'history' ? 'time' : 'time-outline'} 
              size={24} 
              color={currentTab === 'history' ? COLORS.gold : COLORS.gray} 
            />
            <Text style={[styles.navText, currentTab === 'history' && styles.navTextActive]}>
              Historique
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('profile')}
          >
            <Ionicons 
              name={currentTab === 'profile' ? 'person' : 'person-outline'} 
              size={24} 
              color={currentTab === 'profile' ? COLORS.gold : COLORS.gray} 
            />
            <Text style={[styles.navText, currentTab === 'profile' && styles.navTextActive]}>
              Profil
            </Text>
          </TouchableOpacity>
        </View>

        {renderScannedModal()}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  gradient: { flex: 1 },
  
  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.gold, marginTop: 16, letterSpacing: 4 },

  // Login
  loginContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  loginLogo: { alignItems: 'center', marginBottom: 48 },
  loginTitle: { fontSize: 48, fontWeight: 'bold', color: COLORS.gold, letterSpacing: 12, marginTop: 16 },
  loginSubtitle: { fontSize: 18, color: COLORS.goldLight, letterSpacing: 8, marginTop: 4 },
  loginForm: { marginBottom: 32 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 16, marginBottom: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  inputIcon: { marginRight: 14 },
  loginInput: { flex: 1, height: 56, color: COLORS.white, fontSize: 17 },
  loginButton: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  loginButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  loginButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.black, marginLeft: 10 },
  loginFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loginHelp: { color: COLORS.gray, fontSize: 14, marginLeft: 8, textAlign: 'center', lineHeight: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.2)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold, marginLeft: 10, letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerName: { color: COLORS.white, fontSize: 14, marginLeft: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },

  // Tabs
  tabContent: { flex: 1 },
  tabContentContainer: { padding: 16 },

  // Stats
  statsContainer: { flexDirection: 'row', marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: COLORS.white, marginTop: 8 },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },

  // Section
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white, marginBottom: 16 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: COLORS.white, fontSize: 18, marginTop: 16 },
  emptySubtext: { color: COLORS.gray, fontSize: 14, marginTop: 8, textAlign: 'center' },
  scanPromptButton: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  scanPromptGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  scanPromptText: { color: COLORS.black, fontSize: 16, fontWeight: '600', marginLeft: 8 },

  // Order Card
  orderCard: { backgroundColor: COLORS.blackMedium, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  orderNumber: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold },
  orderDate: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', marginLeft: 6 },
  customerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  customerName: { color: COLORS.white, fontSize: 16, fontWeight: '600', marginLeft: 10 },
  callButton: { backgroundColor: COLORS.gold, padding: 10, borderRadius: 12 },
  addressSection: { flexDirection: 'row', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 14, borderRadius: 12, marginBottom: 12 },
  addressInfo: { flex: 1, marginLeft: 12 },
  addressText: { color: COLORS.white, fontSize: 15 },
  addressCity: { color: COLORS.gray, fontSize: 14, marginTop: 2 },
  itemsSection: { marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  itemsTitle: { color: COLORS.gray, fontSize: 12, marginBottom: 6 },
  itemText: { color: COLORS.white, fontSize: 14, marginBottom: 2 },
  orderTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginBottom: 14 },
  totalLabel: { color: COLORS.gray, fontSize: 14 },
  totalAmount: { color: COLORS.gold, fontSize: 22, fontWeight: 'bold' },
  navButtons: { flexDirection: 'row', marginBottom: 12 },
  wazeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#33CCFF', paddingVertical: 12, borderRadius: 12, marginRight: 8 },
  gmapsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4285F4', paddingVertical: 12, borderRadius: 12 },
  navBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  statusButton: { borderRadius: 12, overflow: 'hidden' },
  statusButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  statusButtonText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 },

  // Scanner
  scannerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permissionBox: { alignItems: 'center', padding: 32, backgroundColor: COLORS.blackMedium, borderRadius: 24, margin: 20 },
  permissionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white, marginTop: 20, marginBottom: 12 },
  permissionText: { color: COLORS.gray, fontSize: 15, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  permissionButton: { borderRadius: 12, overflow: 'hidden' },
  permissionButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  permissionButtonText: { color: COLORS.black, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  camera: { flex: 1, width: '100%' },
  scannerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  scannerTitle: { color: COLORS.white, fontSize: 22, fontWeight: 'bold', marginBottom: 32 },
  scannerFrame: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 50, height: 50, borderColor: COLORS.gold },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scannerHint: { color: COLORS.gray, fontSize: 16, marginTop: 32 },
  rescanContainer: { position: 'absolute', bottom: 120 },
  rescanButton: { borderRadius: 16, overflow: 'hidden' },
  rescanGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 28 },
  rescanText: { color: COLORS.black, fontSize: 17, fontWeight: 'bold', marginLeft: 10 },

  // History
  historyCard: { backgroundColor: COLORS.blackMedium, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.1)' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  historyNumber: { color: COLORS.gold, fontSize: 15, fontWeight: '600' },
  historyCustomer: { color: COLORS.white, fontSize: 14, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyTotal: { color: COLORS.gold, fontSize: 16, fontWeight: 'bold' },
  historyDate: { color: COLORS.gray, fontSize: 12, marginTop: 2 },
  historyAddress: { flexDirection: 'row', alignItems: 'center' },
  historyAddressText: { color: COLORS.gray, fontSize: 13, marginLeft: 6, flex: 1 },

  // Profile
  profileHeader: { alignItems: 'center', paddingVertical: 32 },
  profileAvatar: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  profileName: { fontSize: 26, fontWeight: 'bold', color: COLORS.white },
  profileUsername: { fontSize: 15, color: COLORS.gray, marginTop: 4 },
  profileStatusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76, 175, 80, 0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 8 },
  profileStatusText: { color: COLORS.success, fontSize: 13, fontWeight: '600' },
  profileStats: { flexDirection: 'row', backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 20, marginBottom: 20 },
  profileStatItem: { flex: 1, alignItems: 'center' },
  profileStatNumber: { fontSize: 32, fontWeight: 'bold', color: COLORS.gold },
  profileStatLabel: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  profileStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20 },
  profileInfo: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 6, marginBottom: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  profileRowContent: { marginLeft: 14, flex: 1 },
  profileLabel: { color: COLORS.gray, fontSize: 12 },
  profileValue: { color: COLORS.white, fontSize: 16, marginTop: 2 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: 'rgba(244, 67, 54, 0.15)', borderRadius: 14 },
  logoutText: { color: COLORS.error, fontSize: 16, fontWeight: '600', marginLeft: 10 },
  versionText: { textAlign: 'center', color: COLORS.gray, fontSize: 12, marginTop: 24 },

  // Bottom Nav
  bottomNav: { flexDirection: 'row', backgroundColor: COLORS.blackMedium, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1, borderTopColor: 'rgba(212, 175, 55, 0.2)', alignItems: 'center' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navItemCenter: { marginTop: -20 },
  navItemCenterGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.black },
  navText: { fontSize: 11, color: COLORS.gray, marginTop: 4 },
  navTextActive: { color: COLORS.gold },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.blackLight, borderRadius: 28, padding: 24 },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.white, marginTop: 12 },
  modalOrderNumber: { fontSize: 16, color: COLORS.gray, marginTop: 4 },
  modalAddress: { flexDirection: 'row', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 18, borderRadius: 16, marginBottom: 20 },
  modalAddressContent: { flex: 1, marginLeft: 14 },
  modalCustomer: { color: COLORS.gold, fontSize: 18, fontWeight: '600' },
  modalAddressText: { color: COLORS.white, fontSize: 15, marginTop: 6 },
  modalCity: { color: COLORS.gray, fontSize: 14, marginTop: 2 },
  modalPhone: { color: COLORS.goldLight, fontSize: 14, marginTop: 8 },
  modalTotal: { alignItems: 'center', marginBottom: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTotalLabel: { color: COLORS.gray, fontSize: 14 },
  modalTotalAmount: { color: COLORS.gold, fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  modalNavButtons: { flexDirection: 'row', marginBottom: 16 },
  modalWazeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#33CCFF', paddingVertical: 14, borderRadius: 14, marginRight: 10 },
  modalGmapsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4285F4', paddingVertical: 14, borderRadius: 14 },
  modalNavText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  assignButton: { borderRadius: 14, overflow: 'hidden' },
  assignGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  assignText: { color: COLORS.black, fontSize: 17, fontWeight: 'bold', marginLeft: 10 },
});
