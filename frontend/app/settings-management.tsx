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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';

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
};

const getBackendUrl = () => {
  return Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
    || process.env.EXPO_PUBLIC_BACKEND_URL 
    || '';
};

const API_BASE_URL = getBackendUrl();
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const ADMIN_PASSWORD = 'kiza2024admin';

const SECTION_LABELS: Record<string, string> = {
  orders: 'Commandes',
  drivers: 'Livreurs',
  employees: 'Employés & Paie',
  finance: 'Finances',
  gps: 'Suivi GPS',
  settings: 'Paramètres',
  menu: 'Menu',
};

const SECTION_ICONS: Record<string, string> = {
  orders: 'receipt',
  drivers: 'people',
  employees: 'cash',
  finance: 'stats-chart',
  gps: 'location',
  settings: 'settings',
  menu: 'restaurant',
};

interface Settings {
  opening_hour: string;
  closing_hour: string;
  is_ramadan_mode: boolean;
  ramadan_opening_hour: string;
  ramadan_closing_hour: string;
  is_open: boolean;
}

interface MenuItem {
  id?: string;
  item_id?: string;
  name: string;
  description?: string;
  price?: number;
  category: string;
  image_url?: string;
  is_bestseller?: boolean;
  in_stock: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface AdminPassword {
  section: string;
  has_custom_password: boolean;
}

export default function SettingsManagementScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'hours' | 'stock' | 'passwords' | 'menu'>('hours');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<Settings>({
    opening_hour: '09:00',
    closing_hour: '23:50',
    is_ramadan_mode: false,
    ramadan_opening_hour: '18:00',
    ramadan_closing_hour: '02:00',
    is_open: true,
  });
  
  // Stock state
  const [stockItems, setStockItems] = useState<MenuItem[]>([]);
  const [stockFilter, setStockFilter] = useState<string>('all');
  
