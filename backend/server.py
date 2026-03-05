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

# Models
class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: Category
    image_url: Optional[str] = None
    available: bool = True
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

# Include the router in the main app
app.include_router(api_router)

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
