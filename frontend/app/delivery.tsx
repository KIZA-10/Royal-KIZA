import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import QRCode from 'react-native-qrcode-svg';
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
  warning: '#FF9800',
  error: '#F44336',
};

// Get the backend URL
const getBackendUrl = () => {
  const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
    || process.env.EXPO_PUBLIC_BACKEND_URL 
    || '';
  return backendUrl || '';
};

const API_BASE_URL = getBackendUrl();
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface DeliveryAddress {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  instructions?: string;
}

interface Order {
  id: string;
  order_number: string;
  items: OrderItem[];
  delivery_address: DeliveryAddress;
  total_amount: number;
  delivery_fee: number;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  confirmed: COLORS.warning,
  preparing: COLORS.gold,
  delivering: COLORS.success,
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  delivering: 'En livraison',
};

const statusIcons: Record<string, string> = {
  confirmed: 'checkmark-circle',
  preparing: 'restaurant',
  delivering: 'car',
};

export default function DeliveryScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/api/orders/delivery');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/api/orders/${orderId}/status?status=${newStatus}`);
      fetchOrders();
      Alert.alert('Succès', 'Statut mis à jour');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const openNavigation = (order: Order, app: 'waze' | 'google') => {
    const addr = order.delivery_address;
    const fullAddress = `${addr.address}, ${addr.postal_code} ${addr.city}, France`;
    const encodedAddress = encodeURIComponent(fullAddress);

    if (app === 'waze') {
      const url = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
      Linking.openURL(url);
    } else {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      Linking.openURL(url);
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getQRCodeUrl = (orderId: string) => {
    // Use the public URL for QR code
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}/navigate/${orderId}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderCard = (order: Order) => (
    <View key={order.id} style={styles.orderCard}>
      {/* Order Header */}
      <View style={styles.orderHeader}>
        <View style={styles.orderNumberContainer}>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[order.status] + '30' }]}>
          <Ionicons 
            name={statusIcons[order.status] as any} 
            size={16} 
            color={statusColors[order.status]} 
          />
          <Text style={[styles.statusText, { color: statusColors[order.status] }]}>
            {statusLabels[order.status]}
          </Text>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.customerSection}>
        <View style={styles.customerInfo}>
          <Ionicons name="person" size={18} color={COLORS.gold} />
          <Text style={styles.customerName}>{order.delivery_address.full_name}</Text>
        </View>
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => callCustomer(order.delivery_address.phone)}
        >
          <Ionicons name="call" size={18} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* Address */}
      <View style={styles.addressSection}>
        <Ionicons name="location" size={18} color={COLORS.gold} />
        <View style={styles.addressInfo}>
          <Text style={styles.addressText}>{order.delivery_address.address}</Text>
          <Text style={styles.addressCity}>
            {order.delivery_address.postal_code} {order.delivery_address.city}
          </Text>
          {order.delivery_address.instructions && (
            <Text style={styles.instructions}>
              📝 {order.delivery_address.instructions}
            </Text>
          )}
        </View>
      </View>

      {/* Order Items */}
      <View style={styles.itemsSection}>
        <Text style={styles.itemsSectionTitle}>Articles commandés:</Text>
        {order.items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemQuantity}>{item.quantity}x</Text>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>{(item.price * item.quantity).toFixed(2)}€</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>
            {(order.total_amount + order.delivery_fee).toFixed(2)}€
          </Text>
        </View>
      </View>

      {/* Navigation Buttons */}
      <View style={styles.navigationSection}>
        <TouchableOpacity
          style={styles.wazeButton}
          onPress={() => openNavigation(order, 'waze')}
        >
          <FontAwesome5 name="waze" size={20} color="#fff" />
          <Text style={styles.navButtonText}>Waze</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.gmapsButton}
          onPress={() => openNavigation(order, 'google')}
        >
          <FontAwesome5 name="google" size={20} color="#fff" />
          <Text style={styles.navButtonText}>Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => {
            setSelectedOrder(order);
            setShowQRModal(true);
          }}
        >
          <Ionicons name="qr-code" size={20} color={COLORS.black} />
          <Text style={styles.qrButtonText}>QR</Text>
        </TouchableOpacity>
      </View>

      {/* Status Update Buttons */}
      <View style={styles.statusButtons}>
        {order.status === 'confirmed' && (
          <TouchableOpacity
            style={styles.statusUpdateButton}
            onPress={() => updateOrderStatus(order.id, 'preparing')}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.statusUpdateGradient}>
              <Ionicons name="restaurant" size={18} color={COLORS.black} />
              <Text style={styles.statusUpdateText}>Commencer préparation</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {order.status === 'preparing' && (
          <TouchableOpacity
            style={styles.statusUpdateButton}
            onPress={() => updateOrderStatus(order.id, 'delivering')}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.statusUpdateGradient}>
              <Ionicons name="car" size={18} color={COLORS.black} />
              <Text style={styles.statusUpdateText}>Partir en livraison</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {order.status === 'delivering' && (
          <TouchableOpacity
            style={styles.statusUpdateButton}
            onPress={() => updateOrderStatus(order.id, 'delivered')}
          >
            <LinearGradient colors={[COLORS.success, '#388E3C']} style={styles.statusUpdateGradient}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={[styles.statusUpdateText, { color: '#fff' }]}>Marquer comme livré</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderQRModal = () => {
    if (!selectedOrder) return null;
    
    return (
      <View style={styles.qrModalOverlay}>
        <View style={styles.qrModalContent}>
          <TouchableOpacity
            style={styles.qrModalClose}
            onPress={() => setShowQRModal(false)}
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>

          <Text style={styles.qrModalTitle}>QR Code Navigation</Text>
          <Text style={styles.qrModalSubtitle}>
            Scannez pour ouvrir Waze ou Google Maps
          </Text>

          <View style={styles.qrCodeContainer}>
            <QRCode
              value={getQRCodeUrl(selectedOrder.id)}
              size={200}
              color={COLORS.black}
              backgroundColor={COLORS.white}
            />
          </View>

          <View style={styles.qrAddressInfo}>
            <Text style={styles.qrCustomerName}>
              {selectedOrder.delivery_address.full_name}
            </Text>
            <Text style={styles.qrAddress}>
              {selectedOrder.delivery_address.address}
            </Text>
            <Text style={styles.qrCity}>
              {selectedOrder.delivery_address.postal_code} {selectedOrder.delivery_address.city}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loadingText}>Chargement des commandes...</Text>
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Panneau Livreur</Text>
            <Text style={styles.headerSubtitle}>{orders.length} commande(s) en cours</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <ScrollView
          style={styles.ordersList}
          contentContainerStyle={styles.ordersContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.gold}
              colors={[COLORS.gold]}
            />
          }
        >
          {orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color={COLORS.gray} />
              <Text style={styles.emptyText}>Aucune commande en cours</Text>
              <Text style={styles.emptySubtext}>
                Les nouvelles commandes apparaîtront ici
              </Text>
            </View>
          ) : (
            orders.map(renderOrderCard)
          )}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* QR Modal */}
        {showQRModal && renderQRModal()}
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
  loadingText: {
    color: COLORS.gray,
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  ordersList: {
    flex: 1,
  },
  ordersContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: COLORS.gray,
    fontSize: 14,
    marginTop: 8,
  },
  orderCard: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderNumberContainer: {},
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  orderDate: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  customerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerName: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  callButton: {
    backgroundColor: COLORS.gold,
    padding: 10,
    borderRadius: 20,
  },
  addressSection: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  addressInfo: {
    flex: 1,
    marginLeft: 10,
  },
  addressText: {
    color: COLORS.white,
    fontSize: 14,
  },
  addressCity: {
    color: COLORS.gray,
    fontSize: 14,
    marginTop: 2,
  },
  instructions: {
    color: COLORS.goldLight,
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  itemsSection: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  itemsSectionTitle: {
    color: COLORS.gray,
    fontSize: 12,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemQuantity: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    width: 30,
  },
  itemName: {
    color: COLORS.white,
    fontSize: 14,
    flex: 1,
  },
  itemPrice: {
    color: COLORS.gray,
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  totalLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalAmount: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  navigationSection: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  wazeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#33CCFF',
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
  },
  gmapsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  qrButtonText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  statusButtons: {
    marginTop: 4,
  },
  statusUpdateButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusUpdateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  statusUpdateText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // QR Modal Styles
  qrModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: COLORS.blackLight,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
  },
  qrModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  qrModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 8,
  },
  qrModalSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 24,
    textAlign: 'center',
  },
  qrCodeContainer: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  qrAddressInfo: {
    alignItems: 'center',
  },
  qrCustomerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 4,
  },
  qrAddress: {
    fontSize: 14,
    color: COLORS.white,
  },
  qrCity: {
    fontSize: 14,
    color: COLORS.gray,
  },
});
