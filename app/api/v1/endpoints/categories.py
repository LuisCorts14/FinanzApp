from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import TransactionType
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])

MAX_INCOME_CATEGORIES = 3


def _get_owned_category_or_404(db: Session, category_id: int, user: User) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if category_in.type == TransactionType.INCOME:
        income_count = db.scalar(
            select(func.count())
            .select_from(Category)
            .where(Category.owner_id == current_user.id, Category.type == TransactionType.INCOME)
        )
        if income_count >= MAX_INCOME_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya tienes el máximo de {MAX_INCOME_CATEGORIES} categorías de ingreso",
            )

    data = category_in.model_dump()
    if category_in.type != TransactionType.EXPENSE:
        data["monthly_budget"] = None

    category = Category(**data, owner_id=current_user.id)
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists")
    db.refresh(category)
    return category


@router.get("", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(Category).where(Category.owner_id == current_user.id).order_by(Category.name)
    return db.scalars(stmt).all()


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(
    category_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return _get_owned_category_or_404(db, category_id, current_user)


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = _get_owned_category_or_404(db, category_id, current_user)

    for field, value in category_in.model_dump(exclude_unset=True).items():
        setattr(category, field, value)

    if category.type != TransactionType.EXPENSE:
        category.monthly_budget = None

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    category = _get_owned_category_or_404(db, category_id, current_user)
    db.delete(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a category that has transactions",
        )
