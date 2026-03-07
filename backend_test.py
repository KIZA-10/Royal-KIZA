#!/usr/bin/env python3
"""
Backend API Testing Suite for KIZA Restaurant
Tests Settings and Stock Management APIs
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

def run_all_tests():
    """Run all Settings and Stock Management API tests"""
    print("🍽️  KIZA Restaurant - Settings & Stock Management API Tests")
    print("=" * 70)
    
    all_results = {}
    
    # Test 1: Get Settings
    success, data = test_get_settings()
    all_results['get_settings'] = success
    
    # Test 2: Update Settings  
    success, data = test_update_settings()
    all_results['update_settings'] = success
    
    # Test 3: Get Stock Status
    success, data = test_get_stock_status()
    all_results['get_stock'] = success
    
    # Test 4: Update Item Stock
    success, data = test_update_item_stock()
    all_results['update_stock'] = success
    
    # Test 5: Verify Stock Update
    success, data = verify_stock_update()
    all_results['verify_stock'] = success
    
    # Summary
    print(f"\n{'='*60}")
    print("FINAL TEST RESULTS SUMMARY")
    print(f"{'='*60}")
    
    total_tests = len(all_results)
    passed_tests = sum(1 for result in all_results.values() if result)
    
    for test_name, result in all_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nTests Passed: {passed_tests}/{total_tests}")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! Settings & Stock Management APIs are working correctly.")
        return True
    else:
        print(f"⚠️  {total_tests - passed_tests} test(s) failed. Check the detailed output above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)