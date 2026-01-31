import requests
import threading
import random
import time

# ==========================================
# ⚙️ ตั้งค่า (Safe Mode สำหรับ Ngrok ฟรี)
# ==========================================
TARGET_URL = "https://sattarned.pythonanywhere.com/" # ⚠️ ใส่ Link Ngrok ของคุณ
TOTAL_USERS = 4        
ITEMS_PER_USER = 100   # ลดจำนวนลงหน่อย (เดี๋ยวยาวเกิน)
DELAY_MIN = 2.0        # ⚠️ รออย่างน้อย 2 วินาที (สำคัญมาก!)
DELAY_MAX = 5.0        # ⚠️ รอสูงสุด 5 วินาที
# ==========================================

def get_random_lotto_data(user_id):
    # (ฟังก์ชันสุ่มตัวเลขเหมือนเดิม)
    is_3_digit = random.choice([True, False])
    if is_3_digit:
        number = str(random.randint(0, 999)).zfill(3)
        top = random.choice([0, 20, 50, 100])
        toad = random.choice([0, 20, 50, 100])
        bottom = random.choice([0, 20, 50, 100])
        if top + toad + bottom == 0: top = 50 
    else:
        number = str(random.randint(0, 99)).zfill(2)
        top = random.choice([0, 20, 50, 100])
        bottom = random.choice([0, 20, 50, 100])
        toad = 0
        if top + bottom == 0: bottom = 50

    return {
        "mode": "normal",
        "buyer": f"Staff_Safe_{user_id}",
        "number": number,
        "top": top,
        "bottom": bottom,
        "toad": toad,
        "run_top": 0,
        "run_bottom": 0
    }

def simulate_user(user_id):
    print(f"👤 Staff {user_id}: เชื่อมต่อ...")
    session = requests.Session()
    session.headers.update({"ngrok-skip-browser-warning": "any_value"})

    # Login พร้อมระบบลองใหม่ (Retry)
    for _ in range(3):
        try:
            login_resp = session.post(f"{TARGET_URL}/login", data={'username': 'admin', 'password': '1234'}, timeout=10)
            if login_resp.status_code == 200 and "login" not in login_resp.url:
                print(f"✅ Staff {user_id}: Login ผ่าน!")
                break
        except:
            time.sleep(2)
    else:
        print(f"❌ Staff {user_id}: Login ไม่ได้ (ข้าม)")
        return

    success = 0
    fail = 0
    
    for i in range(ITEMS_PER_USER):
        payload = get_random_lotto_data(user_id)
        
        # วนลูปลองส่ง 3 ครั้ง ถ้า Error 429 (Too Many Requests)
        for attempt in range(3):
            try:
                resp = session.post(f"{TARGET_URL}/submit_all", json=payload, timeout=10)
                
                if resp.status_code == 200:
                    success += 1
                    break
                elif resp.status_code == 429: # โดน Ngrok บล็อกชั่วคราว
                    print(f"⚠️ Staff {user_id}: เร็วไป! ขอพัก 5 วิ...")
                    time.sleep(5) # พักยาวๆ
                elif resp.status_code == 502: # Server ล่ม
                    print(f"⚠️ Staff {user_id}: Server น็อก! รอ 2 วิ...")
                    time.sleep(2)
                else:
                    time.sleep(1)
            except:
                time.sleep(1)
        else:
            fail += 1

        # หน่วงเวลาหลังคีย์เสร็จ (สำคัญ)
        wait_time = random.uniform(DELAY_MIN, DELAY_MAX)
        time.sleep(wait_time)

    print(f"🏁 Staff {user_id}: จบงาน (✅{success} / ❌{fail})")

# --- เริ่มรัน ---
print(f"🚀 STARTING SAFE MODE STRESS TEST...")
threads = []
for i in range(1, TOTAL_USERS + 1):
    t = threading.Thread(target=simulate_user, args=(i,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()
print("DONE")