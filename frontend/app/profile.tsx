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
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

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

interface CustomerInfo {
  phone: string;
  full_name?: string;
  is_premium: boolean;
  premium_expires_at?: string;
  total_orders: number;
  loyalty_discount_unlocked: boolean;
}

interface SubscriptionInfo {
  name: string;
  price: number;
  benefits: string[];
  loyalty_info: {
    threshold: number;
    discount: number;
    description: string;
  };
}

export default function ProfileScreen() {
  const [phone, setPhone] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      const res = await api.get('/api/subscription/info');
      setSubscriptionInfo(res.data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const handleLogin = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/api/customer/${phone}?phone=${phone}`);
      setCustomerInfo(res.data);
      setIsLoggedIn(true);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger votre profil');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!phone) return;
    setRefreshing(true);
    try {
      const res = await api.get(`/api/customer/${phone}?phone=${phone}`);
      setCustomerInfo(res.data);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [phone]);

  const handleSubscribe = async () => {
    if (!customerInfo) return;

    try {
      setLoading(true);
      await api.post('/api/customer/subscribe', {
        phone: customerInfo.phone,
        full_name: customerInfo.full_name,
      });
      
      // Reload customer info
      const res = await api.get(`/api/customer/${phone}?phone=${phone}`);
      setCustomerInfo(res.data);
      
      Alert.alert(
        'Bienvenue chez KIZA PREMIUM !',
        'Vous bénéficiez maintenant de la livraison gratuite sur toutes vos commandes pendant 1 mois.',
        [{ text: 'Super !' }]
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de souscrire');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const isPremiumActive = () => {
    if (!customerInfo?.is_premium || !customerInfo?.premium_expires_at) return false;
    try {
      const expires = new Date(customerInfo.premium_expires_at);
      return expires > new Date();
    } catch {
      return false;
    }
  };

  const getDaysRemaining = () => {
    if (!customerInfo?.premium_expires_at) return 0;
    try {
      const expires = new Date(customerInfo.premium_expires_at);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
          <View style={styles.loginContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
            </TouchableOpacity>

            <View style={styles.loginHeader}>
              <MaterialCommunityIcons name="account-circle" size={64} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Mon Espace</Text>
              <Text style={styles.loginSubtitle}>Fidélité & Abonnement KIZA</Text>
            </View>

            <View style={styles.loginForm}>
              <Text style={styles.inputLabel}>Numéro de téléphone</Text>
              <View style={styles.inputGroup}>
                <Ionicons name="call" size={20} color={COLORS.gold} />
                <TextInput
                  style={styles.input}
                  placeholder="06 12 34 56 78"
                  placeholderTextColor={COLORS.gray}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>

              <TouchableOpacity 
                style={styles.loginButton} 
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.loginButtonGradient}>
                  {loading ? (
                    <ActivityIndicator color={COLORS.black} />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Accéder à mon espace</Text>
                      <Ionicons name="arrow-forward" size={20} color={COLORS.black} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>
              Entrez le numéro utilisé lors de vos commandes pour accéder à votre espace fidélité
            </Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Profile Screen
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <TouchableOpacity onPress={() => { setIsLoggedIn(false); setCustomerInfo(null); }}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <MaterialCommunityIcons name="account" size={40} color={COLORS.gold} />
            </View>
            <Text style={styles.profileName}>{customerInfo?.full_name || 'Client KIZA'}</Text>
            <Text style={styles.profilePhone}>{customerInfo?.phone}</Text>
          </View>

          {/* Premium Status */}
          {isPremiumActive() ? (
            <LinearGradient colors={['#9C27B0', '#673AB7']} style={styles.premiumCard}>
              <View style={styles.premiumHeader}>
                <MaterialCommunityIcons name="crown" size={32} color={COLORS.gold} />
                <Text style={styles.premiumTitle}>KIZA PREMIUM</Text>
              </View>
              <Text style={styles.premiumStatus}>Membre Actif</Text>
              <View style={styles.premiumBenefits}>
                <View style={styles.premiumBenefit}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <Text style={styles.premiumBenefitText}>Livraison GRATUITE illimitée</Text>
                </View>
              </View>
              <View style={styles.premiumExpiry}>
                <Ionicons name="calendar" size={16} color={COLORS.goldLight} />
                <Text style={styles.premiumExpiryText}>
                  Valide jusqu'au {formatDate(customerInfo?.premium_expires_at)} ({getDaysRemaining()} jours)
                </Text>
              </View>
            </LinearGradient>
          ) : (
            <TouchableOpacity onPress={handleSubscribe} disabled={loading}>
              <LinearGradient colors={[COLORS.blackMedium, COLORS.blackLight]} style={styles.subscribeCard}>
                <View style={styles.subscribeHeader}>
                  <MaterialCommunityIcons name="crown-outline" size={32} color={COLORS.gold} />
                  <View style={styles.subscribeHeaderText}>
                    <Text style={styles.subscribeTitle}>KIZA PREMIUM</Text>
                    <Text style={styles.subscribePrice}>{subscriptionInfo?.price || 9.99}€/mois</Text>
                  </View>
                </View>
                <View style={styles.subscribeBenefits}>
                  <View style={styles.subscribeBenefit}>
                    <Ionicons name="bicycle" size={18} color={COLORS.gold} />
                    <Text style={styles.subscribeBenefitText}>Livraison GRATUITE illimitée</Text>
                  </View>
                  <View style={styles.subscribeBenefit}>
                    <Ionicons name="flash" size={18} color={COLORS.gold} />
                    <Text style={styles.subscribeBenefitText}>Économisez 3€ par commande</Text>
                  </View>
                </View>
                <View style={styles.subscribeButton}>
                  {loading ? (
                    <ActivityIndicator color={COLORS.black} />
                  ) : (
                    <>
                      <Text style={styles.subscribeButtonText}>Devenir Premium</Text>
                      <Ionicons name="arrow-forward" size={18} color={COLORS.black} />
                    </>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Loyalty Status */}
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyHeader}>
              <MaterialCommunityIcons name="star-circle" size={28} color={COLORS.gold} />
              <Text style={styles.loyaltyTitle}>Programme Fidélité</Text>
            </View>

            {customerInfo?.loyalty_discount_unlocked ? (
              <View style={styles.loyaltyUnlocked}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                <View style={styles.loyaltyUnlockedText}>
                  <Text style={styles.loyaltyUnlockedTitle}>Félicitations !</Text>
                  <Text style={styles.loyaltyUnlockedDesc}>
                    Vous bénéficiez de -{subscriptionInfo?.loyalty_info?.discount || 15}% sur toutes vos commandes !
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.loyaltyDesc}>
                  Encore {Math.max(0, (subscriptionInfo?.loyalty_info?.threshold || 10) - (customerInfo?.total_orders || 0))} commande(s) pour débloquer -{subscriptionInfo?.loyalty_info?.discount || 15}% permanent !
                </Text>
                <View style={styles.loyaltyProgressContainer}>
                  <View style={styles.loyaltyProgressBar}>
                    <View 
                      style={[
                        styles.loyaltyProgressFill,
                        { width: `${Math.min(100, ((customerInfo?.total_orders || 0) / (subscriptionInfo?.loyalty_info?.threshold || 10)) * 100)}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.loyaltyProgressText}>
                    {customerInfo?.total_orders || 0}/{subscriptionInfo?.loyalty_info?.threshold || 10}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.orderCountCard}>
              <MaterialCommunityIcons name="receipt" size={24} color={COLORS.goldLight} />
              <View style={styles.orderCountText}>
                <Text style={styles.orderCountNumber}>{customerInfo?.total_orders || 0}</Text>
                <Text style={styles.orderCountLabel}>Commandes passées</Text>
              </View>
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Comment ça marche ?</Text>
            <View style={styles.infoItem}>
              <View style={styles.infoIconBg}>
                <Text style={styles.infoIcon}>1</Text>
              </View>
              <Text style={styles.infoItemText}>Commandez chez KIZA</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIconBg}>
                <Text style={styles.infoIcon}>2</Text>
              </View>
              <Text style={styles.infoItemText}>Cumulez vos commandes</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIconBg}>
                <Text style={styles.infoIcon}>3</Text>
              </View>
              <Text style={styles.infoItemText}>Après 10 commandes, profitez de -15% permanent !</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  gradient: { flex: 1 },
  
  // Login styles
  loginContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  backButton: { position: 'absolute', top: 20, left: 0 },
  loginHeader: { alignItems: 'center', marginBottom: 40 },
  loginTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.gold, marginTop: 16 },
  loginSubtitle: { fontSize: 14, color: COLORS.gray, marginTop: 8 },
  loginForm: { marginBottom: 20 },
  inputLabel: { fontSize: 13, color: COLORS.goldLight, marginBottom: 8 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  input: { flex: 1, height: 50, color: COLORS.white, fontSize: 16, marginLeft: 12 },
  loginButton: { borderRadius: 12, overflow: 'hidden' },
  loginButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  loginButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, marginRight: 8 },
  infoText: { fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 20 },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.2)' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold },
  
  // Content
  content: { flex: 1 },
  contentContainer: { padding: 16 },
  
  // Profile Card
  profileCard: { alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212,175,55,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: COLORS.white },
  profilePhone: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  
  // Premium Card
  premiumCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  premiumTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.white, marginLeft: 12 },
  premiumStatus: { fontSize: 14, color: COLORS.goldLight, marginBottom: 16 },
  premiumBenefits: { marginBottom: 16 },
  premiumBenefit: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  premiumBenefitText: { fontSize: 14, color: COLORS.white, marginLeft: 10 },
  premiumExpiry: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 },
  premiumExpiryText: { fontSize: 12, color: COLORS.goldLight, marginLeft: 8 },
  
  // Subscribe Card
  subscribeCard: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: COLORS.gold, borderStyle: 'dashed' },
  subscribeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  subscribeHeaderText: { marginLeft: 12 },
  subscribeTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold },
  subscribePrice: { fontSize: 14, color: COLORS.gray },
  subscribeBenefits: { marginBottom: 16 },
  subscribeBenefit: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  subscribeBenefitText: { fontSize: 14, color: COLORS.white, marginLeft: 12 },
  subscribeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold, borderRadius: 12, paddingVertical: 14 },
  subscribeButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, marginRight: 8 },
  
  // Loyalty Card
  loyaltyCard: { backgroundColor: COLORS.blackMedium, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  loyaltyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  loyaltyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold, marginLeft: 10 },
  loyaltyDesc: { fontSize: 14, color: COLORS.gray, marginBottom: 16 },
  loyaltyProgressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loyaltyProgressBar: { flex: 1, height: 12, backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: 6, overflow: 'hidden', marginRight: 12 },
  loyaltyProgressFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 6 },
  loyaltyProgressText: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold, minWidth: 45 },
  loyaltyUnlocked: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 12, padding: 16, marginBottom: 16 },
  loyaltyUnlockedText: { marginLeft: 12, flex: 1 },
  loyaltyUnlockedTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.success },
  loyaltyUnlockedDesc: { fontSize: 13, color: COLORS.white, marginTop: 4 },
  orderCountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.black, borderRadius: 12, padding: 16 },
  orderCountText: { marginLeft: 14 },
  orderCountNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold },
  orderCountLabel: { fontSize: 12, color: COLORS.gray },
  
  // Info Section
  infoSection: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  infoSectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.gold, marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  infoIconBg: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoIcon: { fontSize: 14, fontWeight: 'bold', color: COLORS.black },
  infoItemText: { fontSize: 14, color: COLORS.white, flex: 1 },
});
