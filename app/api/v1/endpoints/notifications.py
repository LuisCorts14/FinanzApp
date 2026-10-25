from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.notification_read import NotificationRead as ReadMark
from app.models.user import User
from app.schemas.notification import MarkReadRequest, NotificationList, NotificationRead
from app.services.notifications import compute_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _read_keys(db: Session, user: User) -> set[str]:
    return set(db.scalars(select(ReadMark.key).where(ReadMark.user_id == user.id)))


@router.get("", response_model=NotificationList)
def list_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    read = _read_keys(db, current_user)
    items = [NotificationRead(**n.model_dump(), read=n.key in read) for n in compute_notifications(db, current_user)]
    return NotificationList(items=items, unread_count=sum(not n.read for n in items))


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    payload: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Solo se aceptan keys de avisos que existen ahora, para no guardar cualquier texto que mande el cliente.
    current = {n.key for n in compute_notifications(db, current_user)}
    wanted = current if payload.keys is None else current & set(payload.keys)
    for key in wanted - _read_keys(db, current_user):
        db.add(ReadMark(user_id=current_user.id, key=key))
    db.commit()
