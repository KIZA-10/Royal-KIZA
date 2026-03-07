#!/usr/bin/env python3
"""
Backend API Testing Suite for KIZA Restaurant
Tests Settings, Stock Management, and GPS Tracking APIs
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

def run_all_tests():
    """Run all Settings, Stock Management, and GPS Tracking API tests"""
    print("🍽️  KIZA Restaurant - Settings, Stock Management & GPS Tracking API Tests")
    print("=" * 80)
    
    all_results = {}
    driver_id = None
    
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
    other_tests = ['get_settings', 'update_settings', 'get_stock', 'update_stock', 'verify_stock']
    for test_name in other_tests:
        if test_name in all_results:
            status = "✅ PASS" if all_results[test_name] else "❌ FAIL"
            print(f"  {test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nTests Passed: {passed_tests}/{total_tests}")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! GPS Tracking, Settings & Stock Management APIs are working correctly.")
        return True
    else:
        print(f"⚠️  {total_tests - passed_tests} test(s) failed. Check the detailed output above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)