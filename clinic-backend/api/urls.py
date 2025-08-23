"""
API URL configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views.auth_views import LoginView, LogoutView, UserProfileView, current_user, register
from .views.core_views import (
    PatientViewSet, DoctorViewSet, AppointmentViewSet, TreatmentCatalogViewSet,
    TreatmentRecordViewSet, BillViewSet, InventoryItemViewSet, TreatmentInventoryUsageViewSet
)

# Create router for viewsets
router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'doctors', DoctorViewSet, basename='doctor')
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'treatments', TreatmentCatalogViewSet, basename='treatment')
router.register(r'treatment-records', TreatmentRecordViewSet, basename='treatment-record')
router.register(r'bills', BillViewSet, basename='bill')
router.register(r'inventory', InventoryItemViewSet, basename='inventory')
router.register(r'inventory-usage', TreatmentInventoryUsageViewSet, basename='inventory-usage')

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/register/', register, name='register'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/user/', current_user, name='current_user'),
    path('auth/profile/', UserProfileView.as_view(), name='user_profile'),
    
    # API routes
    path('', include(router.urls)),
]
