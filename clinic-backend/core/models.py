from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator


class Patient(models.Model):
    """
    Patient model to store patient information
    """
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17)
    date_of_birth = models.DateField()
    address = models.TextField()
    emergency_contact_name = models.CharField(max_length=100)
    emergency_contact_phone = models.CharField(validators=[phone_regex], max_length=17)
    medical_history = models.TextField(blank=True, null=True)
    allergies = models.TextField(blank=True, null=True)
    
    # Relationship fields
    assigned_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': 'doctor'},
        related_name='patients'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'patients'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class Doctor(models.Model):
    """
    Doctor profile model (extends User model)
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'doctor'},
        related_name='doctor_profile'
    )
    bio = models.TextField(blank=True, null=True)
    years_of_experience = models.PositiveIntegerField(default=0)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    available_days = models.CharField(
        max_length=100,
        default='Monday,Tuesday,Wednesday,Thursday,Friday',
        help_text='Comma-separated list of available days'
    )
    start_time = models.TimeField(default='09:00')
    end_time = models.TimeField(default='17:00')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'doctors'
    
    def __str__(self):
        return f"Dr. {self.user.get_full_name()}"


class Appointment(models.Model):
    """
    Appointment model to manage patient appointments
    """
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'doctor'},
        related_name='appointments'
    )
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=30)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    reason = models.TextField()
    notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'appointments'
        ordering = ['appointment_date', 'appointment_time']
        unique_together = ['doctor', 'appointment_date', 'appointment_time']
    
    def __str__(self):
        return f"{self.patient.full_name} - {self.appointment_date} {self.appointment_time}"


class TreatmentCatalog(models.Model):
    """
    Catalog of available treatments and procedures
    """
    name = models.CharField(max_length=200)
    description = models.TextField()
    base_cost = models.DecimalField(max_digits=10, decimal_places=2)
    duration_minutes = models.PositiveIntegerField(default=30)
    category = models.CharField(max_length=100, default='General')
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'treatment_catalog'
        ordering = ['category', 'name']
    
    def __str__(self):
        return self.name


class TreatmentRecord(models.Model):
    """
    Record of treatments performed on patients
    """
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='treatments')
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'doctor'},
        related_name='treatments_performed'
    )
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.CASCADE,
        related_name='treatments',
        null=True,
        blank=True
    )
    treatment = models.ForeignKey(TreatmentCatalog, on_delete=models.CASCADE)
    date_performed = models.DateField()
    notes = models.TextField(blank=True, null=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'treatment_records'
        ordering = ['-date_performed']
    
    def __str__(self):
        return f"{self.patient.full_name} - {self.treatment.name}"


class Bill(models.Model):
    """
    Billing model for patient invoices
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]
    
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='bills')
    bill_number = models.CharField(max_length=50, unique=True)
    bill_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'bills'
        ordering = ['-bill_date']
    
    def __str__(self):
        return f"Bill #{self.bill_number} - {self.patient.full_name}"


class BillItem(models.Model):
    """
    Individual line items for bills
    """
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')
    treatment_record = models.ForeignKey(
        TreatmentRecord,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    description = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    class Meta:
        db_table = 'bill_items'
    
    def __str__(self):
        return f"{self.bill.bill_number} - {self.description}"


class InventoryItem(models.Model):
    """
    Inventory management for medical supplies and equipment
    """
    CATEGORY_CHOICES = [
        ('equipment', 'Equipment'),
        ('supplies', 'Medical Supplies'),
        ('medication', 'Medication'),
        ('consumables', 'Consumables'),
    ]
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    sku = models.CharField(max_length=50, unique=True)
    current_stock = models.PositiveIntegerField(default=0)
    minimum_stock = models.PositiveIntegerField(default=5)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    supplier = models.CharField(max_length=200, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'inventory_items'
        ordering = ['category', 'name']
    
    def __str__(self):
        return f"{self.name} (Stock: {self.current_stock})"
    
    @property
    def is_low_stock(self):
        return self.current_stock <= self.minimum_stock


class TreatmentInventoryUsage(models.Model):
    """
    Track inventory usage during treatments
    """
    treatment_record = models.ForeignKey(
        TreatmentRecord,
        on_delete=models.CASCADE,
        related_name='inventory_usage'
    )
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE)
    quantity_used = models.PositiveIntegerField()
    cost_at_time = models.DecimalField(max_digits=10, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'treatment_inventory_usage'
    
    def __str__(self):
        return f"{self.inventory_item.name} - {self.quantity_used} units"
