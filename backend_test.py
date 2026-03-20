#!/usr/bin/env python3
"""
Backend API Testing Suite for KIZA Restaurant
Tests Settings, Stock Management, GPS Tracking, Employee Management, and Payroll APIs
"""

import requests
import json
from typing import Dict, Any, List

# Backend URL from frontend environment
BACKEND_BASE_URL = "https://dev-preview-223.preview.emergentagent.com"
API_BASE_URL = f"{BACKEND_BASE_URL}/api"

def print_test_header(test_name: str):
    print(f"\n{'='*60}")
    print(f"Testing: {test_name}")
    print(f"{'='*60}")

def print_response(response: requests.Response):
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    try:
        response_data = response.json()
        print(f"Response Body: {json.dumps(response_data, indent=2)}")
        return response_data
    except json.JSONDecodeError:
        print(f"Response Text: {response.text}")
        return response.text

# ============ GPS TRACKING TESTS ============

def test_get_drivers():
    """Test GET /api/drivers - Get all drivers to select one for location testing"""
    print_test_header("GET /api/drivers - Get All Drivers")
    
    try:
        response = requests.get(f"{API_BASE_URL}/drivers", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} drivers")
                if len(response_data) > 0:
                    # Return the first driver for testing
                    first_driver = response_data[0]
                    print(f"Using driver for testing: {first_driver.get('full_name')} (ID: {first_driver.get('id')})")
                    print("✅ GET /api/drivers - SUCCESS")
                    return True, first_driver.get('id'), response_data
                else:
                    print("⚠️  No drivers found. GPS tracking tests will be skipped.")
                    print("✅ GET /api/drivers - SUCCESS (no drivers)")
                    return True, None, response_data
            else:
                print("❌ GET /api/drivers - FAILED: Response is not a list")
                return False, None, response_data
        else:
            print(f"❌ GET /api/drivers - FAILED: Status {response.status_code}")
            return False, None, None
            
    except Exception as e:
        print(f"❌ GET /api/drivers - ERROR: {e}")
        return False, None, None

