from django.contrib import admin
from django.urls import path
from django.views.generic import RedirectView

from app import views

urlpatterns = [
    path('admin/', admin.site.urls),

    path('', views.index, name='index'),

    # path('x', views.zero_tolerance, name='maximum-privacy'),
    # path('pv-x', RedirectView.as_view(url='/x', permanent=False)),
    # path('pv/x  ', RedirectView.as_view(url='/x', permanent=False)),
]
