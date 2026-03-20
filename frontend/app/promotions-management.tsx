import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { Picker } from '@react-native-picker/picker';

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
  purple: '#9C27B0',
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

interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  description?: string;
  min_order_amount: number;
  max_uses?: number;
  current_uses: number;
  status: string;
  valid_until?: string;
}

interface ProductPromotion {
  id: string;
  name: string;
  discount_percent: number;
  applies_to: string;
  category_id?: string;
  product_ids?: string[];
  is_active: boolean;
  valid_until?: string;
}

interface Customer {
  phone: string;
  full_name?: string;
  is_premium: boolean;
  is_premium_active?: boolean;
  premium_expires_at?: string;
  total_orders: number;
  loyalty_discount_unlocked: boolean;
  created_at?: string;
}

interface CustomerStats {
  total_customers: number;
  premium_subscribers: number;
  loyal_customers: number;
  loyalty_threshold: number;
  loyalty_discount: number;
  premium_price: number;
}

interface Category {
  id: string;
  name: string;
}

export default function PromotionsManagementScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'codes' | 'promotions' | 'clients'>('codes');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Promo Codes state
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeForm, setCodeForm] = useState({
    code: '',
    discount_percent: '',
    description: '',
    min_order_amount: '',
    max_uses: '',
    valid_until: '',
  });
  
  // Product Promotions state
  const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoForm, setPromoForm] = useState({
    name: '',
    discount_percent: '',
    applies_to: 'all',
    category_id: '',
    valid_until: '',
  });

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [customerFilter, setCustomerFilter] = useState<'all' | 'premium' | 'loyal'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editOrderCount, setEditOrderCount] = useState('');

  const handleLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchAllData();
    } else {
      Alert.alert('Erreur', 'Mot de passe incorrect');
    }
  };

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [codesRes, promosRes, catsRes, customersRes, statsRes] = await Promise.all([
        api.get('/api/admin/promo-codes'),
        api.get('/api/admin/promotions'),
        api.get('/api/admin/menu/categories'),
        api.get('/api/admin/customers'),
        api.get('/api/admin/customers/stats'),
      ]);
      setPromoCodes(codesRes.data);
      setPromotions(promosRes.data);
      setCategories(catsRes.data);
      setCustomers(customersRes.data);
      setCustomerStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData().finally(() => setRefreshing(false));
  };

  // Promo Code functions
  const resetCodeForm = () => {
    setCodeForm({
      code: '',
      discount_percent: '',
      description: '',
      min_order_amount: '',
      max_uses: '',
      valid_until: '',
    });
  };

  const handleCreateCode = async () => {
    if (!codeForm.code || !codeForm.discount_percent) {
      Alert.alert('Erreur', 'Code et réduction requis');
      return;
    }

    try {
      await api.post('/api/admin/promo-codes', {
        code: codeForm.code.toUpperCase(),
        discount_percent: parseFloat(codeForm.discount_percent),
        description: codeForm.description || null,
        min_order_amount: parseFloat(codeForm.min_order_amount) || 0,
        max_uses: codeForm.max_uses ? parseInt(codeForm.max_uses) : null,
        valid_until: codeForm.valid_until || null,
      });
      Alert.alert('Succès', 'Code promo créé');
      setShowCodeModal(false);
      resetCodeForm();
      fetchAllData();
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de créer');
    }
  };

  const handleToggleCode = async (code: PromoCode) => {
    try {
      await api.put(`/api/admin/promo-codes/${code.id}/toggle`);
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier');
    }
  };

  const handleDeleteCode = (code: PromoCode) => {
    Alert.alert('Confirmer', `Supprimer le code "${code.code}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/promo-codes/${code.id}`);
            fetchAllData();
          } catch (error) {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  // Product Promotion functions
  const resetPromoForm = () => {
    setPromoForm({
      name: '',
      discount_percent: '',
      applies_to: 'all',
      category_id: '',
      valid_until: '',
    });
  };

  const handleCreatePromotion = async () => {
    if (!promoForm.name || !promoForm.discount_percent) {
      Alert.alert('Erreur', 'Nom et réduction requis');
      return;
    }

    try {
      await api.post('/api/admin/promotions', {
        name: promoForm.name,
        discount_percent: parseFloat(promoForm.discount_percent),
        applies_to: promoForm.applies_to,
        category_id: promoForm.applies_to === 'category' ? promoForm.category_id : null,
        valid_until: promoForm.valid_until || null,
      });
      Alert.alert('Succès', 'Promotion créée');
      setShowPromoModal(false);
      resetPromoForm();
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer');
    }
  };

  const handleTogglePromotion = async (promo: ProductPromotion) => {
    try {
      await api.put(`/api/admin/promotions/${promo.id}/toggle`);
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier');
    }
  };

  const handleDeletePromotion = (promo: ProductPromotion) => {
    Alert.alert('Confirmer', `Supprimer "${promo.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/promotions/${promo.id}`);
            fetchAllData();
          } catch (error) {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  // Customer management functions
  const handleTogglePremium = async (customer: Customer) => {
    try {
      const activate = !customer.is_premium_active;
      await api.put(`/api/admin/customers/${customer.phone}/premium?activate=${activate}`);
      Alert.alert('Succès', activate ? 'Premium activé pour 30 jours' : 'Premium désactivé');
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier');
    }
  };

  const handleUpdateLoyalty = async () => {
    if (!selectedCustomer) return;
    const count = parseInt(editOrderCount);
    if (isNaN(count) || count < 0) {
      Alert.alert('Erreur', 'Nombre de commandes invalide');
      return;
    }
    
    try {
      await api.put(`/api/admin/customers/${selectedCustomer.phone}/loyalty?order_count=${count}`);
      Alert.alert('Succès', 'Fidélité mise à jour');
      setShowCustomerModal(false);
      setSelectedCustomer(null);
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier');
    }
  };

  const openCustomerModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditOrderCount(customer.total_orders.toString());
    setShowCustomerModal(true);
  };

  const getFilteredCustomers = () => {
    switch (customerFilter) {
      case 'premium':
        return customers.filter(c => c.is_premium_active);
      case 'loyal':
        return customers.filter(c => c.loyalty_discount_unlocked);
      default:
        return customers;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return 'N/A';
    }
  };

  const getAppliestoLabel = (appliesTo: string, categoryId?: string) => {
    if (appliesTo === 'all') return 'Tout le menu';
    if (appliesTo === 'category') {
      const cat = categories.find(c => c.id === categoryId);
      return cat ? cat.name : 'Catégorie';
    }
    return appliesTo;
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
              <MaterialCommunityIcons name="tag-multiple" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Promotions</Text>
              <Text style={styles.loginSubtitle}>Codes & Réductions</Text>
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
          <Text style={styles.headerTitle}>Promotions</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'codes' && styles.tabButtonActive]}
            onPress={() => setActiveTab('codes')}
          >
            <MaterialCommunityIcons name="ticket-percent" size={16} color={activeTab === 'codes' ? COLORS.black : COLORS.gold} />
            <Text style={[styles.tabText, activeTab === 'codes' && styles.tabTextActive]}>Codes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'promotions' && styles.tabButtonActive]}
            onPress={() => setActiveTab('promotions')}
          >
            <MaterialCommunityIcons name="sale" size={16} color={activeTab === 'promotions' ? COLORS.black : COLORS.gold} />
            <Text style={[styles.tabText, activeTab === 'promotions' && styles.tabTextActive]}>Promos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'clients' && styles.tabButtonActive]}
            onPress={() => setActiveTab('clients')}
          >
            <MaterialCommunityIcons name="account-group" size={16} color={activeTab === 'clients' ? COLORS.black : COLORS.gold} />
            <Text style={[styles.tabText, activeTab === 'clients' && styles.tabTextActive]}>Clients</Text>
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          >
            {activeTab === 'codes' ? (
              /* Promo Codes Tab */
              <View>
                <TouchableOpacity style={styles.addButton} onPress={() => { resetCodeForm(); setShowCodeModal(true); }}>
                  <LinearGradient colors={[COLORS.purple, '#7B1FA2']} style={styles.addButtonGradient}>
                    <Ionicons name="add" size={20} color={COLORS.white} />
                    <Text style={styles.addButtonText}>Nouveau Code Promo</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {promoCodes.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="ticket-outline" size={48} color={COLORS.gray} />
                    <Text style={styles.emptyText}>Aucun code promo</Text>
                  </View>
                ) : (
                  promoCodes.map((code) => (
                    <View key={code.id} style={styles.promoCard}>
                      <View style={styles.promoHeader}>
                        <View style={styles.codeBox}>
                          <Text style={styles.codeText}>{code.code}</Text>
                        </View>
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>-{code.discount_percent}%</Text>
                        </View>
                      </View>
                      
                      {code.description && (
                        <Text style={styles.promoDescription}>{code.description}</Text>
                      )}
                      
                      <View style={styles.promoDetails}>
                        <View style={styles.promoDetail}>
                          <Ionicons name="cart" size={14} color={COLORS.gray} />
                          <Text style={styles.promoDetailText}>Min: {code.min_order_amount}€</Text>
                        </View>
                        <View style={styles.promoDetail}>
                          <Ionicons name="people" size={14} color={COLORS.gray} />
                          <Text style={styles.promoDetailText}>
                            {code.current_uses}/{code.max_uses || '∞'} utilisés
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.promoFooter}>
                        <View style={[styles.statusBadge, { backgroundColor: code.status === 'active' ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)' }]}>
                          <Text style={[styles.statusText, { color: code.status === 'active' ? COLORS.success : COLORS.error }]}>
                            {code.status === 'active' ? 'Actif' : 'Désactivé'}
                          </Text>
                        </View>
                        <View style={styles.promoActions}>
                          <Switch
                            value={code.status === 'active'}
                            onValueChange={() => handleToggleCode(code)}
                            trackColor={{ false: COLORS.error, true: COLORS.success }}
                            thumbColor={COLORS.white}
                          />
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteCode(code)}>
                            <Ionicons name="trash" size={18} color={COLORS.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : (
              /* Product Promotions Tab */
              <View>
                <TouchableOpacity style={styles.addButton} onPress={() => { resetPromoForm(); setShowPromoModal(true); }}>
                  <LinearGradient colors={[COLORS.warning, '#E65100']} style={styles.addButtonGradient}>
                    <Ionicons name="add" size={20} color={COLORS.white} />
                    <Text style={styles.addButtonText}>Nouvelle Promotion</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {promotions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="sale" size={48} color={COLORS.gray} />
                    <Text style={styles.emptyText}>Aucune promotion</Text>
                  </View>
                ) : (
                  promotions.map((promo) => (
                    <View key={promo.id} style={styles.promoCard}>
                      <View style={styles.promoHeader}>
                        <Text style={styles.promoName}>{promo.name}</Text>
                        <View style={[styles.discountBadge, { backgroundColor: COLORS.warning }]}>
                          <Text style={styles.discountText}>-{promo.discount_percent}%</Text>
                        </View>
                      </View>
                      
                      <View style={styles.promoDetails}>
                        <View style={styles.promoDetail}>
                          <Ionicons name="pricetag" size={14} color={COLORS.gray} />
                          <Text style={styles.promoDetailText}>
                            Appliqué sur: {getAppliestoLabel(promo.applies_to, promo.category_id)}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.promoFooter}>
                        <View style={[styles.statusBadge, { backgroundColor: promo.is_active ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)' }]}>
                          <Text style={[styles.statusText, { color: promo.is_active ? COLORS.success : COLORS.error }]}>
                            {promo.is_active ? 'Active' : 'Désactivée'}
                          </Text>
                        </View>
                        <View style={styles.promoActions}>
                          <Switch
                            value={promo.is_active}
                            onValueChange={() => handleTogglePromotion(promo)}
                            trackColor={{ false: COLORS.error, true: COLORS.success }}
                            thumbColor={COLORS.white}
                          />
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePromotion(promo)}>
                            <Ionicons name="trash" size={18} color={COLORS.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
            
            {/* Clients Tab */}
            {activeTab === 'clients' && (
              <View>
                {/* Stats Cards */}
                {customerStats && (
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <MaterialCommunityIcons name="account-group" size={24} color={COLORS.gold} />
                      <Text style={styles.statNumber}>{customerStats.total_customers}</Text>
                      <Text style={styles.statLabel}>Total Clients</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: 'rgba(156,39,176,0.15)' }]}>
                      <MaterialCommunityIcons name="crown" size={24} color={COLORS.purple} />
                      <Text style={[styles.statNumber, { color: COLORS.purple }]}>{customerStats.premium_subscribers}</Text>
                      <Text style={styles.statLabel}>Premium</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: 'rgba(76,175,80,0.15)' }]}>
                      <MaterialCommunityIcons name="star-circle" size={24} color={COLORS.success} />
                      <Text style={[styles.statNumber, { color: COLORS.success }]}>{customerStats.loyal_customers}</Text>
                      <Text style={styles.statLabel}>Fidèles</Text>
                    </View>
                  </View>
                )}

                {/* Filter Buttons */}
                <View style={styles.filterRow}>
                  <TouchableOpacity
                    style={[styles.filterBtn, customerFilter === 'all' && styles.filterBtnActive]}
                    onPress={() => setCustomerFilter('all')}
                  >
                    <Text style={[styles.filterText, customerFilter === 'all' && styles.filterTextActive]}>Tous</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterBtn, customerFilter === 'premium' && styles.filterBtnActive]}
                    onPress={() => setCustomerFilter('premium')}
                  >
                    <MaterialCommunityIcons name="crown" size={14} color={customerFilter === 'premium' ? COLORS.black : COLORS.purple} />
                    <Text style={[styles.filterText, customerFilter === 'premium' && styles.filterTextActive]}>Premium</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.filterBtn, customerFilter === 'loyal' && styles.filterBtnActive]}
                    onPress={() => setCustomerFilter('loyal')}
                  >
                    <MaterialCommunityIcons name="star" size={14} color={customerFilter === 'loyal' ? COLORS.black : COLORS.success} />
                    <Text style={[styles.filterText, customerFilter === 'loyal' && styles.filterTextActive]}>Fidèles</Text>
                  </TouchableOpacity>
                </View>

                {/* Customer List */}
                {getFilteredCustomers().length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="account-off" size={48} color={COLORS.gray} />
                    <Text style={styles.emptyText}>Aucun client trouvé</Text>
                  </View>
                ) : (
                  getFilteredCustomers().map((customer, idx) => (
                    <TouchableOpacity
                      key={customer.phone || idx}
                      style={styles.customerCard}
                      onPress={() => openCustomerModal(customer)}
                    >
                      <View style={styles.customerHeader}>
                        <View style={styles.customerInfo}>
                          <View style={styles.customerAvatar}>
                            <MaterialCommunityIcons name="account" size={24} color={COLORS.gold} />
                          </View>
                          <View>
                            <Text style={styles.customerName}>{customer.full_name || 'Client'}</Text>
                            <Text style={styles.customerPhone}>{customer.phone}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                      </View>
                      
                      <View style={styles.customerBadges}>
                        {customer.is_premium_active && (
                          <View style={styles.premiumBadge}>
                            <MaterialCommunityIcons name="crown" size={12} color={COLORS.purple} />
                            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                          </View>
                        )}
                        {customer.loyalty_discount_unlocked && (
                          <View style={styles.loyalBadge}>
                            <MaterialCommunityIcons name="star" size={12} color={COLORS.success} />
                            <Text style={styles.loyalBadgeText}>FIDÈLE -15%</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.customerStats}>
                        <View style={styles.customerStat}>
                          <Ionicons name="receipt" size={14} color={COLORS.gray} />
                          <Text style={styles.customerStatText}>{customer.total_orders} commandes</Text>
                        </View>
                        {customer.is_premium_active && customer.premium_expires_at && (
                          <View style={styles.customerStat}>
                            <Ionicons name="calendar" size={14} color={COLORS.gray} />
                            <Text style={styles.customerStatText}>Expire: {formatDate(customer.premium_expires_at)}</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.customerActions}>
                        <TouchableOpacity
                          style={[styles.quickActionBtn, customer.is_premium_active ? styles.quickActionBtnDanger : styles.quickActionBtnPremium]}
                          onPress={(e) => { e.stopPropagation(); handleTogglePremium(customer); }}
                        >
                          <MaterialCommunityIcons name="crown" size={14} color={COLORS.white} />
                          <Text style={styles.quickActionText}>
                            {customer.is_premium_active ? 'Retirer' : 'Activer'} Premium
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Promo Code Modal */}
        <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => setShowCodeModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouveau Code Promo</Text>
                <TouchableOpacity onPress={() => setShowCodeModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <Text style={styles.formLabel}>Code *</Text>
                <TextInput
                  style={styles.formInput}
                  value={codeForm.code}
                  onChangeText={(t) => setCodeForm({ ...codeForm, code: t.toUpperCase() })}
                  placeholder="Ex: KIZA20"
                  placeholderTextColor={COLORS.gray}
                  autoCapitalize="characters"
                />

                <Text style={styles.formLabel}>Réduction (%) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={codeForm.discount_percent}
                  onChangeText={(t) => setCodeForm({ ...codeForm, discount_percent: t })}
                  placeholder="Ex: 20"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="numeric"
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={styles.formInput}
                  value={codeForm.description}
                  onChangeText={(t) => setCodeForm({ ...codeForm, description: t })}
                  placeholder="Ex: Offre de bienvenue"
                  placeholderTextColor={COLORS.gray}
                />

                <Text style={styles.formLabel}>Commande minimum (€)</Text>
                <TextInput
                  style={styles.formInput}
                  value={codeForm.min_order_amount}
                  onChangeText={(t) => setCodeForm({ ...codeForm, min_order_amount: t })}
                  placeholder="Ex: 15"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="numeric"
                />

                <Text style={styles.formLabel}>Utilisations max</Text>
                <TextInput
                  style={styles.formInput}
                  value={codeForm.max_uses}
                  onChangeText={(t) => setCodeForm({ ...codeForm, max_uses: t })}
                  placeholder="Laisser vide = illimité"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="numeric"
                />
              </ScrollView>

              <TouchableOpacity style={styles.modalSaveButton} onPress={handleCreateCode}>
                <LinearGradient colors={[COLORS.purple, '#7B1FA2']} style={styles.saveButtonGradient}>
                  <Ionicons name="checkmark" size={20} color={COLORS.white} />
                  <Text style={[styles.saveButtonText, { color: COLORS.white }]}>Créer le code</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Product Promotion Modal */}
        <Modal visible={showPromoModal} transparent animationType="slide" onRequestClose={() => setShowPromoModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle Promotion</Text>
                <TouchableOpacity onPress={() => setShowPromoModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <Text style={styles.formLabel}>Nom *</Text>
                <TextInput
                  style={styles.formInput}
                  value={promoForm.name}
                  onChangeText={(t) => setPromoForm({ ...promoForm, name: t })}
                  placeholder="Ex: Promo Grillades"
                  placeholderTextColor={COLORS.gray}
                />

                <Text style={styles.formLabel}>Réduction (%) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={promoForm.discount_percent}
                  onChangeText={(t) => setPromoForm({ ...promoForm, discount_percent: t })}
                  placeholder="Ex: 15"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="numeric"
                />

                <Text style={styles.formLabel}>Appliquer sur</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={promoForm.applies_to}
                    onValueChange={(v) => setPromoForm({ ...promoForm, applies_to: v })}
                    style={styles.picker}
                    dropdownIconColor={COLORS.gold}
                  >
                    <Picker.Item label="Tout le menu" value="all" color={COLORS.white} />
                    <Picker.Item label="Une catégorie" value="category" color={COLORS.white} />
                  </Picker>
                </View>

                {promoForm.applies_to === 'category' && (
                  <>
                    <Text style={styles.formLabel}>Catégorie</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={promoForm.category_id}
                        onValueChange={(v) => setPromoForm({ ...promoForm, category_id: v })}
                        style={styles.picker}
                        dropdownIconColor={COLORS.gold}
                      >
                        <Picker.Item label="-- Sélectionner --" value="" color={COLORS.gray} />
                        {categories.map((cat) => (
                          <Picker.Item key={cat.id} label={cat.name} value={cat.id} color={COLORS.white} />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}
              </ScrollView>

              <TouchableOpacity style={styles.modalSaveButton} onPress={handleCreatePromotion}>
                <LinearGradient colors={[COLORS.warning, '#E65100']} style={styles.saveButtonGradient}>
                  <Ionicons name="checkmark" size={20} color={COLORS.white} />
                  <Text style={[styles.saveButtonText, { color: COLORS.white }]}>Créer la promotion</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Customer Edit Modal */}
        <Modal visible={showCustomerModal} transparent animationType="slide" onRequestClose={() => setShowCustomerModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Modifier Client</Text>
                <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              {selectedCustomer && (
                <ScrollView style={styles.modalForm}>
                  <View style={styles.customerModalInfo}>
                    <View style={styles.customerModalAvatar}>
                      <MaterialCommunityIcons name="account" size={40} color={COLORS.gold} />
                    </View>
                    <Text style={styles.customerModalName}>{selectedCustomer.full_name || 'Client'}</Text>
                    <Text style={styles.customerModalPhone}>{selectedCustomer.phone}</Text>
                  </View>

                  <View style={styles.customerModalSection}>
                    <Text style={styles.formLabel}>Abonnement Premium</Text>
                    <View style={styles.premiumToggleRow}>
                      <Text style={styles.premiumToggleLabel}>
                        {selectedCustomer.is_premium_active ? 'Actif' : 'Inactif'}
                      </Text>
                      <Switch
                        value={selectedCustomer.is_premium_active}
                        onValueChange={() => handleTogglePremium(selectedCustomer)}
                        trackColor={{ false: COLORS.error, true: COLORS.success }}
                        thumbColor={COLORS.white}
                      />
                    </View>
                    {selectedCustomer.is_premium_active && selectedCustomer.premium_expires_at && (
                      <Text style={styles.premiumExpireText}>
                        Expire le: {formatDate(selectedCustomer.premium_expires_at)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.customerModalSection}>
                    <Text style={styles.formLabel}>Programme Fidélité</Text>
                    <Text style={styles.loyaltyInfo}>
                      {selectedCustomer.loyalty_discount_unlocked 
                        ? '✓ Réduction -15% débloquée !' 
                        : `${10 - selectedCustomer.total_orders} commande(s) restantes pour -15%`}
                    </Text>
                    
                    <Text style={[styles.formLabel, { marginTop: 16 }]}>Nombre de commandes</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editOrderCount}
                      onChangeText={setEditOrderCount}
                      placeholder="Nombre de commandes"
                      placeholderTextColor={COLORS.gray}
                      keyboardType="numeric"
                    />
                  </View>
                </ScrollView>
              )}

              <TouchableOpacity style={styles.modalSaveButton} onPress={handleUpdateLoyalty}>
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveButtonGradient}>
                  <Ionicons name="checkmark" size={20} color={COLORS.black} />
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
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
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  backButton: { position: 'absolute', top: 20, left: 0 },
  loginHeader: { alignItems: 'center', marginBottom: 40 },
  loginTitle: { fontSize: 32, fontWeight: 'bold', color: COLORS.gold, marginTop: 16 },
  loginSubtitle: { fontSize: 16, color: COLORS.gray, marginTop: 8 },
  loginForm: { marginBottom: 20 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  input: { flex: 1, height: 50, color: COLORS.white, fontSize: 16, marginLeft: 12 },
  loginButton: { borderRadius: 12, overflow: 'hidden' },
  loginButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  loginButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.black, marginRight: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.2)' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },
  tabNav: { flexDirection: 'row', padding: 12 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.blackMedium, marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  tabButtonActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gold, marginLeft: 6 },
  tabTextActive: { color: COLORS.black },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 16 },
  addButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  addButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  addButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.white, marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: COLORS.gray, marginTop: 16 },
  promoCard: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)' },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  codeBox: { backgroundColor: COLORS.purple, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  codeText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  promoName: { fontSize: 18, fontWeight: 'bold', color: COLORS.white, flex: 1 },
  discountBadge: { backgroundColor: COLORS.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  discountText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  promoDescription: { fontSize: 14, color: COLORS.gray, marginBottom: 12 },
  promoDetails: { marginBottom: 12 },
  promoDetail: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  promoDetailText: { fontSize: 13, color: COLORS.gray, marginLeft: 8 },
  promoFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  promoActions: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { padding: 8, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.blackLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },
  modalForm: { maxHeight: 350 },
  formLabel: { fontSize: 13, color: COLORS.goldLight, marginBottom: 8, marginTop: 12 },
  formInput: { backgroundColor: COLORS.blackMedium, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: 15, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  pickerContainer: { backgroundColor: COLORS.blackMedium, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', overflow: 'hidden' },
  picker: { color: COLORS.white, height: 50 },
  modalSaveButton: { borderRadius: 12, overflow: 'hidden', marginTop: 20 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  
  // Customer Tab Styles
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 12, padding: 12, alignItems: 'center', marginHorizontal: 4 },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold, marginTop: 4 },
  statLabel: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  filterRow: { flexDirection: 'row', marginBottom: 16 },
  filterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: COLORS.blackMedium, borderRadius: 8, marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  filterBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterText: { fontSize: 13, color: COLORS.gold, marginLeft: 4 },
  filterTextActive: { color: COLORS.black, fontWeight: '600' },
  customerCard: { backgroundColor: COLORS.blackMedium, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)' },
  customerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  customerInfo: { flexDirection: 'row', alignItems: 'center' },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212,175,55,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  customerName: { fontSize: 16, fontWeight: '600', color: COLORS.white },
  customerPhone: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  customerBadges: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(156,39,176,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, marginBottom: 4 },
  premiumBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.purple, marginLeft: 4 },
  loyalBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, marginBottom: 4 },
  loyalBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.success, marginLeft: 4 },
  customerStats: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  customerStat: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  customerStatText: { fontSize: 12, color: COLORS.gray, marginLeft: 6 },
  customerActions: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 },
  quickActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  quickActionBtnPremium: { backgroundColor: COLORS.purple },
  quickActionBtnDanger: { backgroundColor: COLORS.error },
  quickActionText: { fontSize: 13, fontWeight: '600', color: COLORS.white, marginLeft: 6 },
  customerModalInfo: { alignItems: 'center', marginBottom: 24 },
  customerModalAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(212,175,55,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  customerModalName: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  customerModalPhone: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  customerModalSection: { backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 14, marginBottom: 16 },
  premiumToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  premiumToggleLabel: { fontSize: 15, color: COLORS.white },
  premiumExpireText: { fontSize: 12, color: COLORS.gray, marginTop: 8 },
  loyaltyInfo: { fontSize: 14, color: COLORS.goldLight, marginTop: 8 },
});
