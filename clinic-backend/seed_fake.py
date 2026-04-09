"""
Seed fake data for testing: clinic, staff, 15 patients, 30 appointments.
Usage: python seed_fake.py
"""
import asyncio
import ssl
import uuid
import random
from datetime import date, time, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.clinic import Clinic
from app.models.user import User, UserRole
from app.models.patient import Patient, Gender, BloodGroup
from app.models.appointment import Appointment, AppointmentStatus
from app.auth.jwt import hash_password


# ── Fake data ─────────────────────────────────────────────────────────────────

CLINIC_EMAIL = "admin@demodental.in"

PATIENTS = [
    ("Aarav",    "Shah",     "male",   "1990-03-14", "9876543210", "aarav.shah@gmail.com",    "A+",      "Mumbai"),
    ("Priya",    "Mehta",    "female", "1985-07-22", "9823456789", "priya.mehta@gmail.com",   "B+",      "Mumbai"),
    ("Rohit",    "Verma",    "male",   "1978-11-05", "9812345678", "rohit.verma@yahoo.com",   "O+",      "Thane"),
    ("Sneha",    "Kulkarni", "female", "1995-01-30", "9701234567", "sneha.k@gmail.com",       "AB+",     "Pune"),
    ("Vikram",   "Joshi",    "male",   "1982-09-18", "9690123456", "vikram.j@hotmail.com",    "A-",      "Mumbai"),
    ("Ananya",   "Nair",     "female", "2000-04-12", "9567890123", None,                      "B-",      "Thane"),
    ("Kiran",    "Reddy",    "male",   "1970-12-01", "9456789012", "kiran.r@gmail.com",       "O-",      "Mumbai"),
    ("Meera",    "Iyer",     "female", "1992-06-25", "9345678901", "meera.iyer@gmail.com",    "AB-",     "Nashik"),
    ("Suresh",   "Gupta",    "male",   "1965-08-08", "9234567890", "suresh.g@gmail.com",      "A+",      "Mumbai"),
    ("Kavya",    "Singh",    "female", "1998-02-17", "9123456789", "kavya.singh@gmail.com",   "B+",      "Thane"),
    ("Arjun",    "Patel",    "male",   "1988-05-03", "9012345678", "arjun.p@gmail.com",       "O+",      "Mumbai"),
    ("Divya",    "Rao",      "female", "1975-10-20", "8901234567", "divya.rao@yahoo.com",     "A+",      "Pune"),
    ("Manish",   "Desai",    "male",   "1993-07-09", "8890123456", None,                      "unknown", "Mumbai"),
    ("Pooja",    "Sharma",   "female", "1987-03-28", "8779012345", "pooja.s@gmail.com",       "B+",      "Thane"),
    ("Rahul",    "Agarwal",  "male",   "2002-11-15", "8668901234", "rahul.a@gmail.com",       "O+",      "Mumbai"),
]

REASONS = [
    "Routine checkup", "Tooth pain", "Cleaning & scaling",
    "Cavity filling", "Root canal consultation", "Teeth whitening",
    "Broken tooth", "Gum pain", "Wisdom tooth", "Follow-up visit",
]

STATUSES_PAST = [
    AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED,
    AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW,
    AppointmentStatus.CANCELLED,
]