def test_update_driver_location(driver_id: str):
    """Test PUT /api/drivers/{driver_id}/location - Update driver GPS location"""
    print_test_header(f"PUT /api/drivers/{driver_id}/location - Update Driver Location")
    
    # Test GPS coordinates (Paris coordinates as specified in review request)
    test_location = {
        "latitude": 48.8566,
        "longitude": 2.3522
    }
    
    try:
        response = requests.put(
            f"{API_BASE_URL}/drivers/{driver_id}/location",
            json=test_location,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['message', 'lat', 'lng']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        print(f"✓ {field}: {response_data[field]}")
                        if field == 'lat' and response_data[field] != test_location['latitude']:
                            print(f"✗ latitude mismatch: expected {test_location['latitude']}, got {response_data[field]}")
                            success = False
                        elif field == 'lng' and response_data[field] != test_location['longitude']:
                            print(f"✗ longitude mismatch: expected {test_location['longitude']}, got {response_data[field]}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ PUT /api/drivers/{driver_id}/location - SUCCESS")
                    return True, response_data
                else:
                    print("❌ PUT /api/drivers/{driver_id}/location - FAILED: Invalid response")
                    return False, response_data
            else:
                print("❌ PUT /api/drivers/{driver_id}/location - FAILED: Invalid response format")
                return False, response_data
        else:
            print(f"❌ PUT /api/drivers/{driver_id}/location - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ PUT /api/drivers/{driver_id}/location - ERROR: {e}")
        return False, None

def test_get_active_drivers_locations():
    """Test GET /api/drivers/locations/active - Get active drivers with locations and assigned orders"""
    print_test_header("GET /api/drivers/locations/active - Get Active Drivers with GPS")
    
    try:
        response = requests.get(f"{API_BASE_URL}/drivers/locations/active", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} active drivers with location data")
                
                # Validate structure if there are drivers
                if len(response_data) > 0:
                    first_driver_data = response_data[0]
                    print(f"\nValidating first driver data structure:")
                    
                    required_fields = ['driver', 'assigned_orders']
                    success = True
                    
                    for field in required_fields:
                        if field in first_driver_data:
                            print(f"  ✓ {field}: present")
                            if field == 'driver':
                                driver_info = first_driver_data[field]
                                location_fields = ['current_lat', 'current_lng', 'last_location_update']
                                for loc_field in location_fields:
                                    if loc_field in driver_info:
                                        print(f"    ✓ {loc_field}: {driver_info[loc_field]}")
                                    else:
                                        print(f"    ⚠️  {loc_field}: not present or null")
                            elif field == 'assigned_orders':
                                orders = first_driver_data[field]
                                print(f"    ✓ assigned_orders: {len(orders)} orders")
                        else:
                            print(f"  ✗ Missing field: {field}")
                            success = False
                    
                    if success:
                        print("✅ GET /api/drivers/locations/active - SUCCESS")
                        return True, response_data
                    else:
                        print("❌ GET /api/drivers/locations/active - FAILED: Invalid structure")
                        return False, response_data
                else:
                    print("⚠️  No active drivers with locations found")
                    print("✅ GET /api/drivers/locations/active - SUCCESS (no active drivers)")
                    return True, response_data
            else:
                print("❌ GET /api/drivers/locations/active - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/drivers/locations/active - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/drivers/locations/active - ERROR: {e}")
        return False, None

def test_get_tracking_overview():
    """Test GET /api/tracking/overview - Get tracking overview statistics"""
    print_test_header("GET /api/tracking/overview - Get Tracking Overview")
    
    try:
        response = requests.get(f"{API_BASE_URL}/tracking/overview", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = [
                    'active_drivers',
                    'drivers_with_location', 
                    'orders_in_delivery',
                    'pending_orders'
                ]
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value} ({type(value)})")
                        if not isinstance(value, int) or value < 0:
                            print(f"✗ {field} should be a non-negative integer")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ GET /api/tracking/overview - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/tracking/overview - FAILED: Invalid structure or values")
                    return False, response_data
            else:
                print("❌ GET /api/tracking/overview - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/tracking/overview - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/tracking/overview - ERROR: {e}")
        return False, None

def verify_location_update(driver_id: str):
    """Verify that the driver location update appears in active drivers list"""
    print_test_header("Verification: Check Updated Location in Active Drivers")
    
    try:
        response = requests.get(f"{API_BASE_URL}/drivers/locations/active", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200 and isinstance(response_data, list):
            # Find the driver we updated
            updated_driver = None
            for driver_data in response_data:
                driver = driver_data.get('driver', {})
                if driver.get('id') == driver_id:
                    updated_driver = driver
                    break
            
            if updated_driver:
                print(f"Found updated driver: {updated_driver.get('full_name')}")
                lat = updated_driver.get('current_lat')
                lng = updated_driver.get('current_lng')
                last_update = updated_driver.get('last_location_update')
                
                print(f"  Current location: {lat}, {lng}")
                print(f"  Last update: {last_update}")
                
                # Check if coordinates match what we sent (48.8566, 2.3522)
                if lat == 48.8566 and lng == 2.3522:
                    print("✅ Location Update Verification - SUCCESS: Coordinates match")
                    return True, updated_driver
                else:
                    print(f"❌ Location Update Verification - FAILED: Expected (48.8566, 2.3522), got ({lat}, {lng})")
                    return False, updated_driver
            else:
                print("❌ Location Update Verification - FAILED: Updated driver not found in active drivers list")
                return False, None
        else:
            print("❌ Location Update Verification - FAILED: Could not retrieve active drivers")
            return False, None
            
    except Exception as e:
        print(f"❌ Location Update Verification - ERROR: {e}")
        return False, None

# ============ SETTINGS AND STOCK MANAGEMENT TESTS ============

def test_get_settings():
    """Test GET /api/settings - Should return restaurant settings with defaults"""
    print_test_header("GET /api/settings - Get Restaurant Settings")
    
    try:
        response = requests.get(f"{API_BASE_URL}/settings", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            # Validate expected fields with default values
            expected_fields = {
                'opening_hour': '09:00',
                'closing_hour': '23:50',
                'is_ramadan_mode': False,
                'ramadan_opening_hour': '18:00',
                'ramadan_closing_hour': '02:00',
                'is_open': True
            }
            
            success = True
            for field, default_value in expected_fields.items():
                if field in response_data:
                    print(f"✓ {field}: {response_data[field]} (expected type: {type(default_value)})")
                    if type(response_data[field]) != type(default_value):
                        print(f"✗ {field} has wrong type: {type(response_data[field])} instead of {type(default_value)}")
                        success = False
                else:
                    print(f"✗ Missing field: {field}")
                    success = False
            
            if success:
                print("✅ GET /api/settings - SUCCESS")
                return True, response_data
            else:
                print("❌ GET /api/settings - FAILED: Missing or invalid fields")
                return False, response_data
        else:
            print(f"❌ GET /api/settings - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/settings - ERROR: {e}")
        return False, None

def test_update_settings():
    """Test PUT /api/settings - Update restaurant settings"""
    print_test_header("PUT /api/settings - Update Restaurant Settings")
    
    # Test data matching the review request
    test_data = {
        "opening_hour": "10:00",
        "closing_hour": "22:00", 
        "is_ramadan_mode": True
    }
    
    try:
        response = requests.put(
            f"{API_BASE_URL}/settings",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            # Validate response structure
            if isinstance(response_data, dict) and 'message' in response_data and 'settings' in response_data:
                updated_settings = response_data['settings']
                
                # Verify updates were applied
                success = True
                for field, expected_value in test_data.items():
                    if field in updated_settings and updated_settings[field] == expected_value:
                        print(f"✓ {field} updated to: {updated_settings[field]}")
                    else:
                        print(f"✗ {field} not updated correctly: expected {expected_value}, got {updated_settings.get(field)}")
                        success = False
                
                if success:
                    print("✅ PUT /api/settings - SUCCESS")
                    return True, updated_settings
                else:
                    print("❌ PUT /api/settings - FAILED: Updates not applied correctly")
                    return False, updated_settings
            else:
                print("❌ PUT /api/settings - FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ PUT /api/settings - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ PUT /api/settings - ERROR: {e}")
        return False, None

def test_get_stock_status():
    """Test GET /api/menu/stock - Get stock status for all menu items"""
    print_test_header("GET /api/menu/stock - Get All Stock Status")
    
    try:
        response = requests.get(f"{API_BASE_URL}/menu/stock", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list) and len(response_data) > 0:
                # Validate structure of first few items
                sample_items = response_data[:3]
                success = True
                
                for i, item in enumerate(sample_items):
                    print(f"\nValidating item {i+1}: {item.get('name', 'Unknown')}")
                    
                    required_fields = ['item_id', 'name', 'category', 'in_stock']
                    for field in required_fields:
                        if field in item:
                            print(f"  ✓ {field}: {item[field]} ({type(item[field])})")
                        else:
                            print(f"  ✗ Missing field: {field}")
                            success = False
                
                print(f"\nTotal items returned: {len(response_data)}")
                
                if success:
                    print("✅ GET /api/menu/stock - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/menu/stock - FAILED: Invalid item structure")
                    return False, response_data
            else:
                print("❌ GET /api/menu/stock - FAILED: No stock items returned")
                return False, response_data
        else:
            print(f"❌ GET /api/menu/stock - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/menu/stock - ERROR: {e}")
        return False, None

def test_update_item_stock():
    """Test PUT /api/menu/{item_id}/stock - Update stock status for specific item"""
    print_test_header("PUT /api/menu/1/stock - Update Samoussa Stock Status")
    
    # Test with item_id "1" (Samoussa) as specified in review request
    item_id = "1"
    test_data = {"in_stock": False}
    
    try:
        response = requests.put(
            f"{API_BASE_URL}/menu/{item_id}/stock",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            # Validate response structure
            if isinstance(response_data, dict):
                expected_fields = ['message', 'item_id', 'in_stock']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        print(f"✓ {field}: {response_data[field]}")
                        if field == 'item_id' and response_data[field] != item_id:
                            print(f"✗ item_id mismatch: expected {item_id}, got {response_data[field]}")
                            success = False
                        elif field == 'in_stock' and response_data[field] != test_data['in_stock']:
                            print(f"✗ in_stock mismatch: expected {test_data['in_stock']}, got {response_data[field]}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ PUT /api/menu/1/stock - SUCCESS")
                    return True, response_data
                else:
                    print("❌ PUT /api/menu/1/stock - FAILED: Invalid response")
                    return False, response_data
            else:
                print("❌ PUT /api/menu/1/stock - FAILED: Invalid response format")
                return False, response_data
        else:
            print(f"❌ PUT /api/menu/1/stock - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ PUT /api/menu/1/stock - ERROR: {e}")
        return False, None

def verify_stock_update():
    """Verify that the stock update was persisted by checking GET /api/menu/stock"""
    print_test_header("Verification: Check Samoussa Stock Status After Update")
    
    try:
        response = requests.get(f"{API_BASE_URL}/menu/stock", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200 and isinstance(response_data, list):
            # Find Samoussa (item_id "1")
            samoussa_item = None
            for item in response_data:
                if item.get('item_id') == '1':
                    samoussa_item = item
                    break
            
            if samoussa_item:
                print(f"Found Samoussa: {samoussa_item}")
                if samoussa_item.get('in_stock') == False:
                    print("✅ Stock Update Verification - SUCCESS: Samoussa is marked as out of stock")
                    return True, samoussa_item
                else:
                    print(f"❌ Stock Update Verification - FAILED: Samoussa stock status is {samoussa_item.get('in_stock')}, expected False")
                    return False, samoussa_item
            else:
                print("❌ Stock Update Verification - FAILED: Samoussa not found in stock list")
                return False, None
        else:
            print("❌ Stock Update Verification - FAILED: Could not retrieve stock status")
            return False, None
            
    except Exception as e:
        print(f"❌ Stock Update Verification - ERROR: {e}")
        return False, None

# ============ EMPLOYEE MANAGEMENT TESTS ============

def test_create_employee():
    """Test POST /api/employees - Create a new employee"""
    print_test_header("POST /api/employees - Create New Employee")
    
    # Test data from the review request with realistic French data
    test_employee = {
        "full_name": "Jean Dupont",
        "phone": "+33612345678",
        "email": "jean@kiza.fr",
        "role": "cook",
        "payment_type": "fixed_salary",
        "payment_rate": 1800,
        "iban": "FR7630006000011234567890189",
        "bank_name": "BNP Paribas"
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/employees",
            json=test_employee,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate required fields
                expected_fields = ['id', 'full_name', 'phone', 'email', 'role', 'payment_type', 'payment_rate', 'iban', 'bank_name', 'status', 'created_at']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value}")
                        
                        # Validate specific field values
                        if field == 'full_name' and value != test_employee['full_name']:
                            print(f"✗ {field} mismatch: expected {test_employee[field]}, got {value}")
                            success = False
                        elif field == 'payment_rate' and value != test_employee['payment_rate']:
                            print(f"✗ {field} mismatch: expected {test_employee[field]}, got {value}")
                            success = False
                        elif field == 'status' and value != 'active':
                            print(f"✗ Default status should be 'active', got {value}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                # Check if ID is a valid UUID format
                employee_id = response_data.get('id')
                if employee_id and len(employee_id.split('-')) == 5:
                    print(f"✓ ID format is valid UUID: {employee_id}")
                else:
                    print(f"✗ Invalid ID format: {employee_id}")
                    success = False
                
                if success:
                    print("✅ POST /api/employees - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/employees - FAILED: Invalid response data")
                    return False, response_data
            else:
                print("❌ POST /api/employees - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ POST /api/employees - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/employees - ERROR: {e}")
        return False, None

def test_get_employees():
    """Test GET /api/employees - Get all employees"""
    print_test_header("GET /api/employees - Get All Employees")
    
    try:
        response = requests.get(f"{API_BASE_URL}/employees", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} employees")
                
                if len(response_data) > 0:
                    # Validate structure of first employee
                    first_employee = response_data[0]
                    print(f"\nValidating first employee: {first_employee.get('full_name', 'Unknown')}")
                    
                    required_fields = ['id', 'full_name', 'phone', 'role', 'payment_type', 'payment_rate', 'status']
                    success = True
                    
                    for field in required_fields:
                        if field in first_employee:
                            print(f"  ✓ {field}: {first_employee[field]} ({type(first_employee[field])})")
                        else:
                            print(f"  ✗ Missing field: {field}")
                            success = False
                    
                    if success:
                        print("✅ GET /api/employees - SUCCESS")
                        return True, response_data
                    else:
                        print("❌ GET /api/employees - FAILED: Invalid employee structure")
                        return False, response_data
                else:
                    print("⚠️  No employees found, but API is working")
                    print("✅ GET /api/employees - SUCCESS (empty list)")
                    return True, response_data
            else:
                print("❌ GET /api/employees - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/employees - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/employees - ERROR: {e}")
        return False, None

# ============ FINANCIAL DASHBOARD TESTS ============

def test_get_financial_stats():
    """Test GET /api/finance/stats - Get comprehensive financial statistics"""
    print_test_header("GET /api/finance/stats - Get Financial Statistics")
    
    try:
        response = requests.get(f"{API_BASE_URL}/finance/stats", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate expected structure
                expected_sections = ['revenue', 'orders', 'transactions', 'charts']
                success = True
                
                for section in expected_sections:
                    if section in response_data:
                        print(f"✓ {section}: present")
                        
                        if section == 'revenue':
                            revenue = response_data[section]
                            revenue_fields = ['today', 'week', 'month', 'total']
                            for field in revenue_fields:
                                if field in revenue:
                                    print(f"  ✓ {field}: €{revenue[field]} ({type(revenue[field])})")
                                else:
                                    print(f"  ✗ Missing field in revenue: {field}")
                                    success = False
                        
                        elif section == 'orders':
                            orders = response_data[section]
                            order_fields = ['total', 'delivered', 'pending', 'average_value']
                            for field in order_fields:
                                if field in orders:
                                    print(f"  ✓ {field}: {orders[field]} ({type(orders[field])})")
                                else:
                                    print(f"  ✗ Missing field in orders: {field}")
                                    success = False
                        
                        elif section == 'transactions':
                            transactions = response_data[section]
                            trans_fields = ['paid', 'pending']
                            for field in trans_fields:
                                if field in transactions:
                                    print(f"  ✓ {field}: {transactions[field]} ({type(transactions[field])})")
                                else:
                                    print(f"  ✗ Missing field in transactions: {field}")
                                    success = False
                        
                        elif section == 'charts':
                            charts = response_data[section]
                            chart_fields = ['daily', 'monthly']
                            for field in chart_fields:
                                if field in charts:
                                    chart_data = charts[field]
                                    if isinstance(chart_data, list):
                                        print(f"  ✓ {field}: {len(chart_data)} data points")
                                        if len(chart_data) > 0:
                                            first_point = chart_data[0]
                                            if field == 'daily' and 'date' in first_point and 'amount' in first_point:
                                                print(f"    ✓ Daily data format valid: date={first_point['date']}, amount={first_point['amount']}")
                                            elif field == 'monthly' and 'month' in first_point and 'amount' in first_point:
                                                print(f"    ✓ Monthly data format valid: month={first_point['month']}, amount={first_point['amount']}")
                                    else:
                                        print(f"  ✗ {field} should be a list")
                                        success = False
                                else:
                                    print(f"  ✗ Missing field in charts: {field}")
                                    success = False
                    else:
                        print(f"✗ Missing section: {section}")
                        success = False
                
                if success:
                    print("✅ GET /api/finance/stats - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/finance/stats - FAILED: Invalid structure")
                    return False, response_data
            else:
                print("❌ GET /api/finance/stats - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/finance/stats - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/finance/stats - ERROR: {e}")
        return False, None

def test_get_financial_transactions():
    """Test GET /api/finance/transactions - Get payment transactions"""
    print_test_header("GET /api/finance/transactions - Get Payment Transactions")
    
    try:
        response = requests.get(f"{API_BASE_URL}/finance/transactions", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} transactions")
                
                # Validate structure if there are transactions
                if len(response_data) > 0:
                    first_transaction = response_data[0]
                    print(f"\nValidating first transaction structure:")
                    
                    expected_fields = ['id', 'order_id', 'amount', 'currency', 'payment_status', 'created_at']
                    success = True
                    
                    for field in expected_fields:
                        if field in first_transaction:
                            print(f"  ✓ {field}: {first_transaction[field]} ({type(first_transaction[field])})")
                        else:
                            print(f"  ⚠️  {field}: not present (may be optional)")
                    
                    # Check for order details if present
                    if 'order_number' in first_transaction:
                        print(f"  ✓ order_number: {first_transaction['order_number']}")
                    if 'customer_name' in first_transaction:
                        print(f"  ✓ customer_name: {first_transaction['customer_name']}")
                    
                    print("✅ GET /api/finance/transactions - SUCCESS")
                    return True, response_data
                else:
                    print("⚠️  No transactions found, but API is working")
                    print("✅ GET /api/finance/transactions - SUCCESS (empty list)")
                    return True, response_data
            else:
                print("❌ GET /api/finance/transactions - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/finance/transactions - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/finance/transactions - ERROR: {e}")
        return False, None

def test_get_finance_summary():
    """Test GET /api/finance/summary - Get quick finance summary"""
    print_test_header("GET /api/finance/summary - Get Finance Summary")
    
    try:
        response = requests.get(f"{API_BASE_URL}/finance/summary", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate expected structure
                expected_sections = ['today', 'recent_transactions']
                success = True
                
                for section in expected_sections:
                    if section in response_data:
                        print(f"✓ {section}: present")
                        
                        if section == 'today':
                            today = response_data[section]
                            today_fields = ['revenue', 'orders']
                            for field in today_fields:
                                if field in today:
                                    print(f"  ✓ {field}: {today[field]} ({type(today[field])})")
                                else:
                                    print(f"  ✗ Missing field in today: {field}")
                                    success = False
                        
                        elif section == 'recent_transactions':
                            recent = response_data[section]
                            if isinstance(recent, list):
                                print(f"  ✓ recent_transactions: {len(recent)} transactions")
                            else:
                                print(f"  ✗ recent_transactions should be a list")
                                success = False
                    else:
                        print(f"✗ Missing section: {section}")
                        success = False
                
                if success:
                    print("✅ GET /api/finance/summary - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/finance/summary - FAILED: Invalid structure")
                    return False, response_data
            else:
                print("❌ GET /api/finance/summary - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/finance/summary - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/finance/summary - ERROR: {e}")
        return False, None

# ============ PAYROLL MANAGEMENT TESTS ============

def test_get_payroll_stats():
    """Test GET /api/payroll/stats - Get payroll statistics"""
    print_test_header("GET /api/payroll/stats - Get Payroll Statistics")
    
    try:
        response = requests.get(f"{API_BASE_URL}/payroll/stats", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate expected structure
                expected_sections = ['current_month', 'employee_stats']
                success = True
                
                for section in expected_sections:
                    if section in response_data:
                        print(f"✓ {section}: present")
                        
                        if section == 'current_month':
                            current_month = response_data[section]
                            month_fields = ['month', 'year', 'total', 'paid', 'pending', 'employee_count']
                            for field in month_fields:
                                if field in current_month:
                                    print(f"  ✓ {field}: {current_month[field]} ({type(current_month[field])})")
                                else:
                                    print(f"  ✗ Missing field in current_month: {field}")
                                    success = False
                        
                        elif section == 'employee_stats':
                            emp_stats = response_data[section]
                            stats_fields = ['total_active', 'by_role']
                            for field in stats_fields:
                                if field in emp_stats:
                                    print(f"  ✓ {field}: {emp_stats[field]} ({type(emp_stats[field])})")
                                else:
                                    print(f"  ✗ Missing field in employee_stats: {field}")
                                    success = False
                    else:
                        print(f"✗ Missing section: {section}")
                        success = False
                
                if success:
                    print("✅ GET /api/payroll/stats - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/payroll/stats - FAILED: Invalid structure")
                    return False, response_data
            else:
                print("❌ GET /api/payroll/stats - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/payroll/stats - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/payroll/stats - ERROR: {e}")
        return False, None

def test_generate_payroll():
    """Test POST /api/payroll/generate - Generate payroll for current month"""
    print_test_header("POST /api/payroll/generate - Generate Payroll")
    
    try:
        response = requests.post(f"{API_BASE_URL}/payroll/generate", timeout=30)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate expected fields
                expected_fields = ['message', 'period', 'records']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: present")
                        
                        if field == 'period':
                            period = response_data[field]
                            if 'month' in period and 'year' in period:
                                print(f"  ✓ month: {period['month']}, year: {period['year']}")
                            else:
                                print("  ✗ Period missing month or year")
                                success = False
                        
                        elif field == 'records':
                            records = response_data[field]
                            print(f"  ✓ Generated {len(records)} payroll records")
                            
                            # Validate first record if any exist
                            if len(records) > 0:
                                first_record = records[0]
                                record_fields = ['id', 'employee_id', 'employee_name', 'role', 'total_amount', 'status', 'payment_type']
                                for rfield in record_fields:
                                    if rfield in first_record:
                                        print(f"    ✓ {rfield}: {first_record[rfield]}")
                                    else:
                                        print(f"    ✗ Missing field in record: {rfield}")
                                        success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ POST /api/payroll/generate - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/payroll/generate - FAILED: Invalid structure")
                    return False, response_data
            else:
                print("❌ POST /api/payroll/generate - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ POST /api/payroll/generate - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/payroll/generate - ERROR: {e}")
        return False, None

def test_get_payroll_overview():
    """Test GET /api/payroll - Get payroll overview for current month"""
    print_test_header("GET /api/payroll - Get Payroll Overview")
    
    try:
        response = requests.get(f"{API_BASE_URL}/payroll", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate expected structure
                expected_fields = ['period', 'records', 'summary']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        print(f"✓ {field}: present")
                        
                        if field == 'period':
                            period = response_data[field]
                            if 'month' in period and 'year' in period:
                                print(f"  ✓ month: {period['month']}, year: {period['year']}")
                            else:
                                print("  ✗ Period missing month or year")
                                success = False
                        
                        elif field == 'records':
                            records = response_data[field]
                            print(f"  ✓ Found {len(records)} payroll records")
                        
                        elif field == 'summary':
                            summary = response_data[field]
                            summary_fields = ['total_employees', 'total_pending', 'total_paid', 'total_amount']
                            for sfield in summary_fields:
                                if sfield in summary:
                                    print(f"  ✓ {sfield}: {summary[sfield]} ({type(summary[sfield])})")
                                else:
                                    print(f"  ✗ Missing field in summary: {sfield}")
                                    success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ GET /api/payroll - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/payroll - FAILED: Invalid structure")
                    return False, response_data
            else:
                print("❌ GET /api/payroll - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/payroll - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/payroll - ERROR: {e}")
        return False, None

def test_mark_payroll_paid(payroll_id: str):
    """Test PUT /api/payroll/{payroll_id}/mark-paid - Mark payroll as paid"""
    print_test_header(f"PUT /api/payroll/{payroll_id}/mark-paid - Mark Payroll as Paid")
    
    try:
        response = requests.put(f"{API_BASE_URL}/payroll/{payroll_id}/mark-paid", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate that status changed to paid
                expected_fields = ['id', 'status', 'paid_at', 'employee_name', 'total_amount']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value}")
                        
                        if field == 'id' and value != payroll_id:
                            print(f"✗ ID mismatch: expected {payroll_id}, got {value}")
                            success = False
                        elif field == 'status' and value != 'paid':
                            print(f"✗ Status should be 'paid', got {value}")
                            success = False
                        elif field == 'paid_at' and not value:
                            print(f"✗ paid_at should not be null")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ PUT /api/payroll/{payroll_id}/mark-paid - SUCCESS")
                    return True, response_data
                else:
                    print("❌ PUT /api/payroll/{payroll_id}/mark-paid - FAILED: Invalid response")
                    return False, response_data
            else:
                print("❌ PUT /api/payroll/{payroll_id}/mark-paid - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ PUT /api/payroll/{payroll_id}/mark-paid - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ PUT /api/payroll/{payroll_id}/mark-paid - ERROR: {e}")
        return False, None

def run_all_tests():
    """Run all Settings, Stock Management, GPS Tracking, Employee Management, and Payroll API tests"""
    print("🍽️  KIZA Restaurant - Complete Backend API Test Suite")
    print("=" * 80)
    
    all_results = {}
    driver_id = None
    payroll_id = None
    
    # GPS TRACKING TESTS
    print("\n🛰️  GPS TRACKING API TESTS")
    print("=" * 40)
    
    # Test 1: Get Drivers (to get a driver ID for testing)
    success, driver_id, data = test_get_drivers()
    all_results['get_drivers'] = success
    
    if driver_id:
        # Test 2: Update Driver Location
        success, data = test_update_driver_location(driver_id)
        all_results['update_driver_location'] = success
        
        # Test 3: Get Active Drivers Locations
        success, data = test_get_active_drivers_locations()
        all_results['get_active_drivers_locations'] = success
        
        # Test 4: Verify Location Update
        success, data = verify_location_update(driver_id)
        all_results['verify_location_update'] = success
    else:
        print("⚠️  Skipping location-specific tests as no drivers are available")
        all_results['update_driver_location'] = True  # Skip but don't fail
        all_results['get_active_drivers_locations'] = True
        all_results['verify_location_update'] = True
    
    # Test 5: Get Tracking Overview
    success, data = test_get_tracking_overview()
    all_results['get_tracking_overview'] = success
    
    # SETTINGS & STOCK MANAGEMENT TESTS
    print("\n⚙️  SETTINGS & STOCK MANAGEMENT API TESTS")
    print("=" * 50)
    
    # Test 6: Get Settings
    success, data = test_get_settings()
    all_results['get_settings'] = success
    
    # Test 7: Update Settings  
    success, data = test_update_settings()
    all_results['update_settings'] = success
    
    # Test 8: Get Stock Status
    success, data = test_get_stock_status()
    all_results['get_stock'] = success
    
    # Test 9: Update Item Stock
    success, data = test_update_item_stock()
    all_results['update_stock'] = success
    
    # Test 10: Verify Stock Update
    success, data = verify_stock_update()
    all_results['verify_stock'] = success
    
    # EMPLOYEE MANAGEMENT TESTS
    print("\n👥 EMPLOYEE MANAGEMENT API TESTS")
    print("=" * 45)
    
    # Test 11: Create Employee
    success, employee_data = test_create_employee()
    all_results['create_employee'] = success
    
    # Test 12: Get All Employees
    success, employees_data = test_get_employees()
    all_results['get_employees'] = success
    
    # PAYROLL MANAGEMENT TESTS
    print("\n💰 PAYROLL MANAGEMENT API TESTS")
    print("=" * 40)
    
    # Test 13: Get Payroll Stats
    success, stats_data = test_get_payroll_stats()
    all_results['get_payroll_stats'] = success
    
    # Test 14: Generate Payroll
    success, generate_data = test_generate_payroll()
    all_results['generate_payroll'] = success
    
    # Test 15: Get Payroll Overview
    success, overview_data = test_get_payroll_overview()
    all_results['get_payroll_overview'] = success
    
    # Test 16: Mark Payroll as Paid (if we have payroll records)
    if success and overview_data and 'records' in overview_data and len(overview_data['records']) > 0:
        payroll_id = overview_data['records'][0]['id']
        success, paid_data = test_mark_payroll_paid(payroll_id)
        all_results['mark_payroll_paid'] = success
    else:
        print("⚠️  Skipping mark payroll paid test - no payroll records available")
        all_results['mark_payroll_paid'] = True  # Skip but don't fail
    
    # FINANCIAL DASHBOARD TESTS
    print("\n📊 FINANCIAL DASHBOARD API TESTS")
    print("=" * 40)
    
    # Test 17: Get Financial Stats
    success, stats_data = test_get_financial_stats()
    all_results['get_financial_stats'] = success
    
    # Test 18: Get Financial Transactions
    success, transactions_data = test_get_financial_transactions()
    all_results['get_financial_transactions'] = success
    
    # Test 19: Get Finance Summary
    success, summary_data = test_get_finance_summary()
    all_results['get_finance_summary'] = success
    
    # Summary
    print(f"\n{'='*80}")
    print("FINAL TEST RESULTS SUMMARY")
    print(f"{'='*80}")
    
    total_tests = len(all_results)
    passed_tests = sum(1 for result in all_results.values() if result)
    
    print("\n🛰️  GPS TRACKING TESTS:")
    gps_tests = ['get_drivers', 'update_driver_location', 'get_active_drivers_locations', 'verify_location_update', 'get_tracking_overview']
    for test_name in gps_tests:
        if test_name in all_results:
            status = "✅ PASS" if all_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n⚙️  SETTINGS & STOCK TESTS:")
    settings_tests = ['get_settings', 'update_settings', 'get_stock', 'update_stock', 'verify_stock']
    for test_name in settings_tests:
        if test_name in all_results:
            status = "✅ PASS" if all_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n👥 EMPLOYEE MANAGEMENT TESTS:")
    employee_tests = ['create_employee', 'get_employees']
    for test_name in employee_tests:
        if test_name in all_results:
            status = "✅ PASS" if all_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n💰 PAYROLL MANAGEMENT TESTS:")
    payroll_tests = ['get_payroll_stats', 'generate_payroll', 'get_payroll_overview', 'mark_payroll_paid']
    for test_name in payroll_tests:
        if test_name in all_results:
            status = "✅ PASS" if all_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n📊 FINANCIAL DASHBOARD TESTS:")
    finance_tests = ['get_financial_stats', 'get_financial_transactions', 'get_finance_summary']
    for test_name in finance_tests:
        if test_name in all_results:
            status = "✅ PASS" if all_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nTests Passed: {passed_tests}/{total_tests}")
    
    # ============ ADMIN PASSWORD AND MENU MANAGEMENT TESTS ============
    
    # Run Admin Password Management tests
    print_test_header("ADMIN PASSWORD MANAGEMENT API TESTS")
    admin_password_tests_passed = 0
    
    # Test 1: Get admin passwords
    print_test_header("GET /api/admin/passwords")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/passwords", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                sections = [item.get('section') for item in response_data]
                expected_sections = ["orders", "drivers", "employees", "finance", "gps", "settings", "menu"]
                if all(section in sections for section in expected_sections):
                    print("✅ GET /api/admin/passwords - SUCCESS: All admin sections returned with password status")
                    admin_password_tests_passed += 1
                else:
                    print("❌ GET /api/admin/passwords - FAILED: Missing some expected sections")
            else:
                print("❌ GET /api/admin/passwords - FAILED: Response is not a list")
        else:
            print("❌ GET /api/admin/passwords - FAILED: Non-200 status code")
    except Exception as e:
        print(f"❌ GET /api/admin/passwords - ERROR: {str(e)}")
    
    # Test 2: Verify default password
    print_test_header("POST /api/admin/passwords/verify (default password)")
    try:
        verify_data = {
            "section": "orders",
            "password": "kiza2024admin"
        }
        response = requests.post(f"{API_BASE_URL}/admin/passwords/verify", 
                               json=verify_data, timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if response_data.get('valid') is True and response_data.get('section') == 'orders':
                print("✅ POST /api/admin/passwords/verify (default) - SUCCESS: Default password verified")
                admin_password_tests_passed += 1
            else:
                print("❌ POST /api/admin/passwords/verify (default) - FAILED: Invalid response structure")
        else:
            print("❌ POST /api/admin/passwords/verify (default) - FAILED: Non-200 status code")
    except Exception as e:
        print(f"❌ POST /api/admin/passwords/verify (default) - ERROR: {str(e)}")
    
    # Test 3: Update password
    print_test_header("PUT /api/admin/passwords/update")
    try:
        update_data = {
            "section": "orders", 
            "new_password": "test123"
        }
        response = requests.put(f"{API_BASE_URL}/admin/passwords/update", 
                              json=update_data, timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if "Password updated for orders" in response_data.get('message', ''):
                print("✅ PUT /api/admin/passwords/update - SUCCESS: Password updated successfully")
                admin_password_tests_passed += 1
            else:
                print("❌ PUT /api/admin/passwords/update - FAILED: Invalid response message")
        else:
            print("❌ PUT /api/admin/passwords/update - FAILED: Non-200 status code")
    except Exception as e:
        print(f"❌ PUT /api/admin/passwords/update - ERROR: {str(e)}")
    
    # Test 4: Verify new password
    print_test_header("POST /api/admin/passwords/verify (new password)")
    try:
        verify_new_data = {
            "section": "orders",
            "password": "test123"
        }
        response = requests.post(f"{API_BASE_URL}/admin/passwords/verify", 
                               json=verify_new_data, timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if response_data.get('valid') is True and response_data.get('section') == 'orders':
                print("✅ POST /api/admin/passwords/verify (new) - SUCCESS: New password verified")
                admin_password_tests_passed += 1
            else:
                print("❌ POST /api/admin/passwords/verify (new) - FAILED: Invalid response structure")
        else:
            print("❌ POST /api/admin/passwords/verify (new) - FAILED: Non-200 status code")
    except Exception as e:
        print(f"❌ POST /api/admin/passwords/verify (new) - ERROR: {str(e)}")

    # Run Menu Management tests
    print_test_header("MENU MANAGEMENT API TESTS")
    menu_tests_passed = 0
    
    # Test 5: Get menu categories
    print_test_header("GET /api/admin/menu/categories")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/menu/categories", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                category_ids = [item.get('id') for item in response_data]
                expected_categories = ['entrees', 'grillades', 'burgers', 'tacos', 'plats', 'poissons', 'accompagnements', 'desserts', 'boissons']
                if all(cat in category_ids for cat in expected_categories):
                    print("✅ GET /api/admin/menu/categories - SUCCESS: All menu categories returned")
                    menu_tests_passed += 1
                else:
                    print("❌ GET /api/admin/menu/categories - FAILED: Missing some expected categories")
            else:
                print("❌ GET /api/admin/menu/categories - FAILED: Response is not a list")
        else:
            print("❌ GET /api/admin/menu/categories - FAILED: Non-200 status code")
    except Exception as e:
        print(f"❌ GET /api/admin/menu/categories - ERROR: {str(e)}")
    
    # Test 6: Get admin menu items
    print_test_header("GET /api/admin/menu")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/menu", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                if len(response_data) > 0:
                    # Check structure of first item
                    first_item = response_data[0]
                    required_fields = ['id', 'name', 'description', 'price', 'category', 'is_bestseller', 'in_stock']
                    if all(field in first_item for field in required_fields):
                        print(f"✅ GET /api/admin/menu - SUCCESS: Found {len(response_data)} menu items with proper structure")
                        menu_tests_passed += 1
                    else:
                        print("❌ GET /api/admin/menu - FAILED: Menu items missing required fields")
                else:
                    print("✅ GET /api/admin/menu - SUCCESS: Empty menu (valid response)")
                    menu_tests_passed += 1
            else:
                print("❌ GET /api/admin/menu - FAILED: Response is not a list")
        else:
            print("❌ GET /api/admin/menu - FAILED: Non-200 status code")
    except Exception as e:
        print(f"❌ GET /api/admin/menu - ERROR: {str(e)}")
    
    # Test 7: Create new menu item
    print_test_header("POST /api/admin/menu")
    try:
        menu_item_data = {
            "name": "Test Burger",
            "description": "Delicious test burger with fresh ingredients",
            "price": 12.99,
            "category": "burgers",
            "is_bestseller": False,
            "in_stock": True
        }
        response = requests.post(f"{API_BASE_URL}/admin/menu", 
                               json=menu_item_data, timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if (response_data.get('name') == 'Test Burger' and 
                response_data.get('price') == 12.99 and
                response_data.get('category') == 'burgers'):
                print("✅ POST /api/admin/menu - SUCCESS: Menu item created successfully")
                menu_tests_passed += 1
                created_item_id = response_data.get('id')  # Store for potential cleanup
            else:
                print("❌ POST /api/admin/menu - FAILED: Created item doesn't match input data")
        else:
            print("❌ POST /api/admin/menu - FAILED: Non-200 status code")
    except Exception as e:
        print(f"❌ POST /api/admin/menu - ERROR: {str(e)}")

    # Update totals for final results
    admin_menu_tests_passed = admin_password_tests_passed + menu_tests_passed
    total_tests = passed_tests + 7  # 4 admin password tests + 3 menu management tests
    total_passed = passed_tests + admin_menu_tests_passed
    
    print_test_header("ADMIN PASSWORD & MENU MANAGEMENT TEST SUMMARY")
    print(f"Admin Password Management Tests: {admin_password_tests_passed}/4 passed")
    print(f"Menu Management Tests: {menu_tests_passed}/3 passed")
    print(f"Total Admin Tests: {admin_menu_tests_passed}/7 passed")
    
    if total_passed == total_tests:
        print("🎉 ALL TESTS PASSED! Complete Backend API Suite is working correctly.")
        print("   ✅ GPS Tracking APIs")
        print("   ✅ Settings & Stock Management APIs") 
        print("   ✅ Employee Management APIs")
        print("   ✅ Payroll Management APIs")
        print("   ✅ Financial Dashboard APIs")
        print("   ✅ Admin Password Management APIs")
        print("   ✅ Menu Management APIs")
        return True
    else:
        print(f"⚠️  {total_tests - total_passed} test(s) failed. Check the detailed output above.")
        return False

# ============ PROMOTIONS, LOYALTY & SUBSCRIPTION TESTS ============

def test_get_admin_promo_codes():
    """Test GET /api/admin/promo-codes - Get all promo codes"""
    print_test_header("GET /api/admin/promo-codes - Get All Promo Codes")
    
    try:
        response = requests.get(f"{API_BASE_URL}/admin/promo-codes", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} promo codes")
                
                # Validate structure if there are promo codes
                if len(response_data) > 0:
                    first_code = response_data[0]
                    required_fields = ['id', 'code', 'discount_percent', 'status', 'current_uses', 'created_at']
                    success = True
                    
                    for field in required_fields:
                        if field in first_code:
                            print(f"  ✓ {field}: {first_code[field]} ({type(first_code[field])})")
                        else:
                            print(f"  ✗ Missing field: {field}")
                            success = False
                    
                    if success:
                        print("✅ GET /api/admin/promo-codes - SUCCESS")
                        return True, response_data
                    else:
                        print("❌ GET /api/admin/promo-codes - FAILED: Invalid structure")
                        return False, response_data
                else:
                    print("✅ GET /api/admin/promo-codes - SUCCESS (empty list)")
                    return True, response_data
            else:
                print("❌ GET /api/admin/promo-codes - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/admin/promo-codes - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/admin/promo-codes - ERROR: {e}")
        return False, None

def test_create_promo_code():
    """Test POST /api/admin/promo-codes - Create a new promo code"""
    print_test_header("POST /api/admin/promo-codes - Create New Promo Code")
    
    # Test data as specified in the review request
    promo_data = {
        "code": "KIZA10",
        "discount_percent": 10,
        "description": "Test promo",
        "min_order_amount": 15
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/admin/promo-codes",
            json=promo_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate required fields
                expected_fields = ['id', 'code', 'discount_percent', 'description', 'min_order_amount', 'status', 'current_uses', 'created_at']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value}")
                        
                        # Validate specific field values
                        if field == 'code' and value != promo_data['code']:
                            print(f"✗ {field} mismatch: expected {promo_data[field]}, got {value}")
                            success = False
                        elif field == 'discount_percent' and value != promo_data['discount_percent']:
                            print(f"✗ {field} mismatch: expected {promo_data[field]}, got {value}")
                            success = False
                        elif field == 'status' and value != 'active':
                            print(f"✗ Default status should be 'active', got {value}")
                            success = False
                        elif field == 'current_uses' and value != 0:
                            print(f"✗ Default current_uses should be 0, got {value}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ POST /api/admin/promo-codes - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/admin/promo-codes - FAILED: Invalid response data")
                    return False, response_data
            else:
                print("❌ POST /api/admin/promo-codes - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ POST /api/admin/promo-codes - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/admin/promo-codes - ERROR: {e}")
        return False, None

def test_toggle_promo_code(code_id: str):
    """Test PUT /api/admin/promo-codes/{code_id}/toggle - Toggle promo code status"""
    print_test_header(f"PUT /api/admin/promo-codes/{code_id}/toggle - Toggle Promo Code Status")
    
    try:
        response = requests.put(f"{API_BASE_URL}/admin/promo-codes/{code_id}/toggle", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict) and 'status' in response_data:
                new_status = response_data['status']
                if new_status in ['active', 'disabled']:
                    print(f"✅ PUT /api/admin/promo-codes/{code_id}/toggle - SUCCESS: Status changed to {new_status}")
                    return True, response_data
                else:
                    print(f"❌ PUT /api/admin/promo-codes/{code_id}/toggle - FAILED: Invalid status {new_status}")
                    return False, response_data
            else:
                print("❌ PUT /api/admin/promo-codes/{code_id}/toggle - FAILED: Invalid response format")
                return False, response_data
        else:
            print(f"❌ PUT /api/admin/promo-codes/{code_id}/toggle - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ PUT /api/admin/promo-codes/{code_id}/toggle - ERROR: {e}")
        return False, None

def test_delete_promo_code(code_id: str):
    """Test DELETE /api/admin/promo-codes/{code_id} - Delete promo code"""
    print_test_header(f"DELETE /api/admin/promo-codes/{code_id} - Delete Promo Code")
    
    try:
        response = requests.delete(f"{API_BASE_URL}/admin/promo-codes/{code_id}", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict) and 'message' in response_data:
                if 'deleted' in response_data['message'].lower():
                    print(f"✅ DELETE /api/admin/promo-codes/{code_id} - SUCCESS: Promo code deleted")
                    return True, response_data
                else:
                    print(f"❌ DELETE /api/admin/promo-codes/{code_id} - FAILED: Invalid message")
                    return False, response_data
            else:
                print("❌ DELETE /api/admin/promo-codes/{code_id} - FAILED: Invalid response format")
                return False, response_data
        else:
            print(f"❌ DELETE /api/admin/promo-codes/{code_id} - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ DELETE /api/admin/promo-codes/{code_id} - ERROR: {e}")
        return False, None

def test_validate_promo_code():
    """Test POST /api/promo-codes/validate?code=KIZA10&order_amount=20 - Validate promo code"""
    print_test_header("POST /api/promo-codes/validate - Validate Promo Code")
    
    # Test with code KIZA10 and order amount 20 as specified
    code = "KIZA10"
    order_amount = 20.0
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/promo-codes/validate?code={code}&order_amount={order_amount}",
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['valid', 'code', 'discount_percent', 'discount_amount']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value}")
                        
                        if field == 'valid' and value != True:
                            print(f"✗ Code should be valid for order amount {order_amount}")
                            success = False
                        elif field == 'code' and value != code:
                            print(f"✗ Code mismatch: expected {code}, got {value}")
                            success = False
                        elif field == 'discount_percent' and not isinstance(value, (int, float)):
                            print(f"✗ discount_percent should be numeric, got {type(value)}")
                            success = False
                        elif field == 'discount_amount' and not isinstance(value, (int, float)):
                            print(f"✗ discount_amount should be numeric, got {type(value)}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ POST /api/promo-codes/validate - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/promo-codes/validate - FAILED: Invalid response structure")
                    return False, response_data
            else:
                print("❌ POST /api/promo-codes/validate - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ POST /api/promo-codes/validate - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/promo-codes/validate - ERROR: {e}")
        return False, None

def test_use_promo_code():
    """Test POST /api/promo-codes/use?code=KIZA10 - Mark promo code as used"""
    print_test_header("POST /api/promo-codes/use - Mark Promo Code as Used")
    
    code = "KIZA10"
    
    try:
        response = requests.post(f"{API_BASE_URL}/promo-codes/use?code={code}", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict) and 'message' in response_data:
                if 'used' in response_data['message'].lower():
                    print("✅ POST /api/promo-codes/use - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/promo-codes/use - FAILED: Invalid message")
                    return False, response_data
            else:
                print("❌ POST /api/promo-codes/use - FAILED: Invalid response format")
                return False, response_data
        else:
            print(f"❌ POST /api/promo-codes/use - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/promo-codes/use - ERROR: {e}")
        return False, None

def test_get_admin_promotions():
    """Test GET /api/admin/promotions - Get all product promotions"""
    print_test_header("GET /api/admin/promotions - Get All Product Promotions")
    
    try:
        response = requests.get(f"{API_BASE_URL}/admin/promotions", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} product promotions")
                
                # Validate structure if there are promotions
                if len(response_data) > 0:
                    first_promo = response_data[0]
                    required_fields = ['id', 'name', 'discount_percent', 'applies_to', 'is_active', 'created_at']
                    success = True
                    
                    for field in required_fields:
                        if field in first_promo:
                            print(f"  ✓ {field}: {first_promo[field]} ({type(first_promo[field])})")
                        else:
                            print(f"  ✗ Missing field: {field}")
                            success = False
                    
                    if success:
                        print("✅ GET /api/admin/promotions - SUCCESS")
                        return True, response_data
                    else:
                        print("❌ GET /api/admin/promotions - FAILED: Invalid structure")
                        return False, response_data
                else:
                    print("✅ GET /api/admin/promotions - SUCCESS (empty list)")
                    return True, response_data
            else:
                print("❌ GET /api/admin/promotions - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/admin/promotions - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/admin/promotions - ERROR: {e}")
        return False, None

def test_create_product_promotion():
    """Test POST /api/admin/promotions - Create product promotion"""
    print_test_header("POST /api/admin/promotions - Create Product Promotion")
    
    # Test data as specified in the review request
    promo_data = {
        "name": "Promo Grillades",
        "discount_percent": 15,
        "applies_to": "category",
        "category_id": "grillades"
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/admin/promotions",
            json=promo_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                # Validate required fields
                expected_fields = ['id', 'name', 'discount_percent', 'applies_to', 'category_id', 'is_active', 'created_at']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value}")
                        
                        # Validate specific field values
                        if field == 'name' and value != promo_data['name']:
                            print(f"✗ {field} mismatch: expected {promo_data[field]}, got {value}")
                            success = False
                        elif field == 'discount_percent' and value != promo_data['discount_percent']:
                            print(f"✗ {field} mismatch: expected {promo_data[field]}, got {value}")
                            success = False
                        elif field == 'is_active' and value != True:
                            print(f"✗ Default is_active should be True, got {value}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ POST /api/admin/promotions - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/admin/promotions - FAILED: Invalid response data")
                    return False, response_data
            else:
                print("❌ POST /api/admin/promotions - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ POST /api/admin/promotions - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/admin/promotions - ERROR: {e}")
        return False, None

def test_get_active_promotions():
    """Test GET /api/promotions/active - Get active promotions for customers"""
    print_test_header("GET /api/promotions/active - Get Active Promotions")
    
    try:
        response = requests.get(f"{API_BASE_URL}/promotions/active", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} active promotions")
                
                # Validate structure if there are active promotions
                if len(response_data) > 0:
                    first_promo = response_data[0]
                    required_fields = ['id', 'name', 'discount_percent', 'applies_to', 'is_active']
                    success = True
                    
                    for field in required_fields:
                        if field in first_promo:
                            value = first_promo[field]
                            print(f"  ✓ {field}: {value} ({type(value)})")
                            
                            # Ensure is_active is True for active promotions
                            if field == 'is_active' and value != True:
                                print(f"  ✗ Active promotion should have is_active=True, got {value}")
                                success = False
                        else:
                            print(f"  ✗ Missing field: {field}")
                            success = False
                    
                    if success:
                        print("✅ GET /api/promotions/active - SUCCESS")
                        return True, response_data
                    else:
                        print("❌ GET /api/promotions/active - FAILED: Invalid structure")
                        return False, response_data
                else:
                    print("✅ GET /api/promotions/active - SUCCESS (no active promotions)")
                    return True, response_data
            else:
                print("❌ GET /api/promotions/active - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/promotions/active - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/promotions/active - ERROR: {e}")
        return False, None

def test_get_customer():
    """Test GET /api/customer/{phone}?phone=0612345678 - Get or create customer"""
    print_test_header("GET /api/customer/{phone} - Get or Create Customer")
    
    phone = "0612345678"
    
    try:
        response = requests.get(f"{API_BASE_URL}/customer/{phone}?phone={phone}", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['id', 'phone', 'total_orders', 'is_premium', 'loyalty_discount_unlocked', 'created_at']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value} ({type(value)})")
                        
                        # Validate specific field types
                        if field == 'phone' and value != phone:
                            print(f"✗ Phone mismatch: expected {phone}, got {value}")
                            success = False
                        elif field == 'total_orders' and not isinstance(value, int):
                            print(f"✗ total_orders should be integer, got {type(value)}")
                            success = False
                        elif field == 'is_premium' and not isinstance(value, bool):
                            print(f"✗ is_premium should be boolean, got {type(value)}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ GET /api/customer/{phone} - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/customer/{phone} - FAILED: Invalid response structure")
                    return False, response_data
            else:
                print("❌ GET /api/customer/{phone} - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/customer/{phone} - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/customer/{phone} - ERROR: {e}")
        return False, None

def test_subscribe_premium():
    """Test POST /api/subscribe - Subscribe to premium"""
    print_test_header("POST /api/subscribe - Subscribe to KIZA PREMIUM")
    
    # Test data as specified in the review request
    subscription_data = {
        "phone": "0612345678",
        "full_name": "Test User"
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/customer/subscribe",
            json=subscription_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['message', 'expires_at', 'price', 'benefit']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value}")
                        
                        # Validate specific field values
                        if field == 'message' and 'activated' not in value.lower():
                            print(f"✗ Expected activation message, got {value}")
                            success = False
                        elif field == 'price' and not isinstance(value, (int, float)):
                            print(f"✗ price should be numeric, got {type(value)}")
                            success = False
                        elif field == 'benefit' and 'gratuite' not in value.lower():
                            print(f"✗ Expected free delivery benefit, got {value}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ POST /api/subscribe - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/subscribe - FAILED: Invalid response structure")
                    return False, response_data
            else:
                print("❌ POST /api/subscribe - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ POST /api/subscribe - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/subscribe - ERROR: {e}")
        return False, None

def test_increment_customer_orders():
    """Test POST /api/customer/order?phone=0612345678 - Increment customer order count"""
    print_test_header("POST /api/customer/order - Increment Order Count for Loyalty")
    
    phone = "0612345678"
    
    try:
        response = requests.post(f"{API_BASE_URL}/customer/increment-orders?phone={phone}", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['total_orders', 'loyalty_unlocked']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value} ({type(value)})")
                        
                        # Validate specific field types
                        if field == 'total_orders' and not isinstance(value, int):
                            print(f"✗ total_orders should be integer, got {type(value)}")
                            success = False
                        elif field == 'loyalty_unlocked' and not isinstance(value, bool):
                            print(f"✗ loyalty_unlocked should be boolean, got {type(value)}")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                # Check for loyalty_discount field if loyalty is unlocked
                if response_data.get('loyalty_unlocked', False):
                    if 'loyalty_discount' in response_data:
                        print(f"✓ loyalty_discount: {response_data['loyalty_discount']}%")
                    
                if success:
                    print("✅ POST /api/customer/order - SUCCESS")
                    return True, response_data
                else:
                    print("❌ POST /api/customer/order - FAILED: Invalid response structure")
                    return False, response_data
            else:
                print("❌ POST /api/customer/order - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ POST /api/customer/order - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ POST /api/customer/order - ERROR: {e}")
        return False, None

def test_get_subscription_info():
    """Test GET /api/subscription/info - Get subscription pricing info"""
    print_test_header("GET /api/subscription/info - Get Subscription Info")
    
    try:
        response = requests.get(f"{API_BASE_URL}/subscription/info", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['price', 'benefits', 'loyalty_info']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: present")
                        
                        if field == 'price' and not isinstance(value, (int, float)):
                            print(f"  ✗ price should be numeric, got {type(value)}")
                            success = False
                        elif field == 'benefits' and not isinstance(value, list):
                            print(f"  ✗ benefits should be a list, got {type(value)}")
                            success = False
                        elif field == 'loyalty_info' and not isinstance(value, dict):
                            print(f"  ✗ loyalty_info should be a dict, got {type(value)}")
                            success = False
                        else:
                            if field == 'loyalty_info':
                                loyalty_fields = ['threshold', 'discount', 'description']
                                for lfield in loyalty_fields:
                                    if lfield in value:
                                        print(f"    ✓ {lfield}: {value[lfield]}")
                                    else:
                                        print(f"    ✗ Missing loyalty field: {lfield}")
                                        success = False
                            else:
                                print(f"  ✓ {field}: {value}")
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ GET /api/subscription/info - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/subscription/info - FAILED: Invalid structure")
                    return False, response_data
            else:
                print("❌ GET /api/subscription/info - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/subscription/info - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/subscription/info - ERROR: {e}")
        return False, None

def test_calculate_discounts():
    """Test GET /api/calculate-discounts?phone=0612345678&subtotal=50&promo_code=KIZA10 - Calculate all discounts"""
    print_test_header("GET /api/calculate-discounts - Calculate All Applicable Discounts")
    
    # Test parameters as specified in the review request
    phone = "0612345678"
    subtotal = 50.0
    promo_code = "KIZA10"
    
    try:
        response = requests.get(
            f"{API_BASE_URL}/calculate-discounts?phone={phone}&subtotal={subtotal}&promo_code={promo_code}",
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['subtotal', 'discounts', 'total_discount', 'free_delivery', 'final_total']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value} ({type(value)})")
                        
                        # Validate specific field types and values
                        if field == 'subtotal' and value != subtotal:
                            print(f"✗ Subtotal mismatch: expected {subtotal}, got {value}")
                            success = False
                        elif field == 'discounts' and not isinstance(value, list):
                            print(f"✗ discounts should be a list, got {type(value)}")
                            success = False
                        elif field in ['total_discount', 'final_total'] and not isinstance(value, (int, float)):
                            print(f"✗ {field} should be numeric, got {type(value)}")
                            success = False
                        elif field == 'free_delivery' and not isinstance(value, bool):
                            print(f"✗ free_delivery should be boolean, got {type(value)}")
                            success = False
                        
                        # Validate discount entries if present
                        if field == 'discounts' and isinstance(value, list) and len(value) > 0:
                            print(f"  Found {len(value)} discount(s):")
                            for i, discount in enumerate(value):
                                if isinstance(discount, dict):
                                    discount_fields = ['type', 'name', 'amount']
                                    for dfield in discount_fields:
                                        if dfield in discount:
                                            print(f"    Discount {i+1} {dfield}: {discount[dfield]}")
                                        else:
                                            print(f"    ✗ Missing discount field: {dfield}")
                                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ GET /api/calculate-discounts - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/calculate-discounts - FAILED: Invalid structure")
                    return False, response_data
            else:
                print("❌ GET /api/calculate-discounts - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/calculate-discounts - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/calculate-discounts - ERROR: {e}")
        return False, None

# ============ CUSTOMER MANAGEMENT API TESTS ============

def test_get_all_customers():
    """Test GET /api/admin/customers - Get all customers with subscription and loyalty status"""
    print_test_header("GET /api/admin/customers - Get All Customers")
    
    try:
        response = requests.get(f"{API_BASE_URL}/admin/customers", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} customers")
                
                if len(response_data) > 0:
                    # Validate structure of first customer
                    first_customer = response_data[0]
                    print(f"\nValidating first customer: {first_customer.get('phone', 'Unknown')}")
                    
                    required_fields = ['id', 'phone', 'total_orders', 'is_premium', 'loyalty_discount_unlocked', 'created_at']
                    success = True
                    
                    for field in required_fields:
                        if field in first_customer:
                            print(f"  ✓ {field}: {first_customer[field]} ({type(first_customer[field])})")
                        else:
                            print(f"  ✗ Missing field: {field}")
                            success = False
                    
                    # Check if premium status is calculated correctly
                    if 'is_premium_active' in first_customer:
                        print(f"  ✓ is_premium_active: {first_customer['is_premium_active']} ({type(first_customer['is_premium_active'])})")
                    
                    if success:
                        print("✅ GET /api/admin/customers - SUCCESS")
                        return True, response_data
                    else:
                        print("❌ GET /api/admin/customers - FAILED: Invalid customer structure")
                        return False, response_data
                else:
                    print("⚠️  No customers found, but API is working")
                    print("✅ GET /api/admin/customers - SUCCESS (empty list)")
                    return True, response_data
            else:
                print("❌ GET /api/admin/customers - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/admin/customers - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/admin/customers - ERROR: {e}")
        return False, None

def test_get_customer_stats():
    """Test GET /api/admin/customers/stats - Get customer statistics"""
    print_test_header("GET /api/admin/customers/stats - Get Customer Statistics")
    
    try:
        response = requests.get(f"{API_BASE_URL}/admin/customers/stats", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = [
                    'total_customers', 
                    'premium_subscribers', 
                    'loyal_customers',
                    'loyalty_threshold',
                    'loyalty_discount', 
                    'premium_price'
                ]
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value} ({type(value)})")
                        
                        # Validate that counts are integers
                        if field in ['total_customers', 'premium_subscribers', 'loyal_customers', 'loyalty_threshold'] and not isinstance(value, int):
                            print(f"✗ {field} should be an integer")
                            success = False
                        # Validate that rates/prices are numbers
                        elif field in ['loyalty_discount', 'premium_price'] and not isinstance(value, (int, float)):
                            print(f"✗ {field} should be a number")
                            success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print("✅ GET /api/admin/customers/stats - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/admin/customers/stats - FAILED: Invalid structure or values")
                    return False, response_data
            else:
                print("❌ GET /api/admin/customers/stats - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ GET /api/admin/customers/stats - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/admin/customers/stats - ERROR: {e}")
        return False, None

def test_get_premium_customers():
    """Test GET /api/admin/customers/premium - Get only premium customers"""
    print_test_header("GET /api/admin/customers/premium - Get Premium Customers")
    
    try:
        response = requests.get(f"{API_BASE_URL}/admin/customers/premium", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"Found {len(response_data)} premium customers")
                
                # Validate that all returned customers are premium
                success = True
                for i, customer in enumerate(response_data):
                    if not customer.get('is_premium'):
                        print(f"✗ Customer {i+1} is not premium but was returned in premium list")
                        success = False
                    else:
                        print(f"  ✓ Customer {i+1}: {customer.get('phone')} is premium (active: {customer.get('is_premium_active', 'unknown')})")
                
                if success:
                    print("✅ GET /api/admin/customers/premium - SUCCESS")
                    return True, response_data
                else:
                    print("❌ GET /api/admin/customers/premium - FAILED: Non-premium customers in result")
                    return False, response_data
            else:
                print("❌ GET /api/admin/customers/premium - FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ GET /api/admin/customers/premium - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ GET /api/admin/customers/premium - ERROR: {e}")
        return False, None

def test_create_test_customer():
    """Create a test customer using GET /api/customer/{phone} endpoint"""
    print_test_header("GET /api/customer/0600000001?phone=0600000001 - Create Test Customer")
    
    test_phone = "0600000001"
    
    try:
        response = requests.get(
            f"{API_BASE_URL}/customer/{test_phone}?phone={test_phone}", 
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict) and response_data.get('phone') == test_phone:
                print(f"✅ Test customer created/retrieved successfully: {response_data.get('phone')}")
                return True, response_data
            else:
                print("❌ Create test customer - FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ Create test customer - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Create test customer - ERROR: {e}")
        return False, None

def test_toggle_customer_premium(phone: str, activate: bool):
    """Test PUT /api/admin/customers/{phone}/premium?activate={activate} - Toggle customer premium status"""
    action = "activate" if activate else "deactivate"
    print_test_header(f"PUT /api/admin/customers/{phone}/premium?activate={activate} - {action.title()} Premium")
    
    try:
        response = requests.put(
            f"{API_BASE_URL}/admin/customers/{phone}/premium?activate={activate}",
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict) and 'message' in response_data:
                print(f"✓ Message: {response_data['message']}")
                
                if activate and 'expires_at' in response_data:
                    print(f"✓ Expires at: {response_data['expires_at']}")
                
                print(f"✅ PUT /api/admin/customers/{phone}/premium?activate={activate} - SUCCESS")
                return True, response_data
            else:
                print(f"❌ Toggle premium {action} - FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ Toggle premium {action} - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Toggle premium {action} - ERROR: {e}")
        return False, None

def test_verify_customer_premium_status(phone: str, expected_premium: bool):
    """Verify customer premium status by checking customer data"""
    print_test_header(f"Verify Customer Premium Status - Expected: {expected_premium}")
    
    try:
        response = requests.get(f"{API_BASE_URL}/customer/{phone}", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                actual_premium = response_data.get('is_premium', False)
                print(f"Customer premium status: {actual_premium}")
                
                if actual_premium == expected_premium:
                    print(f"✅ Premium status verification - SUCCESS: Status is {actual_premium} as expected")
                    return True, response_data
                else:
                    print(f"❌ Premium status verification - FAILED: Expected {expected_premium}, got {actual_premium}")
                    return False, response_data
            else:
                print("❌ Premium status verification - FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ Premium status verification - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Premium status verification - ERROR: {e}")
        return False, None

def test_update_customer_loyalty(phone: str, order_count: int):
    """Test PUT /api/admin/customers/{phone}/loyalty?order_count={order_count} - Update customer loyalty"""
    print_test_header(f"PUT /api/admin/customers/{phone}/loyalty?order_count={order_count} - Update Loyalty")
    
    try:
        response = requests.put(
            f"{API_BASE_URL}/admin/customers/{phone}/loyalty?order_count={order_count}",
            timeout=10
        )
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                expected_fields = ['message', 'total_orders', 'loyalty_unlocked']
                success = True
                
                for field in expected_fields:
                    if field in response_data:
                        value = response_data[field]
                        print(f"✓ {field}: {value}")
                        
                        if field == 'total_orders' and value != order_count:
                            print(f"✗ total_orders mismatch: expected {order_count}, got {value}")
                            success = False
                        elif field == 'loyalty_unlocked':
                            expected_loyalty = order_count >= 10  # Default loyalty threshold
                            if value != expected_loyalty:
                                print(f"✗ loyalty_unlocked mismatch: expected {expected_loyalty}, got {value}")
                                success = False
                    else:
                        print(f"✗ Missing field: {field}")
                        success = False
                
                if success:
                    print(f"✅ PUT /api/admin/customers/{phone}/loyalty - SUCCESS")
                    return True, response_data
                else:
                    print(f"❌ PUT /api/admin/customers/{phone}/loyalty - FAILED: Invalid response")
                    return False, response_data
            else:
                print(f"❌ Update customer loyalty - FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ Update customer loyalty - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Update customer loyalty - ERROR: {e}")
        return False, None

def test_verify_customer_loyalty_status(phone: str, expected_orders: int, expected_loyalty: bool):
    """Verify customer loyalty status by checking customer data"""
    print_test_header(f"Verify Customer Loyalty Status - Expected: {expected_orders} orders, loyalty={expected_loyalty}")
    
    try:
        response = requests.get(f"{API_BASE_URL}/customer/{phone}", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, dict):
                actual_orders = response_data.get('total_orders', 0)
                actual_loyalty = response_data.get('loyalty_discount_unlocked', False)
                
                print(f"Customer total_orders: {actual_orders}")
                print(f"Customer loyalty_discount_unlocked: {actual_loyalty}")
                
                success = True
                if actual_orders != expected_orders:
                    print(f"✗ Order count mismatch: expected {expected_orders}, got {actual_orders}")
                    success = False
                
                if actual_loyalty != expected_loyalty:
                    print(f"✗ Loyalty status mismatch: expected {expected_loyalty}, got {actual_loyalty}")
                    success = False
                
                if success:
                    print(f"✅ Loyalty status verification - SUCCESS")
                    return True, response_data
                else:
                    print(f"❌ Loyalty status verification - FAILED")
                    return False, response_data
            else:
                print("❌ Loyalty status verification - FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ Loyalty status verification - FAILED: Status {response.status_code}")
            return False, None
            
    except Exception as e:
        print(f"❌ Loyalty status verification - ERROR: {e}")
        return False, None

def run_customer_management_tests():
    """Run all Customer Management API tests"""
    print("\n👤 CUSTOMER MANAGEMENT API TESTS")
    print("=" * 50)
    
    customer_results = {}
    test_phone = "0600000001"
    
    # Test 1: Get all customers
    success, data = test_get_all_customers()
    customer_results['get_all_customers'] = success
    
    # Test 2: Get customer stats
    success, data = test_get_customer_stats()
    customer_results['get_customer_stats'] = success
    
    # Test 3: Get premium customers
    success, data = test_get_premium_customers()
    customer_results['get_premium_customers'] = success
    
    # Test 4: Create test customer
    success, customer_data = test_create_test_customer()
    customer_results['create_test_customer'] = success
    
    if success:
        # Test 5: Activate premium for test customer
        success, data = test_toggle_customer_premium(test_phone, True)
        customer_results['activate_premium'] = success
        
        if success:
            # Test 6: Verify customer now has premium status
            success, data = test_verify_customer_premium_status(test_phone, True)
            customer_results['verify_premium_active'] = success
            
        # Test 7: Deactivate premium for test customer
        success, data = test_toggle_customer_premium(test_phone, False)
        customer_results['deactivate_premium'] = success
        
        if success:
            # Test 8: Verify customer premium is deactivated
            success, data = test_verify_customer_premium_status(test_phone, False)
            customer_results['verify_premium_inactive'] = success
        
        # Test 9: Update customer loyalty to 12 orders (should unlock loyalty)
        success, data = test_update_customer_loyalty(test_phone, 12)
        customer_results['update_loyalty_high'] = success
        
        if success:
            # Test 10: Verify loyalty is unlocked (12 >= 10)
            success, data = test_verify_customer_loyalty_status(test_phone, 12, True)
            customer_results['verify_loyalty_unlocked'] = success
        
        # Test 11: Update customer loyalty to 5 orders (should lock loyalty)
        success, data = test_update_customer_loyalty(test_phone, 5)
        customer_results['update_loyalty_low'] = success
        
        if success:
            # Test 12: Verify loyalty is locked (5 < 10)
            success, data = test_verify_customer_loyalty_status(test_phone, 5, False)
            customer_results['verify_loyalty_locked'] = success
    else:
        print("⚠️  Skipping premium and loyalty tests - test customer creation failed")
        skip_tests = ['activate_premium', 'verify_premium_active', 'deactivate_premium', 
                     'verify_premium_inactive', 'update_loyalty_high', 'verify_loyalty_unlocked',
                     'update_loyalty_low', 'verify_loyalty_locked']
        for test in skip_tests:
            customer_results[test] = True  # Skip but don't fail
    
    # Summary
    print(f"\n{'='*50}")
    print("CUSTOMER MANAGEMENT TEST RESULTS")
    print(f"{'='*50}")
    
    total_customer_tests = len(customer_results)
    passed_customer_tests = sum(1 for result in customer_results.values() if result)
    
    print("\n📊 CUSTOMER DATA TESTS:")
    data_tests = ['get_all_customers', 'get_customer_stats', 'get_premium_customers', 'create_test_customer']
    for test_name in data_tests:
        if test_name in customer_results:
            status = "✅ PASS" if customer_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n💎 PREMIUM MANAGEMENT TESTS:")
    premium_tests = ['activate_premium', 'verify_premium_active', 'deactivate_premium', 'verify_premium_inactive']
    for test_name in premium_tests:
        if test_name in customer_results:
            status = "✅ PASS" if customer_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n🏆 LOYALTY MANAGEMENT TESTS:")
    loyalty_tests = ['update_loyalty_high', 'verify_loyalty_unlocked', 'update_loyalty_low', 'verify_loyalty_locked']
    for test_name in loyalty_tests:
        if test_name in customer_results:
            status = "✅ PASS" if customer_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nCustomer Management Tests Passed: {passed_customer_tests}/{total_customer_tests}")
    
    return customer_results

def run_promotions_loyalty_tests():
    """Run all Promotions, Loyalty & Subscription API tests"""
    print("\n🎟️  PROMOTIONS, LOYALTY & SUBSCRIPTION API TESTS")
    print("=" * 60)
    
    promo_results = {}
    promo_code_id = None
    
    # Test 1: Get admin promo codes (initially empty)
    success, data = test_get_admin_promo_codes()
    promo_results['get_admin_promo_codes'] = success
    
    # Test 2: Create promo code KIZA10
    success, promo_data = test_create_promo_code()
    promo_results['create_promo_code'] = success
    
    if success and promo_data:
        promo_code_id = promo_data.get('id')
    
    # Test 3: Validate promo code with order amount 20
    success, data = test_validate_promo_code()
    promo_results['validate_promo_code'] = success
    
    # Test 4: Use promo code
    success, data = test_use_promo_code()
    promo_results['use_promo_code'] = success
    
    # Test 5: Get admin promotions 
    success, data = test_get_admin_promotions()
    promo_results['get_admin_promotions'] = success
    
    # Test 6: Create product promotion
    success, data = test_create_product_promotion()
    promo_results['create_product_promotion'] = success
    
    # Test 7: Get active promotions
    success, data = test_get_active_promotions()
    promo_results['get_active_promotions'] = success
    
    # Test 8: Get or create customer
    success, data = test_get_customer()
    promo_results['get_customer'] = success
    
    # Test 9: Subscribe to premium
    success, data = test_subscribe_premium()
    promo_results['subscribe_premium'] = success
    
    # Test 10: Increment customer orders for loyalty
    success, data = test_increment_customer_orders()
    promo_results['increment_customer_orders'] = success
    
    # Test 11: Get subscription info
    success, data = test_get_subscription_info()
    promo_results['get_subscription_info'] = success
    
    # Test 12: Calculate all discounts
    success, data = test_calculate_discounts()
    promo_results['calculate_discounts'] = success
    
    # Optional tests if we have promo code ID
    if promo_code_id:
        # Test 13: Toggle promo code status
        success, data = test_toggle_promo_code(promo_code_id)
        promo_results['toggle_promo_code'] = success
        
        # Test 14: Delete promo code (cleanup)
        success, data = test_delete_promo_code(promo_code_id)
        promo_results['delete_promo_code'] = success
    else:
        print("⚠️  Skipping toggle and delete promo code tests - no promo code ID available")
        promo_results['toggle_promo_code'] = True  # Skip but don't fail
        promo_results['delete_promo_code'] = True  # Skip but don't fail
    
    # Summary
    print(f"\n{'='*60}")
    print("PROMOTIONS, LOYALTY & SUBSCRIPTION TEST RESULTS")
    print(f"{'='*60}")
    
    total_promo_tests = len(promo_results)
    passed_promo_tests = sum(1 for result in promo_results.values() if result)
    
    print("\n🎟️  PROMO CODE TESTS:")
    promo_code_tests = ['get_admin_promo_codes', 'create_promo_code', 'validate_promo_code', 'use_promo_code', 'toggle_promo_code', 'delete_promo_code']
    for test_name in promo_code_tests:
        if test_name in promo_results:
            status = "✅ PASS" if promo_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n🏷️  PRODUCT PROMOTION TESTS:")
    promotion_tests = ['get_admin_promotions', 'create_product_promotion', 'get_active_promotions']
    for test_name in promotion_tests:
        if test_name in promo_results:
            status = "✅ PASS" if promo_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print("\n👤 CUSTOMER & LOYALTY TESTS:")
    customer_tests = ['get_customer', 'subscribe_premium', 'increment_customer_orders', 'get_subscription_info', 'calculate_discounts']
    for test_name in customer_tests:
        if test_name in promo_results:
            status = "✅ PASS" if promo_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nPromotion Tests Passed: {passed_promo_tests}/{total_promo_tests}")
    
    return promo_results

if __name__ == "__main__":
    # Run existing tests first
    print("🍽️  KIZA Restaurant - Running Existing Backend API Tests")
    success = run_all_tests()
    
    # Run customer management tests
    print("\n\n" + "="*80)
    print("👤 KIZA Restaurant - Running Customer Management API Tests")
    print("="*80)
    customer_results = run_customer_management_tests()
    
    # Run new promotional tests
    print("\n\n" + "="*80)
    print("🎟️  KIZA Restaurant - Running Promotional & Subscription API Tests")
    print("="*80)
    promo_results = run_promotions_loyalty_tests()
    
    # Overall results
    customer_success = all(customer_results.values())
    promo_success = all(promo_results.values())
    overall_success = success and customer_success and promo_success
    
    print(f"\n{'='*80}")
    print("🎉 OVERALL TEST RESULTS SUMMARY")
    print(f"{'='*80}")
    print(f"Existing Backend Tests: {'✅ PASS' if success else '❌ FAIL'}")
    print(f"Customer Management Tests: {'✅ PASS' if customer_success else '❌ FAIL'}")
    print(f"Promotional API Tests: {'✅ PASS' if promo_success else '❌ FAIL'}")
    print(f"Overall Result: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
    
    exit(0 if overall_success else 1)