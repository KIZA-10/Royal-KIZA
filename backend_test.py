#!/usr/bin/env python3
"""
KIZA Restaurant API Backend Testing
Tests all backend functionality for the KIZA Restaurant API
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://dev-preview-223.preview.emergentagent.com/api"

def test_restaurant_info():
    """Test GET /api/restaurant-info endpoint"""
    print("\n=== Testing Restaurant Info Endpoint ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/restaurant-info")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Restaurant info retrieved successfully")
            print(f"Restaurant Name: {data.get('name')}")
            print(f"Phone: {data.get('phone')}")
            print(f"Email: {data.get('email')}")
            print(f"Address: {data.get('address')}")
            
            # Check for required fields
            required_fields = ['name', 'phone', 'email', 'address', 'social_media']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
            
            # Check social media
            social_media = data.get('social_media', {})
            if not social_media:
                print("❌ Social media information missing")
                return False
            
            print(f"Social Media: {social_media}")
            return True
        else:
            print(f"❌ Failed to get restaurant info. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing restaurant info: {str(e)}")
        return False

def test_menu():
    """Test GET /api/menu endpoint"""
    print("\n=== Testing Menu Endpoint ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/menu")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Menu retrieved successfully - {len(data)} items")
            
            # Check if we have menu items
            if not data:
                print("❌ No menu items returned")
                return False
            
            # Sample first item structure
            first_item = data[0]
            print(f"Sample item: {first_item.get('name')} - ${first_item.get('price')}")
            
            # Check required fields in first item
            required_fields = ['id', 'name', 'description', 'price', 'category']
            missing_fields = [field for field in required_fields if field not in first_item]
            
            if missing_fields:
                print(f"❌ Missing required fields in menu item: {missing_fields}")
                return False
            
            return True
        else:
            print(f"❌ Failed to get menu. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing menu: {str(e)}")
        return False

def test_menu_category_grillades():
    """Test GET /api/menu/category/grillades endpoint"""
    print("\n=== Testing Grillades Category Endpoint ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/menu/category/grillades")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Grillades menu retrieved successfully - {len(data)} items")
            
            if not data:
                print("❌ No grillades items returned")
                return False
            
            # Verify all items are grillades
            non_grillades = [item for item in data if item.get('category') != 'grillades']
            if non_grillades:
                print(f"❌ Found non-grillades items: {[item.get('name') for item in non_grillades]}")
                return False
            
            # Show sample items
            for item in data[:3]:
                print(f"  - {item.get('name')}: {item.get('description')[:50]}...")
            
            return True
        else:
            print(f"❌ Failed to get grillades menu. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing grillades menu: {str(e)}")
        return False

def test_menu_category_burgers():
    """Test GET /api/menu/category/burgers endpoint"""
    print("\n=== Testing Burgers Category Endpoint ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/menu/category/burgers")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Burgers menu retrieved successfully - {len(data)} items")
            
            if not data:
                print("❌ No burger items returned")
                return False
            
            # Verify all items are burgers
            non_burgers = [item for item in data if item.get('category') != 'burgers']
            if non_burgers:
                print(f"❌ Found non-burger items: {[item.get('name') for item in non_burgers]}")
                return False
            
            # Show sample items
            for item in data[:3]:
                print(f"  - {item.get('name')}: ${item.get('price')}")
            
            return True
        else:
            print(f"❌ Failed to get burgers menu. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing burgers menu: {str(e)}")
        return False

def test_create_order():
    """Test POST /api/orders endpoint"""
    print("\n=== Testing Create Order Endpoint ===")
    
    # Test order data as specified in the review request
    order_data = {
        "items": [
            {
                "menu_item_id": "1",
                "name": "Samoussa",
                "price": 2.00,
                "quantity": 3
            }
        ],
        "delivery_address": {
            "full_name": "Jean Dupont",
            "phone": "0612345678", 
            "address": "10 Rue de Paris",
            "city": "Paris",
            "postal_code": "75001"
        },
        "total_amount": 6.00,
        "delivery_fee": 3.00
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/orders",
            json=order_data,
            headers={"Content-Type": "application/json"}
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Order created successfully")
            print(f"Order ID: {data.get('id')}")
            print(f"Order Number: {data.get('order_number')}")
            print(f"Grand Total: ${data.get('grand_total')}")
            print(f"Status: {data.get('status')}")
            
            # Verify order data
            if data.get('total_amount') != 6.00:
                print(f"❌ Incorrect total amount: expected 6.00, got {data.get('total_amount')}")
                return False, None
            
            if data.get('delivery_fee') != 3.00:
                print(f"❌ Incorrect delivery fee: expected 3.00, got {data.get('delivery_fee')}")
                return False, None
            
            if data.get('grand_total') != 9.00:
                print(f"❌ Incorrect grand total: expected 9.00, got {data.get('grand_total')}")
                return False, None
            
            # Verify customer info
            delivery_addr = data.get('delivery_address', {})
            if delivery_addr.get('full_name') != "Jean Dupont":
                print(f"❌ Incorrect customer name: {delivery_addr.get('full_name')}")
                return False, None
            
            # Verify items
            items = data.get('items', [])
            if not items:
                print("❌ No items in created order")
                return False, None
            
            first_item = items[0]
            if first_item.get('name') != "Samoussa" or first_item.get('quantity') != 3:
                print(f"❌ Incorrect item data: {first_item}")
                return False, None
            
            print("✅ Order data validation passed")
            return True, data.get('id')
            
        else:
            print(f"❌ Failed to create order. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ Error testing order creation: {str(e)}")
        return False, None

def test_get_order(order_id):
    """Test GET /api/orders/{order_id} endpoint"""
    print(f"\n=== Testing Get Order Endpoint ===")
    
    if not order_id:
        print("❌ No order ID provided for testing")
        return False
    
    try:
        response = requests.get(f"{BACKEND_URL}/orders/{order_id}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Order retrieved successfully")
            print(f"Order ID: {data.get('id')}")
            print(f"Customer: {data.get('delivery_address', {}).get('full_name')}")
            print(f"Status: {data.get('status')}")
            return True
        else:
            print(f"❌ Failed to get order. Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing get order: {str(e)}")
        return False

def test_api_root():
    """Test GET /api/ endpoint"""
    print("\n=== Testing API Root Endpoint ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API root accessible")
            print(f"Message: {data.get('message')}")
            return True
        else:
            print(f"❌ Failed to access API root. Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing API root: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests and return results"""
    print("🚀 Starting KIZA Restaurant API Backend Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    results = {
        "api_root": test_api_root(),
        "restaurant_info": test_restaurant_info(),
        "menu": test_menu(),
        "menu_grillades": test_menu_category_grillades(),
        "menu_burgers": test_menu_category_burgers(),
    }
    
    # Test order creation and retrieval
    order_success, order_id = test_create_order()
    results["create_order"] = order_success
    
    if order_success and order_id:
        results["get_order"] = test_get_order(order_id)
    else:
        results["get_order"] = False
        print("\n❌ Skipping get order test - order creation failed")
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Backend is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please check the issues above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)