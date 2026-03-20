#!/usr/bin/env python3
"""
Customer Management API Testing Suite for KIZA Restaurant
Tests Admin Customer Management endpoints as specified in the review request
"""

import requests
import json
from typing import Dict, Any

# Backend URL from frontend environment
BACKEND_BASE_URL = "https://dev-preview-223.preview.emergentagent.com"
API_BASE_URL = f"{BACKEND_BASE_URL}/api"

def print_test_header(test_name: str):
    print(f"\n{'='*60}")
    print(f"Testing: {test_name}")
    print(f"{'='*60}")

def print_response(response: requests.Response):
    print(f"Status Code: {response.status_code}")
    try:
        response_data = response.json()
        print(f"Response Body: {json.dumps(response_data, indent=2)}")
        return response_data
    except json.JSONDecodeError:
        print(f"Response Text: {response.text}")
        return response.text

def test_get_all_customers():
    """Test GET /api/admin/customers - Get all customers with subscription and loyalty status"""
    print_test_header("GET /api/admin/customers - Get All Customers")
    
    try:
        response = requests.get(f"{API_BASE_URL}/admin/customers", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"✅ SUCCESS: Found {len(response_data)} customers")
                return True, response_data
            else:
                print("❌ FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
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
                    if field not in response_data:
                        print(f"❌ Missing field: {field}")
                        success = False
                    else:
                        print(f"✓ {field}: {response_data[field]}")
                
                if success:
                    print("✅ SUCCESS: All required fields present")
                    return True, response_data
                else:
                    print("❌ FAILED: Missing required fields")
                    return False, response_data
            else:
                print("❌ FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False, None

def test_get_premium_customers():
    """Test GET /api/admin/customers/premium - Get only premium customers"""
    print_test_header("GET /api/admin/customers/premium - Get Premium Customers")
    
    try:
        response = requests.get(f"{API_BASE_URL}/admin/customers/premium", timeout=10)
        response_data = print_response(response)
        
        if response.status_code == 200:
            if isinstance(response_data, list):
                print(f"✅ SUCCESS: Found {len(response_data)} premium customers")
                return True, response_data
            else:
                print("❌ FAILED: Response is not a list")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
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
                print(f"✅ SUCCESS: Test customer created/retrieved for phone {test_phone}")
                return True, response_data
            else:
                print("❌ FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
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
                print(f"✅ SUCCESS: {response_data['message']}")
                return True, response_data
            else:
                print(f"❌ FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
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
                if actual_premium == expected_premium:
                    print(f"✅ SUCCESS: Premium status is {actual_premium} as expected")
                    return True, response_data
                else:
                    print(f"❌ FAILED: Expected {expected_premium}, got {actual_premium}")
                    return False, response_data
            else:
                print("❌ FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
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
                print(f"✅ SUCCESS: Updated loyalty - Orders: {response_data.get('total_orders')}, Loyalty: {response_data.get('loyalty_unlocked')}")
                return True, response_data
            else:
                print(f"❌ FAILED: Response is not a dictionary")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
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
                
                if actual_orders == expected_orders and actual_loyalty == expected_loyalty:
                    print(f"✅ SUCCESS: Loyalty status verified correctly")
                    return True, response_data
                else:
                    print(f"❌ FAILED: Expected orders={expected_orders}, loyalty={expected_loyalty}")
                    print(f"          Got orders={actual_orders}, loyalty={actual_loyalty}")
                    return False, response_data
            else:
                print("❌ FAILED: Invalid response structure")
                return False, response_data
        else:
            print(f"❌ FAILED: Status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False, None

def run_customer_management_tests():
    """Run all Customer Management API tests as specified in the review request"""
    print("👤 KIZA Restaurant - Customer Management API Tests")
    print("=" * 80)
    
    results = []
    test_phone = "0600000001"
    
    # Test 1: Get All Customers
    success, data = test_get_all_customers()
    results.append(("Get All Customers", success))
    
    # Test 2: Get Customer Stats
    success, data = test_get_customer_stats()
    results.append(("Get Customer Stats", success))
    
    # Test 3: Get Premium Customers
    success, data = test_get_premium_customers()
    results.append(("Get Premium Customers", success))
    
    # Test 4: Create Test Customer
    success, customer_data = test_create_test_customer()
    results.append(("Create Test Customer", success))
    
    if success:
        # Test 5: Activate Premium
        success, data = test_toggle_customer_premium(test_phone, True)
        results.append(("Toggle Premium - Activate", success))
        
        if success:
            # Test 6: Verify Premium Active
            success, data = test_verify_customer_premium_status(test_phone, True)
            results.append(("Verify Premium Active", success))
        
        # Test 7: Deactivate Premium
        success, data = test_toggle_customer_premium(test_phone, False)
        results.append(("Toggle Premium - Deactivate", success))
        
        if success:
            # Test 8: Verify Premium Inactive
            success, data = test_verify_customer_premium_status(test_phone, False)
            results.append(("Verify Premium Inactive", success))
        
        # Test 9: Update Loyalty to 12 (should unlock)
        success, data = test_update_customer_loyalty(test_phone, 12)
        results.append(("Update Loyalty (12 orders)", success))
        
        if success:
            # Test 10: Verify Loyalty Unlocked
            success, data = test_verify_customer_loyalty_status(test_phone, 12, True)
            results.append(("Verify Loyalty Unlocked", success))
        
        # Test 11: Update Loyalty to 5 (should lock)
        success, data = test_update_customer_loyalty(test_phone, 5)
        results.append(("Update Loyalty (5 orders)", success))
        
        if success:
            # Test 12: Verify Loyalty Locked
            success, data = test_verify_customer_loyalty_status(test_phone, 5, False)
            results.append(("Verify Loyalty Locked", success))
    
    # Results Summary
    print(f"\n{'='*80}")
    print("🎉 CUSTOMER MANAGEMENT API TEST RESULTS")
    print(f"{'='*80}")
    
    passed_tests = 0
    total_tests = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name}: {status}")
        if success:
            passed_tests += 1
    
    print(f"\nTests Passed: {passed_tests}/{total_tests}")
    
    overall_success = passed_tests == total_tests
    print(f"Overall Result: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
    
    return overall_success

if __name__ == "__main__":
    success = run_customer_management_tests()
    exit(0 if success else 1)