"""
URL configuration for clinic project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

def api_root(request):
    """API root endpoint with available endpoints"""
    return JsonResponse({
        'message': 'Dental Clinic Management System API',
        'version': 'v1.0.0',
        'endpoints': {
            'admin': '/admin/',
            'api': '/api/v1/',
            'documentation': '/swagger/',
            'redoc': '/redoc/',
        },
        'frontend': 'http://localhost:4200',
        'status': 'running'
    })

# API Documentation (Swagger)
schema_view = get_schema_view(
    openapi.Info(
        title="Dental Clinic Management API",
        default_version='v1',
        description="API for managing dental clinic operations",
        contact=openapi.Contact(email="admin@clinic.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.urls')),
    
    # API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]
