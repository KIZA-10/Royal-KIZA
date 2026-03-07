import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
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
  warning: '#FF9800',
  error: '#F44336',
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

interface OrderItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: string;
  items: OrderItem[];
  delivery_address: {
    full_name: string;
    phone: string;
    address: string;
    city: string;
    postal_code: string;
    instructions?: string;
  };
  total_amount: number;
  delivery_fee: number;
  grand_total: number;
  status: string;
  payment_method: string;
  assigned_driver_id?: string;
  assigned_driver_name?: string;
  created_at: string;
  updated_at: string;
}

interface Driver {
  id: string;
  full_name: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; priority: number }> = {
  pending: { label: 'En attente', color: COLORS.error, icon: 'time', priority: 1 },
  confirmed: { label: 'Confirmée', color: COLORS.warning, icon: 'checkmark-circle', priority: 2 },
  preparing: { label: 'En préparation', color: COLORS.info, icon: 'restaurant', priority: 3 },
  delivering: { label: 'En livraison', color: COLORS.success, icon: 'car', priority: 4 },
  delivered: { label: 'Livrée', color: COLORS.gray, icon: 'checkmark-done', priority: 5 },
  cancelled: { label: 'Annulée', color: COLORS.gray, icon: 'close-circle', priority: 6 },
};

