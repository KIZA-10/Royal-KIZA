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
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
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
  info: '#2196F3',
};

const { width } = Dimensions.get('window');

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

interface FinanceStats {
  revenue: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  orders: {
    total: number;
    delivered: number;
    pending: number;
    average_value: number;
  };
  transactions: {
    paid: number;
    pending: number;
  };
  charts: {
    daily: Array<{ date: string; amount: number }>;
    monthly: Array<{ month: string; amount: number }>;
  };
}

interface Transaction {
  id: string;
  order_id: string;
  order_number?: string;
  customer_name?: string;
  amount: number;
  currency: string;
  status: string;
  payment_status: string;
  created_at: string;
}

export default function FinanceDashboardScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');
  
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartType, setChartType] = useState<'daily' | 'monthly'>('daily');

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
      const [statsRes, txRes] = await Promise.all([
        api.get('/api/finance/stats'),
        api.get('/api/finance/transactions?limit=50'),
      ]);
      setStats(statsRes.data);
      setTransactions(txRes.data);
    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData().finally(() => setRefreshing(false));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatChartDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  const formatMonth = (monthStr: string) => {
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const parts = monthStr.split('-');
    if (parts.length === 2) {
      const monthIndex = parseInt(parts[1]) - 1;
      return monthNames[monthIndex] || monthStr;
    }
    return monthStr;
  };

  const getMaxValue = (data: Array<{ amount: number }>) => {
    const max = Math.max(...data.map(d => d.amount), 1);
    return max;
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
              <MaterialCommunityIcons name="chart-line" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Finances</Text>
              <Text style={styles.loginSubtitle}>Tableau de bord</Text>
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
          <Text style={styles.headerTitle}>Finances</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
            onPress={() => setActiveTab('overview')}
          >
            <MaterialCommunityIcons 
              name="chart-bar" 
              size={18} 
              color={activeTab === 'overview' ? COLORS.black : COLORS.gold} 
            />
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
              Aperçu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'transactions' && styles.tabButtonActive]}
            onPress={() => setActiveTab('transactions')}
          >
            <Ionicons 
              name="list" 
              size={18} 
              color={activeTab === 'transactions' ? COLORS.black : COLORS.gold} 
            />
            <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
              Transactions
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
            {activeTab === 'overview' && stats ? (
              <View>
                {/* Revenue Cards */}
                <View style={styles.revenueGrid}>
                  <View style={styles.revenueCardMain}>
                    <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.revenueCardGradient}>
                      <Text style={styles.revenueMainLabel}>Revenus Total</Text>
                      <Text style={styles.revenueMainValue}>{stats.revenue.total.toFixed(2)}€</Text>
                      <View style={styles.revenueMainIcon}>
                        <MaterialCommunityIcons name="cash-multiple" size={32} color="rgba(0,0,0,0.3)" />
                      </View>
                    </LinearGradient>
                  </View>
                </View>

                <View style={styles.revenueRow}>
                  <View style={[styles.revenueCard, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                    <Ionicons name="today" size={24} color={COLORS.success} />
                    <Text style={styles.revenueLabel}>Aujourd'hui</Text>
                    <Text style={[styles.revenueValue, { color: COLORS.success }]}>
                      {stats.revenue.today.toFixed(2)}€
                    </Text>
                  </View>
                  <View style={[styles.revenueCard, { backgroundColor: 'rgba(33, 150, 243, 0.15)' }]}>
                    <Ionicons name="calendar" size={24} color={COLORS.info} />
                    <Text style={styles.revenueLabel}>Cette semaine</Text>
                    <Text style={[styles.revenueValue, { color: COLORS.info }]}>
                      {stats.revenue.week.toFixed(2)}€
                    </Text>
                  </View>
                  <View style={[styles.revenueCard, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
                    <Ionicons name="calendar-outline" size={24} color={COLORS.warning} />
                    <Text style={styles.revenueLabel}>Ce mois</Text>
                    <Text style={[styles.revenueValue, { color: COLORS.warning }]}>
                      {stats.revenue.month.toFixed(2)}€
                    </Text>
                  </View>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsSection}>
                  <Text style={styles.sectionTitle}>Statistiques</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statsCard}>
                      <FontAwesome5 name="shopping-bag" size={20} color={COLORS.gold} />
                      <Text style={styles.statsValue}>{stats.orders.total}</Text>
                      <Text style={styles.statsLabel}>Commandes</Text>
                    </View>
                    <View style={styles.statsCard}>
                      <FontAwesome5 name="check-circle" size={20} color={COLORS.success} />
                      <Text style={styles.statsValue}>{stats.orders.delivered}</Text>
                      <Text style={styles.statsLabel}>Livrées</Text>
                    </View>
                    <View style={styles.statsCard}>
                      <FontAwesome5 name="clock" size={20} color={COLORS.warning} />
                      <Text style={styles.statsValue}>{stats.orders.pending}</Text>
                      <Text style={styles.statsLabel}>En cours</Text>
                    </View>
                    <View style={styles.statsCard}>
                      <FontAwesome5 name="euro-sign" size={20} color={COLORS.info} />
                      <Text style={styles.statsValue}>{stats.orders.average_value.toFixed(0)}€</Text>
                      <Text style={styles.statsLabel}>Panier moyen</Text>
                    </View>
                  </View>
                </View>

                {/* Chart Section */}
                <View style={styles.chartSection}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.sectionTitle}>Tendances</Text>
                    <View style={styles.chartToggle}>
                      <TouchableOpacity
                        style={[styles.chartToggleBtn, chartType === 'daily' && styles.chartToggleBtnActive]}
                        onPress={() => setChartType('daily')}
                      >
                        <Text style={[styles.chartToggleText, chartType === 'daily' && styles.chartToggleTextActive]}>
                          7 jours
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chartToggleBtn, chartType === 'monthly' && styles.chartToggleBtnActive]}
                        onPress={() => setChartType('monthly')}
                      >
                        <Text style={[styles.chartToggleText, chartType === 'monthly' && styles.chartToggleTextActive]}>
                          6 mois
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Simple Bar Chart */}
                  <View style={styles.chart}>
                    {(chartType === 'daily' ? stats.charts.daily : stats.charts.monthly).map((item, idx) => {
                      const data = chartType === 'daily' ? stats.charts.daily : stats.charts.monthly;
                      const maxVal = getMaxValue(data);
                      const barHeight = maxVal > 0 ? (item.amount / maxVal) * 120 : 0;
                      
                      return (
                        <View key={idx} style={styles.chartBar}>
                          <Text style={styles.chartValue}>
                            {item.amount > 0 ? `${item.amount.toFixed(0)}€` : ''}
                          </Text>
                          <View style={styles.chartBarContainer}>
                            <LinearGradient
                              colors={[COLORS.gold, COLORS.goldDark]}
                              style={[styles.chartBarFill, { height: Math.max(barHeight, 4) }]}
                            />
                          </View>
                          <Text style={styles.chartLabel}>
                            {chartType === 'daily' 
                              ? formatChartDate(item.date)
                              : formatMonth(item.month)
                            }
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Payment Status */}
                <View style={styles.paymentSection}>
                  <Text style={styles.sectionTitle}>Paiements</Text>
                  <View style={styles.paymentRow}>
                    <View style={[styles.paymentCard, { borderLeftColor: COLORS.success }]}>
                      <MaterialCommunityIcons name="check-circle" size={28} color={COLORS.success} />
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentCount}>{stats.transactions.paid}</Text>
                        <Text style={styles.paymentLabel}>Payés</Text>
                      </View>
                    </View>
                    <View style={[styles.paymentCard, { borderLeftColor: COLORS.warning }]}>
                      <MaterialCommunityIcons name="clock-outline" size={28} color={COLORS.warning} />
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentCount}>{stats.transactions.pending}</Text>
                        <Text style={styles.paymentLabel}>En attente</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Stripe Info */}
                <View style={styles.stripeInfo}>
                  <MaterialCommunityIcons name="credit-card" size={24} color={COLORS.gold} />
                  <View style={styles.stripeTextContainer}>
                    <Text style={styles.stripeTitle}>Virements Stripe</Text>
                    <Text style={styles.stripeText}>
                      Les fonds sont transférés automatiquement sur votre compte bancaire selon vos paramètres Stripe.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              /* Transactions Tab */
              <View>
                <Text style={styles.sectionTitle}>Historique des transactions</Text>
                
                {transactions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="credit-card-off" size={48} color={COLORS.gray} />
                    <Text style={styles.emptyText}>Aucune transaction</Text>
                    <Text style={styles.emptySubtext}>Les paiements apparaîtront ici</Text>
                  </View>
                ) : (
                  transactions.map((tx) => (
                    <View key={tx.id} style={styles.transactionCard}>
                      <View style={styles.transactionLeft}>
                        <View style={[
                          styles.transactionIcon,
                          { backgroundColor: tx.payment_status === 'paid' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)' }
                        ]}>
                          <MaterialCommunityIcons 
                            name={tx.payment_status === 'paid' ? 'check' : 'clock-outline'} 
                            size={20} 
                            color={tx.payment_status === 'paid' ? COLORS.success : COLORS.warning} 
                          />
                        </View>
                        <View style={styles.transactionInfo}>
                          <Text style={styles.transactionCustomer}>
                            {tx.customer_name || 'Client'}
                          </Text>
                          <Text style={styles.transactionOrder}>
                            #{tx.order_number?.slice(-8) || tx.order_id.slice(-8)}
                          </Text>
                          <Text style={styles.transactionDate}>{formatDate(tx.created_at)}</Text>
                        </View>
                      </View>
                      <View style={styles.transactionRight}>
                        <Text style={styles.transactionAmount}>
                          +{tx.amount.toFixed(2)}€
                        </Text>
                        <View style={[
                          styles.transactionStatus,
                          { backgroundColor: tx.payment_status === 'paid' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 152, 0, 0.15)' }
                        ]}>
                          <Text style={[
                            styles.transactionStatusText,
                            { color: tx.payment_status === 'paid' ? COLORS.success : COLORS.warning }
                          ]}>
                            {tx.payment_status === 'paid' ? 'Payé' : 'En attente'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
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

  // Revenue Cards
  revenueGrid: { marginBottom: 16 },
  revenueCardMain: { borderRadius: 20, overflow: 'hidden' },
  revenueCardGradient: { padding: 24, position: 'relative' },
  revenueMainLabel: { fontSize: 14, color: 'rgba(0,0,0,0.6)', fontWeight: '500' },
  revenueMainValue: { fontSize: 36, fontWeight: 'bold', color: COLORS.black, marginTop: 8 },
  revenueMainIcon: { position: 'absolute', right: 20, bottom: 20 },

  revenueRow: { flexDirection: 'row', marginBottom: 20 },
  revenueCard: { flex: 1, borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center' },
  revenueLabel: { fontSize: 11, color: COLORS.gray, marginTop: 8, textAlign: 'center' },
  revenueValue: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },

  // Stats Section
  statsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statsCard: { width: '48%', backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginBottom: 8, marginHorizontal: '1%', alignItems: 'center' },
  statsValue: { fontSize: 24, fontWeight: 'bold', color: COLORS.white, marginTop: 8 },
  statsLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },

  // Chart Section
  chartSection: { marginBottom: 24 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartToggle: { flexDirection: 'row', backgroundColor: COLORS.blackMedium, borderRadius: 8, padding: 4 },
  chartToggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  chartToggleBtnActive: { backgroundColor: COLORS.gold },
  chartToggleText: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },
  chartToggleTextActive: { color: COLORS.black },

  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, paddingTop: 24, minHeight: 200 },
  chartBar: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  chartValue: { fontSize: 9, color: COLORS.goldLight, marginBottom: 4, height: 14 },
  chartBarContainer: { width: '80%', height: 120, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBarFill: { width: '100%', borderRadius: 4 },
  chartLabel: { fontSize: 10, color: COLORS.gray, marginTop: 8 },

  // Payment Section
  paymentSection: { marginBottom: 24 },
  paymentRow: { flexDirection: 'row' },
  paymentCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginHorizontal: 4, borderLeftWidth: 4 },
  paymentInfo: { marginLeft: 12 },
  paymentCount: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
  paymentLabel: { fontSize: 12, color: COLORS.gray },

  // Stripe Info
  stripeInfo: { flexDirection: 'row', backgroundColor: 'rgba(212, 175, 55, 0.1)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  stripeTextContainer: { flex: 1, marginLeft: 12 },
  stripeTitle: { fontSize: 14, fontWeight: '600', color: COLORS.gold },
  stripeText: { fontSize: 12, color: COLORS.gray, marginTop: 4, lineHeight: 18 },

  // Transactions
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: COLORS.gray, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: COLORS.gray, marginTop: 8 },

  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginBottom: 10 },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  transactionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  transactionInfo: { marginLeft: 12, flex: 1 },
  transactionCustomer: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  transactionOrder: { fontSize: 12, color: COLORS.gold, marginTop: 2 },
  transactionDate: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  transactionRight: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 18, fontWeight: 'bold', color: COLORS.success },
  transactionStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  transactionStatusText: { fontSize: 11, fontWeight: '600' },
});
