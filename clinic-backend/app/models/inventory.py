import uuid
import enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, Enum as SAEnum, Numeric, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User


class InventoryCategory(str, enum.Enum):
    EQUIPMENT = "equipment"
    CONSUMABLE = "consumable"
    MEDICATION = "medication"
    INSTRUMENT = "instrument"
    PROTECTIVE = "protective"
    OTHER = "other"


class InventoryItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inventory_items"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[InventoryCategory] = mapped_column(SAEnum(InventoryCategory), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(30), default="pcs")   # pcs, ml, grams, box, etc.

    current_stock: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=10)   # Alert when stock <= this
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    supplier_name: Mapped[str | None] = mapped_column(String(200))
    supplier_contact: Mapped[str | None] = mapped_column(String(100))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    @property
    def is_low_stock(self) -> bool:
        return self.current_stock <= self.reorder_level
