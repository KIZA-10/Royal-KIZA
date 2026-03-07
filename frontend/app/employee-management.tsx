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
  Modal,
  RefreshControl,
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

const ROLE_LABELS: Record<string, string> = {
  driver: 'Livreur',
  cook: 'Cuisinier',
  server: 'Serveur',
  manager: 'Manager',
  cleaner: 'Agent entretien',
  other: 'Autre',
};

const ROLE_ICONS: Record<string, string> = {
  driver: 'motorcycle',
  cook: 'utensils',
  server: 'concierge-bell',
  manager: 'user-tie',
  cleaner: 'broom',
  other: 'user',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  per_delivery: 'Par livraison',
  percentage: 'Pourcentage',
  fixed_salary: 'Salaire fixe',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  on_leave: 'En congé',
};

interface Employee {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  role: string;
  payment_type: string;
  payment_rate: number;
  iban?: string;
  bank_name?: string;
  status: string;
  driver_id?: string;
  created_at: string;
  notes?: string;
}

interface PayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  role: string;
  period_month: number;
  period_year: number;
  total_deliveries: number;
  total_orders_amount: number;
  base_salary: number;
  bonus: number;
  deductions: number;
  total_amount: number;
  status: string;
  payment_type: string;
  payment_rate: number;
  iban?: string;
  paid_at?: string;
}

interface Driver {
  id: string;
  full_name: string;
  username: string;
}