SLOTS = [
    time(9, 0), time(9, 30), time(10, 0), time(10, 30),
    time(11, 0), time(11, 30), time(14, 0), time(14, 30),
    time(15, 0), time(15, 30), time(16, 0), time(16, 30),
]


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
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # ── 1. Get or create clinic ───────────────────────────────────────────
        result = await db.execute(select(Clinic).where(Clinic.slug == "demo-dental"))
        clinic = result.scalar_one_or_none()

        if not clinic:
            clinic = Clinic(
                name="Demo Dental Clinic",
                slug="demo-dental",
                phone="9999999999",
                email=CLINIC_EMAIL,
                address_line1="123 Main Street",
                city="Mumbai",
                state="Maharashtra",
                pincode="400001",
                plan="growth",
            )
            db.add(clinic)
            await db.flush()
            print(f"  Created clinic: {clinic.name}")
        else:
            print(f"  Using existing clinic: {clinic.name}")

        # ── 2. Get or create staff ────────────────────────────────────────────
        result = await db.execute(select(User).where(User.email == CLINIC_EMAIL))
        owner = result.scalar_one_or_none()
        if not owner:
            owner = User(
                clinic_id=clinic.id,
                email=CLINIC_EMAIL,
                hashed_password=hash_password("Admin@1234"),
                role=UserRole.CLINIC_OWNER,
                first_name="Admin",
                last_name="User",
                phone="9999999999",
            )
            db.add(owner)
            print("  Created clinic owner")

        result = await db.execute(select(User).where(User.email == "doctor@demodental.in"))
        doctor = result.scalar_one_or_none()
        if not doctor:
            doctor = User(
                clinic_id=clinic.id,
                email="doctor@demodental.in",
                hashed_password=hash_password("Doctor@1234"),
                role=UserRole.DOCTOR,
                first_name="Priya",
                last_name="Sharma",
                specialization="General Dentistry",
                mci_number="MH-12345",
            )
            db.add(doctor)
            print("  Created doctor")

        result = await db.execute(select(User).where(User.email == "doctor2@demodental.in"))
        doctor2 = result.scalar_one_or_none()
        if not doctor2:
            doctor2 = User(
                clinic_id=clinic.id,
                email="doctor2@demodental.in",
                hashed_password=hash_password("Doctor@1234"),
                role=UserRole.DOCTOR,
                first_name="Anil",
                last_name="Kumar",
                specialization="Orthodontics",
                mci_number="MH-67890",
            )
            db.add(doctor2)
            print("  Created doctor2")

        await db.flush()
        doctors = [doctor, doctor2]

        # ── 3. Create patients ────────────────────────────────────────────────
        patient_objs = []
        for first, last, gender, dob, phone, email, blood, city in PATIENTS:
            result = await db.execute(select(Patient).where(Patient.phone == phone))
            p = result.scalar_one_or_none()
            if not p:
                p = Patient(
                    clinic_id=clinic.id,
                    first_name=first,
                    last_name=last,
                    gender=Gender(gender),
                    date_of_birth=date.fromisoformat(dob),
                    phone=phone,
                    email=email,
                    city=city,
                    blood_group=BloodGroup(blood),
                    assigned_doctor_id=random.choice(doctors).id,
                    is_active=True,
                )
                db.add(p)
            patient_objs.append(p)

        await db.flush()
        print(f"  Upserted {len(patient_objs)} patients")

        # ── 4. Create appointments ────────────────────────────────────────────
        today = date.today()
        appt_count = 0

        # 20 past appointments (last 30 days)
        for i in range(20):
            days_back = random.randint(1, 30)
            appt_date = today - timedelta(days=days_back)
            appt = Appointment(
                clinic_id=clinic.id,
                patient_id=random.choice(patient_objs).id,
                doctor_id=random.choice(doctors).id,
                booked_by_id=owner.id,
                appointment_date=appt_date,
                start_time=random.choice(SLOTS),
                duration_minutes=random.choice([30, 45, 60]),
                status=random.choice(STATUSES_PAST),
                reason=random.choice(REASONS),
            )
            db.add(appt)
            appt_count += 1

        # 10 upcoming appointments (next 14 days)
        for i in range(10):
            days_ahead = random.randint(0, 14)
            appt_date = today + timedelta(days=days_ahead)
            appt = Appointment(
                clinic_id=clinic.id,
                patient_id=random.choice(patient_objs).id,
                doctor_id=random.choice(doctors).id,
                booked_by_id=owner.id,
                appointment_date=appt_date,
                start_time=random.choice(SLOTS),
                duration_minutes=random.choice([30, 45, 60]),
                status=AppointmentStatus.SCHEDULED,
                reason=random.choice(REASONS),
            )
            db.add(appt)
            appt_count += 1

        await db.commit()
        print(f"  Created {appt_count} appointments")

    print("\n✅ Fake data seeded!\n")
    print("  Clinic Owner:  admin@demodental.in   / Admin@1234")
    print("  Doctor 1:      doctor@demodental.in  / Doctor@1234")
    print("  Doctor 2:      doctor2@demodental.in / Doctor@1234")
    print(f"  Patients:      {len(PATIENTS)}")
    print(f"  Appointments:  {appt_count} (20 past, 10 upcoming)")
    print()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
