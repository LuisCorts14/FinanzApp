from fastapi import APIRouter

from app.api.v1.endpoints import accounts, auth, catalog, categories, health, receipts, savings_goals, settings, stats, transactions, transfers

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(stats.router)
api_router.include_router(savings_goals.router)
api_router.include_router(catalog.router)
api_router.include_router(transfers.router)
api_router.include_router(receipts.router)
api_router.include_router(settings.router)
