import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Linking,
  KeyboardAvoidingView,
  Modal,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

// API Configuration
const API_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
  process.env.EXPO_PUBLIC_BACKEND_URL || 
  'https://dev-preview-223.preview.emergentagent.com';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});

// Types
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  available: boolean;
  quantity_info?: string;
  in_stock?: boolean;
  is_bestseller?: boolean;
}

interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface DeliveryAddress {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  additional_info?: string;
}

interface RestaurantInfo {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  delivery_radius_km: number;
  delivery_fee: number;
  free_delivery_minimum: number;
  social_media: {
    snapchat: string;
    instagram: string;
    tiktok: string;
  };
  categories: Array<{ id: string; name: string; icon: string }>;
}

// Theme Colors
const COLORS = {
  gold: '#D4AF37',
  goldLight: '#F4E4BA',
  goldDark: '#B8860B',
  goldAccent: '#FFD700',
  black: '#0a0a0a',
  blackLight: '#1a1a1a',
  blackMedium: '#2a2a2a',
  blackSoft: '#1f1f1f',
  white: '#ffffff',
  gray: '#888888',
  grayLight: '#cccccc',
  success: '#4CAF50',
  error: '#f44336',
};

// Food Images - Using high quality food images
const FOOD_IMAGES = {
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
  grillade: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop',
  dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop',
  boisson: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop',
  entree: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop',
  plat: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop',
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
  interior: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&h=600&fit=crop',
};

// Category Images
const CATEGORY_IMAGES: { [key: string]: string } = {
  entrees: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&h=200&fit=crop',
  grillades: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=200&fit=crop',
  plats: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&h=200&fit=crop',
  poissons: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=300&h=200&fit=crop',
  accompagnements: 'https://images.unsplash.com/photo-1529313780224-1a12b68bed16?w=300&h=200&fit=crop',
  desserts: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300&h=200&fit=crop',
  boissons: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop',
};

// Menu Item Images based on category - uses custom image if available
const getMenuItemImage = (category: string, name: string, customImageUrl?: string | null): string => {
  // If custom image URL exists, use it
  if (customImageUrl) {
    return customImageUrl;
  }
  
  const images: { [key: string]: string[] } = {
    entrees: [
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop',
    ],
    grillades: [
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=300&h=200&fit=crop',
    ],
    plats: [
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&h=200&fit=crop',
    ],
    poissons: [
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=300&h=200&fit=crop',
    ],
    accompagnements: [
      'https://images.unsplash.com/photo-1529313780224-1a12b68bed16?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1518013431117-eb1465fa5752?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=300&h=200&fit=crop',
    ],
    desserts: [
      'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=200&fit=crop',
    ],
    boissons: [
      'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=300&h=200&fit=crop',
      'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=300&h=200&fit=crop',
    ],
  };
  
  const categoryImages = images[category] || images.entrees;
  const index = name.length % categoryImages.length;
  return categoryImages[index];
};

