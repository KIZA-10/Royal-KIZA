from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

class Category(str, Enum):
    ENTREES = "entrees"
    GRILLADES = "grillades"
    DESSERTS = "desserts"
    BOISSONS = "boissons"
    BURGERS = "burgers"
    PLATS_SURPRISE = "plats_surprise"

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
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Menu Items Data
MENU_ITEMS = [
    # Entrées
    MenuItem(id="1", name="Samoussa", description="Délicieux samoussas croustillants farcis aux légumes et épices", price=2.00, category=Category.ENTREES, quantity_info="3 pièces"),
    MenuItem(id="2", name="Brochettes Viande", description="Brochettes de viande tendre marinée aux herbes", price=3.00, category=Category.ENTREES, quantity_info="3 pièces"),
    MenuItem(id="3", name="Brochettes Mixtes", description="Assortiment de brochettes viande et légumes grillés", price=4.00, category=Category.ENTREES, quantity_info="3 pièces"),
    MenuItem(id="4", name="Frites Barquettes", description="Frites dorées et croustillantes servies en barquette", price=2.00, category=Category.ENTREES),
    MenuItem(id="5", name="Potatoes Barquettes", description="Potatoes assaisonnées aux herbes de Provence", price=3.50, category=Category.ENTREES),
    MenuItem(id="6", name="Nems Poulet", description="Nems croustillants au poulet avec sauce aigre-douce", price=3.50, category=Category.ENTREES, quantity_info="4 pièces"),
    MenuItem(id="7", name="Ailes de Poulet", description="Ailes de poulet épicées et croustillantes", price=5.00, category=Category.ENTREES, quantity_info="6 pièces"),
    
    # Grillades
    MenuItem(id="8", name="Côtes d'Agneau Sauté", description="Côtes d'agneau tendres sautées aux épices orientales", price=10.00, category=Category.GRILLADES),
    MenuItem(id="9", name="Poulet Entier Grillé", description="Poulet fermier entier grillé aux herbes, juteux et savoureux", price=17.00, category=Category.GRILLADES),
    MenuItem(id="10", name="Brochettes Viande Grillées", description="Brochettes de viande grillées au feu de bois", price=3.00, category=Category.GRILLADES, quantity_info="3 pièces"),
    MenuItem(id="11", name="Brochettes Mixtes Grillées", description="Mix de brochettes viande et légumes grillées", price=4.00, category=Category.GRILLADES, quantity_info="3 pièces"),
    MenuItem(id="12", name="Samoussa Grillé", description="Samoussas légèrement grillés pour plus de croustillant", price=2.50, category=Category.GRILLADES, quantity_info="3 pièces"),
    MenuItem(id="13", name="Entrecôte Grillée", description="Entrecôte de bœuf grillée à point, tendre et savoureuse", price=14.00, category=Category.GRILLADES),
    MenuItem(id="14", name="Côtelettes d'Agneau", description="Côtelettes d'agneau grillées, fondantes en bouche", price=12.00, category=Category.GRILLADES, quantity_info="4 pièces"),
    
    # Burgers
    MenuItem(id="15", name="Burger Royal KIZA", description="Notre signature: steak haché, cheddar, bacon, sauce royale, oignons caramélisés", price=9.50, category=Category.BURGERS),
    MenuItem(id="16", name="Burger Classic", description="Steak haché, salade, tomate, oignons, sauce maison", price=7.00, category=Category.BURGERS),
    MenuItem(id="17", name="Burger Chicken", description="Filet de poulet pané, salade, sauce caesar", price=8.00, category=Category.BURGERS),
    MenuItem(id="18", name="Burger Double Cheese", description="Double steak, double cheddar, cornichons, sauce burger", price=11.00, category=Category.BURGERS),
    MenuItem(id="19", name="Burger Végétarien", description="Steak végétal, avocat, tomate, roquette, sauce verte", price=8.50, category=Category.BURGERS),
    
    # Desserts
    MenuItem(id="20", name="Tiramisu", description="Tiramisu maison crémeux au café et mascarpone", price=3.99, category=Category.DESSERTS),
    MenuItem(id="21", name="Salade de Fruits", description="Salade de fruits frais de saison", price=4.00, category=Category.DESSERTS),
    MenuItem(id="22", name="Fondant au Chocolat", description="Fondant au chocolat noir avec cœur coulant", price=4.50, category=Category.DESSERTS),
    MenuItem(id="23", name="Crème Brûlée", description="Crème brûlée à la vanille de Madagascar", price=4.00, category=Category.DESSERTS),
    MenuItem(id="24", name="Baklava", description="Pâtisserie orientale aux noix et miel", price=3.50, category=Category.DESSERTS, quantity_info="3 pièces"),
    
    # Boissons
    MenuItem(id="25", name="Coca-Cola", description="Coca-Cola classique 33cl", price=2.00, category=Category.BOISSONS),
    MenuItem(id="26", name="Fanta Orange", description="Fanta Orange pétillant 33cl", price=2.00, category=Category.BOISSONS),
    MenuItem(id="27", name="Sprite", description="Sprite citron-lime 33cl", price=2.00, category=Category.BOISSONS),
    MenuItem(id="28", name="Ice Tea Pêche", description="Thé glacé saveur pêche 33cl", price=2.50, category=Category.BOISSONS),
    MenuItem(id="29", name="Jus d'Orange Frais", description="Jus d'orange fraîchement pressé", price=3.50, category=Category.BOISSONS),
    MenuItem(id="30", name="Eau Minérale", description="Eau minérale naturelle 50cl", price=1.50, category=Category.BOISSONS),
    MenuItem(id="31", name="Cocktail Tropical", description="Mélange de fruits exotiques sans alcool", price=4.00, category=Category.BOISSONS),
    MenuItem(id="32", name="Milkshake Vanille", description="Milkshake onctueux à la vanille", price=4.50, category=Category.BOISSONS),
    MenuItem(id="33", name="Milkshake Chocolat", description="Milkshake gourmand au chocolat", price=4.50, category=Category.BOISSONS),
    
    # Plats Surprise
    MenuItem(id="34", name="Plat Surprise du Jour", description="Plat surprise avec patates, pâtes, sauces, pilao... Laissez-vous surprendre!", price=7.50, category=Category.PLATS_SURPRISE),
    MenuItem(id="35", name="Menu Royal", description="Entrée + Plat + Dessert + Boisson au choix", price=15.00, category=Category.PLATS_SURPRISE),
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
        {"id": "burgers", "name": "Burgers", "icon": "lunch-dining"},
        {"id": "desserts", "name": "Desserts", "icon": "cake"},
        {"id": "boissons", "name": "Boissons", "icon": "local-cafe"},
        {"id": "plats_surprise", "name": "Plats Surprise", "icon": "card-giftcard"}
    ]
}

