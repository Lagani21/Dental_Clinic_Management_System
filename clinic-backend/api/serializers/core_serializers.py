"""
Serializers for Core models
"""
from rest_framework import serializers
from core.models import (
    Patient, Doctor, Appointment, TreatmentCatalog, TreatmentRecord,
    Bill, BillItem, InventoryItem, TreatmentInventoryUsage
)
from .user_serializers import UserProfileSerializer


class PatientSerializer(serializers.ModelSerializer):
    """
    Serializer for Patient model
    """
    full_name = serializers.CharField(read_only=True)
    assigned_doctor_details = UserProfileSerializer(source='assigned_doctor', read_only=True)
    
    class Meta:
        model = Patient
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'email', 'phone',
            'date_of_birth', 'address', 'emergency_contact_name', 
            'emergency_contact_phone', 'medical_history', 'allergies',
            'assigned_doctor', 'assigned_doctor_details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DoctorSerializer(serializers.ModelSerializer):
    """
    Serializer for Doctor model
    """
    user_details = UserProfileSerializer(source='user', read_only=True)
    patient_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Doctor
        fields = [
            'id', 'user', 'user_details', 'bio', 'years_of_experience',
            'consultation_fee', 'available_days', 'start_time', 'end_time',
            'patient_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_patient_count(self, obj):
        return obj.user.patients.count() if obj.user else 0


class AppointmentSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment model
    """
    patient_details = PatientSerializer(source='patient', read_only=True)
    doctor_details = UserProfileSerializer(source='doctor', read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    
    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'patient_name', 'patient_details', 'doctor', 
            'doctor_name', 'doctor_details', 'appointment_date', 'appointment_time',
            'duration_minutes', 'status', 'reason', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """
        Validate appointment doesn't conflict with existing ones
        """
        doctor = attrs.get('doctor')
        appointment_date = attrs.get('appointment_date')
        appointment_time = attrs.get('appointment_time')
        
        if doctor and appointment_date and appointment_time:
            # Check for conflicts (excluding current instance for updates)
            existing_appointment = Appointment.objects.filter(
                doctor=doctor,
                appointment_date=appointment_date,
                appointment_time=appointment_time
            )
            
            if self.instance:
                existing_appointment = existing_appointment.exclude(id=self.instance.id)
            
            if existing_appointment.exists():
                raise serializers.ValidationError(
                    'Doctor already has an appointment at this date and time.'
                )
        
        return attrs


class TreatmentCatalogSerializer(serializers.ModelSerializer):
    """
    Serializer for TreatmentCatalog model
    """
    class Meta:
        model = TreatmentCatalog
        fields = [
            'id', 'name', 'description', 'base_cost', 'duration_minutes',
            'category', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TreatmentRecordSerializer(serializers.ModelSerializer):
    """
    Serializer for TreatmentRecord model
    """
    patient_details = PatientSerializer(source='patient', read_only=True)
    doctor_details = UserProfileSerializer(source='doctor', read_only=True)
    treatment_details = TreatmentCatalogSerializer(source='treatment', read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.get_full_name', read_only=True)
    treatment_name = serializers.CharField(source='treatment.name', read_only=True)
    
    class Meta:
        model = TreatmentRecord
        fields = [
            'id', 'patient', 'patient_name', 'patient_details', 'doctor', 
            'doctor_name', 'doctor_details', 'appointment', 'treatment',
            'treatment_name', 'treatment_details', 'date_performed', 'notes',
            'cost', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BillItemSerializer(serializers.ModelSerializer):
    """
    Serializer for BillItem model
    """
    treatment_name = serializers.CharField(
        source='treatment_record.treatment.name', 
        read_only=True
    )
    
    class Meta:
        model = BillItem
        fields = [
            'id', 'treatment_record', 'treatment_name', 'description',
            'quantity', 'unit_price', 'total_price'
        ]


class BillSerializer(serializers.ModelSerializer):
    """
    Serializer for Bill model
    """
    patient_details = PatientSerializer(source='patient', read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    items = BillItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Bill
        fields = [
            'id', 'patient', 'patient_name', 'patient_details', 'bill_number',
            'bill_date', 'due_date', 'status', 'subtotal', 'tax_amount',
            'discount_amount', 'total_amount', 'notes', 'items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class InventoryItemSerializer(serializers.ModelSerializer):
    """
    Serializer for InventoryItem model
    """
    is_low_stock = serializers.ReadOnlyField()
    
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'description', 'category', 'sku', 'current_stock',
            'minimum_stock', 'is_low_stock', 'unit_cost', 'supplier',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class TreatmentInventoryUsageSerializer(serializers.ModelSerializer):
    """
    Serializer for TreatmentInventoryUsage model
    """
    inventory_item_details = InventoryItemSerializer(source='inventory_item', read_only=True)
    inventory_item_name = serializers.CharField(source='inventory_item.name', read_only=True)
    
    class Meta:
        model = TreatmentInventoryUsage
        fields = [
            'id', 'treatment_record', 'inventory_item', 'inventory_item_name',
            'inventory_item_details', 'quantity_used', 'cost_at_time', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
