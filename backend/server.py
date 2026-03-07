from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime
from enum import Enum

# Stripe integration
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# LLM integration for chatbot
from emergentintegrations.llm.openai import LlmChat
from emergentintegrations.llm.chat import UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# LLM configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    DELIVERING = "delivering"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    EXPIRED = "expired"

class Category(str, Enum):
    ENTREES = "entrees"
    GRILLADES = "grillades"
    PLATS = "plats"
    POISSONS = "poissons"
    ACCOMPAGNEMENTS = "accompagnements"
    DESSERTS = "desserts"
    BOISSONS = "boissons"

class DriverStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_DELIVERY = "on_delivery"

# ============ DRIVER MODELS ============
class Driver(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str  # Will be hashed
    full_name: str
    phone: str
    email: Optional[str] = None
    status: DriverStatus = DriverStatus.ACTIVE
    total_deliveries: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    # GPS Tracking fields
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    last_location_update: Optional[datetime] = None

class DriverCreate(BaseModel):
    username: str
    password: str
    full_name: str
    phone: str
    email: Optional[str] = None

class DriverLogin(BaseModel):
    username: str
    password: str

class DriverResponse(BaseModel):
    id: str
    username: str
    full_name: str
    phone: str
    email: Optional[str]
    status: DriverStatus
    total_deliveries: int
    created_at: datetime
    last_login: Optional[datetime]
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    last_location_update: Optional[datetime] = None

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

# ============ EMPLOYEE & PAYROLL MODELS ============
class EmployeeRole(str, Enum):
    DRIVER = "driver"
    COOK = "cook"
    SERVER = "server"
    MANAGER = "manager"
    CLEANER = "cleaner"
    OTHER = "other"

class PaymentType(str, Enum):
    PER_DELIVERY = "per_delivery"  # Fixed amount per delivery
    PERCENTAGE = "percentage"      # Percentage of order amount
    FIXED_SALARY = "fixed_salary"  # Monthly fixed salary

class EmployeeStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_LEAVE = "on_leave"

class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    full_name: str
    phone: str
    email: Optional[str] = None
    role: EmployeeRole
    payment_type: PaymentType
    payment_rate: float  # Amount per delivery, percentage (0-100), or monthly salary
    iban: Optional[str] = None
    bank_name: Optional[str] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    driver_id: Optional[str] = None  # Link to driver account if role is DRIVER
    created_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

class EmployeeCreate(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    role: EmployeeRole
    payment_type: PaymentType
    payment_rate: float
    iban: Optional[str] = None
    bank_name: Optional[str] = None
    driver_id: Optional[str] = None
    notes: Optional[str] = None

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[EmployeeRole] = None
    payment_type: Optional[PaymentType] = None
    payment_rate: Optional[float] = None
    iban: Optional[str] = None
    bank_name: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    notes: Optional[str] = None

class PayrollStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"

class PayrollRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    role: EmployeeRole
    period_month: int  # 1-12
    period_year: int
    total_deliveries: int = 0
    total_orders_amount: float = 0.0
    base_salary: float = 0.0
    bonus: float = 0.0
    deductions: float = 0.0
    total_amount: float = 0.0
    status: PayrollStatus = PayrollStatus.PENDING
    payment_type: PaymentType
    payment_rate: float
    iban: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None

# Simple password hashing (for production, use bcrypt)
import hashlib
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

# Models
class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: Category
    image_url: Optional[str] = None
    available: bool = True
    in_stock: bool = True  # For stock management
    quantity_info: Optional[str] = None
    is_bestseller: bool = False

class CartItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int
    notes: Optional[str] = None

class DeliveryAddress(BaseModel):
    full_name: str
    phone: str
    address: str
    city: str
    postal_code: str
    additional_info: Optional[str] = None

class OrderCreate(BaseModel):
    items: List[CartItem]
    delivery_address: DeliveryAddress
    total_amount: float
    delivery_fee: float
    payment_method: str = "cash_on_delivery"
    notes: Optional[str] = None

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = Field(default_factory=lambda: f"KIZA-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:4].upper()}")
    items: List[CartItem]
    delivery_address: DeliveryAddress
    total_amount: float
    delivery_fee: float
    grand_total: float
    status: OrderStatus = OrderStatus.PENDING
    payment_method: str = "cash_on_delivery"
    payment_status: PaymentStatus = PaymentStatus.PENDING
    stripe_session_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Review Model
class ReviewCreate(BaseModel):
    menu_item_id: str
    customer_name: str
    rating: int = Field(..., ge=1, le=5)
    comment: str
    order_id: Optional[str] = None

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    menu_item_id: str
    customer_name: str
    rating: int
    comment: str
    order_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_approved: bool = True

# Chatbot Model
class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

# Payment Models
class PaymentRequest(BaseModel):
    order_id: str
    origin_url: str

# Settings Models
class RestaurantSettings(BaseModel):
    opening_hour: str = "09:00"
    closing_hour: str = "23:50"
    is_ramadan_mode: bool = False
    ramadan_opening_hour: str = "18:00"
    ramadan_closing_hour: str = "02:00"
    is_open: bool = True

class SettingsUpdate(BaseModel):
    opening_hour: Optional[str] = None
    closing_hour: Optional[str] = None
    is_ramadan_mode: Optional[bool] = None
    ramadan_opening_hour: Optional[str] = None
    ramadan_closing_hour: Optional[str] = None
    is_open: Optional[bool] = None

class StockUpdate(BaseModel):
    in_stock: bool

# Menu Items Data - Updated with all KIZA products
MENU_ITEMS = [
    # ============ ENTRÉES ============
    MenuItem(id="1", name="Samoussa", description="Délicieux samoussas croustillants farcis aux légumes et épices", price=2.00, category=Category.ENTREES, quantity_info="3 pièces", image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/5t6ljkkg_2F919575-9B64-4027-BD6F-D8DA6072133F.png", is_bestseller=True),
    MenuItem(id="2", name="Beignets Goulagoula", description="Beignets africains traditionnels, moelleux et savoureux", price=4.50, category=Category.ENTREES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/jlcbh8cq_DE9BAD42-1D3D-4BAA-A185-EEDAF3D7E153.png", is_bestseller=True),
    MenuItem(id="3", name="Beignets Goulagoula Nutella", description="Beignets africains garnis de Nutella fondant", price=5.00, category=Category.ENTREES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/yutd4zax_CEB87213-AC43-44B7-B750-B394B1BC7C79.png"),
    MenuItem(id="4", name="Kanguer", description="Spécialité comorienne croustillante et parfumée", price=5.00, category=Category.ENTREES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/xkq5wt1m_DF481B61-8A56-43F6-BF06-6C13E88D543E.png"),
    MenuItem(id="5", name="Buns", description="Petits pains moelleux cuits à la vapeur", price=1.50, category=Category.ENTREES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/bxvjzh7y_63BA2155-87C1-4738-B3AD-2B5F729565B4.png"),
    MenuItem(id="6", name="Mkatre", description="Pain traditionnel comorien cuit au charbon", price=3.50, category=Category.ENTREES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/zyxaod0i_FF3CD703-38BC-4415-9AEF-FD02DC56C18E.png", is_bestseller=True),
    MenuItem(id="7", name="Couscouma", description="Semoule de manioc parfumée aux épices", price=3.50, category=Category.ENTREES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/dk73yid1_D71DC8BA-8A0F-4EA6-B014-FDCF14217DCF.png"),
    
    # ============ GRILLADES ============
    MenuItem(id="10", name="Poulet Entier Grillé", description="Poulet fermier entier grillé aux herbes, juteux et savoureux", price=17.00, category=Category.GRILLADES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/4s6bzx0f_EED7F738-8D10-4823-937C-9701C2874764.png", is_bestseller=True),
    MenuItem(id="11", name="Cuisse de Poulet Grillé", description="Cuisse de poulet marinée et grillée à la perfection", price=7.00, category=Category.GRILLADES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/w6ozu114_FDF1DE2F-1AAF-4F15-8ED5-9F08EF2F7409.png"),
    MenuItem(id="12", name="Côtelettes d'Agneau", description="Côtelettes d'agneau grillées, tendres et parfumées", price=12.00, category=Category.GRILLADES, quantity_info="4 pièces", image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/pe8zqu2b_24AA1592-6E3A-491E-9E41-038491599714.png", is_bestseller=True),
    MenuItem(id="13", name="Brochettes Viande", description="Brochettes de viande tendre marinée aux herbes", price=3.00, category=Category.GRILLADES, quantity_info="3 pièces", image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/rrqdy1ov_8F254ABE-A4E9-4FDE-BEEF-19547347E207.png", is_bestseller=True),
    MenuItem(id="14", name="Brochettes Mixtes", description="Assortiment de brochettes viande et légumes grillés", price=4.00, category=Category.GRILLADES, quantity_info="3 pièces", image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/l45rfnet_063935E9-A005-43EC-BEDA-73397F9F2F9C.png"),
    MenuItem(id="15", name="Canard Sauté", description="Canard sauté aux épices, croustillant et savoureux", price=18.00, category=Category.GRILLADES, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/arcms8l5_647129DD-A1F8-49B3-9C7D-D0755FE34CF0.png"),
    
    # ============ PLATS PRINCIPAUX ============
    MenuItem(id="20", name="Pilao", description="Riz parfumé aux épices avec viande tendre, plat traditionnel comorien", price=8.50, category=Category.PLATS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/1aulv011_41F43494-C1AB-4649-99C8-216D875EB7F3.png", is_bestseller=True),
    MenuItem(id="21", name="Cuisse de Poulet Sauce", description="Cuisse de poulet mijotée dans une sauce onctueuse aux épices", price=7.00, category=Category.PLATS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/977ytvaj_7B1345FC-3939-43AB-8A76-4FBCEEA49713.png"),
    MenuItem(id="22", name="Pilons Sauce", description="Pilons de poulet en sauce savoureuse maison", price=5.00, category=Category.PLATS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/djxz7khe_34C482D5-BA32-4F3E-81DB-2A44292FC18D.png"),
    MenuItem(id="23", name="Canard Sauce", description="Canard mijoté dans une sauce riche et parfumée", price=16.00, category=Category.PLATS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/nilxbkd5_56E50F0D-39BA-46CC-A417-D6C76336BBC3.png"),
    MenuItem(id="24", name="Gésier", description="Gésiers de volaille mijotés aux oignons et épices", price=5.50, category=Category.PLATS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/16anrkch_C106172C-E2CD-4D25-89F6-60F82D3A8CE8.png"),
    MenuItem(id="25", name="Poulet Pané", description="Morceaux de poulet panés, croustillants à l'extérieur, tendres à l'intérieur", price=3.50, category=Category.PLATS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/qiee0fj5_49F1B479-F443-4F6C-941D-4CC472088783.png"),
    
    # ============ POISSONS & FRUITS DE MER ============
    MenuItem(id="30", name="Tilapia Frit", description="Tilapia entier frit, croustillant et savoureux", price=10.00, category=Category.POISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/3s2ehb93_C9F82EEF-7EFE-468D-998E-4795B087B3D7.png", is_bestseller=True),
    MenuItem(id="31", name="Tilapia Sauce", description="Tilapia mijoté dans une sauce tomate aux épices africaines", price=10.00, category=Category.POISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/b9h24ya8_36946C4A-225A-4689-BD3E-E79E30364908.png"),
    MenuItem(id="32", name="Pieuvre Sauce", description="Pieuvre tendre mijotée en sauce (verte ou rouge au choix)", price=7.50, category=Category.POISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/64dqs3sb_4E96D6F7-5B1E-4DFE-BDD6-C829043BCD8E.png"),
    MenuItem(id="33", name="Crevettes Panées", description="Crevettes panées croustillantes servies avec sauce", price=7.50, category=Category.POISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/75g3nvxc_041E140B-C4B6-478F-8C58-26504C5C056D.png"),
    
    # ============ ACCOMPAGNEMENTS ============
    MenuItem(id="40", name="Frites", description="Frites dorées et croustillantes", price=2.00, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/crgt3mmq_IMG_4387.jpeg"),
    MenuItem(id="41", name="Potato's", description="Potatoes assaisonnées aux herbes", price=2.00, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/u2yinmhu_295F1092-47BB-44D8-BC6A-25928CC5D324.png"),
    MenuItem(id="42", name="Alloco", description="Bananes plantain frites, spécialité africaine sucrée-salée", price=3.50, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/s1r3ph1y_87FE5DBD-A1BF-4480-9B05-F7B8854EDA56.png"),
    MenuItem(id="43", name="Banane Frit", description="Bananes douces frites caramélisées", price=3.50, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/ui24dtv5_D1ABE73C-F08F-4C68-9A9D-C626CE181523.png"),
    MenuItem(id="44", name="Manioc Frit", description="Bâtonnets de manioc frits, croustillants", price=3.50, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/0e159wj8_A819519E-F60F-4C8D-B1FA-E1E2FB580892.png"),
    MenuItem(id="45", name="Pâtes Crème", description="Pâtes onctueuses à la crème fraîche", price=2.50, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/u7i4cblj_3E31BB2D-3474-43BE-9317-63BD070A7D4B.png"),
    MenuItem(id="46", name="Spaghetti Crème", description="Spaghetti à la sauce crème et fines herbes", price=3.00, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/1xuliia0_81E7D67C-CB0D-4F43-B6F2-75A9C759B0B9.png"),
    MenuItem(id="47", name="Riz", description="Riz basmati parfumé", price=2.50, category=Category.ACCOMPAGNEMENTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/s9cjxue9_181D25DF-BBB9-43F3-85DE-3ED181BCCA16.png", is_bestseller=True),
    
    # ============ DESSERTS ============
    MenuItem(id="50", name="Crêpes Nutella", description="Crêpes fines garnies de Nutella fondant", price=3.50, category=Category.DESSERTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/yix60xzs_1A7A4F3C-69A5-4902-83C4-7083C9F2533E.png"),
    MenuItem(id="51", name="Gâteau Chocolat", description="Fondant au chocolat noir fait maison", price=7.50, category=Category.DESSERTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/mktjze96_7E6D7DCB-4825-43FA-B9E7-477FCAB02A7E.png"),
    MenuItem(id="52", name="Tiramisu", description="Tiramisu maison crémeux au café et mascarpone", price=3.99, category=Category.DESSERTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/i9td74tl_D2056F19-9811-4B69-A373-7057BAC9B81D.png"),
    MenuItem(id="53", name="Salade de Fruits", description="Salade de fruits frais de saison", price=4.00, category=Category.DESSERTS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/cbjdb1m5_B1F37EB4-C7F0-4E61-BA08-4E3E371BA36E.png"),
    
    # ============ BOISSONS ============
    MenuItem(id="60", name="Boisson Foco", description="Boisson exotique aux fruits tropicaux", price=2.00, category=Category.BOISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/oem1hndz_IMG_4376.jpeg", is_bestseller=True),
    MenuItem(id="61", name="Coca-Cola", description="Coca-Cola classique 33cl", price=2.00, category=Category.BOISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/afjdbdt9_IMG_4466.jpeg"),
    MenuItem(id="62", name="Fanta Orange", description="Fanta Orange pétillant 33cl", price=2.00, category=Category.BOISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/87719suf_IMG_4476.jpeg"),
    MenuItem(id="63", name="Sprite", description="Sprite citron-lime 33cl", price=2.00, category=Category.BOISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/ry6gidpu_IMG_4475.jpeg"),
    MenuItem(id="64", name="Ice Tea Pêche", description="Thé glacé saveur pêche 33cl", price=2.50, category=Category.BOISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/nflc0i3g_IMG_4474.jpeg"),
    MenuItem(id="65", name="Jus d'Orange Frais", description="Jus d'orange fraîchement pressé", price=3.50, category=Category.BOISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/qaip55bp_IMG_4478.jpeg"),
    MenuItem(id="66", name="Eau Minérale", description="Eau minérale naturelle 50cl", price=1.50, category=Category.BOISSONS, image_url="https://customer-assets.emergentagent.com/job_dev-preview-223/artifacts/n9hv1xal_IMG_4481.png"),
]

# Restaurant Info
RESTAURANT_INFO = {
    "name": "KIZA Restaurant",
    "tagline": "Royale",
    "phone": "0751420492",
    "email": "Maanrouf.zakidine@gmail.com",
    "address": "9 Place du Maréchix, Ville",
    "delivery_radius_km": 30,
    "delivery_fee": 3.00,
    "free_delivery_minimum": 25.00,
    "opening_hours": {
        "default": {
            "open": "09:00",
            "close": "23:50"
        },
        "ramadan": {
            "enabled": False,
            "open": "18:00",
            "close": "02:00"
        }
    },
    "social_media": {
        "snapchat": "Zakma2020",
        "instagram": "KIZA",
        "tiktok": "KIZA.10"
    },
    "categories": [
        {"id": "entrees", "name": "Entrées", "icon": "restaurant-menu"},
        {"id": "grillades", "name": "Grillades", "icon": "local-fire-department"},
        {"id": "plats", "name": "Plats", "icon": "dinner-dining"},
        {"id": "poissons", "name": "Poissons", "icon": "set-meal"},
        {"id": "accompagnements", "name": "Accompagnements", "icon": "rice-bowl"},
        {"id": "desserts", "name": "Desserts", "icon": "cake"},
        {"id": "boissons", "name": "Boissons", "icon": "local-cafe"}
    ]
}

# Chatbot system prompt
CHATBOT_SYSTEM_PROMPT = """Tu es l'assistant virtuel de KIZA Restaurant, un restaurant comorien et africain spécialisé dans les grillades, plats traditionnels, poissons et desserts.

Informations du restaurant:
- Nom: KIZA Restaurant
- Téléphone: 0751420492
- Email: Maanrouf.zakidine@gmail.com
- Adresse: 9 Place du Maréchix
- Livraison: Dans un rayon de 30km
- Frais de livraison: 3€ (GRATUIT dès 25€ d'achat)
- Paiement: À la livraison (espèces ou carte) ou en ligne par carte bancaire

Réseaux sociaux:
- Snapchat: @Zakma2020
- Instagram: @KIZA
- TikTok: @KIZA.10

Notre menu comprend:
- Entrées: Samoussa, Beignets Goulagoula, Kanguer, Buns, Mkatre, Couscouma
- Grillades: Poulet Entier Grillé (17€), Côtelettes d'Agneau (12€), Brochettes, Canard Sauté
- Plats: Pilao (8.50€), Cuisse de Poulet Sauce, Gésier, Poulet Pané
- Poissons: Tilapia Frit/Sauce (10€), Pieuvre Sauce, Crevettes Panées
- Accompagnements: Frites, Alloco, Banane Frit, Manioc Frit, Riz, Pâtes
- Desserts: Crêpes Nutella, Gâteau Chocolat, Tiramisu, Salade de Fruits
- Boissons: Foco, Coca-Cola, Fanta, Sprite, Ice Tea, Jus d'Orange

Réponds de manière amicale, professionnelle et en français. Aide les clients avec leurs questions sur le menu, les prix, la livraison, les horaires et les commandes. Sois concis mais informatif."""

# ============ ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "Bienvenue chez KIZA Restaurant API"}

@api_router.get("/restaurant-info")
async def get_restaurant_info():
    return RESTAURANT_INFO

@api_router.get("/menu", response_model=List[MenuItem])
async def get_menu():
    return MENU_ITEMS

@api_router.get("/menu/bestsellers", response_model=List[MenuItem])
async def get_bestsellers():
    return [item for item in MENU_ITEMS if item.is_bestseller]

@api_router.get("/menu/category/{category}", response_model=List[MenuItem])
async def get_menu_by_category(category: Category):
    return [item for item in MENU_ITEMS if item.category == category]

# Stock route must come before {item_id} route to avoid conflicts
@api_router.get("/menu/stock")
async def get_all_stock_status():
    """Get stock status for all menu items"""
    stock_statuses = await db.menu_stock.find({}).to_list(100)
    stock_dict = {s['item_id']: s['in_stock'] for s in stock_statuses}
    
    result = []
    for item in MENU_ITEMS:
        in_stock = stock_dict.get(item.id, item.in_stock)
        result.append({
            "item_id": item.id,
            "name": item.name,
            "category": item.category,
            "in_stock": in_stock
        })
    
    return result

@api_router.get("/menu/{item_id}", response_model=MenuItem)
async def get_menu_item(item_id: str):
    for item in MENU_ITEMS:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item not found")

# ============ ORDER ROUTES ============

@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate):
    grand_total = order_data.total_amount + order_data.delivery_fee
    
    order = Order(
        items=order_data.items,
        delivery_address=order_data.delivery_address,
        total_amount=order_data.total_amount,
        delivery_fee=order_data.delivery_fee,
        grand_total=grand_total,
        payment_method=order_data.payment_method,
        notes=order_data.notes
    )
    
    order_dict = order.dict()
    order_dict['created_at'] = order.created_at.isoformat()
    order_dict['updated_at'] = order.updated_at.isoformat()
    await db.orders.insert_one(order_dict)
    
    return order

# Get all orders for delivery panel - MUST be before /{order_id}
@api_router.get("/orders/delivery")
async def get_delivery_orders():
    """Get orders for delivery drivers"""
    orders = await db.orders.find({
        "status": {"$in": ["confirmed", "preparing", "delivering"]}
    }).sort("created_at", -1).to_list(100)
    # Remove MongoDB _id field
    for order in orders:
        order.pop('_id', None)
    return orders

# Get all orders for management panel - MUST be before /{order_id}
@api_router.get("/orders/all")
async def get_all_orders():
    """Get all orders for management"""
    orders = await db.orders.find({}).sort("created_at", -1).to_list(500)
    for order in orders:
        order.pop('_id', None)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.pop('_id', None)
    return order

@api_router.get("/orders/number/{order_number}")
async def get_order_by_number(order_number: str):
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.pop('_id', None)
    return order

# ============ DRIVER AUTHENTICATION ROUTES ============

@api_router.post("/drivers/register", response_model=DriverResponse)
async def register_driver(driver_data: DriverCreate):
    """Register a new driver (Admin only in production)"""
    # Check if username already exists
    existing = await db.drivers.find_one({"username": driver_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    driver = Driver(
        username=driver_data.username,
        password=hash_password(driver_data.password),
        full_name=driver_data.full_name,
        phone=driver_data.phone,
        email=driver_data.email
    )
    
    driver_dict = driver.dict()
    driver_dict['created_at'] = driver.created_at.isoformat()
    await db.drivers.insert_one(driver_dict)
    
    # Return without password
    return DriverResponse(**{k: v for k, v in driver_dict.items() if k != 'password' and k != '_id'})

@api_router.post("/drivers/login")
async def login_driver(login_data: DriverLogin):
    """Driver login"""
    driver = await db.drivers.find_one({"username": login_data.username})
    if not driver:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login_data.password, driver['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if driver.get('status') == 'inactive':
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    # Update last login
    await db.drivers.update_one(
        {"id": driver['id']},
        {"$set": {"last_login": datetime.utcnow().isoformat()}}
    )
    
    driver.pop('_id', None)
    driver.pop('password', None)
    
    return {"message": "Login successful", "driver": driver}

@api_router.get("/drivers", response_model=List[DriverResponse])
async def get_all_drivers():
    """Get all drivers (Admin only)"""
    drivers = await db.drivers.find({}).to_list(100)
    result = []
    for d in drivers:
        d.pop('_id', None)
        d.pop('password', None)
        result.append(d)
    return result

@api_router.get("/drivers/{driver_id}")
async def get_driver(driver_id: str):
    """Get driver by ID"""
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    driver.pop('_id', None)
    driver.pop('password', None)
    return driver

@api_router.put("/drivers/{driver_id}/status")
async def update_driver_status(driver_id: str, status: DriverStatus):
    """Update driver status"""
    result = await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"status": status}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Status updated", "status": status}

@api_router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str):
    """Delete a driver (Admin only)"""
    result = await db.drivers.delete_one({"id": driver_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Driver deleted"}

# ============ DRIVER ORDER MANAGEMENT ============

@api_router.get("/drivers/{driver_id}/orders")
async def get_driver_orders(driver_id: str):
    """Get orders assigned to a specific driver"""
    orders = await db.orders.find({
        "assigned_driver_id": driver_id,
        "status": {"$in": ["confirmed", "preparing", "delivering"]}
    }).sort("created_at", -1).to_list(50)
    for order in orders:
        order.pop('_id', None)
    return orders

@api_router.get("/drivers/{driver_id}/history")
async def get_driver_delivery_history(driver_id: str):
    """Get completed deliveries for a driver"""
    orders = await db.orders.find({
        "assigned_driver_id": driver_id,
        "status": "delivered"
    }).sort("updated_at", -1).to_list(100)
    for order in orders:
        order.pop('_id', None)
    return orders

@api_router.put("/orders/{order_id}/assign/{driver_id}")
async def assign_order_to_driver(order_id: str, driver_id: str):
    """Assign an order to a driver"""
    # Verify driver exists
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "assigned_driver_id": driver_id,
            "assigned_driver_name": driver['full_name'],
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order assigned", "driver_id": driver_id}

@api_router.put("/orders/{order_id}/deliver")
async def mark_order_delivered(order_id: str, driver_id: str):
    """Mark order as delivered and update driver stats"""
    # Update order
    result = await db.orders.update_one(
        {"id": order_id, "assigned_driver_id": driver_id},
        {"$set": {
            "status": "delivered",
            "delivered_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found or not assigned to this driver")
    
    # Update driver stats
    await db.drivers.update_one(
        {"id": driver_id},
        {"$inc": {"total_deliveries": 1}}
    )
    
    return {"message": "Order marked as delivered"}

@api_router.get("/drivers/{driver_id}/stats")
async def get_driver_stats(driver_id: str):
    """Get driver statistics"""
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Count deliveries today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_deliveries = await db.orders.count_documents({
        "assigned_driver_id": driver_id,
        "status": "delivered",
        "delivered_at": {"$gte": today_start.isoformat()}
    })
    
    # Count pending deliveries
    pending = await db.orders.count_documents({
        "assigned_driver_id": driver_id,
        "status": {"$in": ["confirmed", "preparing", "delivering"]}
    })
    
    return {
        "total_deliveries": driver.get('total_deliveries', 0),
        "today_deliveries": today_deliveries,
        "pending_deliveries": pending
    }

# ============ GPS TRACKING ROUTES ============

@api_router.put("/drivers/{driver_id}/location")
async def update_driver_location(driver_id: str, location: LocationUpdate):
    """Update driver's current GPS location"""
    result = await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "current_lat": location.latitude,
            "current_lng": location.longitude,
            "last_location_update": datetime.utcnow().isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Location updated", "lat": location.latitude, "lng": location.longitude}

@api_router.get("/drivers/locations/active")
async def get_active_drivers_locations():
    """Get all active/on_delivery drivers with their locations and assigned orders"""
    # Get drivers that are active or on delivery
    drivers = await db.drivers.find({
        "status": {"$in": ["active", "on_delivery"]},
        "current_lat": {"$ne": None}
    }).to_list(100)
    
    result = []
    for driver in drivers:
        driver.pop('_id', None)
        driver.pop('password', None)
        
        # Get assigned orders for this driver
        orders = await db.orders.find({
            "assigned_driver_id": driver['id'],
            "status": {"$in": ["confirmed", "preparing", "delivering"]}
        }).to_list(20)
        
        for order in orders:
            order.pop('_id', None)
        
        result.append({
            "driver": driver,
            "assigned_orders": orders
        })
    
    return result

@api_router.get("/tracking/overview")
async def get_tracking_overview():
    """Get overview for tracking dashboard"""
    # Count active drivers
    active_drivers = await db.drivers.count_documents({
        "status": {"$in": ["active", "on_delivery"]}
    })
    
    # Count drivers with location
    drivers_with_location = await db.drivers.count_documents({
        "status": {"$in": ["active", "on_delivery"]},
        "current_lat": {"$ne": None}
    })
    
    # Count orders in delivery
    orders_in_delivery = await db.orders.count_documents({
        "status": "delivering"
    })
    
    # Count pending orders
    pending_orders = await db.orders.count_documents({
        "status": {"$in": ["confirmed", "preparing"]}
    })
    
    return {
        "active_drivers": active_drivers,
        "drivers_with_location": drivers_with_location,
        "orders_in_delivery": orders_in_delivery,
        "pending_orders": pending_orders
    }

# ============ EMPLOYEE MANAGEMENT ROUTES ============

@api_router.get("/employees")
async def get_employees():
    """Get all employees"""
    employees = await db.employees.find({}).to_list(100)
    for emp in employees:
        emp.pop('_id', None)
    return employees

@api_router.post("/employees")
async def create_employee(employee: EmployeeCreate):
    """Create a new employee"""
    emp_dict = employee.dict()
    emp_dict['id'] = str(uuid.uuid4())
    emp_dict['status'] = EmployeeStatus.ACTIVE.value
    emp_dict['created_at'] = datetime.utcnow().isoformat()
    
    await db.employees.insert_one(emp_dict)
    emp_dict.pop('_id', None)
    return emp_dict

@api_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str):
    """Get employee by ID"""
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.pop('_id', None)
    return employee

@api_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, update: EmployeeUpdate):
    """Update employee"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.employees.update_one(
        {"id": employee_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee = await db.employees.find_one({"id": employee_id})
    employee.pop('_id', None)
    return employee

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    """Delete employee"""
    result = await db.employees.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted"}

@api_router.get("/employees/{employee_id}/earnings")
async def get_employee_earnings(employee_id: str, period: str = "month"):
    """Get employee earnings history"""
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get payroll records for this employee
    payroll_records = await db.payroll.find(
        {"employee_id": employee_id}
    ).sort("period_year", -1).sort("period_month", -1).to_list(24)
    
    for record in payroll_records:
        record.pop('_id', None)
    
    # If employee is a driver, get detailed delivery stats
    delivery_stats = []
    if employee.get('role') == 'driver' and employee.get('driver_id'):
        # Get orders delivered by this driver
        orders = await db.orders.find({
            "assigned_driver_id": employee.get('driver_id'),
            "status": "delivered"
        }).sort("created_at", -1).to_list(100)
        
        # Group by day
        daily_stats = {}
        for order in orders:
            created_at = order.get('created_at', '')
            if isinstance(created_at, str):
                day = created_at[:10]
            else:
                day = created_at.strftime('%Y-%m-%d')
            
            if day not in daily_stats:
                daily_stats[day] = {"date": day, "deliveries": 0, "total_amount": 0}
            daily_stats[day]['deliveries'] += 1
            daily_stats[day]['total_amount'] += order.get('grand_total', 0)
        
        delivery_stats = sorted(daily_stats.values(), key=lambda x: x['date'], reverse=True)
    
    return {
        "employee": employee,
        "payroll_records": payroll_records,
        "delivery_stats": delivery_stats
    }

# ============ PAYROLL ROUTES ============

@api_router.get("/payroll")
async def get_payroll_overview(month: int = None, year: int = None):
    """Get payroll overview for a specific month"""
    if month is None:
        month = datetime.utcnow().month
    if year is None:
        year = datetime.utcnow().year
    
    # Get all payroll records for this period
    records = await db.payroll.find({
        "period_month": month,
        "period_year": year
    }).to_list(100)
    
    for record in records:
        record.pop('_id', None)
    
    # Calculate totals
    total_pending = sum(r['total_amount'] for r in records if r['status'] == 'pending')
    total_paid = sum(r['total_amount'] for r in records if r['status'] == 'paid')
    
    return {
        "period": {"month": month, "year": year},
        "records": records,
        "summary": {
            "total_employees": len(records),
            "total_pending": total_pending,
            "total_paid": total_paid,
            "total_amount": total_pending + total_paid
        }
    }

@api_router.post("/payroll/generate")
async def generate_payroll(month: int = None, year: int = None):
    """Generate payroll for all active employees for a specific month"""
    if month is None:
        month = datetime.utcnow().month
    if year is None:
        year = datetime.utcnow().year
    
    # Check if payroll already exists for this period
    existing = await db.payroll.find_one({
        "period_month": month,
        "period_year": year
    })
    
    # Get all active employees
    employees = await db.employees.find({"status": "active"}).to_list(100)
    
    generated_records = []
    
    for emp in employees:
        # Check if record already exists for this employee and period
        existing_record = await db.payroll.find_one({
            "employee_id": emp['id'],
            "period_month": month,
            "period_year": year
        })
        if existing_record:
            continue
        
        # Calculate salary based on payment type
        total_deliveries = 0
        total_orders_amount = 0.0
        base_salary = 0.0
        
        if emp['payment_type'] == 'fixed_salary':
            base_salary = emp['payment_rate']
        
        elif emp['payment_type'] in ['per_delivery', 'percentage']:
            # Get deliveries for this driver in this month
            if emp.get('driver_id'):
                start_date = datetime(year, month, 1)
                if month == 12:
                    end_date = datetime(year + 1, 1, 1)
                else:
                    end_date = datetime(year, month + 1, 1)
                
                orders = await db.orders.find({
                    "assigned_driver_id": emp.get('driver_id'),
                    "status": "delivered",
                    "delivered_at": {
                        "$gte": start_date.isoformat(),
                        "$lt": end_date.isoformat()
                    }
                }).to_list(500)
                
                total_deliveries = len(orders)
                total_orders_amount = sum(o.get('grand_total', 0) for o in orders)
                
                if emp['payment_type'] == 'per_delivery':
                    base_salary = total_deliveries * emp['payment_rate']
                else:  # percentage
                    base_salary = total_orders_amount * (emp['payment_rate'] / 100)
        
        # Create payroll record
        payroll_record = {
            "id": str(uuid.uuid4()),
            "employee_id": emp['id'],
            "employee_name": emp['full_name'],
            "role": emp['role'],
            "period_month": month,
            "period_year": year,
            "total_deliveries": total_deliveries,
            "total_orders_amount": total_orders_amount,
            "base_salary": round(base_salary, 2),
            "bonus": 0.0,
            "deductions": 0.0,
            "total_amount": round(base_salary, 2),
            "status": "pending",
            "payment_type": emp['payment_type'],
            "payment_rate": emp['payment_rate'],
            "iban": emp.get('iban'),
            "created_at": datetime.utcnow().isoformat(),
            "paid_at": None,
            "notes": None
        }
        
        await db.payroll.insert_one(payroll_record)
        payroll_record.pop('_id', None)
        generated_records.append(payroll_record)
    
    return {
        "message": f"Generated {len(generated_records)} payroll records",
        "period": {"month": month, "year": year},
        "records": generated_records
    }

@api_router.put("/payroll/{payroll_id}/mark-paid")
async def mark_payroll_paid(payroll_id: str):
    """Mark a payroll record as paid"""
    result = await db.payroll.update_one(
        {"id": payroll_id},
        {"$set": {
            "status": "paid",
            "paid_at": datetime.utcnow().isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    record = await db.payroll.find_one({"id": payroll_id})
    record.pop('_id', None)
    return record

@api_router.put("/payroll/{payroll_id}/update")
async def update_payroll(payroll_id: str, bonus: float = 0, deductions: float = 0, notes: str = None):
    """Update payroll record with bonus/deductions"""
    record = await db.payroll.find_one({"id": payroll_id})
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    
    new_total = record['base_salary'] + bonus - deductions
    
    update_data = {
        "bonus": bonus,
        "deductions": deductions,
        "total_amount": round(new_total, 2)
    }
    if notes:
        update_data['notes'] = notes
    
    await db.payroll.update_one(
        {"id": payroll_id},
        {"$set": update_data}
    )
    
    updated = await db.payroll.find_one({"id": payroll_id})
    updated.pop('_id', None)
    return updated

@api_router.get("/payroll/stats")
async def get_payroll_stats():
    """Get overall payroll statistics"""
    # Current month stats
    now = datetime.utcnow()
    current_month_records = await db.payroll.find({
        "period_month": now.month,
        "period_year": now.year
    }).to_list(100)
    
    current_month_total = sum(r['total_amount'] for r in current_month_records)
    current_month_paid = sum(r['total_amount'] for r in current_month_records if r['status'] == 'paid')
    current_month_pending = current_month_total - current_month_paid
    
    # Employee counts by role
    employees = await db.employees.find({"status": "active"}).to_list(100)
    role_counts = {}
    for emp in employees:
        role = emp.get('role', 'other')
        role_counts[role] = role_counts.get(role, 0) + 1
    
    return {
        "current_month": {
            "month": now.month,
            "year": now.year,
            "total": current_month_total,
            "paid": current_month_paid,
            "pending": current_month_pending,
            "employee_count": len(current_month_records)
        },
        "employee_stats": {
            "total_active": len(employees),
            "by_role": role_counts
        }
    }

# ============ STRIPE PAYMENT ROUTES ============

@api_router.post("/payments/create-checkout")
async def create_checkout_session(payment_request: PaymentRequest, request: Request):
    # Get the order
    order = await db.orders.find_one({"id": payment_request.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Initialize Stripe
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create success and cancel URLs
    success_url = f"{payment_request.origin_url}?payment_success=true&session_id={{CHECKOUT_SESSION_ID}}&order_id={payment_request.order_id}"
    cancel_url = f"{payment_request.origin_url}?payment_cancelled=true&order_id={payment_request.order_id}"
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=float(order['grand_total']),
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": payment_request.order_id,
            "order_number": order['order_number']
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    payment_record = {
        "id": str(uuid.uuid4()),
        "order_id": payment_request.order_id,
        "session_id": session.session_id,
        "amount": float(order['grand_total']),
        "currency": "eur",
        "status": "pending",
        "payment_status": "pending",
        "created_at": datetime.utcnow().isoformat()
    }
    await db.payment_transactions.insert_one(payment_record)
    
    # Update order with stripe session id
    await db.orders.update_one(
        {"id": payment_request.order_id},
        {"$set": {"stripe_session_id": session.session_id, "payment_method": "stripe"}}
    )
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    # Initialize Stripe
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Get checkout status
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update payment transaction
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": status.status, "payment_status": status.payment_status}}
    )
    
    # If paid, update the order
    if status.payment_status == "paid":
        await db.orders.update_one(
            {"stripe_session_id": session_id},
            {"$set": {"payment_status": "paid", "status": "confirmed"}}
        )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"status": "complete", "payment_status": "paid"}}
            )
            await db.orders.update_one(
                {"stripe_session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "status": "confirmed"}}
            )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ============ REVIEW ROUTES ============

@api_router.post("/reviews", response_model=Review)
async def create_review(review_data: ReviewCreate):
    review = Review(
        menu_item_id=review_data.menu_item_id,
        customer_name=review_data.customer_name,
        rating=review_data.rating,
        comment=review_data.comment,
        order_id=review_data.order_id
    )
    
    review_dict = review.dict()
    review_dict['created_at'] = review.created_at.isoformat()
    await db.reviews.insert_one(review_dict)
    
    return review

@api_router.get("/reviews")
async def get_all_reviews():
    reviews = await db.reviews.find({"is_approved": True}).sort("created_at", -1).to_list(100)
    for review in reviews:
        review.pop('_id', None)
    return reviews

@api_router.get("/reviews/item/{menu_item_id}")
async def get_item_reviews(menu_item_id: str):
    reviews = await db.reviews.find({"menu_item_id": menu_item_id, "is_approved": True}).sort("created_at", -1).to_list(50)
    for review in reviews:
        review.pop('_id', None)
    return reviews

@api_router.get("/reviews/stats/{menu_item_id}")
async def get_item_review_stats(menu_item_id: str):
    reviews = await db.reviews.find({"menu_item_id": menu_item_id, "is_approved": True}).to_list(1000)
    
    if not reviews:
        return {"average_rating": 0, "total_reviews": 0, "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}}
    
    total = len(reviews)
    avg = sum(r['rating'] for r in reviews) / total
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in reviews:
        distribution[r['rating']] += 1
    
    return {
        "average_rating": round(avg, 1),
        "total_reviews": total,
        "rating_distribution": distribution
    }

# ============ CHATBOT ROUTES ============

@api_router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(chat_message: ChatMessage):
    try:
        # Generate unique session id
        session_id = str(uuid.uuid4())
        
        # Initialize LLM Chat
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=CHATBOT_SYSTEM_PROMPT
        )
        llm = llm.with_model("openai", "gpt-4o-mini")
        
        # Create UserMessage
        user_msg = UserMessage(text=chat_message.message)
        
        response = await llm.send_message(user_msg)
        
        return ChatResponse(response=response)
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        return ChatResponse(response="Désolé, je rencontre un problème technique. Veuillez nous contacter directement au 0751420492.")

# ============ SETTINGS ROUTES ============

@api_router.get("/settings")
async def get_settings():
    """Get restaurant settings"""
    settings = await db.settings.find_one({"_id": "restaurant_settings"})
    if not settings:
        # Create default settings if not exists
        default_settings = {
            "_id": "restaurant_settings",
            "opening_hour": "09:00",
            "closing_hour": "23:50",
            "is_ramadan_mode": False,
            "ramadan_opening_hour": "18:00",
            "ramadan_closing_hour": "02:00",
            "is_open": True
        }
        await db.settings.insert_one(default_settings)
        settings = default_settings
    
    settings.pop('_id', None)
    return settings

@api_router.put("/settings")
async def update_settings(settings_update: SettingsUpdate):
    """Update restaurant settings"""
    update_data = {k: v for k, v in settings_update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Check if settings exist
    existing = await db.settings.find_one({"_id": "restaurant_settings"})
    if not existing:
        # Create with defaults + updates
        default_settings = {
            "_id": "restaurant_settings",
            "opening_hour": "09:00",
            "closing_hour": "23:50",
            "is_ramadan_mode": False,
            "ramadan_opening_hour": "18:00",
            "ramadan_closing_hour": "02:00",
            "is_open": True
        }
        default_settings.update(update_data)
        await db.settings.insert_one(default_settings)
    else:
        await db.settings.update_one(
            {"_id": "restaurant_settings"},
            {"$set": update_data}
        )
    
    # Return updated settings
    settings = await db.settings.find_one({"_id": "restaurant_settings"})
    settings.pop('_id', None)
    return {"message": "Settings updated", "settings": settings}

# ============ STOCK MANAGEMENT ROUTES ============

@api_router.put("/menu/{item_id}/stock")
async def update_item_stock(item_id: str, stock_update: StockUpdate):
    """Update menu item stock status"""
    # Find the item in MENU_ITEMS
    item_found = False
    for item in MENU_ITEMS:
        if item.id == item_id:
            item.in_stock = stock_update.in_stock
            item_found = True
            break
    
    if not item_found:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Also store in database for persistence
    await db.menu_stock.update_one(
        {"item_id": item_id},
        {"$set": {"in_stock": stock_update.in_stock, "updated_at": datetime.utcnow().isoformat()}},
        upsert=True
    )
    
    return {"message": "Stock updated", "item_id": item_id, "in_stock": stock_update.in_stock}

# Include the router in the main app
app.include_router(api_router)

# Navigation page for QR code (Waze + Google Maps)
from fastapi.responses import HTMLResponse
import urllib.parse

@app.get("/navigate/{order_id}", response_class=HTMLResponse)
async def navigation_page(order_id: str):
    """Page that shows navigation options when QR code is scanned"""
    # Get order from database
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return HTMLResponse(content="""
        <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:Arial;background:#1a1a1a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
        .error{text-align:center;padding:20px}</style></head>
        <body><div class="error"><h2>Commande non trouvée</h2></div></body>
        </html>
        """, status_code=404)
    
    # Build address string
    addr = order.get('delivery_address', {})
    full_address = f"{addr.get('address', '')}, {addr.get('postal_code', '')} {addr.get('city', '')}, France"
    encoded_address = urllib.parse.quote(full_address)
    
    # Waze deep link
    waze_url = f"https://waze.com/ul?q={encoded_address}&navigate=yes"
    
    # Google Maps URL
    gmaps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_address}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Navigation - KIZA</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Segoe UI', Arial, sans-serif;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }}
            .container {{
                background: rgba(30, 30, 30, 0.95);
                border-radius: 24px;
                padding: 32px 24px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                border: 1px solid rgba(212, 175, 55, 0.3);
            }}
            .logo {{
                text-align: center;
                margin-bottom: 24px;
            }}
            .logo h1 {{
                color: #D4AF37;
                font-size: 32px;
                letter-spacing: 8px;
            }}
            .logo span {{
                color: #888;
                font-size: 12px;
                letter-spacing: 4px;
            }}
            .order-info {{
                background: rgba(212, 175, 55, 0.1);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 24px;
            }}
            .order-info h3 {{
                color: #D4AF37;
                font-size: 14px;
                margin-bottom: 8px;
            }}
            .order-info p {{
                color: #fff;
                font-size: 14px;
                line-height: 1.5;
            }}
            .customer {{
                color: #D4AF37 !important;
                font-weight: bold;
                font-size: 16px !important;
            }}
            .nav-title {{
                color: #fff;
                text-align: center;
                margin-bottom: 20px;
                font-size: 18px;
            }}
            .nav-btn {{
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px 24px;
                border-radius: 16px;
                text-decoration: none;
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 16px;
                transition: transform 0.2s, box-shadow 0.2s;
            }}
            .nav-btn:hover {{
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            }}
            .nav-btn:active {{
                transform: scale(0.98);
            }}
            .waze {{
                background: linear-gradient(135deg, #33CCFF 0%, #00A5E0 100%);
                color: #fff;
            }}
            .gmaps {{
                background: linear-gradient(135deg, #4285F4 0%, #34A853 50%, #EA4335 100%);
                color: #fff;
            }}
            .nav-btn svg {{
                width: 28px;
                height: 28px;
                margin-right: 12px;
            }}
            .footer {{
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 12px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <h1>KIZA</h1>
                <span>RESTAURANT</span>
            </div>
            
            <div class="order-info">
                <h3>📍 Adresse de livraison</h3>
                <p class="customer">{addr.get('full_name', 'Client')}</p>
                <p>{addr.get('address', '')}</p>
                <p>{addr.get('postal_code', '')} {addr.get('city', '')}</p>
                <p>📞 {addr.get('phone', '')}</p>
            </div>
            
            <p class="nav-title">Choisissez votre application GPS</p>
            
            <a href="{waze_url}" class="nav-btn waze">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Ouvrir avec Waze
            </a>
            
            <a href="{gmaps_url}" class="nav-btn gmaps">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Ouvrir avec Google Maps
            </a>
            
            <p class="footer">Bonne livraison ! 🚗</p>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# Update order status
@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: OrderStatus):
    """Update order status"""
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow().isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Status updated", "status": status}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
