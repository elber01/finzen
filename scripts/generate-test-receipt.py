#!/usr/bin/env python3
"""Generate a test receipt image for OCR testing."""
from PIL import Image, ImageDraw, ImageFont
import os

# Create image
width, height = 400, 500
img = Image.new('RGB', (width, height), color='white')
draw = ImageDraw.Draw(img)

# Try to use a basic font
try:
    font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
    font_med = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
except:
    font_large = ImageFont.load_default()
    font_med = ImageFont.load_default()
    font_small = ImageFont.load_default()

y = 20

# Merchant name (large)
draw.text((width//2 - 80, y), "SUPERMERCADO", fill='black', font=font_large)
y += 28
draw.text((width//2 - 90, y), "NACIONAL SRL", fill='black', font=font_med)
y += 30

# Address
draw.text((60, y), "Av. Winston Churchill 109", fill='black', font=font_small)
y += 20
draw.text((80, y), "Santo Domingo, RD", fill='black', font=font_small)
y += 20
draw.text((90, y), "Tel: 809-555-1234", fill='black', font=font_small)
y += 25

# Separator
draw.line([(40, y), (width-40, y)], fill='black', width=1)
y += 15

# Date
draw.text((40, y), "Fecha: 26/06/2026", fill='black', font=font_small)
y += 20
draw.text((40, y), "Factura: B001-000123", fill='black', font=font_small)
y += 25

# Separator
draw.line([(40, y), (width-40, y)], fill='black', width=1)
y += 15

# Items header
draw.text((40, y), "Cant  Descripcion    Precio", fill='black', font=font_small)
y += 20

# Items
items = [
    ("2", "Arroz 5lb", "180.00"),
    ("1", "Pollo 1kg", "295.00"),
    ("3", "Platanos", "120.00"),
    ("1", "Aceite 1L", "165.00"),
    ("2", "Habichuelas", "140.00"),
]

for qty, desc, price in items:
    draw.text((40, y), qty, fill='black', font=font_small)
    draw.text((80, y), desc, fill='black', font=font_small)
    draw.text((width-110, y), price, fill='black', font=font_small)
    y += 20

# Separator
y += 5
draw.line([(40, y), (width-40, y)], fill='black', width=1)
y += 15

# Subtotal
draw.text((40, y), "Subtotal:", fill='black', font=font_small)
draw.text((width-130, y), "900.00", fill='black', font=font_small)
y += 22

# Tax (IVA)
draw.text((40, y), "IVA 18%:", fill='black', font=font_small)
draw.text((width-130, y), "162.00", fill='black', font=font_small)
y += 25

# Separator
draw.line([(40, y), (width-40, y)], fill='black', width=1)
y += 15

# Total (bold/large)
draw.text((40, y), "TOTAL A PAGAR:", fill='black', font=font_med)
draw.text((width-150, y), "RD$ 1,062.00", fill='black', font=font_med)
y += 30

# Payment
draw.text((40, y), "Pago: Tarjeta ****4521", fill='black', font=font_small)
y += 25

# Footer
draw.text((width//2 - 60, y), "GRACIAS POR SU COMPRA", fill='black', font=font_small)

# Save
output_path = '/home/z/my-project/download/test-receipt.png'
img.save(output_path)
print(f"Receipt saved to {output_path}")
print(f"Image size: {img.size}")
