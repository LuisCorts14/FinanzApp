from dataclasses import asdict

from fastapi import APIRouter

from app.core.institutions import GROUPS, INSTITUTIONS
from app.schemas.catalog import InstitutionRead

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/institutions", response_model=list[InstitutionRead])
def list_institutions():
    """Instituciones financieras de Chile con sus productos, ordenadas por grupo."""
    ordered = sorted(INSTITUTIONS, key=lambda inst: GROUPS.index(inst.group))
    return [asdict(inst) for inst in ordered]
