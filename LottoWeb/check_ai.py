import google.generativeai as genai
import os

# คีย์จากโค้ดของคุณ
KEY = "AIzaSyASs5RMbtlqnjsDojj9fClayNbX4qgQt0U" 
genai.configure(api_key=KEY)

print(f"Checking models with key: {KEY[:5]}...")
try:
    found = False
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"✅ ใช้ได้: {m.name}")
            found = True
    if not found:
        print("❌ ไม่พบโมเดลที่ใช้ generateContent ได้เลย (อาจเป็นที่ Key หรือ Library เก่ามาก)")
except Exception as e:
    print(f"❌ Error: {e}")