  // Password state
  const [passwords, setPasswords] = useState<AdminPassword[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Menu state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [menuFilter, setMenuFilter] = useState<string>('all');
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'entrees',
    image_base64: '',
    is_bestseller: false,
    in_stock: true,
  });

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
      const [settingsRes, passwordsRes, menuRes, categoriesRes, stockRes] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/admin/passwords'),
        api.get('/api/admin/menu'),
        api.get('/api/admin/menu/categories'),
        api.get('/api/menu/stock'),
      ]);
      setSettings(settingsRes.data);
      setPasswords(passwordsRes.data);
      setMenuItems(menuRes.data);
      setCategories(categoriesRes.data);
      setStockItems(stockRes.data);
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

  // Settings functions
  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.put('/api/settings', settings);
      Alert.alert('Succès', 'Paramètres enregistrés');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  // Stock functions
  const toggleStock = async (item: MenuItem) => {
    const itemId = item.item_id || item.id;
    if (!itemId) {
      Alert.alert('Erreur', 'ID du produit manquant');
      return;
    }
    const newStock = !item.in_stock;
    try {
      await api.put(`/api/menu/${itemId}/stock`, { in_stock: newStock });
      setStockItems(prev => 
        prev.map(i => (i.item_id || i.id) === itemId ? { ...i, in_stock: newStock } : i)
      );
    } catch (error) {
      console.error('Stock update error:', error);
      Alert.alert('Erreur', 'Impossible de modifier le stock');
    }
  };

  const getStockCategoryName = (cat: string) => {
    const found = categories.find(c => c.id === cat);
    return found?.name || cat;
  };

  const filteredStockItems = stockItems.filter(item => {
    if (stockFilter === 'all') return true;
    if (stockFilter === 'out') return !item.in_stock;
    return item.category === stockFilter;
  });

  // Password functions
  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 4 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    
    try {
      await api.put('/api/admin/passwords/update', {
        section: selectedSection,
        new_password: newPassword
      });
      Alert.alert('Succès', `Mot de passe mis à jour pour ${SECTION_LABELS[selectedSection]}`);
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le mot de passe');
    }
  };

  const handleResetPassword = async (section: string) => {
    Alert.alert(
      'Confirmer',
      `Réinitialiser le mot de passe de "${SECTION_LABELS[section]}" au mot de passe par défaut ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/admin/passwords/${section}`);
              Alert.alert('Succès', 'Mot de passe réinitialisé');
              fetchAllData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de réinitialiser');
            }
          }
        }
      ]
    );
  };

  // Menu functions
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setMenuForm({ ...menuForm, image_base64: result.assets[0].base64 });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erreur', 'Permission caméra requise');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setMenuForm({ ...menuForm, image_base64: result.assets[0].base64 });
    }
  };

  const resetMenuForm = () => {
    setMenuForm({
      name: '',
      description: '',
      price: '',
      category: 'entrees',
      image_base64: '',
      is_bestseller: false,
      in_stock: true,
    });
    setSelectedMenuItem(null);
  };

  const handleEditMenuItem = (item: MenuItem) => {
    setSelectedMenuItem(item);
    setMenuForm({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category: item.category,
      image_base64: '',
      is_bestseller: item.is_bestseller,
      in_stock: item.in_stock,
    });
    setShowMenuModal(true);
  };

  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price) {
      Alert.alert('Erreur', 'Nom et prix requis');
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: menuForm.name,
        description: menuForm.description,
        price: parseFloat(menuForm.price),
        category: menuForm.category,
        image_base64: menuForm.image_base64 || undefined,
        is_bestseller: menuForm.is_bestseller,
        in_stock: menuForm.in_stock,
      };

      if (selectedMenuItem) {
        await api.put(`/api/admin/menu/${selectedMenuItem.id}`, data);
        Alert.alert('Succès', 'Produit mis à jour');
      } else {
        await api.post('/api/admin/menu', data);
        Alert.alert('Succès', 'Produit ajouté');
      }

      setShowMenuModal(false);
      resetMenuForm();
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMenuItem = (item: MenuItem) => {
    Alert.alert(
      'Confirmer',
      `Supprimer "${item.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/admin/menu/${item.id}`);
              Alert.alert('Succès', 'Produit supprimé');
              fetchAllData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.name || catId;
  };

  const filteredMenuItems = menuItems.filter(item =>
    menuFilter === 'all' || item.category === menuFilter
  );

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
              <MaterialIcons name="settings" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Paramètres</Text>
              <Text style={styles.loginSubtitle}>Administration</Text>
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
          <Text style={styles.headerTitle}>Paramètres</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabNavScroll}>
          <View style={styles.tabNav}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'hours' && styles.tabButtonActive]}
              onPress={() => setActiveTab('hours')}
            >
              <Ionicons name="time" size={14} color={activeTab === 'hours' ? COLORS.black : COLORS.gold} />
              <Text style={[styles.tabText, activeTab === 'hours' && styles.tabTextActive]}>Horaires</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'stock' && styles.tabButtonActive]}
              onPress={() => setActiveTab('stock')}
            >
              <Ionicons name="cube" size={14} color={activeTab === 'stock' ? COLORS.black : COLORS.gold} />
              <Text style={[styles.tabText, activeTab === 'stock' && styles.tabTextActive]}>Stock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'passwords' && styles.tabButtonActive]}
              onPress={() => setActiveTab('passwords')}
            >
              <Ionicons name="key" size={14} color={activeTab === 'passwords' ? COLORS.black : COLORS.gold} />
              <Text style={[styles.tabText, activeTab === 'passwords' && styles.tabTextActive]}>Mots passe</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'menu' && styles.tabButtonActive]}
              onPress={() => setActiveTab('menu')}
            >
              <Ionicons name="restaurant" size={14} color={activeTab === 'menu' ? COLORS.black : COLORS.gold} />
              <Text style={[styles.tabText, activeTab === 'menu' && styles.tabTextActive]}>Menu</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

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
            {activeTab === 'hours' && (
              /* Hours Tab */
              <View>
                {/* Restaurant Open/Closed */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name={settings.is_open ? "storefront" : "storefront-outline"} size={24} color={settings.is_open ? COLORS.success : COLORS.error} />
                    <Text style={styles.cardTitle}>État du Restaurant</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{settings.is_open ? 'Ouvert' : 'Fermé'}</Text>
                    <Switch
                      value={settings.is_open}
                      onValueChange={(v) => setSettings({ ...settings, is_open: v })}
                      trackColor={{ false: COLORS.error, true: COLORS.success }}
                      thumbColor={COLORS.white}
                    />
                  </View>
                </View>

                {/* Normal Hours */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="sunny" size={24} color={COLORS.gold} />
                    <Text style={styles.cardTitle}>Horaires Normaux</Text>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Ouverture</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={settings.opening_hour}
                        onChangeText={(t) => setSettings({ ...settings, opening_hour: t })}
                        placeholder="09:00"
                        placeholderTextColor={COLORS.gray}
                      />
                    </View>
                    <Text style={styles.timeSeparator}>→</Text>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Fermeture</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={settings.closing_hour}
                        onChangeText={(t) => setSettings({ ...settings, closing_hour: t })}
                        placeholder="23:50"
                        placeholderTextColor={COLORS.gray}
                      />
                    </View>
                  </View>
                </View>

                {/* Ramadan Mode */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="moon" size={24} color={COLORS.goldLight} />
                    <Text style={styles.cardTitle}>Mode Ramadan</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Activer</Text>
                    <Switch
                      value={settings.is_ramadan_mode}
                      onValueChange={(v) => setSettings({ ...settings, is_ramadan_mode: v })}
                      trackColor={{ false: COLORS.blackMedium, true: COLORS.gold }}
                      thumbColor={COLORS.white}
                    />
                  </View>
                  {settings.is_ramadan_mode && (
                    <View style={[styles.timeRow, { marginTop: 16 }]}>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Iftar</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={settings.ramadan_opening_hour}
                          onChangeText={(t) => setSettings({ ...settings, ramadan_opening_hour: t })}
                        />
                      </View>
                      <Text style={styles.timeSeparator}>→</Text>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Fermeture</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={settings.ramadan_closing_hour}
                          onChangeText={(t) => setSettings({ ...settings, ramadan_closing_hour: t })}
                        />
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={saveSettings} disabled={saving}>
                  <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveButtonGradient}>
                    {saving ? <ActivityIndicator color={COLORS.black} /> : (
                      <>
                        <Ionicons name="save" size={20} color={COLORS.black} />
                        <Text style={styles.saveButtonText}>Enregistrer</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'stock' && (
              /* Stock Tab */
              <View>
                {/* Stock Stats */}
                <View style={styles.stockStatsRow}>
                  <View style={styles.stockStatCard}>
                    <Text style={styles.stockStatNumber}>{stockItems.length}</Text>
                    <Text style={styles.stockStatLabel}>Articles</Text>
                  </View>
                  <View style={styles.stockStatCard}>
                    <Text style={[styles.stockStatNumber, { color: COLORS.success }]}>
                      {stockItems.filter(i => i.in_stock).length}
                    </Text>
                    <Text style={styles.stockStatLabel}>En stock</Text>
                  </View>
                  <View style={styles.stockStatCard}>
                    <Text style={[styles.stockStatNumber, { color: COLORS.error }]}>
                      {stockItems.filter(i => !i.in_stock).length}
                    </Text>
                    <Text style={styles.stockStatLabel}>Rupture</Text>
                  </View>
                </View>

                {/* Stock Category Filter */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.stockFilterScroll}
                >
                  <TouchableOpacity
                    style={[styles.stockFilterChip, stockFilter === 'all' && styles.stockFilterChipActive]}
                    onPress={() => setStockFilter('all')}
                  >
                    <Text style={[styles.stockFilterChipText, stockFilter === 'all' && styles.stockFilterChipTextActive]}>Tous</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stockFilterChip, stockFilter === 'out' && styles.stockFilterChipActive, stockFilter === 'out' && { backgroundColor: COLORS.error }]}
                    onPress={() => setStockFilter('out')}
                  >
                    <Text style={[styles.stockFilterChipText, stockFilter === 'out' && styles.stockFilterChipTextActive]}>Ruptures</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.stockFilterChip, stockFilter === cat.id && styles.stockFilterChipActive]}
                      onPress={() => setStockFilter(cat.id)}
                    >
                      <Text style={[styles.stockFilterChipText, stockFilter === cat.id && styles.stockFilterChipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Stock Items List */}
                {filteredStockItems.map((item) => (
                  <View key={item.item_id || item.id} style={styles.stockCard}>
                    <View style={styles.stockInfo}>
                      <Text style={styles.stockName}>{item.name}</Text>
                      <Text style={styles.stockCategory}>{getStockCategoryName(item.category)}</Text>
                    </View>
                    <View style={styles.stockToggle}>
                      <Text style={[
                        styles.stockStatus,
                        { color: item.in_stock ? COLORS.success : COLORS.error }
                      ]}>
                        {item.in_stock ? 'En stock' : 'Rupture'}
                      </Text>
                      <Switch
                        value={item.in_stock}
                        onValueChange={() => toggleStock(item)}
                        trackColor={{ false: COLORS.error, true: COLORS.success }}
                        thumbColor={COLORS.white}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'passwords' && (
              /* Passwords Tab */
              <View>
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle" size={20} color={COLORS.gold} />
                  <Text style={styles.infoText}>
                    Définissez un mot de passe unique pour chaque section admin. Par défaut, toutes les sections utilisent "kiza2024admin".
                  </Text>
                </View>

                {passwords.map((pw) => (
                  <View key={pw.section} style={styles.passwordCard}>
                    <View style={styles.passwordLeft}>
                      <View style={[styles.passwordIcon, { backgroundColor: pw.has_custom_password ? COLORS.success : COLORS.blackMedium }]}>
                        <Ionicons name={SECTION_ICONS[pw.section] as any} size={20} color={pw.has_custom_password ? COLORS.white : COLORS.gold} />
                      </View>
                      <View>
                        <Text style={styles.passwordSection}>{SECTION_LABELS[pw.section]}</Text>
                        <Text style={styles.passwordStatus}>
                          {pw.has_custom_password ? 'Mot de passe personnalisé' : 'Mot de passe par défaut'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.passwordActions}>
                      <TouchableOpacity
                        style={styles.passwordBtn}
                        onPress={() => {
                          setSelectedSection(pw.section);
                          setShowPasswordModal(true);
                        }}
                      >
                        <Ionicons name="pencil" size={18} color={COLORS.gold} />
                      </TouchableOpacity>
                      {pw.has_custom_password && (
                        <TouchableOpacity
                          style={styles.passwordBtn}
                          onPress={() => handleResetPassword(pw.section)}
                        >
                          <Ionicons name="refresh" size={18} color={COLORS.warning} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'menu' && (
              /* Menu Tab */
              <View>
                {/* Add Button */}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => { resetMenuForm(); setShowMenuModal(true); }}
                >
                  <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.addButtonGradient}>
                    <Ionicons name="add" size={20} color={COLORS.black} />
                    <Text style={styles.addButtonText}>Ajouter un produit</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Category Filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  <TouchableOpacity
                    style={[styles.filterChip, menuFilter === 'all' && styles.filterChipActive]}
                    onPress={() => setMenuFilter('all')}
                  >
                    <Text style={[styles.filterChipText, menuFilter === 'all' && styles.filterChipTextActive]}>Tous ({menuItems.length})</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => {
                    const count = menuItems.filter(i => i.category === cat.id).length;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.filterChip, menuFilter === cat.id && styles.filterChipActive]}
                        onPress={() => setMenuFilter(cat.id)}
                      >
                        <Text style={[styles.filterChipText, menuFilter === cat.id && styles.filterChipTextActive]}>
                          {cat.name} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Menu Items */}
                {filteredMenuItems.map((item) => (
                  <View key={item.id} style={styles.menuCard}>
                    <View style={styles.menuCardContent}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.menuImage} />
                      ) : (
                        <View style={[styles.menuImage, styles.menuImagePlaceholder]}>
                          <Ionicons name="image" size={24} color={COLORS.gray} />
                        </View>
                      )}
                      <View style={styles.menuInfo}>
                        <View style={styles.menuHeader}>
                          <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
                          {item.is_bestseller && (
                            <View style={styles.bestsellerBadge}>
                              <Text style={styles.bestsellerText}>Best</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.menuCategory}>{getCategoryName(item.category)}</Text>
                        <Text style={styles.menuPrice}>{item.price.toFixed(2)}€</Text>
                        <View style={[styles.stockBadge, { backgroundColor: item.in_stock ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)' }]}>
                          <Text style={[styles.stockText, { color: item.in_stock ? COLORS.success : COLORS.error }]}>
                            {item.in_stock ? 'En stock' : 'Rupture'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.menuActions}>
                      <TouchableOpacity style={styles.menuBtn} onPress={() => handleEditMenuItem(item)}>
                        <Ionicons name="pencil" size={18} color={COLORS.gold} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.menuBtn} onPress={() => handleDeleteMenuItem(item)}>
                        <Ionicons name="trash" size={18} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Password Modal */}
        <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Modifier le mot de passe</Text>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>{SECTION_LABELS[selectedSection]}</Text>
              
              <View style={styles.modalForm}>
                <Text style={styles.formLabel}>Nouveau mot de passe</Text>
                <TextInput
                  style={styles.formInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Minimum 4 caractères"
                  placeholderTextColor={COLORS.gray}
                />
                
                <Text style={styles.formLabel}>Confirmer</Text>
                <TextInput
                  style={styles.formInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Retapez le mot de passe"
                  placeholderTextColor={COLORS.gray}
                />
              </View>

              <TouchableOpacity style={styles.modalSaveButton} onPress={handleUpdatePassword}>
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveButtonGradient}>
                  <Ionicons name="save" size={20} color={COLORS.black} />
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Menu Item Modal */}
        <Modal visible={showMenuModal} transparent animationType="slide" onRequestClose={() => setShowMenuModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedMenuItem ? 'Modifier' : 'Nouveau'} Produit</Text>
                <TouchableOpacity onPress={() => { setShowMenuModal(false); resetMenuForm(); }}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                {/* Image */}
                <Text style={styles.formLabel}>Photo</Text>
                <View style={styles.imagePickerRow}>
                  {menuForm.image_base64 ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${menuForm.image_base64}` }} style={styles.previewImage} />
                  ) : selectedMenuItem?.image_url ? (
                    <Image source={{ uri: selectedMenuItem.image_url }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.previewImage, styles.previewImagePlaceholder]}>
                      <Ionicons name="image" size={32} color={COLORS.gray} />
                    </View>
                  )}
                  <View style={styles.imageButtons}>
                    <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                      <Ionicons name="images" size={20} color={COLORS.gold} />
                      <Text style={styles.imageBtnText}>Galerie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
                      <Ionicons name="camera" size={20} color={COLORS.gold} />
                      <Text style={styles.imageBtnText}>Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.formLabel}>Nom *</Text>
                <TextInput
                  style={styles.formInput}
                  value={menuForm.name}
                  onChangeText={(t) => setMenuForm({ ...menuForm, name: t })}
                  placeholder="Nom du produit"
                  placeholderTextColor={COLORS.gray}
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, { height: 80 }]}
                  value={menuForm.description}
                  onChangeText={(t) => setMenuForm({ ...menuForm, description: t })}
                  placeholder="Description..."
                  placeholderTextColor={COLORS.gray}
                  multiline
                />

                <Text style={styles.formLabel}>Prix (€) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={menuForm.price}
                  onChangeText={(t) => setMenuForm({ ...menuForm, price: t })}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="numeric"
                />

                <Text style={styles.formLabel}>Catégorie</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={menuForm.category}
                    onValueChange={(v) => setMenuForm({ ...menuForm, category: v })}
                    style={styles.picker}
                    dropdownIconColor={COLORS.gold}
                  >
                    {categories.map((cat) => (
                      <Picker.Item key={cat.id} label={cat.name} value={cat.id} color={COLORS.white} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Best-seller</Text>
                  <Switch
                    value={menuForm.is_bestseller}
                    onValueChange={(v) => setMenuForm({ ...menuForm, is_bestseller: v })}
                    trackColor={{ false: COLORS.blackMedium, true: COLORS.gold }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>En stock</Text>
                  <Switch
                    value={menuForm.in_stock}
                    onValueChange={(v) => setMenuForm({ ...menuForm, in_stock: v })}
                    trackColor={{ false: COLORS.error, true: COLORS.success }}
                  />
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveMenuItem} disabled={saving}>
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveButtonGradient}>
                  {saving ? <ActivityIndicator color={COLORS.black} /> : (
                    <>
                      <Ionicons name="save" size={20} color={COLORS.black} />
                      <Text style={styles.saveButtonText}>Enregistrer</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.gold, marginLeft: 6 },
  tabTextActive: { color: COLORS.black },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 16 },
  card: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white, marginLeft: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 16, color: COLORS.white },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 13, color: COLORS.gold, marginBottom: 8 },
  timeInput: { backgroundColor: COLORS.blackLight, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: 18, fontWeight: '600', textAlign: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  timeSeparator: { fontSize: 20, color: COLORS.gold, paddingHorizontal: 16, paddingTop: 24 },
  saveButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, marginLeft: 8 },
  infoCard: { flexDirection: 'row', backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  infoText: { flex: 1, fontSize: 13, color: COLORS.gray, marginLeft: 12, lineHeight: 18 },
  passwordCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 16, marginBottom: 10 },
  passwordLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  passwordIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  passwordSection: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  passwordStatus: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  passwordActions: { flexDirection: 'row' },
  passwordBtn: { padding: 8, marginLeft: 4 },
  addButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  addButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  addButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginLeft: 8 },
  filterScroll: { marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: COLORS.blackMedium, marginRight: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  filterChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterChipText: { fontSize: 12, color: COLORS.gold, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.black },
  menuCard: { backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 12, marginBottom: 10 },
  menuCardContent: { flexDirection: 'row' },
  menuImage: { width: 70, height: 70, borderRadius: 10 },
  menuImagePlaceholder: { backgroundColor: COLORS.blackLight, justifyContent: 'center', alignItems: 'center' },
  menuInfo: { flex: 1, marginLeft: 12 },
  menuHeader: { flexDirection: 'row', alignItems: 'center' },
  menuName: { fontSize: 15, fontWeight: '600', color: COLORS.white, flex: 1 },
  bestsellerBadge: { backgroundColor: COLORS.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  bestsellerText: { fontSize: 9, fontWeight: 'bold', color: COLORS.black },
  menuCategory: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  menuPrice: { fontSize: 16, fontWeight: 'bold', color: COLORS.gold, marginTop: 4 },
  stockBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  stockText: { fontSize: 10, fontWeight: '600' },
  menuActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  menuBtn: { padding: 8, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.blackLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },
  modalSubtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 20 },
  modalForm: { maxHeight: 400 },
  formLabel: { fontSize: 13, color: COLORS.goldLight, marginBottom: 8, marginTop: 12 },
  formInput: { backgroundColor: COLORS.blackMedium, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: 15, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  modalSaveButton: { borderRadius: 12, overflow: 'hidden', marginTop: 20 },
  pickerContainer: { backgroundColor: COLORS.blackMedium, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', overflow: 'hidden' },
  picker: { color: COLORS.white, height: 50 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  switchLabel: { fontSize: 15, color: COLORS.white },
  imagePickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  previewImage: { width: 80, height: 80, borderRadius: 10 },
  previewImagePlaceholder: { backgroundColor: COLORS.blackMedium, justifyContent: 'center', alignItems: 'center' },
  imageButtons: { marginLeft: 16 },
  imageBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blackMedium, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  imageBtnText: { fontSize: 13, color: COLORS.gold, marginLeft: 8 },
  // Stock Tab Styles
  tabNavScroll: { flexGrow: 0 },
  stockStatsRow: { flexDirection: 'row', marginBottom: 16 },
  stockStatCard: { flex: 1, backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 14, marginHorizontal: 4, alignItems: 'center' },
  stockStatNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold },
  stockStatLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  stockFilterScroll: { marginBottom: 16 },
  stockFilterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.blackMedium, marginRight: 8, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  stockFilterChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  stockFilterChipText: { fontSize: 14, color: COLORS.gold, fontWeight: '500' },
  stockFilterChipTextActive: { color: COLORS.black },
  stockCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
  stockInfo: { flex: 1, marginRight: 12 },
  stockName: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  stockCategory: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  stockToggle: { flexDirection: 'row', alignItems: 'center' },
  stockStatus: { fontSize: 12, fontWeight: '600', marginRight: 10 },
});
