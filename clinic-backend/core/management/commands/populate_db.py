from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import Patient, Doctor, Appointment, TreatmentCatalog, InventoryItem
from datetime import datetime, timedelta, date, time
import random

User = get_user_model()

class Command(BaseCommand):
    help = 'Populate database with comprehensive sample data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before populating',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing data...')
            Appointment.objects.all().delete()
            Patient.objects.all().delete()
            Doctor.objects.all().delete()
            TreatmentCatalog.objects.all().delete()
            InventoryItem.objects.all().delete()
            User.objects.filter(role__in=['doctor']).delete()
            self.stdout.write('Data cleared.')
            
        self.stdout.write('Populating database with comprehensive sample data...')

        # Create more doctor users
        doctor_data = [
            {
                'username': 'dr_smith',
                'email': 'dr.smith@clinic.com',
                'first_name': 'John',
                'last_name': 'Smith',
                'role': 'doctor',
                'specialization': 'General Dentistry',
                'license_number': 'DDS001',
                'phone': '+1234567890'
            },
            {
                'username': 'dr_johnson',
                'email': 'dr.johnson@clinic.com',
                'first_name': 'Sarah',
                'last_name': 'Johnson',
                'role': 'doctor',
                'specialization': 'Orthodontics',
                'license_number': 'DDS002',
                'phone': '+1234567891'
            },
            {
                'username': 'dr_wilson',
                'email': 'dr.wilson@clinic.com',
                'first_name': 'Michael',
                'last_name': 'Wilson',
                'role': 'doctor',
                'specialization': 'Oral Surgery',
                'license_number': 'DDS003',
                'phone': '+1234567892'
            },
            {
                'username': 'dr_brown',
                'email': 'dr.brown@clinic.com',
                'first_name': 'Emily',
                'last_name': 'Brown',
                'role': 'doctor',
                'specialization': 'Pediatric Dentistry',
                'license_number': 'DDS004',
                'phone': '+1234567893'
            },
            {
                'username': 'dr_garcia',
                'email': 'dr.garcia@clinic.com',
                'first_name': 'Carlos',
                'last_name': 'Garcia',
                'role': 'doctor',
                'specialization': 'Periodontics',
                'license_number': 'DDS005',
                'phone': '+1234567894'
            }
        ]

        created_doctors = []
        for data in doctor_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults=data
            )
            if created:
                user.set_password('doctor123')
                user.save()
                
            doctor, doc_created = Doctor.objects.get_or_create(
                user=user,
                defaults={
                    'years_of_experience': random.randint(2, 25),
                    'consultation_fee': random.randint(100, 300),
                    'available_days': random.choice(['Mon-Fri', 'Mon-Sat', 'Tue-Sat']),
                    'start_time': '09:00',
                    'end_time': '17:00'
                }
            )
            created_doctors.append(doctor)
            if created or doc_created:
                self.stdout.write(f'Created doctor: {user.username}')

        # Create many more patients
        patient_names = [
            ('Alice', 'Wilson', 'alice.wilson@email.com', '1985-05-15'),
            ('Bob', 'Brown', 'bob.brown@email.com', '1990-08-22'),
            ('Carol', 'Davis', 'carol.davis@email.com', '1978-12-03'),
            ('David', 'Miller', 'david.miller@email.com', '1983-11-17'),
            ('Emma', 'Martinez', 'emma.martinez@email.com', '1992-07-09'),
            ('Frank', 'Anderson', 'frank.anderson@email.com', '1975-03-24'),
            ('Grace', 'Taylor', 'grace.taylor@email.com', '1988-12-30'),
            ('Henry', 'Thomas', 'henry.thomas@email.com', '1979-04-14'),
            ('Iris', 'Jackson', 'iris.jackson@email.com', '1995-09-06'),
            ('Jack', 'White', 'jack.white@email.com', '1982-01-22'),
            ('Karen', 'Harris', 'karen.harris@email.com', '1987-06-18'),
            ('Leo', 'Clark', 'leo.clark@email.com', '1993-10-12'),
            ('Maria', 'Rodriguez', 'maria.rodriguez@email.com', '1980-08-05'),
            ('Nathan', 'Lewis', 'nathan.lewis@email.com', '1991-02-28'),
            ('Olivia', 'Lee', 'olivia.lee@email.com', '1984-05-11'),
            ('Paul', 'Walker', 'paul.walker@email.com', '1977-09-03'),
            ('Quinn', 'Hall', 'quinn.hall@email.com', '1989-11-25'),
            ('Rita', 'Allen', 'rita.allen@email.com', '1986-07-16'),
            ('Sam', 'Young', 'sam.young@email.com', '1994-03-08'),
            ('Tina', 'King', 'tina.king@email.com', '1981-12-19')
        ]

        created_patients = []
        addresses = [
            '123 Main St, Springfield, IL',
            '456 Oak Ave, Madison, WI',
            '789 Pine Rd, Austin, TX',
            '321 Elm St, Denver, CO',
            '654 Maple Dr, Seattle, WA',
            '987 Cedar Ln, Miami, FL',
            '147 Birch Ct, Portland, OR',
            '258 Willow Way, Boston, MA',
            '369 Ash Blvd, Phoenix, AZ',
            '741 Cherry St, Nashville, TN'
        ]

        for i, (first, last, email, dob) in enumerate(patient_names):
            patient_data = {
                'first_name': first,
                'last_name': last,
                'email': email,
                'phone': f'+123456{7890 + i}',
                'date_of_birth': dob,
                'address': addresses[i % len(addresses)],
                'emergency_contact_name': f'{first} Contact',
                'emergency_contact_phone': f'+123456{8000 + i}',
                'medical_history': random.choice([
                    'No significant medical history',
                    'Hypertension, controlled with medication',
                    'Diabetes Type 2',
                    'Asthma',
                    'Heart condition - cleared for dental work'
                ]),
                'allergies': random.choice([
                    None,
                    'Penicillin',
                    'Latex',
                    'Local anesthetics',
                    'Ibuprofen'
                ])
            }
            
            patient, created = Patient.objects.get_or_create(
                email=email,
                defaults=patient_data
            )
            if created:
                # Assign random doctor
                patient.assigned_doctor = random.choice(created_doctors).user
                patient.save()
                created_patients.append(patient)
                self.stdout.write(f'Created patient: {patient.first_name} {patient.last_name}')

        # Create comprehensive treatment catalog
        treatments = [
            {'name': 'Regular Cleaning', 'description': 'Routine dental cleaning and examination', 'base_cost': 120.00, 'duration_minutes': 60, 'category': 'Preventive'},
            {'name': 'Deep Cleaning', 'description': 'Scaling and root planing', 'base_cost': 250.00, 'duration_minutes': 90, 'category': 'Periodontics'},
            {'name': 'Cavity Filling (Composite)', 'description': 'Tooth-colored composite filling', 'base_cost': 200.00, 'duration_minutes': 45, 'category': 'Restorative'},
            {'name': 'Cavity Filling (Amalgam)', 'description': 'Silver amalgam filling', 'base_cost': 150.00, 'duration_minutes': 30, 'category': 'Restorative'},
            {'name': 'Root Canal Therapy', 'description': 'Endodontic treatment', 'base_cost': 800.00, 'duration_minutes': 120, 'category': 'Endodontics'},
            {'name': 'Crown (Porcelain)', 'description': 'Porcelain dental crown', 'base_cost': 1200.00, 'duration_minutes': 90, 'category': 'Restorative'},
            {'name': 'Crown (Metal)', 'description': 'Metal dental crown', 'base_cost': 900.00, 'duration_minutes': 90, 'category': 'Restorative'},
            {'name': 'Teeth Whitening', 'description': 'Professional teeth whitening treatment', 'base_cost': 350.00, 'duration_minutes': 60, 'category': 'Cosmetic'},
            {'name': 'Orthodontic Consultation', 'description': 'Initial braces consultation', 'base_cost': 150.00, 'duration_minutes': 45, 'category': 'Orthodontics'},
            {'name': 'Braces Installation', 'description': 'Traditional metal braces', 'base_cost': 3500.00, 'duration_minutes': 120, 'category': 'Orthodontics'},
            {'name': 'Invisalign Consultation', 'description': 'Clear aligner consultation', 'base_cost': 200.00, 'duration_minutes': 60, 'category': 'Orthodontics'},
            {'name': 'Tooth Extraction', 'description': 'Simple tooth extraction', 'base_cost': 300.00, 'duration_minutes': 30, 'category': 'Oral Surgery'},
            {'name': 'Wisdom Tooth Extraction', 'description': 'Surgical wisdom tooth removal', 'base_cost': 450.00, 'duration_minutes': 60, 'category': 'Oral Surgery'},
            {'name': 'Dental Implant', 'description': 'Single tooth implant placement', 'base_cost': 2500.00, 'duration_minutes': 90, 'category': 'Oral Surgery'},
            {'name': 'Veneer (Porcelain)', 'description': 'Porcelain veneer placement', 'base_cost': 1000.00, 'duration_minutes': 75, 'category': 'Cosmetic'},
            {'name': 'Bridge (3-unit)', 'description': 'Three-unit dental bridge', 'base_cost': 2200.00, 'duration_minutes': 120, 'category': 'Restorative'},
            {'name': 'Denture (Partial)', 'description': 'Partial removable denture', 'base_cost': 1200.00, 'duration_minutes': 60, 'category': 'Prosthetics'},
            {'name': 'Denture (Complete)', 'description': 'Complete removable denture', 'base_cost': 2000.00, 'duration_minutes': 90, 'category': 'Prosthetics'},
            {'name': 'Gum Graft', 'description': 'Gingival graft procedure', 'base_cost': 700.00, 'duration_minutes': 90, 'category': 'Periodontics'},
            {'name': 'Emergency Visit', 'description': 'Emergency dental consultation', 'base_cost': 180.00, 'duration_minutes': 30, 'category': 'Emergency'}
        ]

        for treatment_data in treatments:
            treatment, created = TreatmentCatalog.objects.get_or_create(
                name=treatment_data['name'],
                defaults=treatment_data
            )
            if created:
                self.stdout.write(f'Created treatment: {treatment.name}')

        # Create comprehensive inventory
        inventory_items = [
            # Supplies
            {'name': 'Dental Floss', 'category': 'supplies', 'sku': 'DF001', 'current_stock': 100, 'minimum_stock': 20, 'unit_cost': 2.50, 'supplier': 'Oral-B'},
            {'name': 'Toothbrush (Soft)', 'category': 'supplies', 'sku': 'TB001', 'current_stock': 200, 'minimum_stock': 50, 'unit_cost': 3.00, 'supplier': 'Oral-B'},
            {'name': 'Toothbrush (Medium)', 'category': 'supplies', 'sku': 'TB002', 'current_stock': 150, 'minimum_stock': 40, 'unit_cost': 3.00, 'supplier': 'Oral-B'},
            {'name': 'Toothpaste (Fluoride)', 'category': 'supplies', 'sku': 'TP001', 'current_stock': 80, 'minimum_stock': 15, 'unit_cost': 4.50, 'supplier': 'Colgate'},
            {'name': 'Mouthwash', 'category': 'supplies', 'sku': 'MW001', 'current_stock': 60, 'minimum_stock': 15, 'unit_cost': 6.00, 'supplier': 'Listerine'},
            
            # Medications
            {'name': 'Lidocaine 2%', 'category': 'medication', 'sku': 'LID001', 'current_stock': 50, 'minimum_stock': 10, 'unit_cost': 15.00, 'supplier': 'MedSupply Co'},
            {'name': 'Articaine 4%', 'category': 'medication', 'sku': 'ART001', 'current_stock': 30, 'minimum_stock': 8, 'unit_cost': 18.00, 'supplier': 'MedSupply Co'},
            {'name': 'Benzocaine Gel', 'category': 'medication', 'sku': 'BEN001', 'current_stock': 25, 'minimum_stock': 5, 'unit_cost': 12.00, 'supplier': 'MedSupply Co'},
            {'name': 'Fluoride Varnish', 'category': 'medication', 'sku': 'FL001', 'current_stock': 40, 'minimum_stock': 10, 'unit_cost': 8.50, 'supplier': 'Preventive Care Inc'},
            
            # Consumables
            {'name': 'Composite Filling Material', 'category': 'consumables', 'sku': 'CF001', 'current_stock': 30, 'minimum_stock': 8, 'unit_cost': 25.00, 'supplier': '3M Dental'},
            {'name': 'Amalgam Filling Material', 'category': 'consumables', 'sku': 'AF001', 'current_stock': 20, 'minimum_stock': 5, 'unit_cost': 35.00, 'supplier': 'Kerr Dental'},
            {'name': 'Dental Impression Material', 'category': 'consumables', 'sku': 'IM001', 'current_stock': 15, 'minimum_stock': 5, 'unit_cost': 45.00, 'supplier': '3M Dental'},
            {'name': 'Crown & Bridge Material', 'category': 'consumables', 'sku': 'CB001', 'current_stock': 12, 'minimum_stock': 3, 'unit_cost': 80.00, 'supplier': 'Ivoclar Vivadent'},
            {'name': 'Dental Cement', 'category': 'consumables', 'sku': 'DC001', 'current_stock': 25, 'minimum_stock': 6, 'unit_cost': 22.00, 'supplier': 'GC America'},
            {'name': 'Latex Gloves (Box)', 'category': 'consumables', 'sku': 'LG001', 'current_stock': 50, 'minimum_stock': 15, 'unit_cost': 12.00, 'supplier': 'SafeCare Medical'},
            {'name': 'Nitrile Gloves (Box)', 'category': 'consumables', 'sku': 'NG001', 'current_stock': 45, 'minimum_stock': 15, 'unit_cost': 15.00, 'supplier': 'SafeCare Medical'},
            {'name': 'Face Masks (Box)', 'category': 'consumables', 'sku': 'FM001', 'current_stock': 35, 'minimum_stock': 10, 'unit_cost': 8.00, 'supplier': 'SafeCare Medical'},
            {'name': 'Disposable Bibs', 'category': 'consumables', 'sku': 'DB001', 'current_stock': 200, 'minimum_stock': 50, 'unit_cost': 0.25, 'supplier': 'Defend'},
            
            # Equipment
            {'name': 'Dental Drill Bits (High Speed)', 'category': 'equipment', 'sku': 'DDB001', 'current_stock': 20, 'minimum_stock': 5, 'unit_cost': 45.00, 'supplier': 'Brasseler USA'},
            {'name': 'Dental Drill Bits (Low Speed)', 'category': 'equipment', 'sku': 'DDB002', 'current_stock': 25, 'minimum_stock': 8, 'unit_cost': 35.00, 'supplier': 'Brasseler USA'},
            {'name': 'Dental Mirrors', 'category': 'equipment', 'sku': 'DM001', 'current_stock': 40, 'minimum_stock': 15, 'unit_cost': 8.00, 'supplier': 'Hu-Friedy'},
            {'name': 'Dental Probes', 'category': 'equipment', 'sku': 'DP001', 'current_stock': 30, 'minimum_stock': 10, 'unit_cost': 12.00, 'supplier': 'Hu-Friedy'},
            {'name': 'Scalers (Set)', 'category': 'equipment', 'sku': 'SC001', 'current_stock': 15, 'minimum_stock': 5, 'unit_cost': 85.00, 'supplier': 'Hu-Friedy'},
            {'name': 'Forceps (Set)', 'category': 'equipment', 'sku': 'FC001', 'current_stock': 10, 'minimum_stock': 3, 'unit_cost': 150.00, 'supplier': 'Hu-Friedy'},
            {'name': 'Suction Tips', 'category': 'equipment', 'sku': 'ST001', 'current_stock': 100, 'minimum_stock': 25, 'unit_cost': 2.00, 'supplier': 'Defend'},
        ]

        for item_data in inventory_items:
            item, created = InventoryItem.objects.get_or_create(
                sku=item_data['sku'],
                defaults=item_data
            )
            if created:
                self.stdout.write(f'Created inventory item: {item.name}')

        # Create many appointments across different dates
        if created_doctors and created_patients:
            appointment_reasons = [
                'Regular checkup and cleaning',
                'Tooth pain - upper molar',
                'Cavity filling needed',
                'Crown preparation',
                'Root canal therapy',
                'Orthodontic consultation',
                'Teeth whitening',
                'Emergency visit - broken tooth',
                'Follow-up appointment',
                'Wisdom tooth extraction',
                'Implant consultation',
                'Gum disease treatment',
                'Dental bridge fitting',
                'Veneer consultation',
                'Denture adjustment'
            ]
            
            # Create appointments for the past 30 days, today, and next 60 days
            for days_offset in range(-30, 61):
                appointment_date = date.today() + timedelta(days=days_offset)
                
                # Skip weekends for most appointments
                if appointment_date.weekday() >= 5 and random.random() > 0.1:
                    continue
                    
                # Create 2-8 appointments per day
                num_appointments = random.randint(2, 8) if days_offset <= 0 else random.randint(1, 6)
                
                used_times = set()
                for _ in range(num_appointments):
                    # Generate appointment time (9 AM to 5 PM)
                    hour = random.randint(9, 16)
                    minute = random.choice([0, 15, 30, 45])
                    appointment_time = time(hour, minute)
                    
                    # Avoid double-booking same time
                    time_key = (appointment_date, appointment_time)
                    if time_key in used_times:
                        continue
                    used_times.add(time_key)
                    
                    # Set status based on date
                    if days_offset < -1:
                        status = random.choice(['completed', 'completed', 'completed', 'cancelled', 'no_show'])
                    elif days_offset == -1 or days_offset == 0:
                        status = random.choice(['completed', 'in_progress', 'scheduled'])
                    else:
                        status = random.choice(['scheduled', 'confirmed'])
                    
                    appointment = Appointment.objects.create(
                        patient=random.choice(created_patients),
                        doctor=random.choice(created_doctors).user,
                        appointment_date=appointment_date,
                        appointment_time=appointment_time,
                        duration_minutes=random.choice([30, 45, 60, 75, 90]),
                        reason=random.choice(appointment_reasons),
                        status=status,
                        notes=random.choice([
                            '',
                            'Patient was on time',
                            'Patient arrived 10 minutes late',
                            'Needs follow-up in 2 weeks',
                            'Referred to specialist',
                            'Treatment completed successfully',
                            'Patient rescheduled',
                            'Insurance pre-authorization required'
                        ]) if random.random() > 0.6 else ''
                    )

            self.stdout.write(f'Created {Appointment.objects.count()} appointments')

        # Update statistics
        for doctor in created_doctors:
            # Update patient count for each doctor
            patient_count = Patient.objects.filter(assigned_doctor=doctor.user).count()
            doctor.patient_count = patient_count
            doctor.save()

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully populated database with sample data!\n'
                f'Created: {User.objects.filter(role="doctor").count()} doctors, '
                f'{Patient.objects.count()} patients, '
                f'{Appointment.objects.count()} appointments, '
                f'{TreatmentCatalog.objects.count()} treatments, '
                f'{InventoryItem.objects.count()} inventory items'
            )
        )
