"""
Core API views for clinic management
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, F
from datetime import datetime, date

from core.models import (
    Patient, Doctor, Appointment, TreatmentCatalog, TreatmentRecord,
    Bill, BillItem, InventoryItem, TreatmentInventoryUsage
)
from api.serializers.core_serializers import (
    PatientSerializer, DoctorSerializer, AppointmentSerializer,
    TreatmentCatalogSerializer, TreatmentRecordSerializer, BillSerializer,
    InventoryItemSerializer, TreatmentInventoryUsageSerializer
)
from api.permissions.base import (
    IsAdminUser, IsDoctorUser, IsAdminOrDoctor, IsAdminOrDoctorOwner,
    IsAdminOrReadOnly, IsPatientOwnerOrAdminOrDoctor
)


class PatientViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing patients
    """
    serializer_class = PatientSerializer
    permission_classes = [IsPatientOwnerOrAdminOrDoctor]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Patient.objects.all()
        elif user.is_doctor:
            return Patient.objects.filter(assigned_doctor=user)
        return Patient.objects.none()
    
    def perform_create(self, serializer):
        # If doctor creates a patient, automatically assign them
        if self.request.user.is_doctor and not serializer.validated_data.get('assigned_doctor'):
            serializer.save(assigned_doctor=self.request.user)
        else:
            serializer.save()
    
    @action(detail=True, methods=['get'])
    def appointments(self, request, pk=None):
        """Get all appointments for a specific patient"""
        patient = self.get_object()
        appointments = patient.appointments.all().order_by('-appointment_date', '-appointment_time')
        serializer = AppointmentSerializer(appointments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def treatments(self, request, pk=None):
        """Get all treatment records for a specific patient"""
        patient = self.get_object()
        treatments = patient.treatments.all().order_by('-date_performed')
        serializer = TreatmentRecordSerializer(treatments, many=True)
        return Response(serializer.data)


class DoctorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing doctor profiles
    """
    serializer_class = DoctorSerializer
    permission_classes = [IsAdminOrDoctorOwner]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Doctor.objects.all()
        elif user.is_doctor:
            return Doctor.objects.filter(user=user)
        return Doctor.objects.none()
    
    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        """Get doctor's schedule for a specific date range"""
        doctor = self.get_object()
        start_date = request.query_params.get('start_date', date.today())
        end_date = request.query_params.get('end_date', date.today())
        
        appointments = Appointment.objects.filter(
            doctor=doctor.user,
            appointment_date__range=[start_date, end_date]
        ).order_by('appointment_date', 'appointment_time')
        
        serializer = AppointmentSerializer(appointments, many=True)
        return Response(serializer.data)


class AppointmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing appointments
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAdminOrDoctorOwner]
    
    def get_queryset(self):
        user = self.request.user
        queryset = Appointment.objects.all()
        
        if user.is_doctor:
            queryset = queryset.filter(doctor=user)
        
        # Filter by date if provided
        date_filter = self.request.query_params.get('date')
        if date_filter:
            queryset = queryset.filter(appointment_date=date_filter)
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('appointment_date', 'appointment_time')
    
    def perform_create(self, serializer):
        # If doctor creates an appointment, automatically assign them
        if self.request.user.is_doctor and not serializer.validated_data.get('doctor'):
            serializer.save(doctor=self.request.user)
        else:
            serializer.save()
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's appointments"""
        user = request.user
        today = date.today()
        
        queryset = Appointment.objects.filter(appointment_date=today)
        if user.is_doctor:
            queryset = queryset.filter(doctor=user)
        
        serializer = self.get_serializer(queryset.order_by('appointment_time'), many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update appointment status"""
        appointment = self.get_object()
        new_status = request.data.get('status')
        
        if new_status in [choice[0] for choice in Appointment.STATUS_CHOICES]:
            appointment.status = new_status
            appointment.save()
            serializer = self.get_serializer(appointment)
            return Response(serializer.data)
        
        return Response(
            {'error': 'Invalid status'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


class TreatmentCatalogViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing treatment catalog
    """
    queryset = TreatmentCatalog.objects.filter(is_active=True)
    serializer_class = TreatmentCatalogSerializer
    permission_classes = [IsAdminOrReadOnly]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__icontains=category)
        return queryset.order_by('category', 'name')


class TreatmentRecordViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing treatment records
    """
    serializer_class = TreatmentRecordSerializer
    permission_classes = [IsAdminOrDoctorOwner]
    
    def get_queryset(self):
        user = self.request.user
        queryset = TreatmentRecord.objects.all()
        
        if user.is_doctor:
            queryset = queryset.filter(doctor=user)
        
        # Filter by patient if provided
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date and end_date:
            queryset = queryset.filter(date_performed__range=[start_date, end_date])
        
        return queryset.order_by('-date_performed')
    
    def perform_create(self, serializer):
        # If doctor creates a treatment record, automatically assign them
        if self.request.user.is_doctor and not serializer.validated_data.get('doctor'):
            serializer.save(doctor=self.request.user)
        else:
            serializer.save()


class BillViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing bills
    """
    serializer_class = BillSerializer
    permission_classes = [IsAdminOrDoctor]
    
    def get_queryset(self):
        user = self.request.user
        queryset = Bill.objects.all()
        
        if user.is_doctor:
            # Doctors can only see bills for their patients
            queryset = queryset.filter(patient__assigned_doctor=user)
        
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-bill_date')
    
    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update bill status"""
        if not request.user.is_admin:
            return Response(
                {'error': 'Only admin can update bill status'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        bill = self.get_object()
        new_status = request.data.get('status')
        
        if new_status in [choice[0] for choice in Bill.STATUS_CHOICES]:
            bill.status = new_status
            bill.save()
            serializer = self.get_serializer(bill)
            return Response(serializer.data)
        
        return Response(
            {'error': 'Invalid status'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


class InventoryItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing inventory items (Admin only)
    """
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by category if provided
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter low stock items if requested
        low_stock = self.request.query_params.get('low_stock')
        if low_stock == 'true':
            queryset = queryset.filter(current_stock__lte=F('minimum_stock'))
        
        return queryset.order_by('category', 'name')
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get items with low stock"""
        low_stock_items = self.queryset.filter(
            current_stock__lte=F('minimum_stock')
        )
        serializer = self.get_serializer(low_stock_items, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def update_stock(self, request, pk=None):
        """Update inventory stock levels"""
        item = self.get_object()
        quantity = request.data.get('quantity')
        operation = request.data.get('operation', 'set')  # 'set', 'add', 'subtract'
        
        if quantity is not None:
            if operation == 'add':
                item.current_stock += int(quantity)
            elif operation == 'subtract':
                item.current_stock = max(0, item.current_stock - int(quantity))
            else:  # set
                item.current_stock = int(quantity)
            
            item.save()
            serializer = self.get_serializer(item)
            return Response(serializer.data)
        
        return Response(
            {'error': 'Quantity is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


class TreatmentInventoryUsageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing treatment inventory usage
    """
    serializer_class = TreatmentInventoryUsageSerializer
    permission_classes = [IsAdminOrDoctor]
    
    def get_queryset(self):
        user = self.request.user
        queryset = TreatmentInventoryUsage.objects.all()
        
        if user.is_doctor:
            queryset = queryset.filter(treatment_record__doctor=user)
        
        return queryset.order_by('-created_at')