export default function OrdersManagementScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const fetchData = async () => {
    try {
      const [ordersRes, driversRes] = await Promise.all([
        api.get('/api/orders/all'),
        api.get('/api/drivers'),
      ]);
      setOrders(ordersRes.data);
      setDrivers(driversRes.data.filter((d: Driver) => d.status === 'active'));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const getFilteredOrders = () => {
    const activeStatuses = ['pending', 'confirmed', 'preparing', 'delivering'];
    const completedStatuses = ['delivered', 'cancelled'];
    
    const filtered = orders.filter(order => 
      selectedTab === 'active' 
        ? activeStatuses.includes(order.status)
        : completedStatuses.includes(order.status)
    );

    // Sort by priority (pending first) then by date
    return filtered.sort((a, b) => {
      const priorityA = STATUS_CONFIG[a.status]?.priority || 99;
      const priorityB = STATUS_CONFIG[b.status]?.priority || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const getOrderCounts = () => {
    return {
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      delivering: orders.filter(o => o.status === 'delivering').length,
      total: orders.filter(o => ['pending', 'confirmed', 'preparing', 'delivering'].includes(o.status)).length,
    };
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/api/orders/${orderId}/status?status=${newStatus}`);
      fetchData();
      Alert.alert('Succès', `Commande ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    try {
      await api.put(`/api/orders/${orderId}/assign/${driverId}`);
      setShowAssignModal(false);
      fetchData();
      Alert.alert('Succès', 'Livreur assigné');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'assigner le livreur');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('fr-FR');
  };

  const getUrgencyLevel = (order: Order) => {
    const diffMs = new Date().getTime() - new Date(order.created_at).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (order.status === 'pending') {
      if (diffMins > 10) return 'critical';
      if (diffMins > 5) return 'high';
      return 'normal';
    }
    if (order.status === 'confirmed' && diffMins > 20) return 'high';
    if (order.status === 'preparing' && diffMins > 30) return 'high';
    return 'normal';
  };

  const counts = getOrderCounts();
  const filteredOrders = getFilteredOrders();

  const renderOrderCard = (order: Order) => {
    const config = STATUS_CONFIG[order.status];
    const urgency = getUrgencyLevel(order);
    
    return (
      <TouchableOpacity
        key={order.id}
        style={[
          styles.orderCard,
          urgency === 'critical' && styles.orderCardCritical,
          urgency === 'high' && styles.orderCardHigh,
        ]}
        onPress={() => {
          setSelectedOrder(order);
          setShowOrderModal(true);
        }}
      >
        {/* Urgency indicator */}
        {urgency !== 'normal' && (
          <View style={[styles.urgencyBadge, urgency === 'critical' ? styles.urgencyCritical : styles.urgencyHigh]}>
            <Ionicons name="alert" size={12} color="#fff" />
            <Text style={styles.urgencyText}>
              {urgency === 'critical' ? 'URGENT!' : 'Prioritaire'}
            </Text>
          </View>
        )}

        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{order.order_number}</Text>
            <Text style={styles.orderTime}>{formatTime(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '25' }]}>
            <Ionicons name={config.icon as any} size={14} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.customerRow}>
          <Ionicons name="person" size={16} color={COLORS.gold} />
          <Text style={styles.customerName}>{order.delivery_address.full_name}</Text>
          <TouchableOpacity onPress={() => {/* Call */}}>
            <Ionicons name="call" size={18} color={COLORS.success} />
          </TouchableOpacity>
        </View>

        <View style={styles.itemsPreview}>
          {order.items.slice(0, 2).map((item, idx) => (
            <Text key={idx} style={styles.itemPreviewText}>
              {item.quantity}x {item.name}
            </Text>
          ))}
          {order.items.length > 2 && (
            <Text style={styles.moreItems}>+{order.items.length - 2} autres...</Text>
          )}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>{order.grand_total.toFixed(2)}€</Text>
          
          {order.assigned_driver_name ? (
            <View style={styles.driverAssigned}>
              <Ionicons name="bicycle" size={14} color={COLORS.gold} />
              <Text style={styles.driverName}>{order.assigned_driver_name}</Text>
            </View>
          ) : (
            order.status !== 'pending' && order.status !== 'delivered' && order.status !== 'cancelled' && (
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => {
                  setSelectedOrder(order);
                  setShowAssignModal(true);
                }}
              >
                <Text style={styles.assignButtonText}>Assigner</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {order.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.quickAction, styles.quickActionSuccess]}
                onPress={() => updateOrderStatus(order.id, 'confirmed')}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.quickActionText}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAction, styles.quickActionDanger]}
                onPress={() => updateOrderStatus(order.id, 'cancelled')}
              >
                <Ionicons name="close" size={18} color="#fff" />
                <Text style={styles.quickActionText}>Refuser</Text>
              </TouchableOpacity>
            </>
          )}
          {order.status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionInfo]}
              onPress={() => updateOrderStatus(order.id, 'preparing')}
            >
              <Ionicons name="restaurant" size={18} color="#fff" />
              <Text style={styles.quickActionText}>Préparer</Text>
            </TouchableOpacity>
          )}
          {order.status === 'preparing' && (
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionWarning]}
              onPress={() => updateOrderStatus(order.id, 'delivering')}
            >
              <Ionicons name="car" size={18} color="#fff" />
              <Text style={styles.quickActionText}>Envoyer</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrderDetailModal = () => {
    if (!selectedOrder) return null;
    const config = STATUS_CONFIG[selectedOrder.status];

    return (
      <Modal
        visible={showOrderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowOrderModal(false)}
            >
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalOrderNumber}>#{selectedOrder.order_number}</Text>
                <View style={[styles.modalStatusBadge, { backgroundColor: config.color + '25' }]}>
                  <Ionicons name={config.icon as any} size={16} color={config.color} />
                  <Text style={[styles.modalStatusText, { color: config.color }]}>{config.label}</Text>
                </View>
              </View>

              {/* Customer Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Client</Text>
                <View style={styles.modalCustomerCard}>
                  <Text style={styles.modalCustomerName}>{selectedOrder.delivery_address.full_name}</Text>
                  <Text style={styles.modalCustomerPhone}>📞 {selectedOrder.delivery_address.phone}</Text>
                  <View style={styles.modalAddressRow}>
                    <Ionicons name="location" size={16} color={COLORS.gold} />
                    <Text style={styles.modalAddress}>
                      {selectedOrder.delivery_address.address}, {selectedOrder.delivery_address.postal_code} {selectedOrder.delivery_address.city}
                    </Text>
                  </View>
                  {selectedOrder.delivery_address.instructions && (
                    <Text style={styles.modalInstructions}>
                      📝 {selectedOrder.delivery_address.instructions}
                    </Text>
                  )}
                </View>
              </View>

              {/* Items */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Articles commandés</Text>
                {selectedOrder.items.map((item, idx) => (
                  <View key={idx} style={styles.modalItemRow}>
                    <Text style={styles.modalItemQty}>{item.quantity}x</Text>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemPrice}>{(item.price * item.quantity).toFixed(2)}€</Text>
                  </View>
                ))}
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Sous-total</Text>
                  <Text style={styles.modalTotalValue}>{selectedOrder.total_amount.toFixed(2)}€</Text>
                </View>
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Livraison</Text>
                  <Text style={styles.modalTotalValue}>{selectedOrder.delivery_fee.toFixed(2)}€</Text>
                </View>
                <View style={[styles.modalTotalRow, styles.modalGrandTotal]}>
                  <Text style={styles.modalGrandTotalLabel}>TOTAL</Text>
                  <Text style={styles.modalGrandTotalValue}>{selectedOrder.grand_total.toFixed(2)}€</Text>
                </View>
              </View>

              {/* Driver */}
              {selectedOrder.assigned_driver_name && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Livreur assigné</Text>
                  <View style={styles.modalDriverCard}>
                    <Ionicons name="bicycle" size={24} color={COLORS.gold} />
                    <Text style={styles.modalDriverName}>{selectedOrder.assigned_driver_name}</Text>
                  </View>
                </View>
              )}

              {/* Actions */}
              <View style={styles.modalActions}>
                {selectedOrder.status === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, styles.modalActionConfirm]}
                      onPress={() => {
                        updateOrderStatus(selectedOrder.id, 'confirmed');
                        setShowOrderModal(false);
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.modalActionText}>Confirmer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionBtn, styles.modalActionCancel]}
                      onPress={() => {
                        updateOrderStatus(selectedOrder.id, 'cancelled');
                        setShowOrderModal(false);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={styles.modalActionText}>Refuser</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, styles.modalActionPrepare]}
                    onPress={() => {
                      updateOrderStatus(selectedOrder.id, 'preparing');
                      setShowOrderModal(false);
                    }}
                  >
                    <Ionicons name="restaurant" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Commencer la préparation</Text>
                  </TouchableOpacity>
                )}
                {selectedOrder.status === 'preparing' && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, styles.modalActionDeliver]}
                    onPress={() => {
                      updateOrderStatus(selectedOrder.id, 'delivering');
                      setShowOrderModal(false);
                    }}
                  >
                    <Ionicons name="car" size={20} color={COLORS.black} />
                    <Text style={[styles.modalActionText, { color: COLORS.black }]}>Envoyer en livraison</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAssignDriverModal = () => (
    <Modal
      visible={showAssignModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAssignModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.assignModalContent}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setShowAssignModal(false)}
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>

          <Text style={styles.assignModalTitle}>Assigner un livreur</Text>
          
          {drivers.length === 0 ? (
            <View style={styles.noDrivers}>
              <Ionicons name="person-outline" size={48} color={COLORS.gray} />
              <Text style={styles.noDriversText}>Aucun livreur disponible</Text>
            </View>
          ) : (
            <ScrollView>
              {drivers.map((driver) => (
                <TouchableOpacity
                  key={driver.id}
                  style={styles.driverOption}
                  onPress={() => selectedOrder && assignDriver(selectedOrder.id, driver.id)}
                >
                  <View style={styles.driverOptionAvatar}>
                    <FontAwesome5 name="user" size={18} color={COLORS.black} />
                  </View>
                  <Text style={styles.driverOptionName}>{driver.full_name}</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.gold} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

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
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Commandes</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* Admin Navigation */}
        <View style={styles.adminNav}>
          <View style={[styles.adminNavButton, styles.adminNavButtonActive]}>
            <LinearGradient colors={['#FF9800', '#E65100']} style={styles.adminNavGradient}>
              <Ionicons name="receipt" size={18} color="#fff" />
              <Text style={[styles.adminNavText, { color: '#fff' }]}>Commandes</Text>
            </LinearGradient>
          </View>
          <TouchableOpacity
            style={styles.adminNavButton}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.adminNavInactive}>
              <Ionicons name="people" size={18} color={COLORS.gold} />
              <Text style={styles.adminNavText}>Livreurs</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.adminNavButton}
            onPress={() => router.push('/settings-management')}
          >
            <View style={styles.adminNavInactive}>
              <Ionicons name="settings" size={18} color={COLORS.gold} />
              <Text style={styles.adminNavText}>Paramètres</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, { backgroundColor: COLORS.error + '25' }]}>
              <Text style={[styles.statNumber, { color: COLORS.error }]}>{counts.pending}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: COLORS.warning + '25' }]}>
              <Text style={[styles.statNumber, { color: COLORS.warning }]}>{counts.confirmed}</Text>
              <Text style={styles.statLabel}>Confirmées</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: COLORS.info + '25' }]}>
              <Text style={[styles.statNumber, { color: COLORS.info }]}>{counts.preparing}</Text>
              <Text style={styles.statLabel}>Préparation</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: COLORS.success + '25' }]}>
              <Text style={[styles.statNumber, { color: COLORS.success }]}>{counts.delivering}</Text>
              <Text style={styles.statLabel}>Livraison</Text>
            </View>
          </View>
        </ScrollView>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'active' && styles.tabActive]}
            onPress={() => setSelectedTab('active')}
          >
            <Text style={[styles.tabText, selectedTab === 'active' && styles.tabTextActive]}>
              En cours ({counts.total})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'completed' && styles.tabActive]}
            onPress={() => setSelectedTab('completed')}
          >
            <Text style={[styles.tabText, selectedTab === 'completed' && styles.tabTextActive]}>
              Terminées
            </Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <ScrollView
          style={styles.ordersList}
          contentContainerStyle={styles.ordersContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
          }
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={COLORS.gray} />
              <Text style={styles.emptyText}>
                {selectedTab === 'active' ? 'Aucune commande en cours' : 'Aucune commande terminée'}
              </Text>
            </View>
          ) : (
            filteredOrders.map(renderOrderCard)
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        {renderOrderDetailModal()}
        {renderAssignDriverModal()}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  gradient: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.gray, marginTop: 16 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.2)' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },

  // Admin Navigation
  adminNav: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  adminNavButton: { flex: 1, marginHorizontal: 3, borderRadius: 10, overflow: 'hidden' },
  adminNavButtonActive: {},
  adminNavGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  adminNavInactive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: COLORS.blackMedium, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  adminNavText: { fontSize: 12, fontWeight: '600', color: COLORS.gold, marginLeft: 6 },

  // Stats
  statsScroll: { maxHeight: 80 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12 },
  statBadge: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginHorizontal: 4, alignItems: 'center', minWidth: 80 },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 10, color: COLORS.gray, marginTop: 2 },

  // Tabs
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.gold },
  tabText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },

  // Orders List
  ordersList: { flex: 1 },
  ordersContent: { padding: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: COLORS.gray, fontSize: 16, marginTop: 16 },

  // Order Card
  orderCard: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
  orderCardCritical: { borderColor: COLORS.error, borderWidth: 2 },
  orderCardHigh: { borderColor: COLORS.warning, borderWidth: 2 },
  urgencyBadge: { position: 'absolute', top: -8, right: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, zIndex: 1 },
  urgencyCritical: { backgroundColor: COLORS.error },
  urgencyHigh: { backgroundColor: COLORS.warning },
  urgencyText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderNumber: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold },
  orderTime: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  customerName: { flex: 1, color: COLORS.white, fontSize: 14, marginLeft: 8 },
  itemsPreview: { marginBottom: 10 },
  itemPreviewText: { color: COLORS.gray, fontSize: 13 },
  moreItems: { color: COLORS.gold, fontSize: 12, fontStyle: 'italic' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  orderTotal: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold },
  driverAssigned: { flexDirection: 'row', alignItems: 'center' },
  driverName: { color: COLORS.goldLight, fontSize: 12, marginLeft: 6 },
  assignButton: { backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  assignButtonText: { color: COLORS.black, fontSize: 12, fontWeight: '600' },
  quickActions: { flexDirection: 'row', marginTop: 12 },
  quickAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, marginHorizontal: 4 },
  quickActionSuccess: { backgroundColor: COLORS.success },
  quickActionDanger: { backgroundColor: COLORS.error },
  quickActionInfo: { backgroundColor: COLORS.info },
  quickActionWarning: { backgroundColor: COLORS.warning },
  quickActionText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.blackLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  modalOrderNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold },
  modalStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  modalStatusText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  modalSection: { marginBottom: 20 },
  modalSectionTitle: { fontSize: 14, color: COLORS.gold, fontWeight: '600', marginBottom: 10 },
  modalCustomerCard: { backgroundColor: COLORS.blackMedium, padding: 14, borderRadius: 12 },
  modalCustomerName: { fontSize: 18, color: COLORS.white, fontWeight: '600' },
  modalCustomerPhone: { fontSize: 14, color: COLORS.goldLight, marginTop: 6 },
  modalAddressRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  modalAddress: { flex: 1, color: COLORS.gray, fontSize: 14, marginLeft: 8 },
  modalInstructions: { color: COLORS.warning, fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  modalItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalItemQty: { width: 40, color: COLORS.gold, fontWeight: 'bold' },
  modalItemName: { flex: 1, color: COLORS.white },
  modalItemPrice: { color: COLORS.gray },
  modalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalTotalLabel: { color: COLORS.gray },
  modalTotalValue: { color: COLORS.white },
  modalGrandTotal: { borderTopWidth: 1, borderTopColor: COLORS.gold, marginTop: 8, paddingTop: 12 },
  modalGrandTotalLabel: { color: COLORS.gold, fontWeight: 'bold', fontSize: 16 },
  modalGrandTotalValue: { color: COLORS.gold, fontWeight: 'bold', fontSize: 20 },
  modalDriverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, padding: 14, borderRadius: 12 },
  modalDriverName: { color: COLORS.white, fontSize: 16, marginLeft: 12 },
  modalActions: { flexDirection: 'row', marginTop: 10 },
  modalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginHorizontal: 4 },
  modalActionConfirm: { backgroundColor: COLORS.success },
  modalActionCancel: { backgroundColor: COLORS.error },
  modalActionPrepare: { backgroundColor: COLORS.info },
  modalActionDeliver: { backgroundColor: COLORS.gold },
  modalActionText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },

  // Assign Modal
  assignModalContent: { backgroundColor: COLORS.blackLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  assignModalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold, textAlign: 'center', marginBottom: 20 },
  noDrivers: { alignItems: 'center', paddingVertical: 40 },
  noDriversText: { color: COLORS.gray, marginTop: 12 },
  driverOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, padding: 14, borderRadius: 12, marginBottom: 10 },
  driverOptionAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  driverOptionName: { flex: 1, color: COLORS.white, fontSize: 16, marginLeft: 12 },
});
