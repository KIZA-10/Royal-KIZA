import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

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
  black: '#0a0a0a',
  blackLight: '#1a1a1a',
  blackMedium: '#2a2a2a',
  white: '#ffffff',
  gray: '#888888',
  grayLight: '#cccccc',
  success: '#4CAF50',
  error: '#f44336',
};

// Category Icons mapping
const CATEGORY_ICONS: { [key: string]: string } = {
  entrees: 'restaurant-menu',
  grillades: 'local-fire-department',
  burgers: 'lunch-dining',
  desserts: 'cake',
  boissons: 'local-cafe',
  plats_surprise: 'card-giftcard',
};

export default function KizaRestaurant() {
  // States
  const [currentScreen, setCurrentScreen] = useState<'home' | 'menu' | 'cart' | 'checkout' | 'contact' | 'order_success'>('home');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('entrees');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  
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
      const [menuRes, infoRes] = await Promise.all([
        api.get('/menu'),
        api.get('/restaurant-info'),
      ]);
      setMenuItems(menuRes.data);
      setRestaurantInfo(infoRes.data);
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
    const total = getCartTotal();
    if (restaurantInfo && total >= restaurantInfo.free_delivery_minimum) {
      return 0;
    }
    return restaurantInfo?.delivery_fee || 3.00;
  };

  const placeOrder = async () => {
    // Validate address
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
      };

      const response = await api.post('/orders', orderData);
      setOrderNumber(response.data.order_number);
      setCart([]);
      await AsyncStorage.removeItem('kiza_cart');
      setCurrentScreen('order_success');
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Erreur', 'Impossible de passer la commande. Veuillez réessayer.');
    } finally {
      setLoading(false);
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
          <Image
            source={{ uri: 'https://customer-assets.emergentagent.com/job_ec724e36-6933-4af6-bd99-4588dc9d4227/artifacts/prsul7jv_1E618950-96B7-4D61-88C0-8D368C76A2E3.png' }}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </LinearGradient>
      </View>
    );
  }

  // Header Component
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => setCurrentScreen('home')} style={styles.headerLogo}>
        <Text style={styles.logoText}>KIZA</Text>
        <MaterialIcons name="restaurant" size={20} color={COLORS.gold} />
      </TouchableOpacity>
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.cartButton} 
          onPress={() => setCurrentScreen('cart')}
        >
          <Ionicons name="cart" size={24} color={COLORS.gold} />
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
        <Ionicons name="home" size={24} color={currentScreen === 'home' ? COLORS.gold : COLORS.gray} />
        <Text style={[styles.navText, currentScreen === 'home' && styles.navTextActive]}>Accueil</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navItem, currentScreen === 'menu' && styles.navItemActive]}
        onPress={() => setCurrentScreen('menu')}
      >
        <MaterialIcons name="restaurant-menu" size={24} color={currentScreen === 'menu' ? COLORS.gold : COLORS.gray} />
        <Text style={[styles.navText, currentScreen === 'menu' && styles.navTextActive]}>Menu</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navItem, currentScreen === 'cart' && styles.navItemActive]}
        onPress={() => setCurrentScreen('cart')}
      >
        <View>
          <Ionicons name="cart" size={24} color={currentScreen === 'cart' ? COLORS.gold : COLORS.gray} />
          {getCartItemCount() > 0 && (
            <View style={styles.navCartBadge}>
              <Text style={styles.navCartBadgeText}>{getCartItemCount()}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.navText, currentScreen === 'cart' && styles.navTextActive]}>Panier</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navItem, currentScreen === 'contact' && styles.navItemActive]}
        onPress={() => setCurrentScreen('contact')}
      >
        <Ionicons name="call" size={24} color={currentScreen === 'contact' ? COLORS.gold : COLORS.gray} />
        <Text style={[styles.navText, currentScreen === 'contact' && styles.navTextActive]}>Contact</Text>
      </TouchableOpacity>
    </View>
  );

  // Home Screen
  const renderHome = () => (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.3)', 'rgba(10, 10, 10, 0.9)']}
          style={styles.heroGradient}
        >
          <View style={styles.crownContainer}>
            <FontAwesome5 name="crown" size={40} color={COLORS.gold} />
          </View>
          <Text style={styles.heroTitle}>KIZA</Text>
          <Text style={styles.heroSubtitle}>RESTAURANT</Text>
          <Text style={styles.heroTagline}>Royale</Text>
          <View style={styles.heroCategories}>
            <Text style={styles.heroCategoryText}>Grillades • Burgers • Desserts • Boissons</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Delivery Info Banner */}
      <View style={styles.deliveryBanner}>
        <MaterialIcons name="delivery-dining" size={24} color={COLORS.gold} />
        <Text style={styles.deliveryBannerText}>Livraison dans un rayon de 30km</Text>
      </View>

      {/* Free Delivery Banner */}
      <View style={styles.freeDeliveryBanner}>
        <Ionicons name="gift" size={20} color={COLORS.black} />
        <Text style={styles.freeDeliveryText}>Livraison GRATUITE dès 25€ d'achat!</Text>
      </View>

      {/* Categories */}
      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Nos Catégories</Text>
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
              <LinearGradient
                colors={[COLORS.goldDark, COLORS.gold]}
                style={styles.categoryGradient}
              >
                <MaterialIcons 
                  name={CATEGORY_ICONS[cat.id] as any || 'restaurant'} 
                  size={32} 
                  color={COLORS.black} 
                />
              </LinearGradient>
              <Text style={styles.categoryName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Popular Items */}
      <View style={styles.popularSection}>
        <Text style={styles.sectionTitle}>Nos Best-Sellers</Text>
        {menuItems.slice(0, 4).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.popularCard}
            onPress={() => {
              setSelectedItem(item);
              setShowItemModal(true);
            }}
          >
            <View style={styles.popularInfo}>
              <Text style={styles.popularName}>{item.name}</Text>
              {item.quantity_info && (
                <Text style={styles.popularQuantity}>{item.quantity_info}</Text>
              )}
              <Text style={styles.popularDesc} numberOfLines={2}>{item.description}</Text>
              <Text style={styles.popularPrice}>{item.price.toFixed(2)}€</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addToCart(item, 1)}
            >
              <Ionicons name="add" size={24} color={COLORS.black} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      {/* Order CTA */}
      <TouchableOpacity
        style={styles.orderCTA}
        onPress={() => setCurrentScreen('menu')}
      >
        <LinearGradient
          colors={[COLORS.gold, COLORS.goldDark]}
          style={styles.orderCTAGradient}
        >
          <Text style={styles.orderCTAText}>Commander Maintenant</Text>
          <MaterialIcons name="arrow-forward" size={24} color={COLORS.black} />
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );

  // Menu Screen
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
            <MaterialIcons 
              name={CATEGORY_ICONS[cat.id] as any || 'restaurant'} 
              size={18} 
              color={selectedCategory === cat.id ? COLORS.black : COLORS.gold} 
            />
            <Text style={[
              styles.categoryTabText,
              selectedCategory === cat.id && styles.categoryTabTextActive
            ]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Menu Items */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        {filteredMenuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuCard}
            onPress={() => {
              setSelectedItem(item);
              setItemQuantity(1);
              setShowItemModal(true);
            }}
          >
            <View style={styles.menuCardContent}>
              <View style={styles.menuCardInfo}>
                <Text style={styles.menuCardName}>{item.name}</Text>
                {item.quantity_info && (
                  <Text style={styles.menuCardQuantity}>{item.quantity_info}</Text>
                )}
                <Text style={styles.menuCardDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.menuCardPrice}>{item.price.toFixed(2)}€</Text>
              </View>
              <TouchableOpacity
                style={styles.menuAddButton}
                onPress={() => addToCart(item, 1)}
              >
                <Ionicons name="add" size={28} color={COLORS.black} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
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
          <Ionicons name="cart-outline" size={80} color={COLORS.gray} />
          <Text style={styles.emptyCartText}>Votre panier est vide</Text>
          <TouchableOpacity
            style={styles.emptyCartButton}
            onPress={() => setCurrentScreen('menu')}
          >
            <Text style={styles.emptyCartButtonText}>Découvrir le menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {cart.map((item) => (
            <View key={item.menu_item_id} style={styles.cartItem}>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.name}</Text>
                <Text style={styles.cartItemPrice}>{item.price.toFixed(2)}€ / unité</Text>
              </View>
              <View style={styles.cartItemActions}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateCartQuantity(item.menu_item_id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={20} color={COLORS.gold} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateCartQuantity(item.menu_item_id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={20} color={COLORS.gold} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cartItemTotal}>{(item.price * item.quantity).toFixed(2)}€</Text>
            </View>
          ))}

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
              <Text style={styles.freeDeliveryHint}>
                Plus que {((restaurantInfo?.free_delivery_minimum || 25) - getCartTotal()).toFixed(2)}€ pour la livraison gratuite!
              </Text>
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
            <MaterialIcons name="payment" size={24} color={COLORS.gold} />
            <Text style={styles.paymentText}>Paiement à la livraison</Text>
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
              {(getCartTotal() + getDeliveryFee()).toFixed(2)}€
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.paymentMethod}>
          <MaterialIcons name="local-atm" size={24} color={COLORS.gold} />
          <View style={styles.paymentMethodInfo}>
            <Text style={styles.paymentMethodTitle}>Paiement à la livraison</Text>
            <Text style={styles.paymentMethodDesc}>Payez en espèces ou par carte au livreur</Text>
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
        <FontAwesome5 name="crown" size={40} color={COLORS.gold} />
        <Text style={styles.contactTitle}>KIZA</Text>
        <Text style={styles.contactSubtitle}>Restaurant</Text>
      </View>

      <View style={styles.contactSection}>
        <Text style={styles.contactSectionTitle}>Nous Contacter</Text>

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => openSocialMedia('phone')}
        >
          <View style={styles.contactIconContainer}>
            <Ionicons name="call" size={24} color={COLORS.gold} />
          </View>
          <View style={styles.contactCardInfo}>
            <Text style={styles.contactCardTitle}>Téléphone</Text>
            <Text style={styles.contactCardValue}>{restaurantInfo?.phone}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gray} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => openSocialMedia('email')}
        >
          <View style={styles.contactIconContainer}>
            <MaterialIcons name="email" size={24} color={COLORS.gold} />
          </View>
          <View style={styles.contactCardInfo}>
            <Text style={styles.contactCardTitle}>Email</Text>
            <Text style={styles.contactCardValue}>{restaurantInfo?.email}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gray} />
        </TouchableOpacity>

        <View style={styles.contactCard}>
          <View style={styles.contactIconContainer}>
            <Ionicons name="location" size={24} color={COLORS.gold} />
          </View>
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
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gray} />
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
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gray} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialCard}
          onPress={() => openSocialMedia('tiktok')}
        >
          <View style={[styles.socialIconContainer, { backgroundColor: COLORS.black, borderWidth: 1, borderColor: COLORS.white }]}>
            <FontAwesome5 name="tiktok" size={22} color={COLORS.white} />
          </View>
          <View style={styles.socialCardInfo}>
            <Text style={styles.socialCardTitle}>TikTok</Text>
            <Text style={styles.socialCardValue}>@{restaurantInfo?.social_media.tiktok}</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.gray} />
        </TouchableOpacity>
      </View>

      {/* Delivery Info */}
      <View style={styles.deliveryInfoSection}>
        <MaterialIcons name="delivery-dining" size={40} color={COLORS.gold} />
        <Text style={styles.deliveryInfoTitle}>Zone de Livraison</Text>
        <Text style={styles.deliveryInfoText}>Nous livrons dans un rayon de 30km</Text>
        <Text style={styles.deliveryInfoFee}>Frais de livraison: 3€</Text>
        <Text style={styles.deliveryInfoFree}>Gratuit dès 25€ d'achat!</Text>
      </View>

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
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={100} color={COLORS.gold} />
        </View>
        <Text style={styles.successTitle}>Commande Confirmée!</Text>
        <Text style={styles.successOrderNumber}>N° {orderNumber}</Text>
        <Text style={styles.successMessage}>
          Merci pour votre commande! Notre équipe prépare votre repas avec soin.
        </Text>
        <Text style={styles.successPayment}>
          Paiement à la livraison - Espèces ou Carte
        </Text>
        
        <View style={styles.successContact}>
          <Text style={styles.successContactText}>Questions? Appelez-nous:</Text>
          <TouchableOpacity
            style={styles.successPhoneButton}
            onPress={() => openSocialMedia('phone')}
          >
            <Ionicons name="call" size={20} color={COLORS.black} />
            <Text style={styles.successPhoneText}>{restaurantInfo?.phone}</Text>
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
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedItem.name}</Text>
                {selectedItem.quantity_info && (
                  <Text style={styles.modalQuantityInfo}>{selectedItem.quantity_info}</Text>
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
                  <Text style={styles.modalAddText}>
                    Ajouter au panier - {(selectedItem.price * itemQuantity).toFixed(2)}€
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
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
  },
  loadingLogo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  loadingText: {
    color: COLORS.gold,
    fontSize: 18,
    marginTop: 16,
    fontWeight: '500',
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
    borderBottomColor: COLORS.blackMedium,
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 2,
    marginRight: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartButton: {
    padding: 8,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.blackMedium,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
    marginTop: -9,
    paddingTop: 9,
  },
  navText: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 4,
  },
  navTextActive: {
    color: COLORS.gold,
  },
  navCartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCartBadgeText: {
    color: COLORS.black,
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Hero Section
  heroSection: {
    height: 280,
    marginBottom: 16,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  crownContainer: {
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 8,
    textShadowColor: 'rgba(212, 175, 55, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroSubtitle: {
    fontSize: 18,
    color: COLORS.white,
    letterSpacing: 6,
    marginTop: -4,
  },
  heroTagline: {
    fontSize: 24,
    color: COLORS.goldLight,
    fontStyle: 'italic',
    marginTop: 8,
  },
  heroCategories: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  heroCategoryText: {
    color: COLORS.goldLight,
    fontSize: 14,
    letterSpacing: 1,
  },
  
  // Delivery Banner
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.blackMedium,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  deliveryBannerText: {
    color: COLORS.white,
    fontSize: 14,
    marginLeft: 8,
  },
  freeDeliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  freeDeliveryText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Categories Section
  categoriesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  categoriesScroll: {
    paddingLeft: 16,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 90,
  },
  categoryGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    color: COLORS.white,
    fontSize: 12,
    textAlign: 'center',
  },
  
  // Popular Section
  popularSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  popularCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.blackMedium,
  },
  popularInfo: {
    flex: 1,
  },
  popularName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  popularQuantity: {
    fontSize: 12,
    color: COLORS.gold,
    marginBottom: 4,
  },
  popularDesc: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
  },
  popularPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  addButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Order CTA
  orderCTA: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  orderCTAGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  orderCTAText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginRight: 8,
  },
  
  // Menu Screen
  menuContainer: {
    flex: 1,
  },
  categoryTabs: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.blackMedium,
  },
  categoryTabsContent: {
    paddingHorizontal: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginLeft: 6,
  },
  categoryTabTextActive: {
    color: COLORS.black,
    fontWeight: 'bold',
  },
  menuScroll: {
    flex: 1,
    padding: 16,
  },
  menuCard: {
    backgroundColor: COLORS.blackMedium,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  menuCardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  menuCardInfo: {
    flex: 1,
  },
  menuCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  menuCardQuantity: {
    fontSize: 12,
    color: COLORS.gold,
    marginBottom: 4,
  },
  menuCardDesc: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 8,
    lineHeight: 18,
  },
  menuCardPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  menuAddButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  
  // Cart Screen
  screenTitle: {
    fontSize: 28,
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
  emptyCartText: {
    fontSize: 18,
    color: COLORS.gray,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyCartButton: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
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
    padding: 16,
    borderRadius: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 13,
    color: COLORS.gray,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold,
    minWidth: 60,
    textAlign: 'right',
  },
  
  // Order Summary
  orderSummary: {
    backgroundColor: COLORS.blackMedium,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
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
  freeDeliveryHint: {
    fontSize: 13,
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  summaryTotalValue: {
    fontSize: 20,
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
    padding: 12,
    backgroundColor: COLORS.blackMedium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  paymentText: {
    color: COLORS.gold,
    fontSize: 15,
    marginLeft: 8,
  },
  
  // Checkout Button
  checkoutButton: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  checkoutGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
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
    borderRadius: 8,
    padding: 14,
    color: COLORS.white,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.blackMedium,
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
    padding: 16,
    borderRadius: 12,
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
    marginBottom: 8,
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
    backgroundColor: COLORS.gray,
    marginVertical: 12,
  },
  checkoutTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
  },
  checkoutTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  checkoutTotalValue: {
    fontSize: 20,
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  paymentMethodInfo: {
    marginLeft: 12,
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
  },
  placeOrderGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 12,
  },
  placeOrderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginRight: 8,
  },
  
  // Contact Screen
  contactHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.blackMedium,
  },
  contactTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 4,
    marginTop: 8,
  },
  contactSubtitle: {
    fontSize: 16,
    color: COLORS.white,
    letterSpacing: 3,
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
    borderRadius: 12,
    marginBottom: 12,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  contactCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactCardTitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 2,
  },
  contactCardValue: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
  
  // Social Cards
  socialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blackMedium,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  socialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  socialCardTitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 2,
  },
  socialCardValue: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
  
  // Delivery Info Section
  deliveryInfoSection: {
    alignItems: 'center',
    padding: 30,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.blackMedium,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  deliveryInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 12,
    marginBottom: 8,
  },
  deliveryInfoText: {
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 8,
  },
  deliveryInfoFee: {
    fontSize: 14,
    color: COLORS.gray,
  },
  deliveryInfoFree: {
    fontSize: 15,
    color: COLORS.success,
    fontWeight: 'bold',
    marginTop: 4,
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
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 8,
  },
  successOrderNumber: {
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 20,
    backgroundColor: COLORS.blackMedium,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  successMessage: {
    fontSize: 16,
    color: COLORS.grayLight,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  successPayment: {
    fontSize: 14,
    color: COLORS.gold,
    marginBottom: 30,
  },
  successContact: {
    alignItems: 'center',
    marginBottom: 30,
  },
  successContactText: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 12,
  },
  successPhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  successPhoneText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  successHomeButton: {
    width: '100%',
  },
  successHomeGradient: {
    paddingVertical: 16,
    borderRadius: 12,
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.blackLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalHeader: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  modalQuantityInfo: {
    fontSize: 14,
    color: COLORS.gold,
    marginTop: 4,
  },
  modalDescription: {
    fontSize: 15,
    color: COLORS.gray,
    lineHeight: 22,
    marginBottom: 16,
  },
  modalPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 24,
  },
  modalQuantity: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalQuantityLabel: {
    fontSize: 16,
    color: COLORS.white,
  },
  modalQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalQuantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalQuantityValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    marginHorizontal: 20,
  },
  modalAddButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalAddGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalAddText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  
  bottomSpacing: {
    height: 100,
  },
});
