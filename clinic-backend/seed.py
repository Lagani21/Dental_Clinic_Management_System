"""
Run once to create the first clinic + clinic owner account.
Usage: python seed.py
"""
import asyncio
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.database import Base
from app.models.clinic import Clinic
from app.models.user import User, UserRole
from app.auth.jwt import hash_password


async def seed():
    ssl_ctx = None
    if settings.DATABASE_SSL:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"ssl": ssl_ctx} if ssl_ctx else {},
    )

    async with async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        # ── 1. Create clinic ─────────────────────────────────────────────────
        clinic = Clinic(
            name="Demo Dental Clinic",
            slug="demo-dental",
            phone="9999999999",
            email="admin@demodental.in",
            address_line1="123 Main Street",
            city="Mumbai",
            state="Maharashtra",
            pincode="400001",
            plan="growth",
        )
        session.add(clinic)
        await session.flush()

        # ── 2. Create clinic owner ───────────────────────────────────────────
        owner = User(
            clinic_id=clinic.id,
            email="admin@demodental.in",
            hashed_password=hash_password("Admin@1234"),
            role=UserRole.CLINIC_OWNER,
            first_name="Admin",
            last_name="User",
            phone="9999999999",
        )
        session.add(owner)

        # ── 3. Create a doctor ───────────────────────────────────────────────
        doctor = User(
            clinic_id=clinic.id,
            email="doctor@demodental.in",
            hashed_password=hash_password("Doctor@1234"),
            role=UserRole.DOCTOR,
            first_name="Dr. Priya",
            last_name="Sharma",
            specialization="General Dentistry",
            mci_number="MH-12345",
        )
        session.add(doctor)

        # ── 4. Create a receptionist ─────────────────────────────────────────
        receptionist = User(
            clinic_id=clinic.id,
            email="reception@demodental.in",
            hashed_password=hash_password("Reception@1234"),
            role=UserRole.RECEPTIONIST,
            first_name="Rahul",
            last_name="Patel",
        )
        session.add(receptionist)

        await session.commit()

    print("\n✅ Seed complete!\n")
    print("  Clinic:        Demo Dental Clinic")
    print("  Owner login:   admin@demodental.in  / Admin@1234")
    print("  Doctor login:  doctor@demodental.in / Doctor@1234")
    print("  Reception:     reception@demodental.in / Reception@1234")
    print()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