export default function EmployeeManagementScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Employees state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Payroll state
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [payrollStats, setPayrollStats] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'cook',
    payment_type: 'fixed_salary',
    payment_rate: '',
    iban: '',
    bank_name: '',
    driver_id: '',
    notes: '',
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
      const [empRes, driverRes, statsRes] = await Promise.all([
        api.get('/api/employees'),
        api.get('/api/drivers'),
        api.get('/api/payroll/stats'),
      ]);
      setEmployees(empRes.data);
      setDrivers(driverRes.data);
      setPayrollStats(statsRes.data);
      
      // Fetch payroll for selected month
      await fetchPayroll();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  const fetchPayroll = async () => {
    try {
      const res = await api.get(`/api/payroll?month=${selectedMonth}&year=${selectedYear}`);
      setPayrollRecords(res.data.records);
    } catch (error) {
      console.error('Error fetching payroll:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPayroll();
    }
  }, [selectedMonth, selectedYear, isAuthenticated]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData().finally(() => setRefreshing(false));
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      role: 'cook',
      payment_type: 'fixed_salary',
      payment_rate: '',
      iban: '',
      bank_name: '',
      driver_id: '',
      notes: '',
    });
    setSelectedEmployee(null);
  };

  const handleSaveEmployee = async () => {
    if (!formData.full_name || !formData.phone || !formData.payment_rate) {
      Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires');
      return;
    }

    try {
      const data = {
        ...formData,
        payment_rate: parseFloat(formData.payment_rate),
        driver_id: formData.role === 'driver' ? formData.driver_id : null,
      };

      if (selectedEmployee) {
        await api.put(`/api/employees/${selectedEmployee.id}`, data);
        Alert.alert('Succès', 'Employé mis à jour');
      } else {
        await api.post('/api/employees', data);
        Alert.alert('Succès', 'Employé ajouté');
      }
      
      setShowAddModal(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    }
  };

  const handleDeleteEmployee = (emp: Employee) => {
    Alert.alert(
      'Confirmer',
      `Supprimer ${emp.full_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/employees/${emp.id}`);
              fetchAllData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          },
        },
      ]
    );
  };

  const handleEditEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormData({
      full_name: emp.full_name,
      phone: emp.phone,
      email: emp.email || '',
      role: emp.role,
      payment_type: emp.payment_type,
      payment_rate: emp.payment_rate.toString(),
      iban: emp.iban || '',
      bank_name: emp.bank_name || '',
      driver_id: emp.driver_id || '',
      notes: emp.notes || '',
    });
    setShowAddModal(true);
  };

  const handleGeneratePayroll = async () => {
    setGeneratingPayroll(true);
    try {
      const res = await api.post(`/api/payroll/generate?month=${selectedMonth}&year=${selectedYear}`);
      Alert.alert('Succès', res.data.message);
      fetchPayroll();
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer la paie');
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const handleMarkPaid = async (record: PayrollRecord) => {
    try {
      await api.put(`/api/payroll/${record.id}/mark-paid`);
      fetchPayroll();
      fetchAllData();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de marquer comme payé');
    }
  };

  const getPaymentRateDisplay = (emp: Employee | PayrollRecord) => {
    if (emp.payment_type === 'per_delivery') return `${emp.payment_rate}€/livraison`;
    if (emp.payment_type === 'percentage') return `${emp.payment_rate}%`;
    return `${emp.payment_rate}€/mois`;
  };

  const filteredEmployees = employees.filter(emp => 
    roleFilter === 'all' || emp.role === roleFilter
  );

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

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
              <MaterialCommunityIcons name="account-cash" size={48} color={COLORS.gold} />
              <Text style={styles.loginTitle}>Employés & Paie</Text>
              <Text style={styles.loginSubtitle}>Gestion du personnel</Text>
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
          <Text style={styles.headerTitle}>Employés & Paie</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'employees' && styles.tabButtonActive]}
            onPress={() => setActiveTab('employees')}
          >
            <FontAwesome5 
              name="users" 
              size={16} 
              color={activeTab === 'employees' ? COLORS.black : COLORS.gold} 
            />
            <Text style={[styles.tabText, activeTab === 'employees' && styles.tabTextActive]}>
              Employés
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'payroll' && styles.tabButtonActive]}
            onPress={() => setActiveTab('payroll')}
          >
            <MaterialCommunityIcons 
              name="cash-multiple" 
              size={18} 
              color={activeTab === 'payroll' ? COLORS.black : COLORS.gold} 
            />
            <Text style={[styles.tabText, activeTab === 'payroll' && styles.tabTextActive]}>
              Paie
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
            {activeTab === 'employees' ? (
              /* Employees Tab */
              <View>
                {/* Stats */}
                {payrollStats && (
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statNumber}>{payrollStats.employee_stats.total_active}</Text>
                      <Text style={styles.statLabel}>Employés</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statNumber, { color: COLORS.success }]}>
                        {payrollStats.employee_stats.by_role?.driver || 0}
                      </Text>
                      <Text style={styles.statLabel}>Livreurs</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statNumber, { color: COLORS.info }]}>
                        {(payrollStats.employee_stats.by_role?.cook || 0) + 
                         (payrollStats.employee_stats.by_role?.server || 0)}
                      </Text>
                      <Text style={styles.statLabel}>Cuisine</Text>
                    </View>
                  </View>
                )}

                {/* Role Filter */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                >
                  {['all', 'driver', 'cook', 'server', 'manager', 'cleaner'].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[styles.filterChip, roleFilter === role && styles.filterChipActive]}
                      onPress={() => setRoleFilter(role)}
                    >
                      <Text style={[styles.filterChipText, roleFilter === role && styles.filterChipTextActive]}>
                        {role === 'all' ? 'Tous' : ROLE_LABELS[role]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Add Button */}
                <TouchableOpacity 
                  style={styles.addButton} 
                  onPress={() => { resetForm(); setShowAddModal(true); }}
                >
                  <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.addButtonGradient}>
                    <Ionicons name="add" size={20} color={COLORS.black} />
                    <Text style={styles.addButtonText}>Ajouter un employé</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Employee List */}
                {filteredEmployees.map((emp) => (
                  <View key={emp.id} style={styles.employeeCard}>
                    <View style={styles.employeeHeader}>
                      <View style={[styles.roleIcon, { backgroundColor: emp.status === 'active' ? COLORS.gold : COLORS.gray }]}>
                        <FontAwesome5 name={ROLE_ICONS[emp.role] || 'user'} size={16} color={COLORS.black} />
                      </View>
                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>{emp.full_name}</Text>
                        <Text style={styles.employeeRole}>{ROLE_LABELS[emp.role]}</Text>
                      </View>
                      <View style={styles.employeeActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditEmployee(emp)}>
                          <Ionicons name="pencil" size={18} color={COLORS.gold} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteEmployee(emp)}>
                          <Ionicons name="trash" size={18} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.employeeDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons name="call" size={14} color={COLORS.gray} />
                        <Text style={styles.detailText}>{emp.phone}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="cash" size={14} color={COLORS.gray} />
                        <Text style={styles.detailText}>{getPaymentRateDisplay(emp)}</Text>
                      </View>
                      {emp.iban && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons name="bank" size={14} color={COLORS.gray} />
                          <Text style={styles.detailText}>{emp.bank_name || 'IBAN'}: ***{emp.iban.slice(-4)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: emp.status === 'active' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)' }]}>
                      <Text style={[styles.statusText, { color: emp.status === 'active' ? COLORS.success : COLORS.error }]}>
                        {STATUS_LABELS[emp.status]}
                      </Text>
                    </View>
                  </View>
                ))}

                {filteredEmployees.length === 0 && (
                  <View style={styles.emptyState}>
                    <FontAwesome5 name="users" size={40} color={COLORS.gray} />
                    <Text style={styles.emptyText}>Aucun employé trouvé</Text>
                  </View>
                )}
              </View>
            ) : (
              /* Payroll Tab */
              <View>
                {/* Period Selector */}
                <View style={styles.periodSelector}>
                  <TouchableOpacity 
                    style={styles.periodArrow}
                    onPress={() => {
                      if (selectedMonth === 1) {
                        setSelectedMonth(12);
                        setSelectedYear(selectedYear - 1);
                      } else {
                        setSelectedMonth(selectedMonth - 1);
                      }
                    }}
                  >
                    <Ionicons name="chevron-back" size={24} color={COLORS.gold} />
                  </TouchableOpacity>
                  <View style={styles.periodDisplay}>
                    <Text style={styles.periodMonth}>{monthNames[selectedMonth - 1]}</Text>
                    <Text style={styles.periodYear}>{selectedYear}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.periodArrow}
                    onPress={() => {
                      if (selectedMonth === 12) {
                        setSelectedMonth(1);
                        setSelectedYear(selectedYear + 1);
                      } else {
                        setSelectedMonth(selectedMonth + 1);
                      }
                    }}
                  >
                    <Ionicons name="chevron-forward" size={24} color={COLORS.gold} />
                  </TouchableOpacity>
                </View>

                {/* Payroll Stats */}
                {payrollStats && (
                  <View style={styles.payrollSummary}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Total</Text>
                      <Text style={styles.summaryValue}>
                        {payrollStats.current_month.total.toFixed(2)}€
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Payé</Text>
                      <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                        {payrollStats.current_month.paid.toFixed(2)}€
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>En attente</Text>
                      <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
                        {payrollStats.current_month.pending.toFixed(2)}€
                      </Text>
                    </View>
                  </View>
                )}

                {/* Generate Payroll Button */}
                <TouchableOpacity 
                  style={styles.generateButton} 
                  onPress={handleGeneratePayroll}
                  disabled={generatingPayroll}
                >
                  <LinearGradient colors={[COLORS.success, '#388E3C']} style={styles.generateButtonGradient}>
                    {generatingPayroll ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="calculator" size={20} color={COLORS.white} />
                        <Text style={styles.generateButtonText}>Générer la paie du mois</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Payroll Records */}
                {payrollRecords.map((record) => (
                  <View key={record.id} style={styles.payrollCard}>
                    <View style={styles.payrollHeader}>
                      <View style={styles.payrollEmployee}>
                        <View style={[styles.roleIconSmall, { backgroundColor: COLORS.gold }]}>
                          <FontAwesome5 name={ROLE_ICONS[record.role] || 'user'} size={12} color={COLORS.black} />
                        </View>
                        <View>
                          <Text style={styles.payrollName}>{record.employee_name}</Text>
                          <Text style={styles.payrollRole}>{ROLE_LABELS[record.role]}</Text>
                        </View>
                      </View>
                      <View style={[
                        styles.payrollStatus,
                        { backgroundColor: record.status === 'paid' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)' }
                      ]}>
                        <Text style={[
                          styles.payrollStatusText,
                          { color: record.status === 'paid' ? COLORS.success : COLORS.warning }
                        ]}>
                          {record.status === 'paid' ? 'Payé' : 'En attente'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.payrollDetails}>
                      {record.payment_type !== 'fixed_salary' && (
                        <View style={styles.payrollDetailRow}>
                          <Text style={styles.payrollDetailLabel}>Livraisons</Text>
                          <Text style={styles.payrollDetailValue}>{record.total_deliveries}</Text>
                        </View>
                      )}
                      <View style={styles.payrollDetailRow}>
                        <Text style={styles.payrollDetailLabel}>Base</Text>
                        <Text style={styles.payrollDetailValue}>{record.base_salary.toFixed(2)}€</Text>
                      </View>
                      {record.bonus > 0 && (
                        <View style={styles.payrollDetailRow}>
                          <Text style={styles.payrollDetailLabel}>Bonus</Text>
                          <Text style={[styles.payrollDetailValue, { color: COLORS.success }]}>+{record.bonus.toFixed(2)}€</Text>
                        </View>
                      )}
                      {record.deductions > 0 && (
                        <View style={styles.payrollDetailRow}>
                          <Text style={styles.payrollDetailLabel}>Déductions</Text>
                          <Text style={[styles.payrollDetailValue, { color: COLORS.error }]}>-{record.deductions.toFixed(2)}€</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.payrollFooter}>
                      <View>
                        <Text style={styles.payrollTotalLabel}>Total</Text>
                        <Text style={styles.payrollTotal}>{record.total_amount.toFixed(2)}€</Text>
                      </View>
                      {record.status === 'pending' && (
                        <TouchableOpacity 
                          style={styles.payButton}
                          onPress={() => handleMarkPaid(record)}
                        >
                          <Text style={styles.payButtonText}>Marquer payé</Text>
                        </TouchableOpacity>
                      )}
                      {record.status === 'paid' && record.paid_at && (
                        <Text style={styles.paidDate}>
                          Payé le {new Date(record.paid_at).toLocaleDateString('fr-FR')}
                        </Text>
                      )}
                    </View>

                    {record.iban && (
                      <View style={styles.ibanRow}>
                        <MaterialCommunityIcons name="bank-transfer" size={14} color={COLORS.gray} />
                        <Text style={styles.ibanText}>IBAN: ***{record.iban.slice(-4)}</Text>
                      </View>
                    )}
                  </View>
                ))}

                {payrollRecords.length === 0 && (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="cash-multiple" size={40} color={COLORS.gray} />
                    <Text style={styles.emptyText}>Aucune fiche de paie pour ce mois</Text>
                    <Text style={styles.emptySubtext}>Cliquez sur "Générer la paie" pour créer les fiches</Text>
                  </View>
                )}
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Add/Edit Employee Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddModal(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedEmployee ? 'Modifier' : 'Nouvel'} Employé
                </Text>
                <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <Text style={styles.formLabel}>Nom complet *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.full_name}
                  onChangeText={(t) => setFormData({ ...formData, full_name: t })}
                  placeholder="Nom et prénom"
                  placeholderTextColor={COLORS.gray}
                />

                <Text style={styles.formLabel}>Téléphone *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.phone}
                  onChangeText={(t) => setFormData({ ...formData, phone: t })}
                  placeholder="+33 6 12 34 56 78"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="phone-pad"
                />

                <Text style={styles.formLabel}>Email</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.email}
                  onChangeText={(t) => setFormData({ ...formData, email: t })}
                  placeholder="email@example.com"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="email-address"
                />

                <Text style={styles.formLabel}>Rôle *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v })}
                    style={styles.picker}
                    dropdownIconColor={COLORS.gold}
                  >
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <Picker.Item key={key} label={label} value={key} color={COLORS.white} />
                    ))}
                  </Picker>
                </View>

                {formData.role === 'driver' && (
                  <>
                    <Text style={styles.formLabel}>Compte livreur associé</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={formData.driver_id}
                        onValueChange={(v) => setFormData({ ...formData, driver_id: v })}
                        style={styles.picker}
                        dropdownIconColor={COLORS.gold}
                      >
                        <Picker.Item label="-- Sélectionner --" value="" color={COLORS.gray} />
                        {drivers.map((d) => (
                          <Picker.Item key={d.id} label={`${d.full_name} (${d.username})`} value={d.id} color={COLORS.white} />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}

                <Text style={styles.formLabel}>Type de rémunération *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.payment_type}
                    onValueChange={(v) => setFormData({ ...formData, payment_type: v })}
                    style={styles.picker}
                    dropdownIconColor={COLORS.gold}
                  >
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                      <Picker.Item key={key} label={label} value={key} color={COLORS.white} />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.formLabel}>
                  {formData.payment_type === 'per_delivery' ? 'Montant par livraison (€) *' :
                   formData.payment_type === 'percentage' ? 'Pourcentage (%) *' :
                   'Salaire mensuel (€) *'}
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.payment_rate}
                  onChangeText={(t) => setFormData({ ...formData, payment_rate: t })}
                  placeholder={formData.payment_type === 'percentage' ? 'Ex: 10' : 'Ex: 1500'}
                  placeholderTextColor={COLORS.gray}
                  keyboardType="numeric"
                />

                <Text style={styles.formLabel}>Nom de la banque</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.bank_name}
                  onChangeText={(t) => setFormData({ ...formData, bank_name: t })}
                  placeholder="Ex: BNP Paribas"
                  placeholderTextColor={COLORS.gray}
                />

                <Text style={styles.formLabel}>IBAN</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.iban}
                  onChangeText={(t) => setFormData({ ...formData, iban: t })}
                  placeholder="FR76 XXXX XXXX XXXX XXXX"
                  placeholderTextColor={COLORS.gray}
                  autoCapitalize="characters"
                />

                <Text style={styles.formLabel}>Notes</Text>
                <TextInput
                  style={[styles.formInput, { height: 80 }]}
                  value={formData.notes}
                  onChangeText={(t) => setFormData({ ...formData, notes: t })}
                  placeholder="Notes additionnelles..."
                  placeholderTextColor={COLORS.gray}
                  multiline
                />
              </ScrollView>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEmployee}>
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={styles.saveButtonGradient}>
                  <Ionicons name="save" size={20} color={COLORS.black} />
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
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

  // Stats
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.blackMedium, borderRadius: 12, padding: 14, marginHorizontal: 4, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },

  // Filter
  filterScroll: { marginBottom: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.blackMedium, marginRight: 8, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  filterChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterChipText: { fontSize: 13, color: COLORS.gold, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.black },

  // Add Button
  addButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  addButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  addButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.black, marginLeft: 8 },

  // Employee Card
  employeeCard: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
  employeeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  roleIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 16, fontWeight: 'bold', color: COLORS.white },
  employeeRole: { fontSize: 13, color: COLORS.goldLight, marginTop: 2 },
  employeeActions: { flexDirection: 'row' },
  actionBtn: { padding: 8, marginLeft: 4 },
  employeeDetails: { paddingLeft: 52, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detailText: { fontSize: 13, color: COLORS.gray, marginLeft: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginLeft: 52 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: COLORS.gray, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: COLORS.gray, marginTop: 8, textAlign: 'center' },

  // Period Selector
  periodSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  periodArrow: { padding: 12 },
  periodDisplay: { alignItems: 'center', paddingHorizontal: 24 },
  periodMonth: { fontSize: 22, fontWeight: 'bold', color: COLORS.gold },
  periodYear: { fontSize: 14, color: COLORS.gray, marginTop: 2 },

  // Payroll Summary
  payrollSummary: { flexDirection: 'row', backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(212, 175, 55, 0.2)' },
  summaryLabel: { fontSize: 12, color: COLORS.gray },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.gold, marginTop: 4 },

  // Generate Button
  generateButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  generateButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  generateButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.white, marginLeft: 8 },

  // Payroll Card
  payrollCard: { backgroundColor: COLORS.blackMedium, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
  payrollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  payrollEmployee: { flexDirection: 'row', alignItems: 'center' },
  roleIconSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  payrollName: { fontSize: 15, fontWeight: '600', color: COLORS.white },
  payrollRole: { fontSize: 12, color: COLORS.gray },
  payrollStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  payrollStatusText: { fontSize: 11, fontWeight: '600' },
  payrollDetails: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12, marginBottom: 12 },
  payrollDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  payrollDetailLabel: { fontSize: 13, color: COLORS.gray },
  payrollDetailValue: { fontSize: 13, color: COLORS.white, fontWeight: '500' },
  payrollFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payrollTotalLabel: { fontSize: 12, color: COLORS.gray },
  payrollTotal: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },
  payButton: { backgroundColor: COLORS.success, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  payButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  paidDate: { fontSize: 12, color: COLORS.success },
  ibanRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  ibanText: { fontSize: 12, color: COLORS.gray, marginLeft: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.blackLight, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.2)' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.gold },
  modalForm: { padding: 20, maxHeight: 400 },
  formLabel: { fontSize: 13, color: COLORS.goldLight, marginBottom: 8, marginTop: 12 },
  formInput: { backgroundColor: COLORS.blackMedium, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: 15, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  pickerContainer: { backgroundColor: COLORS.blackMedium, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)', overflow: 'hidden' },
  picker: { color: COLORS.white, height: 50 },
  saveButton: { margin: 20, borderRadius: 12, overflow: 'hidden' },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, marginLeft: 8 },
});
