from django.contrib import admin
from .models import (
    Patient, Doctor, Appointment, TreatmentCatalog, TreatmentRecord,
    Bill, BillItem, InventoryItem, TreatmentInventoryUsage
)


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'email', 'phone', 'assigned_doctor', 'created_at']
    list_filter = ['assigned_doctor', 'created_at']
    search_fields = ['first_name', 'last_name', 'email', 'phone']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ['user', 'get_specialization', 'years_of_experience', 'consultation_fee']
    list_filter = ['user__specialization', 'years_of_experience']
    search_fields = ['user__first_name', 'user__last_name', 'user__specialization']
    readonly_fields = ['created_at', 'updated_at']
    
    def get_specialization(self, obj):
        return obj.user.specialization
    get_specialization.short_description = 'Specialization'


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['patient', 'doctor', 'appointment_date', 'appointment_time', 'status']
    list_filter = ['status', 'appointment_date', 'doctor']
    search_fields = ['patient__first_name', 'patient__last_name', 'doctor__first_name', 'doctor__last_name']
    ordering = ['-appointment_date', '-appointment_time']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TreatmentCatalog)
class TreatmentCatalogAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'base_cost', 'duration_minutes', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'category']
    ordering = ['category', 'name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(TreatmentRecord)
class TreatmentRecordAdmin(admin.ModelAdmin):
    list_display = ['patient', 'treatment', 'doctor', 'date_performed', 'cost']
    list_filter = ['date_performed', 'doctor', 'treatment__category']
    search_fields = ['patient__first_name', 'patient__last_name', 'treatment__name']
    ordering = ['-date_performed']
    readonly_fields = ['created_at', 'updated_at']


class BillItemInline(admin.TabularInline):
    model = BillItem
    extra = 0


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ['bill_number', 'patient', 'bill_date', 'total_amount', 'status']
    list_filter = ['status', 'bill_date']
    search_fields = ['bill_number', 'patient__first_name', 'patient__last_name']
    ordering = ['-bill_date']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [BillItemInline]


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'current_stock', 'minimum_stock', 'is_low_stock', 'unit_cost']
    list_filter = ['category']
    search_fields = ['name', 'sku', 'supplier']
    ordering = ['category', 'name']
    readonly_fields = ['created_at', 'updated_at']
    
    def is_low_stock(self, obj):
        return obj.is_low_stock
    is_low_stock.boolean = True
    is_low_stock.short_description = 'Low Stock'


@admin.register(TreatmentInventoryUsage)
class TreatmentInventoryUsageAdmin(admin.ModelAdmin):
    list_display = ['treatment_record', 'inventory_item', 'quantity_used', 'cost_at_time']
    list_filter = ['inventory_item__category', 'created_at']
    search_fields = ['treatment_record__patient__first_name', 'inventory_item__name']
    ordering = ['-created_at']