export default function KizaRestaurant() {
  // States
  const [currentScreen, setCurrentScreen] = useState<'home' | 'menu' | 'cart' | 'checkout' | 'contact' | 'order_success' | 'chat' | 'reviews'>('home');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [bestsellers, setBestsellers] = useState<MenuItem[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('entrees');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe'>('stripe');
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewName, setReviewName] = useState('');
  
  // Promo & Loyalty State
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{code: string; discount_percent: number; discount_amount: number; description?: string} | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{is_premium: boolean; loyalty_discount_unlocked: boolean; total_orders: number; premium_expires_at?: string} | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{price: number; benefits: string[]; loyalty_info: {threshold: number; discount: number}} | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [discountsLoading, setDiscountsLoading] = useState(false);
  
  // Delivery Address State
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    full_name: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    additional_info: '',
  });

  // Load data on mount
  useEffect(() => {
    loadInitialData();
    loadCart();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [menuRes, infoRes, bestsellersRes] = await Promise.all([
        api.get('/menu'),
        api.get('/restaurant-info'),
        api.get('/menu/bestsellers'),
      ]);
      setMenuItems(menuRes.data);
      setRestaurantInfo(infoRes.data);
      setBestsellers(bestsellersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const loadCart = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('kiza_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCart = async (newCart: CartItem[]) => {
    try {
      await AsyncStorage.setItem('kiza_cart', JSON.stringify(newCart));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addToCart = (item: MenuItem, quantity: number = 1) => {
    // Block if item is out of stock
    if (item.in_stock === false) {
      Alert.alert(
        'Rupture de stock',
        `Désolé, "${item.name}" n'est plus disponible actuellement.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    const existingIndex = cart.findIndex(c => c.menu_item_id === item.id);
    let newCart: CartItem[];
    
    if (existingIndex > -1) {
      newCart = [...cart];
      newCart[existingIndex].quantity += quantity;
    } else {
      newCart = [...cart, {
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: quantity,
      }];
    }
    
    setCart(newCart);
    saveCart(newCart);
    setShowItemModal(false);
    setItemQuantity(1);
  };

  const removeFromCart = (menuItemId: string) => {
    const newCart = cart.filter(c => c.menu_item_id !== menuItemId);
    setCart(newCart);
    saveCart(newCart);
  };

  const updateCartQuantity = (menuItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(menuItemId);
      return;
    }
    const newCart = cart.map(c => 
      c.menu_item_id === menuItemId ? { ...c, quantity: newQuantity } : c
    );
    setCart(newCart);
    saveCart(newCart);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getDeliveryFee = () => {
    // Free delivery for KIZA PREMIUM members
    if (customerInfo?.is_premium) {
      const expiresAt = customerInfo.premium_expires_at;
      if (expiresAt) {
        const expires = new Date(expiresAt);
        if (expires > new Date()) {
          return 0;
        }
      }
    }
    
    const total = getCartTotal();
    if (restaurantInfo && total >= restaurantInfo.free_delivery_minimum) {
      return 0;
    }
    return restaurantInfo?.delivery_fee || 3.00;
  };

  // Load customer info when phone changes in checkout
  const loadCustomerInfo = async (phone: string) => {
    if (!phone || phone.length < 10) return;
    try {
      const res = await api.get(`/customer/${phone}?phone=${phone}`);
      setCustomerInfo(res.data);
    } catch (error) {
      console.error('Error loading customer:', error);
      setCustomerInfo(null);
    }
  };

  // Load subscription info on mount
  const loadSubscriptionInfo = async () => {
    try {
      const res = await api.get('/subscription/info');
      setSubscriptionInfo(res.data);
    } catch (error) {
      console.error('Error loading subscription info:', error);
    }
  };

  // Validate promo code
  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoError('Veuillez entrer un code promo');
      return;
    }
    
    setDiscountsLoading(true);
    setPromoError('');
    
    try {
      const res = await api.post(`/promo-codes/validate?code=${promoCode}&order_amount=${getCartTotal()}`);
      setAppliedPromo({
        code: res.data.code,
        discount_percent: res.data.discount_percent,
        discount_amount: res.data.discount_amount,
        description: res.data.description,
      });
      setPromoError('');
    } catch (error: any) {
      setPromoError(error.response?.data?.detail || 'Code promo invalide');
      setAppliedPromo(null);
    } finally {
      setDiscountsLoading(false);
    }
  };

  // Remove applied promo
  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  // Subscribe to KIZA PREMIUM
  const subscribeToPremium = async () => {
    if (!deliveryAddress.phone || deliveryAddress.phone.length < 10) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro de téléphone dans le formulaire');
      return;
    }
    
    try {
      setLoading(true);
      await api.post('/customer/subscribe', {
        phone: deliveryAddress.phone,
        full_name: deliveryAddress.full_name || undefined,
      });
      
      // Reload customer info
      await loadCustomerInfo(deliveryAddress.phone);
      setShowPremiumModal(false);
      
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

  // Calculate total with discounts
  const calculateFinalTotal = () => {
    let subtotal = getCartTotal();
    let discount = 0;
    
    // Apply loyalty discount (15%)
    if (customerInfo?.loyalty_discount_unlocked) {
      discount += subtotal * 0.15;
    }
    
    // Apply promo code discount
    if (appliedPromo) {
      discount += subtotal * (appliedPromo.discount_percent / 100);
    }
    
    const delivery = getDeliveryFee();
    return Math.max(0, subtotal - discount) + delivery;
  };

  // Get all applicable discounts for display
  const getActiveDiscounts = () => {
    const discounts: {name: string; amount: number; type: string}[] = [];
    const subtotal = getCartTotal();
    
    // Premium free delivery
    if (customerInfo?.is_premium && getDeliveryFee() === 0) {
      discounts.push({
        name: 'KIZA PREMIUM - Livraison gratuite',
        amount: restaurantInfo?.delivery_fee || 3.00,
        type: 'premium'
      });
    }
    
    // Loyalty discount
    if (customerInfo?.loyalty_discount_unlocked) {
      discounts.push({
        name: 'Fidélité Client -15%',
        amount: subtotal * 0.15,
        type: 'loyalty'
      });
    }
    
    // Promo code
    if (appliedPromo) {
      discounts.push({
        name: `Code: ${appliedPromo.code} -${appliedPromo.discount_percent}%`,
        amount: appliedPromo.discount_amount,
        type: 'promo'
      });
    }
    
    return discounts;
  };

  // Load subscription info on component mount
  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  // Load customer info when phone changes
  useEffect(() => {
    if (deliveryAddress.phone && deliveryAddress.phone.length >= 10) {
      loadCustomerInfo(deliveryAddress.phone);
    }
  }, [deliveryAddress.phone]);

  const placeOrder = async () => {
    if (!deliveryAddress.full_name || !deliveryAddress.phone || !deliveryAddress.address || 
        !deliveryAddress.city || !deliveryAddress.postal_code) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    try {
      setLoading(true);
      const orderData = {
        items: cart,
        delivery_address: deliveryAddress,
        total_amount: getCartTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: 'stripe',
      };

      const response = await api.post('/orders', orderData);
      
      // Create Stripe checkout session
      const paymentRes = await api.post('/payments/create-checkout', {
        order_id: response.data.id,
        origin_url: API_BASE_URL,
      });
      // Open Stripe checkout
      Linking.openURL(paymentRes.data.checkout_url);
      setOrderNumber(response.data.order_number);
      // Clear cart after redirecting to Stripe
      setCart([]);
      await AsyncStorage.removeItem('kiza_cart');
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Erreur', 'Impossible de passer la commande. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  // Chatbot function
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const response = await api.post('/chat', { message: userMessage });
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Désolé, une erreur est survenue. Veuillez réessayer.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Submit review function
  const submitReview = async () => {
    if (!reviewName.trim() || !reviewComment.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    
    try {
      await api.post('/reviews', {
        menu_item_id: selectedItem?.id || '0',
        customer_name: reviewName,
        rating: reviewRating,
        comment: reviewComment,
      });
      Alert.alert('Merci !', 'Votre avis a été enregistré.');
      setShowReviewModal(false);
      setReviewComment('');
      setReviewName('');
      setReviewRating(5);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'avis.');
    }
  };

  const openSocialMedia = (platform: string) => {
    let url = '';
    switch (platform) {
      case 'snapchat':
        url = `https://www.snapchat.com/add/${restaurantInfo?.social_media.snapchat}`;
        break;
      case 'instagram':
        url = `https://www.instagram.com/${restaurantInfo?.social_media.instagram}`;
        break;
      case 'tiktok':
        url = `https://www.tiktok.com/@${restaurantInfo?.social_media.tiktok}`;
        break;
      case 'phone':
        url = `tel:${restaurantInfo?.phone}`;
        break;
      case 'email':
        url = `mailto:${restaurantInfo?.email}`;
        break;
    }
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le lien.');
      });
    }
  };

  const filteredMenuItems = menuItems.filter(item => item.category === selectedCategory);

  // Loading Screen
  if (loading && !menuItems.length) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
          <View style={styles.loadingLogoContainer}>
            <FontAwesome5 name="crown" size={60} color={COLORS.gold} />
            <Text style={styles.loadingLogoText}>KIZA</Text>
            <Text style={styles.loadingLogoSubtext}>RESTAURANT</Text>
          </View>
          <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 30 }} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </LinearGradient>
      </View>
    );
  }

  // Header Component
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.headerLogo}>
        <FontAwesome5 name="crown" size={18} color={COLORS.gold} />
        <Text style={styles.logoText}>KIZA</Text>
      </TouchableOpacity>
      <View style={styles.halalBadge}>
        <Text style={styles.halalText}>100% HALAL</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.cartButton} 
          onPress={() => setCurrentScreen('cart')}
        >
          <Ionicons name="cart" size={26} color={COLORS.gold} />
          {getCartItemCount() > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{getCartItemCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Bottom Navigation
  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      <TouchableOpacity 
        style={[styles.navItem, currentScreen === 'home' && styles.navItemActive]}
        onPress={() => setCurrentScreen('home')}
      >
        <Ionicons name="home" size={22} color={currentScreen === 'home' ? COLORS.gold : COLORS.gray} />
        <Text style={[styles.navText, currentScreen === 'home' && styles.navTextActive]}>Accueil</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navItem, currentScreen === 'menu' && styles.navItemActive]}
        onPress={() => setCurrentScreen('menu')}
      >
        <MaterialIcons name="restaurant-menu" size={22} color={currentScreen === 'menu' ? COLORS.gold : COLORS.gray} />
        <Text style={[styles.navText, currentScreen === 'menu' && styles.navTextActive]}>Menu</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navItemCenter}
        onPress={() => setCurrentScreen('cart')}
      >
        <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.navItemCenterGradient}>
          <Ionicons name="cart" size={28} color={COLORS.black} />
          {getCartItemCount() > 0 && (
            <View style={styles.navCenterBadge}>
              <Text style={styles.navCenterBadgeText}>{getCartItemCount()}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navItem, currentScreen === 'contact' && styles.navItemActive]}
        onPress={() => setCurrentScreen('contact')}
      >
        <Ionicons name="call" size={22} color={currentScreen === 'contact' ? COLORS.gold : COLORS.gray} />
        <Text style={[styles.navText, currentScreen === 'contact' && styles.navTextActive]}>Contact</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navItem}
        onPress={() => router.push('/profile')}
      >
        <MaterialCommunityIcons name="account-circle" size={22} color={COLORS.gray} />
        <Text style={styles.navText}>Profil</Text>
      </TouchableOpacity>
    </View>
  );

  // Home Screen - Enhanced with images
  const renderHome = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Hero Section with Image Background */}
      <View style={styles.heroSection}>
        <ImageBackground
          source={{ uri: FOOD_IMAGES.restaurant }}
          style={styles.heroBackground}
          imageStyle={styles.heroBackgroundImage}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', COLORS.black]}
            style={styles.heroOverlay}
          >
            <View style={styles.heroContent}>
              <View style={styles.crownContainer}>
                <FontAwesome5 name="crown" size={50} color={COLORS.gold} />
              </View>
              <Text style={styles.heroTitle}>KIZA</Text>
              <View style={styles.heroTitleUnderline} />
              <Text style={styles.heroSubtitle}>RESTAURANT</Text>
              <Text style={styles.heroTagline}>Royale</Text>
              
              <View style={styles.heroCategoriesContainer}>
                <View style={styles.heroCategories}>
                  <Text style={styles.heroCategoryText}>GRILLADES</Text>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroCategoryText}>PLATS</Text>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroCategoryText}>POISSONS</Text>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroCategoryText}>DESSERTS</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => setCurrentScreen('menu')}
        >
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.quickActionGradient}>
            <MaterialIcons name="restaurant-menu" size={20} color={COLORS.black} />
            <Text style={styles.quickActionText}>Voir Menu</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButtonOutline}
          onPress={() => openSocialMedia('phone')}
        >
          <Ionicons name="call" size={20} color={COLORS.gold} />
          <Text style={styles.quickActionTextOutline}>Commander</Text>
        </TouchableOpacity>
      </View>

      {/* Delivery Banner */}
      <View style={styles.deliveryBanner}>
        <LinearGradient 
          colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.1)']} 
          style={styles.deliveryBannerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <MaterialIcons name="delivery-dining" size={28} color={COLORS.gold} />
          <View style={styles.deliveryBannerContent}>
            <Text style={styles.deliveryBannerTitle}>Livraison dans un rayon de 30km</Text>
            <Text style={styles.deliveryBannerSubtitle}>Livraison GRATUITE dès 25€ d'achat!</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Categories Section with Images */}
      <View style={styles.categoriesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nos Catégories</Text>
          <TouchableOpacity onPress={() => setCurrentScreen('menu')}>
            <Text style={styles.sectionLink}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {restaurantInfo?.categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryCard}
              onPress={() => {
                setSelectedCategory(cat.id);
                setCurrentScreen('menu');
              }}
            >
              <ImageBackground
                source={{ uri: CATEGORY_IMAGES[cat.id] }}
                style={styles.categoryImage}
                imageStyle={styles.categoryImageStyle}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.categoryOverlay}
                >
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </LinearGradient>
              </ImageBackground>
              <View style={styles.categoryGoldBar} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Featured Section */}
      <View style={styles.featuredSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Découvrez Nos Spécialités</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll}>
          {menuItems.slice(7, 12).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.featuredCard}
              onPress={() => {
                setSelectedItem(item);
                setItemQuantity(1);
                setShowItemModal(true);
              }}
            >
              <Image
                source={{ uri: getMenuItemImage(item.category, item.name, item.image_url) }}
                style={styles.featuredImage}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.9)']}
                style={styles.featuredOverlay}
              >
                <Text style={styles.featuredName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.featuredPrice}>{item.price.toFixed(2)}€</Text>
              </LinearGradient>
              <TouchableOpacity
                style={styles.featuredAddButton}
                onPress={() => addToCart(item, 1)}
              >
                <Ionicons name="add" size={20} color={COLORS.black} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Popular Items Section - Using bestsellers from API */}
      <View style={styles.popularSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nos Best-Sellers</Text>
          <View style={styles.sectionBadge}>
            <FontAwesome5 name="fire" size={12} color={COLORS.gold} />
            <Text style={styles.sectionBadgeText}>Populaire</Text>
          </View>
        </View>
        {bestsellers.slice(0, 5).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.popularCard}
            onPress={() => {
              setSelectedItem(item);
              setShowItemModal(true);
            }}
          >
            <Image
              source={{ uri: getMenuItemImage(item.category, item.name, item.image_url) }}
              style={styles.popularImage}
            />
            <View style={styles.popularInfo}>
              <Text style={styles.popularName}>{item.name}</Text>
              {item.quantity_info && (
                <View style={styles.popularQuantityBadge}>
                  <Text style={styles.popularQuantity}>{item.quantity_info}</Text>
                </View>
              )}
              <Text style={styles.popularDesc} numberOfLines={2}>{item.description}</Text>
              <Text style={styles.popularPrice}>{item.price.toFixed(2)}€</Text>
            </View>
            <TouchableOpacity
              style={styles.popularAddButton}
              onPress={() => addToCart(item, 1)}
            >
              <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.popularAddGradient}>
                <Ionicons name="add" size={24} color={COLORS.black} />
              </LinearGradient>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {/* Restaurant Ambiance Section */}
      <View style={styles.ambianceSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bienvenue chez KIZA</Text>
        </View>
        <View style={styles.ambianceCard}>
          <Image
            source={{ uri: FOOD_IMAGES.interior }}
            style={styles.ambianceImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.95)']}
            style={styles.ambianceOverlay}
          >
            <Text style={styles.ambianceText}>
              Découvrez une expérience culinaire royale avec nos grillades premium, burgers gourmets et desserts délicieux.
            </Text>
            <TouchableOpacity
              style={styles.ambianceButton}
              onPress={() => setCurrentScreen('menu')}
            >
              <Text style={styles.ambianceButtonText}>Explorer le Menu</Text>
              <MaterialIcons name="arrow-forward" size={18} color={COLORS.black} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>

      {/* Order CTA */}
      <TouchableOpacity
        style={styles.orderCTA}
        onPress={() => setCurrentScreen('menu')}
      >
        <LinearGradient
          colors={[COLORS.gold, COLORS.goldDark]}
          style={styles.orderCTAGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.orderCTAContent}>
            <FontAwesome5 name="crown" size={20} color={COLORS.black} />
            <Text style={styles.orderCTAText}>Commander Maintenant</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={24} color={COLORS.black} />
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );

  // Menu Screen with Images
  const renderMenu = () => (
    <View style={styles.menuContainer}>
      {/* Category Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {restaurantInfo?.categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryTab,
              selectedCategory === cat.id && styles.categoryTabActive
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={[
              styles.categoryTabText,
              selectedCategory === cat.id && styles.categoryTabTextActive
            ]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Menu Items */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.menuGrid}>
          {filteredMenuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, item.in_stock === false && styles.menuCardOutOfStock]}
              onPress={() => {
                if (item.in_stock === false) {
                  Alert.alert('Rupture de stock', `"${item.name}" n'est plus disponible.`);
                  return;
                }
                setSelectedItem(item);
                setItemQuantity(1);
                setShowItemModal(true);
              }}
            >
              <Image
                source={{ uri: getMenuItemImage(item.category, item.name, item.image_url) }}
                style={[styles.menuCardImage, item.in_stock === false && styles.menuCardImageOutOfStock]}
              />
              {/* Out of Stock Badge */}
              {item.in_stock === false && (
                <View style={styles.outOfStockBadge}>
                  <Text style={styles.outOfStockText}>RUPTURE</Text>
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.9)']}
                style={styles.menuCardOverlay}
              >
                <View style={styles.menuCardContent}>
                  <Text style={[styles.menuCardName, item.in_stock === false && styles.menuCardNameOutOfStock]} numberOfLines={1}>{item.name}</Text>
                  {item.quantity_info && (
                    <Text style={styles.menuCardQuantity}>{item.quantity_info}</Text>
                  )}
                  <Text style={[styles.menuCardPrice, item.in_stock === false && styles.menuCardPriceOutOfStock]}>{item.price.toFixed(2)}€</Text>
                </View>
              </LinearGradient>
              {item.in_stock !== false ? (
                <TouchableOpacity
                  style={styles.menuCardAddButton}
                  onPress={() => addToCart(item, 1)}
                >
                  <Ionicons name="add" size={22} color={COLORS.black} />
                </TouchableOpacity>
              ) : (
                <View style={styles.menuCardAddButtonDisabled}>
                  <Ionicons name="close" size={22} color={COLORS.white} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );

  // Cart Screen
  const renderCart = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Mon Panier</Text>
      
      {cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <View style={styles.emptyCartIconContainer}>
            <Ionicons name="cart-outline" size={80} color={COLORS.gold} />
          </View>
          <Text style={styles.emptyCartText}>Votre panier est vide</Text>
          <Text style={styles.emptyCartSubtext}>Ajoutez des délicieux plats pour commencer</Text>
          <TouchableOpacity
            style={styles.emptyCartButton}
            onPress={() => setCurrentScreen('menu')}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.emptyCartGradient}>
              <Text style={styles.emptyCartButtonText}>Découvrir le menu</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {cart.map((item) => {
            const menuItem = menuItems.find(m => m.id === item.menu_item_id);
            return (
              <View key={item.menu_item_id} style={styles.cartItem}>
                <Image
                  source={{ uri: menuItem ? getMenuItemImage(menuItem.category, menuItem.name, menuItem.image_url) : FOOD_IMAGES.plat }}
                  style={styles.cartItemImage}
                />
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>{item.price.toFixed(2)}€ / unité</Text>
                </View>
                <View style={styles.cartItemActions}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateCartQuantity(item.menu_item_id, item.quantity - 1)}
                  >
                    <Ionicons name="remove" size={18} color={COLORS.gold} />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateCartQuantity(item.menu_item_id, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={18} color={COLORS.gold} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cartItemTotal}>{(item.price * item.quantity).toFixed(2)}€</Text>
              </View>
            );
          })}

          {/* Order Summary */}
          <View style={styles.orderSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sous-total</Text>
              <Text style={styles.summaryValue}>{getCartTotal().toFixed(2)}€</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Livraison</Text>
              <Text style={[
                styles.summaryValue,
                getDeliveryFee() === 0 && styles.freeDelivery
              ]}>
                {getDeliveryFee() === 0 ? 'GRATUITE' : `${getDeliveryFee().toFixed(2)}€`}
              </Text>
            </View>
            {getCartTotal() < (restaurantInfo?.free_delivery_minimum || 25) && (
              <View style={styles.freeDeliveryHintContainer}>
                <Ionicons name="gift" size={16} color={COLORS.gold} />
                <Text style={styles.freeDeliveryHint}>
                  Plus que {((restaurantInfo?.free_delivery_minimum || 25) - getCartTotal()).toFixed(2)}€ pour la livraison gratuite!
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>
                {(getCartTotal() + getDeliveryFee()).toFixed(2)}€
              </Text>
            </View>
          </View>

          {/* Payment Info */}
          <View style={styles.paymentInfo}>
            <MaterialIcons name="credit-card" size={24} color={COLORS.gold} />
            <Text style={styles.paymentText}>Paiement en ligne sécurisé</Text>
          </View>

          {/* Checkout Button */}
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={() => setCurrentScreen('checkout')}
          >
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldDark]}
              style={styles.checkoutGradient}
            >
              <Text style={styles.checkoutButtonText}>Commander</Text>
              <MaterialIcons name="arrow-forward" size={24} color={COLORS.black} />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );

  // Checkout Screen
  const renderCheckout = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentScreen('cart')}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
          <Text style={styles.backButtonText}>Retour au panier</Text>
        </TouchableOpacity>

        <Text style={styles.screenTitle}>Adresse de Livraison</Text>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nom complet *</Text>
            <TextInput
              style={styles.input}
              value={deliveryAddress.full_name}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, full_name: text})}
              placeholder="Votre nom complet"
              placeholderTextColor={COLORS.gray}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Téléphone *</Text>
            <TextInput
              style={styles.input}
              value={deliveryAddress.phone}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, phone: text})}
              placeholder="Votre numéro de téléphone"
              placeholderTextColor={COLORS.gray}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Adresse *</Text>
            <TextInput
              style={styles.input}
              value={deliveryAddress.address}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, address: text})}
              placeholder="Numéro et nom de rue"
              placeholderTextColor={COLORS.gray}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, styles.inputHalf]}>
              <Text style={styles.inputLabel}>Ville *</Text>
              <TextInput
                style={styles.input}
                value={deliveryAddress.city}
                onChangeText={(text) => setDeliveryAddress({...deliveryAddress, city: text})}
                placeholder="Ville"
                placeholderTextColor={COLORS.gray}
              />
            </View>
            <View style={[styles.inputGroup, styles.inputHalf]}>
              <Text style={styles.inputLabel}>Code postal *</Text>
              <TextInput
                style={styles.input}
                value={deliveryAddress.postal_code}
                onChangeText={(text) => setDeliveryAddress({...deliveryAddress, postal_code: text})}
                placeholder="Code postal"
                placeholderTextColor={COLORS.gray}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Instructions (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={deliveryAddress.additional_info}
              onChangeText={(text) => setDeliveryAddress({...deliveryAddress, additional_info: text})}
              placeholder="Digicode, étage, instructions spéciales..."
              placeholderTextColor={COLORS.gray}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* KIZA PREMIUM Banner */}
        {!customerInfo?.is_premium && subscriptionInfo && (
          <TouchableOpacity 
            style={styles.premiumBanner}
            onPress={() => setShowPremiumModal(true)}
          >
            <LinearGradient
              colors={['#9C27B0', '#673AB7']}
              style={styles.premiumBannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.premiumBannerContent}>
                <View style={styles.premiumBannerIcon}>
                  <MaterialCommunityIcons name="crown" size={28} color={COLORS.gold} />
                </View>
                <View style={styles.premiumBannerText}>
                  <Text style={styles.premiumBannerTitle}>KIZA PREMIUM</Text>
                  <Text style={styles.premiumBannerSubtitle}>
                    Livraison GRATUITE illimitée pour {subscriptionInfo.price}€/mois
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Premium Member Badge */}
        {customerInfo?.is_premium && (
          <View style={styles.premiumMemberBadge}>
            <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
            <Text style={styles.premiumMemberText}>Membre KIZA PREMIUM</Text>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
          </View>
        )}

        {/* Loyalty Progress */}
        {customerInfo && !customerInfo.loyalty_discount_unlocked && (
          <View style={styles.loyaltyProgress}>
            <View style={styles.loyaltyProgressHeader}>
              <MaterialCommunityIcons name="star-circle" size={20} color={COLORS.gold} />
              <Text style={styles.loyaltyProgressTitle}>Programme Fidélité</Text>
            </View>
            <Text style={styles.loyaltyProgressText}>
              Encore {Math.max(0, 10 - customerInfo.total_orders)} commande(s) pour débloquer -15% permanent !
            </Text>
            <View style={styles.loyaltyProgressBar}>
              <View 
                style={[
                  styles.loyaltyProgressFill, 
                  { width: `${Math.min(100, (customerInfo.total_orders / 10) * 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.loyaltyProgressCount}>{customerInfo.total_orders}/10 commandes</Text>
          </View>
        )}

        {/* Loyalty Discount Active */}
        {customerInfo?.loyalty_discount_unlocked && (
          <View style={styles.loyaltyActive}>
            <MaterialCommunityIcons name="star-circle" size={20} color={COLORS.gold} />
            <Text style={styles.loyaltyActiveText}>Réduction fidélité -15% appliquée !</Text>
          </View>
        )}

        {/* Promo Code Section */}
        <View style={styles.promoCodeSection}>
          <Text style={styles.promoCodeTitle}>Code Promo</Text>
          {appliedPromo ? (
            <View style={styles.promoApplied}>
              <View style={styles.promoAppliedInfo}>
                <MaterialCommunityIcons name="ticket-percent" size={20} color={COLORS.success} />
                <Text style={styles.promoAppliedCode}>{appliedPromo.code}</Text>
                <Text style={styles.promoAppliedDiscount}>-{appliedPromo.discount_percent}%</Text>
              </View>
              <TouchableOpacity onPress={removePromo} style={styles.promoRemoveBtn}>
                <Ionicons name="close-circle" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.promoCodeInputRow}>
              <TextInput
                style={styles.promoCodeInput}
                value={promoCode}
                onChangeText={(t) => { setPromoCode(t.toUpperCase()); setPromoError(''); }}
                placeholder="Entrez votre code"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                style={styles.promoCodeApplyBtn}
                onPress={validatePromoCode}
                disabled={discountsLoading}
              >
                {discountsLoading ? (
                  <ActivityIndicator size="small" color={COLORS.black} />
                ) : (
                  <Text style={styles.promoCodeApplyText}>Appliquer</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {promoError ? (
            <Text style={styles.promoError}>{promoError}</Text>
          ) : null}
        </View>

        {/* Order Summary */}
        <View style={styles.checkoutSummary}>
          <Text style={styles.checkoutSummaryTitle}>Récapitulatif</Text>
          {cart.map((item) => (
            <View key={item.menu_item_id} style={styles.checkoutItem}>
              <Text style={styles.checkoutItemName}>{item.quantity}x {item.name}</Text>
              <Text style={styles.checkoutItemPrice}>{(item.price * item.quantity).toFixed(2)}€</Text>
            </View>
          ))}
          
          <View style={styles.divider} />
          
          <View style={styles.checkoutItem}>
            <Text style={styles.checkoutItemName}>Sous-total</Text>
            <Text style={styles.checkoutItemPrice}>{getCartTotal().toFixed(2)}€</Text>
          </View>
          
          {/* Active Discounts */}
          {getActiveDiscounts().map((discount, idx) => (
            <View key={idx} style={styles.checkoutDiscount}>
              <Text style={styles.checkoutDiscountName}>{discount.name}</Text>
              <Text style={styles.checkoutDiscountAmount}>-{discount.amount.toFixed(2)}€</Text>
            </View>
          ))}
          
          <View style={styles.checkoutItem}>
            <Text style={styles.checkoutItemName}>Livraison</Text>
            <Text style={[
              styles.checkoutItemPrice,
              getDeliveryFee() === 0 && styles.freeDelivery
            ]}>
              {getDeliveryFee() === 0 ? 'GRATUITE' : `${getDeliveryFee().toFixed(2)}€`}
            </Text>
          </View>
          
          <View style={styles.checkoutTotal}>
            <Text style={styles.checkoutTotalLabel}>Total à payer</Text>
            <Text style={styles.checkoutTotalValue}>
              {calculateFinalTotal().toFixed(2)}€
            </Text>
          </View>
        </View>

        {/* Payment Method - Stripe Only */}
        <View style={styles.paymentMethodSection}>
          <Text style={styles.paymentMethodSectionTitle}>Mode de paiement</Text>
          
          <View style={[styles.paymentMethodOption, styles.paymentMethodOptionActive]}>
            <View style={styles.paymentMethodOptionLeft}>
              <MaterialIcons name="credit-card" size={28} color={COLORS.gold} />
              <View style={styles.paymentMethodOptionInfo}>
                <Text style={[styles.paymentMethodOptionTitle, styles.paymentMethodOptionTitleActive]}>Paiement en ligne sécurisé</Text>
                <Text style={styles.paymentMethodOptionDesc}>Paiement par carte bancaire via Stripe</Text>
              </View>
            </View>
            <View style={styles.paymentMethodSecureIcon}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.gold} />
            </View>
          </View>
        </View>

        {/* Place Order Button */}
        <TouchableOpacity
          style={styles.placeOrderButton}
          onPress={placeOrder}
          disabled={loading}
        >
          <LinearGradient
            colors={[COLORS.gold, COLORS.goldDark]}
            style={styles.placeOrderGradient}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <>
                <Text style={styles.placeOrderText}>Confirmer la commande</Text>
                <MaterialIcons name="check-circle" size={24} color={COLORS.black} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Contact Screen
  const renderContact = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.contactHeader}>
        <FontAwesome5 name="crown" size={50} color={COLORS.gold} />
        <Text style={styles.contactTitle}>KIZA</Text>
        <Text style={styles.contactSubtitle}>Restaurant</Text>
        <View style={styles.contactHeaderLine} />
      </View>

      <View style={styles.contactSection}>
        <Text style={styles.contactSectionTitle}>Nous Contacter</Text>

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => openSocialMedia('phone')}
        >
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.contactIconContainer}>
            <Ionicons name="call" size={24} color={COLORS.black} />
          </LinearGradient>
          <View style={styles.contactCardInfo}>
            <Text style={styles.contactCardTitle}>Téléphone</Text>
            <Text style={styles.contactCardValue}>{restaurantInfo?.phone}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gold} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => openSocialMedia('email')}
        >
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.contactIconContainer}>
            <MaterialIcons name="email" size={24} color={COLORS.black} />
          </LinearGradient>
          <View style={styles.contactCardInfo}>
            <Text style={styles.contactCardTitle}>Email</Text>
            <Text style={styles.contactCardValue}>{restaurantInfo?.email}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gold} />
        </TouchableOpacity>

        <View style={styles.contactCard}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.contactIconContainer}>
            <Ionicons name="location" size={24} color={COLORS.black} />
          </LinearGradient>
          <View style={styles.contactCardInfo}>
            <Text style={styles.contactCardTitle}>Adresse</Text>
            <Text style={styles.contactCardValue}>{restaurantInfo?.address}</Text>
          </View>
        </View>
      </View>

      <View style={styles.contactSection}>
        <Text style={styles.contactSectionTitle}>Réseaux Sociaux</Text>

        <TouchableOpacity
          style={styles.socialCard}
          onPress={() => openSocialMedia('snapchat')}
        >
          <View style={[styles.socialIconContainer, { backgroundColor: '#FFFC00' }]}>
            <FontAwesome5 name="snapchat-ghost" size={24} color={COLORS.black} />
          </View>
          <View style={styles.socialCardInfo}>
            <Text style={styles.socialCardTitle}>Snapchat</Text>
            <Text style={styles.socialCardValue}>@{restaurantInfo?.social_media.snapchat}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gold} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialCard}
          onPress={() => openSocialMedia('instagram')}
        >
          <LinearGradient
            colors={['#833AB4', '#FD1D1D', '#F77737']}
            style={styles.socialIconContainer}
          >
            <FontAwesome5 name="instagram" size={24} color={COLORS.white} />
          </LinearGradient>
          <View style={styles.socialCardInfo}>
            <Text style={styles.socialCardTitle}>Instagram</Text>
            <Text style={styles.socialCardValue}>@{restaurantInfo?.social_media.instagram}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gold} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialCard}
          onPress={() => openSocialMedia('tiktok')}
        >
          <View style={[styles.socialIconContainer, { backgroundColor: COLORS.black, borderWidth: 2, borderColor: COLORS.white }]}>
            <FontAwesome5 name="tiktok" size={22} color={COLORS.white} />
          </View>
          <View style={styles.socialCardInfo}>
            <Text style={styles.socialCardTitle}>TikTok</Text>
            <Text style={styles.socialCardValue}>@{restaurantInfo?.social_media.tiktok}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      {/* Review CTA */}
      <View style={styles.reviewCTASection}>
        <TouchableOpacity
          style={styles.reviewCTAButton}
          onPress={() => setShowReviewModal(true)}
        >
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.reviewCTAGradient}>
            <Ionicons name="star" size={24} color={COLORS.black} />
            <Text style={styles.reviewCTAText}>Laissez votre avis</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Delivery Info */}
      <View style={styles.deliveryInfoSection}>
        <LinearGradient 
          colors={[COLORS.blackMedium, COLORS.blackLight]}
          style={styles.deliveryInfoGradient}
        >
          <MaterialIcons name="delivery-dining" size={50} color={COLORS.gold} />
          <Text style={styles.deliveryInfoTitle}>Zone de Livraison</Text>
          <Text style={styles.deliveryInfoText}>Nous livrons dans un rayon de 30km</Text>
          <View style={styles.deliveryInfoDivider} />
          <Text style={styles.deliveryInfoFee}>Frais de livraison: 3€</Text>
          <View style={styles.deliveryInfoFreeContainer}>
            <Ionicons name="gift" size={18} color={COLORS.black} />
            <Text style={styles.deliveryInfoFree}>Gratuit dès 25€ d'achat!</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Admin Link (discreet) */}
      <TouchableOpacity
        style={styles.adminLink}
        onPress={() => router.push('/admin')}
      >
        <Text style={styles.adminLinkText}>Administration</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );

  // Order Success Screen
  const renderOrderSuccess = () => (
    <View style={styles.successContainer}>
      <LinearGradient
        colors={[COLORS.black, COLORS.blackLight]}
        style={styles.successGradient}
      >
        <View style={styles.successIconContainer}>
          <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.successIconGradient}>
            <Ionicons name="checkmark" size={60} color={COLORS.black} />
          </LinearGradient>
        </View>
        <Text style={styles.successTitle}>Commande Confirmée!</Text>
        <View style={styles.successOrderNumberContainer}>
          <Text style={styles.successOrderNumberLabel}>N° de commande</Text>
          <Text style={styles.successOrderNumber}>{orderNumber}</Text>
        </View>
        <Text style={styles.successMessage}>
          Merci pour votre commande! Notre équipe prépare votre repas avec soin.
        </Text>
        
        <View style={styles.successPaymentContainer}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.gold} />
          <Text style={styles.successPayment}>
            Paiement sécurisé par carte bancaire
          </Text>
        </View>
        
        <View style={styles.successContact}>
          <Text style={styles.successContactText}>Questions? Appelez-nous:</Text>
          <TouchableOpacity
            style={styles.successPhoneButton}
            onPress={() => openSocialMedia('phone')}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.successPhoneGradient}>
              <Ionicons name="call" size={20} color={COLORS.black} />
              <Text style={styles.successPhoneText}>{restaurantInfo?.phone}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.successHomeButton}
          onPress={() => {
            setCurrentScreen('home');
            setDeliveryAddress({
              full_name: '',
              phone: '',
              address: '',
              city: '',
              postal_code: '',
              additional_info: '',
            });
          }}
        >
          <LinearGradient
            colors={[COLORS.gold, COLORS.goldDark]}
            style={styles.successHomeGradient}
          >
            <Text style={styles.successHomeText}>Retour à l'accueil</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  // Item Modal
  const renderItemModal = () => (
    <Modal
      visible={showItemModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowItemModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setShowItemModal(false)}
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          
          {selectedItem && (
            <>
              <Image
                source={{ uri: getMenuItemImage(selectedItem.category, selectedItem.name, selectedItem.image_url) }}
                style={styles.modalImage}
              />
              <View style={styles.modalBody}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedItem.name}</Text>
                  {selectedItem.quantity_info && (
                    <View style={styles.modalQuantityBadge}>
                      <Text style={styles.modalQuantityInfo}>{selectedItem.quantity_info}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalDescription}>{selectedItem.description}</Text>
                <Text style={styles.modalPrice}>{selectedItem.price.toFixed(2)}€</Text>
                
                <View style={styles.modalQuantity}>
                  <Text style={styles.modalQuantityLabel}>Quantité</Text>
                  <View style={styles.modalQuantityControls}>
                    <TouchableOpacity
                      style={styles.modalQuantityButton}
                      onPress={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    >
                      <Ionicons name="remove" size={24} color={COLORS.gold} />
                    </TouchableOpacity>
                    <Text style={styles.modalQuantityValue}>{itemQuantity}</Text>
                    <TouchableOpacity
                      style={styles.modalQuantityButton}
                      onPress={() => setItemQuantity(itemQuantity + 1)}
                    >
                      <Ionicons name="add" size={24} color={COLORS.gold} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={styles.modalAddButton}
                  onPress={() => addToCart(selectedItem, itemQuantity)}
                >
                  <LinearGradient
                    colors={[COLORS.gold, COLORS.goldDark]}
                    style={styles.modalAddGradient}
                  >
                    <Ionicons name="cart" size={22} color={COLORS.black} />
                    <Text style={styles.modalAddText}>
                      Ajouter - {(selectedItem.price * itemQuantity).toFixed(2)}€
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // KIZA PREMIUM Subscription Modal
  const renderPremiumModal = () => (
    <Modal
      visible={showPremiumModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPremiumModal(false)}
    >
      <View style={styles.premiumModalOverlay}>
        <View style={styles.premiumModalContent}>
          <TouchableOpacity
            style={styles.premiumModalClose}
            onPress={() => setShowPremiumModal(false)}
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          
          <LinearGradient
            colors={['#9C27B0', '#673AB7']}
            style={styles.premiumModalHeader}
          >
            <MaterialCommunityIcons name="crown" size={56} color={COLORS.gold} />
            <Text style={styles.premiumModalTitle}>KIZA PREMIUM</Text>
            <Text style={styles.premiumModalPrice}>
              {subscriptionInfo?.price || 9.99}€<Text style={styles.premiumModalPricePeriod}>/mois</Text>
            </Text>
          </LinearGradient>
          
          <View style={styles.premiumModalBody}>
            <Text style={styles.premiumModalBenefitsTitle}>Avantages inclus :</Text>
            
            <View style={styles.premiumModalBenefit}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.premiumModalBenefitText}>Livraison GRATUITE illimitée</Text>
            </View>
            
            <View style={styles.premiumModalBenefit}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.premiumModalBenefitText}>Économisez 3€ par commande</Text>
            </View>
            
            <View style={styles.premiumModalBenefit}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.premiumModalBenefitText}>Accès aux offres exclusives</Text>
            </View>
            
            <View style={styles.premiumModalBenefit}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.premiumModalBenefitText}>Sans engagement - Annulez quand vous voulez</Text>
            </View>
            
            <View style={styles.premiumModalDivider} />
            
            <View style={styles.premiumModalLoyaltyInfo}>
              <MaterialCommunityIcons name="star-circle" size={24} color={COLORS.gold} />
              <View style={styles.premiumModalLoyaltyText}>
                <Text style={styles.premiumModalLoyaltyTitle}>Programme Fidélité</Text>
                <Text style={styles.premiumModalLoyaltyDesc}>
                  {subscriptionInfo?.loyalty_info?.discount || 15}% de réduction permanente après {subscriptionInfo?.loyalty_info?.threshold || 10} commandes
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.premiumSubscribeButton}
              onPress={subscribeToPremium}
              disabled={loading}
            >
              <LinearGradient
                colors={[COLORS.gold, COLORS.goldDark]}
                style={styles.premiumSubscribeGradient}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.black} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="crown" size={22} color={COLORS.black} />
                    <Text style={styles.premiumSubscribeText}>Devenir PREMIUM</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <Text style={styles.premiumModalDisclaimer}>
              En souscrivant, vous acceptez les conditions d'utilisation
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Chatbot Modal
  const renderChatbotModal = () => (
    <Modal
      visible={showChatbot}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowChatbot(false)}
    >
      <View style={styles.chatbotModalOverlay}>
        <View style={styles.chatbotModalContent}>
          <View style={styles.chatbotHeader}>
            <View style={styles.chatbotHeaderLeft}>
              <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.chatbotAvatar}>
                <MaterialIcons name="smart-toy" size={24} color={COLORS.black} />
              </LinearGradient>
              <View>
                <Text style={styles.chatbotHeaderTitle}>Assistant KIZA</Text>
                <Text style={styles.chatbotHeaderSubtitle}>En ligne</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.chatbotCloseButton}
              onPress={() => setShowChatbot(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.chatbotMessages} contentContainerStyle={styles.chatbotMessagesContent}>
            {chatMessages.length === 0 && (
              <View style={styles.chatbotWelcome}>
                <MaterialIcons name="waving-hand" size={40} color={COLORS.gold} />
                <Text style={styles.chatbotWelcomeTitle}>Bienvenue chez KIZA!</Text>
                <Text style={styles.chatbotWelcomeText}>
                  Je suis votre assistant virtuel. Posez-moi vos questions sur le menu, les prix, la livraison ou les horaires!
                </Text>
              </View>
            )}
            {chatMessages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.chatMessage,
                  msg.role === 'user' ? styles.chatMessageUser : styles.chatMessageBot
                ]}
              >
                <Text style={[
                  styles.chatMessageText,
                  msg.role === 'user' ? styles.chatMessageTextUser : styles.chatMessageTextBot
                ]}>{msg.content}</Text>
              </View>
            ))}
            {chatLoading && (
              <View style={styles.chatMessageBot}>
                <ActivityIndicator size="small" color={COLORS.gold} />
              </View>
            )}
          </ScrollView>
          
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.chatbotInputContainer}>
              <TextInput
                style={styles.chatbotInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Posez votre question..."
                placeholderTextColor={COLORS.gray}
                multiline
              />
              <TouchableOpacity
                style={styles.chatbotSendButton}
                onPress={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
              >
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.chatbotSendGradient}>
                  <Ionicons name="send" size={20} color={COLORS.black} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );

  // Review Modal
  const renderReviewModal = () => (
    <Modal
      visible={showReviewModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowReviewModal(false)}
    >
      <View style={styles.reviewModalOverlay}>
        <View style={styles.reviewModalContent}>
          <TouchableOpacity
            style={styles.reviewModalClose}
            onPress={() => setShowReviewModal(false)}
          >
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>
          
          <Text style={styles.reviewModalTitle}>Laissez votre avis</Text>
          <Text style={styles.reviewModalSubtitle}>Votre opinion compte pour nous!</Text>
          
          <View style={styles.reviewStarsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setReviewRating(star)}
              >
                <Ionicons
                  name={star <= reviewRating ? "star" : "star-outline"}
                  size={40}
                  color={COLORS.gold}
                  style={styles.reviewStar}
                />
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.reviewInputGroup}>
            <Text style={styles.reviewInputLabel}>Votre nom</Text>
            <TextInput
              style={styles.reviewInput}
              value={reviewName}
              onChangeText={setReviewName}
              placeholder="Entrez votre nom"
              placeholderTextColor={COLORS.gray}
            />
          </View>
          
          <View style={styles.reviewInputGroup}>
            <Text style={styles.reviewInputLabel}>Votre commentaire</Text>
            <TextInput
              style={[styles.reviewInput, styles.reviewInputMultiline]}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Partagez votre expérience..."
              placeholderTextColor={COLORS.gray}
              multiline
              numberOfLines={4}
            />
          </View>
          
          <TouchableOpacity
            style={styles.reviewSubmitButton}
            onPress={submitReview}
          >
            <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.reviewSubmitGradient}>
              <Text style={styles.reviewSubmitText}>Envoyer mon avis</Text>
              <Ionicons name="send" size={20} color={COLORS.black} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Floating Chatbot Button
  const renderFloatingChatButton = () => (
    <TouchableOpacity
      style={styles.floatingChatButton}
      onPress={() => setShowChatbot(true)}
    >
      <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.floatingChatGradient}>
        <MaterialIcons name="chat" size={28} color={COLORS.black} />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[COLORS.black, COLORS.blackLight]} style={styles.gradient}>
        {currentScreen !== 'order_success' && renderHeader()}
        
        {currentScreen === 'home' && renderHome()}
        {currentScreen === 'menu' && renderMenu()}
        {currentScreen === 'cart' && renderCart()}
        {currentScreen === 'checkout' && renderCheckout()}
        {currentScreen === 'contact' && renderContact()}
        {currentScreen === 'order_success' && renderOrderSuccess()}
        
        {currentScreen !== 'order_success' && currentScreen !== 'checkout' && renderBottomNav()}
        {renderItemModal()}
        {renderPremiumModal()}
        {renderChatbotModal()}
        {renderReviewModal()}
        {currentScreen !== 'order_success' && currentScreen !== 'checkout' && renderFloatingChatButton()}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  flex: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogoContainer: {
    alignItems: 'center',
  },
  loadingLogoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 8,
    marginTop: 10,
  },
  loadingLogoSubtext: {
    fontSize: 14,
    color: COLORS.white,
    letterSpacing: 6,
    marginTop: -5,
  },
  loadingText: {
    color: COLORS.gold,
    fontSize: 16,
    marginTop: 20,
  },
  scrollView: {
    flex: 1,
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
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 3,
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  halalBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  halalText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cartButton: {
    padding: 8,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: 'bold',
  },
  
  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.blackMedium,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.3)',
    alignItems: 'center',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  navItemActive: {},
  navText: {
    color: COLORS.gray,
    fontSize: 10,
    marginTop: 4,
  },
  navTextActive: {
    color: COLORS.gold,
  },
  navItemCenter: {
    flex: 1,
    alignItems: 'center',
    marginTop: -30,
  },
  navItemCenterGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.black,
  },
  navCenterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCenterBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  
  // Hero Section
  heroSection: {
    height: 380,
  },
  heroBackground: {
    flex: 1,
  },
  heroBackgroundImage: {
    opacity: 0.8,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 30,
  },
  heroContent: {
    alignItems: 'center',
  },
  crownContainer: {
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 64,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  heroTitleUnderline: {
    width: 150,
    height: 3,
    backgroundColor: COLORS.gold,
    marginTop: -5,
    marginBottom: 5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: COLORS.white,
    letterSpacing: 8,
  },
  heroTagline: {
    fontSize: 22,
    color: COLORS.goldLight,
    fontStyle: 'italic',
    marginTop: 8,
  },
  heroCategoriesContainer: {
    marginTop: 20,
  },
  heroCategories: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  heroCategoryText: {
    color: COLORS.goldLight,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
  },
  heroDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gold,
    marginHorizontal: 8,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -20,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 25,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  quickActionText: {
    color: COLORS.black,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  quickActionButtonOutline: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  quickActionTextOutline: {
    color: COLORS.gold,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  
  // Delivery Banner
  deliveryBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  deliveryBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deliveryBannerContent: {
    marginLeft: 12,
    flex: 1,
  },
  deliveryBannerTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  deliveryBannerSubtitle: {
    color: COLORS.gold,
    fontSize: 13,
    marginTop: 2,
  },
  
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  sectionLink: {
    color: COLORS.goldLight,
    fontSize: 14,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionBadgeText: {
    color: COLORS.gold,
    fontSize: 12,
    marginLeft: 4,
  },
  
  // Categories Section
  categoriesSection: {
    marginBottom: 24,
  },
  categoriesScroll: {
    paddingLeft: 16,
  },
  categoryCard: {
    width: 130,
    height: 100,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryImageStyle: {
    borderRadius: 12,
  },
  categoryOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
  },
  categoryName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  categoryGoldBar: {
    height: 3,
    backgroundColor: COLORS.gold,
  },
  
  // Featured Section
  featuredSection: {
    marginBottom: 24,
  },
  featuredScroll: {
    paddingLeft: 16,
  },
  featuredCard: {
    width: 160,
    height: 200,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.blackMedium,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  featuredName: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  featuredPrice: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  featuredAddButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.gold,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Popular Section
  popularSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  popularCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  popularImage: {
    width: 100,
    height: 100,
  },
  popularInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  popularName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  popularQuantityBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  popularQuantity: {
    fontSize: 11,
    color: COLORS.gold,
  },
  popularDesc: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    lineHeight: 16,
  },
  popularPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 6,
  },
  popularAddButton: {
    justifyContent: 'center',
    paddingRight: 12,
  },
  popularAddGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Ambiance Section
  ambianceSection: {
    marginBottom: 24,
  },
  ambianceCard: {
    marginHorizontal: 16,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ambianceImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  ambianceOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  ambianceText: {
    color: COLORS.grayLight,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  ambianceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  ambianceButtonText: {
    color: COLORS.black,
    fontWeight: 'bold',
    marginRight: 8,
  },
  
  // Order CTA
  orderCTA: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  orderCTAGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  orderCTAContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderCTAText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginLeft: 12,
  },
  
  // Menu Screen
  menuContainer: {
    flex: 1,
  },
  categoryTabs: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  categoryTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: COLORS.blackMedium,
  },
  categoryTabActive: {
    backgroundColor: COLORS.gold,
  },
  categoryTabText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: COLORS.black,
  },
  menuScroll: {
    flex: 1,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  menuCard: {
    width: (width - 32) / 2,
    height: 180,
    margin: 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.blackMedium,
  },
  menuCardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  menuCardOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  menuCardContent: {
    padding: 12,
  },
  menuCardName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  menuCardQuantity: {
    fontSize: 11,
    color: COLORS.goldLight,
    marginTop: 2,
  },
  menuCardPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 4,
  },
  menuCardAddButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.gold,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCardAddButtonDisabled: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#666',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCardOutOfStock: {
    opacity: 0.7,
  },
  menuCardImageOutOfStock: {
    opacity: 0.5,
  },
  menuCardNameOutOfStock: {
    color: '#999',
  },
  menuCardPriceOutOfStock: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(244, 67, 54, 0.95)',
    paddingVertical: 8,
    zIndex: 10,
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  
  // Cart Screen
  screenTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginHorizontal: 16,
    marginVertical: 20,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCartIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyCartText: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
    marginBottom: 30,
  },
  emptyCartButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  emptyCartGradient: {
    paddingHorizontal: 30,
    paddingVertical: 14,
  },
  emptyCartButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blackMedium,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cartItemImage: {
    width: 80,
    height: 80,
  },
  cartItemInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  cartItemPrice: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  cartItemTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.gold,
    paddingRight: 16,
    minWidth: 60,
    textAlign: 'right',
  },
  
  // Order Summary
  orderSummary: {
    backgroundColor: COLORS.blackMedium,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: COLORS.gray,
  },
  summaryValue: {
    fontSize: 15,
    color: COLORS.white,
  },
  freeDelivery: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
  freeDeliveryHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  freeDeliveryHint: {
    fontSize: 13,
    color: COLORS.gold,
    marginLeft: 8,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.3)',
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  summaryTotalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  
  // Payment Info
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  paymentText: {
    color: COLORS.gold,
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '500',
  },
  
  // Checkout Button
  checkoutButton: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  checkoutGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginRight: 8,
  },
  
  // Checkout Screen
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    color: COLORS.gold,
    fontSize: 16,
    marginLeft: 8,
  },
  formContainer: {
    paddingHorizontal: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: COLORS.goldLight,
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    padding: 16,
    color: COLORS.white,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputHalf: {
    width: '48%',
  },
  
  // Checkout Summary
  checkoutSummary: {
    backgroundColor: COLORS.blackMedium,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
  },
  checkoutSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 16,
  },
  checkoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  checkoutItemName: {
    color: COLORS.white,
    fontSize: 14,
  },
  checkoutItemPrice: {
    color: COLORS.white,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  checkoutTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.3)',
  },
  checkoutTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  checkoutTotalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  
  // Payment Method
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blackMedium,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  paymentMethodInfo: {
    marginLeft: 14,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  paymentMethodDesc: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  
  // Place Order Button
  placeOrderButton: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  placeOrderGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
  },
  placeOrderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginRight: 10,
  },
  
  // Contact Screen
  contactHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  contactTitle: {
    fontSize: 44,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 6,
    marginTop: 12,
  },
  contactSubtitle: {
    fontSize: 14,
    color: COLORS.white,
    letterSpacing: 4,
    marginTop: -2,
  },
  contactHeaderLine: {
    width: 60,
    height: 3,
    backgroundColor: COLORS.gold,
    marginTop: 16,
  },
  contactSection: {
    padding: 16,
  },
  contactSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 16,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blackMedium,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  contactIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactCardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  contactCardTitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  contactCardValue: {
    fontSize: 15,
    color: COLORS.white,
    fontWeight: '500',
  },
  
  // Social Cards
  socialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blackMedium,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  socialIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialCardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  socialCardTitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  socialCardValue: {
    fontSize: 15,
    color: COLORS.white,
    fontWeight: '500',
  },
  
  // Delivery Info Section
  deliveryInfoSection: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  deliveryInfoGradient: {
    alignItems: 'center',
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 20,
  },
  deliveryInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 14,
    marginBottom: 8,
  },
  deliveryInfoText: {
    fontSize: 16,
    color: COLORS.white,
  },
  deliveryInfoDivider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.gold,
    marginVertical: 16,
  },
  deliveryInfoFee: {
    fontSize: 14,
    color: COLORS.gray,
  },
  deliveryInfoFreeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  deliveryInfoFree: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Success Screen
  successContainer: {
    flex: 1,
  },
  successGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 16,
  },
  successOrderNumberContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.blackMedium,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  successOrderNumberLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  successOrderNumber: {
    fontSize: 18,
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  successMessage: {
    fontSize: 15,
    color: COLORS.grayLight,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  successPaymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  successPayment: {
    fontSize: 14,
    color: COLORS.gold,
    marginLeft: 10,
  },
  successContact: {
    alignItems: 'center',
    marginBottom: 40,
  },
  successContactText: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 12,
  },
  successPhoneButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  successPhoneGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  successPhoneText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  successHomeButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  successHomeGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  successHomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.blackLight,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '85%',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  modalBody: {
    padding: 24,
  },
  modalHeader: {
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  modalQuantityBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  modalQuantityInfo: {
    fontSize: 13,
    color: COLORS.gold,
  },
  modalDescription: {
    fontSize: 15,
    color: COLORS.gray,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 16,
  },
  modalPrice: {
    fontSize: 30,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 24,
  },
  modalQuantity: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
  },
  modalQuantityLabel: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
  modalQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalQuantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalQuantityValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    marginHorizontal: 24,
  },
  modalAddButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalAddGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
  },
  modalAddText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginLeft: 10,
  },
  
  bottomSpacing: {
    height: 100,
  },
  
  // Payment Method Section Styles
  paymentMethodSection: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  paymentMethodSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 16,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.blackMedium,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  paymentMethodOptionActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  paymentMethodOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodOptionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paymentMethodOptionTitle: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },
  paymentMethodOptionTitleActive: {
    color: COLORS.gold,
  },
  paymentMethodOptionDesc: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  paymentMethodRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMethodRadioActive: {
    borderColor: COLORS.gold,
  },
  paymentMethodRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.gold,
  },
  paymentMethodSecureIcon: {
    marginLeft: 10,
  },
  
  // Floating Chat Button Styles
  floatingChatButton: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    zIndex: 100,
  },
  floatingChatGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  // Chatbot Modal Styles
  chatbotModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  chatbotModalContent: {
    backgroundColor: COLORS.blackLight,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '80%',
    overflow: 'hidden',
  },
  chatbotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  chatbotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatbotAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatbotHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  chatbotHeaderSubtitle: {
    fontSize: 12,
    color: COLORS.success,
  },
  chatbotCloseButton: {
    padding: 8,
  },
  chatbotMessages: {
    flex: 1,
    padding: 16,
  },
  chatbotMessagesContent: {
    paddingBottom: 20,
  },
  chatbotWelcome: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  chatbotWelcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 16,
    marginBottom: 8,
  },
  chatbotWelcomeText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  chatMessage: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  chatMessageUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.gold,
    borderBottomRightRadius: 4,
  },
  chatMessageBot: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.blackMedium,
    borderBottomLeftRadius: 4,
  },
  chatMessageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  chatMessageTextUser: {
    color: COLORS.black,
  },
  chatMessageTextBot: {
    color: COLORS.white,
  },
  chatbotInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: COLORS.blackMedium,
  },
  chatbotInput: {
    flex: 1,
    backgroundColor: COLORS.blackLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.white,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 10,
  },
  chatbotSendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  chatbotSendGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Review Modal Styles
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewModalContent: {
    backgroundColor: COLORS.blackLight,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  reviewModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  reviewModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 8,
  },
  reviewModalSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24,
  },
  reviewStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  reviewStar: {
    marginHorizontal: 4,
  },
  reviewInputGroup: {
    marginBottom: 16,
  },
  reviewInputLabel: {
    fontSize: 14,
    color: COLORS.gold,
    marginBottom: 8,
  },
  reviewInput: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  reviewInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reviewSubmitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  reviewSubmitGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  reviewSubmitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    marginRight: 8,
  },
  
  // Review CTA Section Styles
  reviewCTASection: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  reviewCTAButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  reviewCTAGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  reviewCTAText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginLeft: 10,
  },
  
  // Admin Link
  adminLink: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  adminLinkText: {
    fontSize: 12,
    color: COLORS.gray,
    textDecorationLine: 'underline',
  },
  
  // Promo & Premium Styles
  premiumBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumBannerGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  premiumBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  premiumBannerText: {
    flex: 1,
  },
  premiumBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  premiumBannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  premiumMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#9C27B0',
  },
  premiumMemberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9C27B0',
    marginHorizontal: 8,
  },
  loyaltyProgress: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  loyaltyProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loyaltyProgressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold,
    marginLeft: 8,
  },
  loyaltyProgressText: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 12,
  },
  loyaltyProgressBar: {
    height: 8,
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  loyaltyProgressFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 4,
  },
  loyaltyProgressCount: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'right',
    marginTop: 6,
  },
  loyaltyActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76,175,80,0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  loyaltyActiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 8,
  },
  promoCodeSection: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  promoCodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold,
    marginBottom: 12,
  },
  promoCodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoCodeInput: {
    flex: 1,
    backgroundColor: COLORS.black,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  promoCodeApplyBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  promoCodeApplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  promoApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  promoAppliedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoAppliedCode: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 8,
  },
  promoAppliedDiscount: {
    fontSize: 13,
    color: COLORS.success,
    marginLeft: 10,
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promoRemoveBtn: {
    padding: 4,
  },
  promoError: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 8,
  },
  checkoutDiscount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkoutDiscountName: {
    fontSize: 13,
    color: COLORS.success,
  },
  checkoutDiscountAmount: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
  },
  
  // Premium Modal Styles
  premiumModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumModalContent: {
    width: width - 32,
    maxHeight: height * 0.85,
    backgroundColor: COLORS.blackLight,
    borderRadius: 24,
    overflow: 'hidden',
  },
  premiumModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  premiumModalHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  premiumModalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 12,
  },
  premiumModalPrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 8,
  },
  premiumModalPricePeriod: {
    fontSize: 16,
    fontWeight: 'normal',
    color: COLORS.goldLight,
  },
  premiumModalBody: {
    padding: 24,
  },
  premiumModalBenefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 16,
  },
  premiumModalBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  premiumModalBenefitText: {
    fontSize: 14,
    color: COLORS.white,
    marginLeft: 12,
    flex: 1,
  },
  premiumModalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 20,
  },
  premiumModalLoyaltyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  premiumModalLoyaltyText: {
    marginLeft: 12,
    flex: 1,
  },
  premiumModalLoyaltyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold,
  },
  premiumModalLoyaltyDesc: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  premiumSubscribeButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  premiumSubscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  premiumSubscribeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginLeft: 10,
  },
  premiumModalDisclaimer: {
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'center',
  },
});
