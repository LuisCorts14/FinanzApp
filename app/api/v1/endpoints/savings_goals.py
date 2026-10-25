from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.savings_contribution import SavingsContribution
from app.models.savings_goal import SavingsGoal
from app.models.user import User
from app.schemas.savings_goal import (
    SavingsContributionCreate,
    SavingsContributionRead,
    SavingsGoalCreate,
    SavingsGoalRead,
    SavingsGoalUpdate,
)

router = APIRouter(prefix="/savings-goals", tags=["savings-goals"])


def _get_owned_goal_or_404(db: Session, goal_id: int, user: User) -> SavingsGoal:
    goal = db.get(SavingsGoal, goal_id)
    if goal is None or goal.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found")
    return goal


@router.post("", response_model=SavingsGoalRead, status_code=status.HTTP_201_CREATED)
def create_savings_goal(
    goal_in: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if goal_in.account_id is not None:
        account = db.get(Account, goal_in.account_id)
        if account is None or account.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    goal = SavingsGoal(**goal_in.model_dump(), owner_id=current_user.id)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("", response_model=list[SavingsGoalRead])
def list_savings_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = (
        select(SavingsGoal)
        .where(SavingsGoal.owner_id == current_user.id)
        .order_by(SavingsGoal.target_date)
    )
    return db.scalars(stmt).all()


@router.get("/{goal_id}", response_model=SavingsGoalRead)
def get_savings_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_owned_goal_or_404(db, goal_id, current_user)


@router.patch("/{goal_id}", response_model=SavingsGoalRead)
def update_savings_goal(
    goal_id: int,
    goal_in: SavingsGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = _get_owned_goal_or_404(db, goal_id, current_user)

    for field, value in goal_in.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)

    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_savings_goal(
    goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    goal = _get_owned_goal_or_404(db, goal_id, current_user)
    db.delete(goal)
    db.commit()


@router.get("/{goal_id}/contributions", response_model=list[SavingsContributionRead])
def list_contributions(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = _get_owned_goal_or_404(db, goal_id, current_user)
    return goal.contributions


@router.post(
    "/{goal_id}/contributions", response_model=SavingsContributionRead, status_code=status.HTTP_201_CREATED
)
def create_contribution(
    goal_id: int,
    contribution_in: SavingsContributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = _get_owned_goal_or_404(db, goal_id, current_user)
    if goal.account is not None:
        # En metas con cuenta el avance sale del balance de la cuenta, no de abonos.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta meta usa el saldo de una cuenta; registra el movimiento en la cuenta.",
        )
    if contribution_in.amount == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El monto no puede ser 0")
    if goal.current_amount + contribution_in.amount < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No puedes retirar más de lo que llevas ahorrado",
        )

    contribution = SavingsContribution(**contribution_in.model_dump(), goal_id=goal.id)
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


@router.delete("/{goal_id}/contributions/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contribution(
    goal_id: int,
    contribution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = _get_owned_goal_or_404(db, goal_id, current_user)
    contribution = db.get(SavingsContribution, contribution_id)
    if contribution is None or contribution.goal_id != goal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")
    db.delete(contribution)
    db.commit()
