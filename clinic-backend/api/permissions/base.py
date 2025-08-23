"""
Custom permission classes for role-based access control
"""
from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Custom permission to only allow admin users to access certain views.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_admin


class IsDoctorUser(permissions.BasePermission):
    """
    Custom permission to only allow doctor users to access certain views.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_doctor


class IsAdminOrDoctor(permissions.BasePermission):
    """
    Custom permission to allow both admin and doctor users.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_admin or request.user.is_doctor)
        )


class IsAdminOrDoctorOwner(permissions.BasePermission):
    """
    Custom permission to allow admin users full access, 
    but doctors can only access their own data.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_admin or request.user.is_doctor)
        )
    
    def has_object_permission(self, request, view, obj):
        # Admin users can access everything
        if request.user.is_admin:
            return True
        
        # Doctors can only access their own data
        if request.user.is_doctor:
            # For models that have a doctor field
            if hasattr(obj, 'doctor'):
                return obj.doctor == request.user
            # For models that have an assigned_doctor field (like Patient)
            elif hasattr(obj, 'assigned_doctor'):
                return obj.assigned_doctor == request.user
            # For user profile models
            elif hasattr(obj, 'user'):
                return obj.user == request.user
            # For user models themselves
            elif obj == request.user:
                return True
        
        return False


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to allow admin users full access,
    but others can only read.
    """
    def has_permission(self, request, view):
        # Read permissions for authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        # Write permissions only for admin users
        return request.user and request.user.is_authenticated and request.user.is_admin


class IsPatientOwnerOrAdminOrDoctor(permissions.BasePermission):
    """
    Custom permission for patient data:
    - Admin: full access
    - Doctor: access to assigned patients
    - Patient: access to own data (future enhancement)
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_admin or request.user.is_doctor)
        )
    
    def has_object_permission(self, request, view, obj):
        # Admin users can access everything
        if request.user.is_admin:
            return True
        
        # Doctors can only access their assigned patients
        if request.user.is_doctor:
            if hasattr(obj, 'assigned_doctor'):
                return obj.assigned_doctor == request.user
            # For appointment-related objects
            elif hasattr(obj, 'patient') and hasattr(obj.patient, 'assigned_doctor'):
                return obj.patient.assigned_doctor == request.user
        
        return False