# Routes
@api_router.get("/")
async def root():
    return {"message": "Bienvenue chez KIZA Restaurant API"}

@api_router.get("/restaurant-info")
async def get_restaurant_info():
    return RESTAURANT_INFO

@api_router.get("/menu", response_model=List[MenuItem])
async def get_menu():
    return MENU_ITEMS

@api_router.get("/menu/category/{category}", response_model=List[MenuItem])
async def get_menu_by_category(category: Category):
    return [item for item in MENU_ITEMS if item.category == category]

@api_router.get("/menu/{item_id}", response_model=MenuItem)
async def get_menu_item(item_id: str):
    for item in MENU_ITEMS:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item not found")

@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate):
    # Calculate grand total
    grand_total = order_data.total_amount + order_data.delivery_fee
    
    order = Order(
        items=order_data.items,
        delivery_address=order_data.delivery_address,
        total_amount=order_data.total_amount,
        delivery_fee=order_data.delivery_fee,
        grand_total=grand_total,
        notes=order_data.notes
    )
    
    # Save to database
    order_dict = order.dict()
    order_dict['created_at'] = order.created_at.isoformat()
    order_dict['updated_at'] = order.updated_at.isoformat()
    await db.orders.insert_one(order_dict)
    
    return order

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order(**order)

@api_router.get("/orders/number/{order_number}")
async def get_order_by_number(order_number: str):
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

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
