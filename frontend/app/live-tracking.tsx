import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';

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
  info: '#2196F3',
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

const ADMIN_PASSWORD = 'kiza2024admin';

// Restaurant location (KIZA Restaurant)
const RESTAURANT_LOCATION = {
  lat: 48.8566,  // Paris coordinates as example
  lng: 2.3522,
  name: "KIZA Restaurant"
};

interface DriverLocation {
  driver: {
    id: string;
    full_name: string;
    phone: string;
    status: string;
    current_lat: number;
    current_lng: number;
    last_location_update: string;
  };
  assigned_orders: Array<{
    id: string;
    order_number: string;
    delivery_address: {
      full_name: string;
      address: string;
      city: string;
    };
    grand_total: number;
    status: string;
  }>;
}

interface TrackingOverview {
  active_drivers: number;
  drivers_with_location: number;
  orders_in_delivery: number;
  pending_orders: number;
}

export default function LiveTrackingScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [driversData, setDriversData] = useState<DriverLocation[]>([]);
  const [overview, setOverview] = useState<TrackingOverview | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const webViewRef = useRef<WebView>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchData();
      startAutoRefresh();
    } else {
      Alert.alert('Erreur', 'Mot de passe incorrect');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [locationsRes, overviewRes] = await Promise.all([
        api.get('/api/drivers/locations/active'),
        api.get('/api/tracking/overview')
      ]);
      setDriversData(locationsRes.data);
      setOverview(overviewRes.data);
      
      // Update map markers
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          updateDriverMarkers(${JSON.stringify(locationsRes.data)});
          true;
        `);
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const startAutoRefresh = useCallback(() => {
    // Refresh every 3 seconds for real-time tracking
    refreshIntervalRef.current = setInterval(() => {
      fetchData();
    }, 3000);
  }, [fetchData]);

  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffSec < 10) return 'À l\'instant';
    if (diffSec < 60) return `Il y a ${diffSec}s`;
    if (diffSec < 3600) return `Il y a ${Math.floor(diffSec / 60)}min`;
    return `Il y a ${Math.floor(diffSec / 3600)}h`;
  };

  const getMapHtml = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .driver-marker {
      background: #D4AF37;
      border: 3px solid #fff;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .driver-marker svg {
      width: 20px;
      height: 20px;
      fill: #000;
    }
    .restaurant-marker {
      background: #F44336;
      border: 3px solid #fff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 12px rgba(0,0,0,0.4);
    }
    .delivery-marker {
      background: #4CAF50;
      border: 2px solid #fff;
      border-radius: 8px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: #fff;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .leaflet-popup-content-wrapper {
      background: #1A1A1A;
      color: #fff;
      border-radius: 12px;
      border: 1px solid #D4AF37;
    }
    .leaflet-popup-content {
      margin: 12px;
    }
    .leaflet-popup-tip {
      background: #1A1A1A;
      border: 1px solid #D4AF37;
    }
    .popup-title {
      color: #D4AF37;
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .popup-info {
      font-size: 12px;
      margin: 4px 0;
      color: #ccc;
    }
    .popup-orders {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #333;
    }
    .popup-order {
      background: #252525;
      border-radius: 6px;
      padding: 6px 8px;
      margin-top: 6px;
      font-size: 11px;
    }
    .order-number {
      color: #D4AF37;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${RESTAURANT_LOCATION.lat}, ${RESTAURANT_LOCATION.lng}], 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(map);
    
    // Restaurant marker
    var restaurantIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="restaurant-marker">🏪</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    
    L.marker([${RESTAURANT_LOCATION.lat}, ${RESTAURANT_LOCATION.lng}], {icon: restaurantIcon})
      .addTo(map)
      .bindPopup('<div class="popup-title">🏪 KIZA Restaurant</div><div class="popup-info">Point de départ des livraisons</div>');
    
    var driverMarkers = {};
    var deliveryMarkers = {};
    
    function updateDriverMarkers(driversData) {
      // Clear old delivery markers
      Object.values(deliveryMarkers).forEach(m => map.removeLayer(m));
      deliveryMarkers = {};
      
      driversData.forEach(function(data) {
        var driver = data.driver;
        var orders = data.assigned_orders;
        
        if (!driver.current_lat || !driver.current_lng) return;
        
        var driverIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div class="driver-marker">🚗</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        
        // Build popup content
        var popupContent = '<div class="popup-title">🚗 ' + driver.full_name + '</div>';
        popupContent += '<div class="popup-info">📞 ' + driver.phone + '</div>';
        popupContent += '<div class="popup-info">📍 Mis à jour: ' + formatTimeAgo(driver.last_location_update) + '</div>';
        
        if (orders.length > 0) {
          popupContent += '<div class="popup-orders"><strong>Commandes assignées:</strong>';
          orders.forEach(function(order, idx) {
            popupContent += '<div class="popup-order">';
            popupContent += '<span class="order-number">#' + order.order_number.slice(-8) + '</span><br>';
            popupContent += order.delivery_address.full_name + '<br>';
            popupContent += order.delivery_address.address + ', ' + order.delivery_address.city;
            popupContent += '</div>';
          });
          popupContent += '</div>';
        }
        
        if (driverMarkers[driver.id]) {
          driverMarkers[driver.id].setLatLng([driver.current_lat, driver.current_lng]);
          driverMarkers[driver.id].setPopupContent(popupContent);
        } else {
          driverMarkers[driver.id] = L.marker([driver.current_lat, driver.current_lng], {icon: driverIcon})
            .addTo(map)
            .bindPopup(popupContent);
        }
        
        // Add delivery destination markers
        orders.forEach(function(order, idx) {
          // Note: In real app, you'd geocode the address. For demo, offset from driver
          var destLat = driver.current_lat + (Math.random() - 0.5) * 0.02;
          var destLng = driver.current_lng + (Math.random() - 0.5) * 0.02;
          
          var deliveryIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="delivery-marker">' + (idx + 1) + '</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          
          var markerId = order.id;
          deliveryMarkers[markerId] = L.marker([destLat, destLng], {icon: deliveryIcon})
            .addTo(map)
            .bindPopup('<div class="popup-title">📦 Livraison</div><div class="popup-info">' + order.delivery_address.full_name + '</div><div class="popup-info">' + order.delivery_address.address + '</div>');
        });
      });
    }
    
    function formatTimeAgo(dateString) {
      if (!dateString) return 'N/A';
      var date = new Date(dateString);
      var now = new Date();
      var diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 10) return "À l'instant";
      if (diffSec < 60) return 'Il y a ' + diffSec + 's';
      if (diffSec < 3600) return 'Il y a ' + Math.floor(diffSec / 60) + 'min';
      return 'Il y a ' + Math.floor(diffSec / 3600) + 'h';
    }
    
    function centerOnDriver(lat, lng) {
      map.setView([lat, lng], 15);
    }
  </script>
</body>
</html>
    `;
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
              <MaterialIcons name="gps-fixed" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Suivi GPS</Text>
              <Text style={styles.loginSubtitle}>Livreurs en temps réel</Text>
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
          <Text style={styles.headerTitle}>Suivi GPS</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Admin Navigation */}
        <View style={styles.adminNav}>
          <TouchableOpacity
            style={styles.adminNavButton}
            onPress={() => router.push('/orders-management')}
          >
            <View style={styles.adminNavInactive}>
              <Ionicons name="receipt" size={16} color={COLORS.gold} />
              <Text style={styles.adminNavText}>Commandes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.adminNavButton}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.adminNavInactive}>
              <Ionicons name="people" size={16} color={COLORS.gold} />
              <Text style={styles.adminNavText}>Livreurs</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.adminNavButton, styles.adminNavButtonActive]}>
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.adminNavGradient}>
              <MaterialIcons name="gps-fixed" size={16} color={COLORS.black} />
              <Text style={[styles.adminNavText, { color: COLORS.black }]}>GPS</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Stats Row */}
        {overview && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{overview.drivers_with_location}</Text>
              <Text style={styles.statLabel}>En ligne</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: COLORS.warning }]}>{overview.orders_in_delivery}</Text>
              <Text style={styles.statLabel}>En livraison</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: COLORS.info }]}>{overview.pending_orders}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
          </View>
        )}

        {/* Map */}
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={getMapHtml()}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              source={{ html: getMapHtml() }}
              style={styles.map}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onLoad={() => {
                if (driversData.length > 0 && webViewRef.current) {
                  webViewRef.current.injectJavaScript(`
                    updateDriverMarkers(${JSON.stringify(driversData)});
                    true;
                  `);
                }
              }}
            />
          )}
          
          {loading && (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={COLORS.gold} />
              <Text style={styles.loadingText}>Chargement de la carte...</Text>
            </View>
          )}
        </View>

        {/* Driver List */}
        <View style={styles.driverListContainer}>
          <Text style={styles.driverListTitle}>Livreurs actifs</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.driverList}>
            {driversData.length === 0 ? (
              <View style={styles.noDrivers}>
                <Text style={styles.noDriversText}>Aucun livreur en ligne</Text>
              </View>
            ) : (
              driversData.map((data) => (
                <TouchableOpacity
                  key={data.driver.id}
                  style={[
                    styles.driverCard,
                    selectedDriver?.driver.id === data.driver.id && styles.driverCardSelected
                  ]}
                  onPress={() => {
                    setSelectedDriver(data);
                    if (webViewRef.current && data.driver.current_lat) {
                      webViewRef.current.injectJavaScript(`
                        centerOnDriver(${data.driver.current_lat}, ${data.driver.current_lng});
                        true;
                      `);
                    }
                  }}
                >
                  <View style={styles.driverAvatar}>
                    <FontAwesome5 name="motorcycle" size={16} color={COLORS.black} />
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName} numberOfLines={1}>{data.driver.full_name}</Text>
                    <Text style={styles.driverOrders}>{data.assigned_orders.length} commande(s)</Text>
                    <Text style={styles.driverUpdate}>{formatTimeAgo(data.driver.last_location_update)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        {/* Selected Driver Details */}
        {selectedDriver && (
          <View style={styles.selectedDriverPanel}>
            <View style={styles.selectedDriverHeader}>
              <View>
                <Text style={styles.selectedDriverName}>{selectedDriver.driver.full_name}</Text>
                <Text style={styles.selectedDriverPhone}>{selectedDriver.driver.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDriver(null)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            
            {selectedDriver.assigned_orders.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedDriver.assigned_orders.map((order, idx) => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.orderNumber}>#{order.order_number.slice(-8)}</Text>
                    <Text style={styles.orderCustomer}>{order.delivery_address.full_name}</Text>
                    <Text style={styles.orderAddress} numberOfLines={2}>
                      {order.delivery_address.address}
                    </Text>
                    <Text style={styles.orderTotal}>{order.grand_total.toFixed(2)}€</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noOrders}>Aucune commande assignée</Text>
            )}
          </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.2)' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244, 67, 54, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error, marginRight: 6 },
  liveText: { fontSize: 11, fontWeight: 'bold', color: COLORS.error },

  // Admin Nav
  adminNav: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  adminNavButton: { flex: 1, marginHorizontal: 3, borderRadius: 10, overflow: 'hidden' },
  adminNavButtonActive: {},
  adminNavGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  adminNavInactive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: COLORS.blackMedium, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  adminNavText: { fontSize: 12, fontWeight: '600', color: COLORS.gold, marginLeft: 6 },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.blackMedium, borderRadius: 10, padding: 10, marginHorizontal: 4, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },
  statLabel: { fontSize: 10, color: COLORS.gray, marginTop: 2 },

  // Map
  mapContainer: { flex: 1, margin: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: COLORS.blackMedium },
  map: { flex: 1 },
  mapLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.gray, marginTop: 12 },

  // Driver List
  driverListContainer: { paddingHorizontal: 12, paddingBottom: 8 },
  driverListTitle: { fontSize: 14, fontWeight: '600', color: COLORS.gold, marginBottom: 8 },
  driverList: { flexGrow: 0 },
  noDrivers: { padding: 20 },
  noDriversText: { color: COLORS.gray },
  driverCard: { width: 120, backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 12, marginRight: 10, borderWidth: 1, borderColor: 'transparent' },
  driverCardSelected: { borderColor: COLORS.gold },
  driverAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  driverInfo: {},
  driverName: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  driverOrders: { fontSize: 11, color: COLORS.goldLight, marginTop: 2 },
  driverUpdate: { fontSize: 10, color: COLORS.gray, marginTop: 2 },

  // Selected Driver Panel
  selectedDriverPanel: { backgroundColor: COLORS.blackMedium, marginHorizontal: 12, marginBottom: 12, borderRadius: 16, padding: 16 },
  selectedDriverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  selectedDriverName: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold },
  selectedDriverPhone: { fontSize: 14, color: COLORS.gray, marginTop: 2 },
  orderCard: { width: 140, backgroundColor: COLORS.blackLight, borderRadius: 10, padding: 12, marginRight: 10 },
  orderBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  orderBadgeText: { fontSize: 12, fontWeight: 'bold', color: COLORS.white },
  orderNumber: { fontSize: 12, fontWeight: 'bold', color: COLORS.gold },
  orderCustomer: { fontSize: 12, color: COLORS.white, marginTop: 4 },
  orderAddress: { fontSize: 10, color: COLORS.gray, marginTop: 4 },
  orderTotal: { fontSize: 14, fontWeight: 'bold', color: COLORS.goldLight, marginTop: 6 },
  noOrders: { color: COLORS.gray, textAlign: 'center', paddingVertical: 12 },
});
