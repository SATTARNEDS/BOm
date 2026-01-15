import sqlite3
import re
import os
import json
import time
import base64
from itertools import permutations
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, abort

# --- Library สำหรับ AI (Groq) ---
from groq import Groq

# --- LINE SDK V3 Imports ---
from linebot import WebhookHandler
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage, ImageMessage, TextSendMessage
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    MessagingApiBlob,
    ReplyMessageRequest,
    TextMessage as TextMessageV3,
    PushMessageRequest
)

app = Flask(__name__)
app.secret_key = 'SecretKeyForLottoSystem'
DB_NAME = "lotto_pro.db"

# =======================================================
# 🔑 ส่วนตั้งค่า KEY
# =======================================================
# Groq API Key
GROQ_API_KEY = "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" 

# Line Key
LINE_ACCESS_TOKEN = "yjtXvz17LZc7Ck6qs5y9Nw3vu72w6dzB5LSvH3sDVgr7RUIorw96if/53K3PDEShH72rwwyaIibv9cQ67RL5OnEWjocadYFNKEfpm3M6A2ZN4yON1+niNvx1zRSG+6EbQaWIxPU7i9HUbQW8+cfsPAdB04t89/1O/w1cDnyilFU="
LINE_CHANNEL_SECRET = "bb070c58a964ec0e803220902a4d1c32"
# =======================================================

# ตั้งค่า Client และ Handler
try:
    groq_client = Groq(api_key=GROQ_API_KEY)
    handler = WebhookHandler(LINE_CHANNEL_SECRET)
    configuration = Configuration(access_token=LINE_ACCESS_TOKEN)
except Exception as e:
    print(f"Warning: Configuration Error - {e}")

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute('''CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer_name TEXT, number TEXT, type TEXT, amount INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)")
    cursor.execute("INSERT OR IGNORE INTO users VALUES ('admin', '1234')")
    cursor.execute('''CREATE TABLE IF NOT EXISTS buyers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            discount INTEGER DEFAULT 0)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value INTEGER)''')
    conn.commit()
    conn.close()

init_db()

def check_auth(): return 'user' in session

# --- Helper Functions ---
def expand_numbers(number, mode):
    results = set()
    if mode in ['3_door', '6_door', 'return_all']: 
        perms = [''.join(p) for p in permutations(number)]
        results.update(perms)
    elif mode == '19_door':
        if len(number) == 1:
            for i in range(10): results.update([f"{number}{i}", f"{i}{number}"])
    elif mode == 'run_front':
        if len(number) == 1:
            for i in range(10): results.add(f"{number}{i}")
    elif mode == 'run_back':
        if len(number) == 1:
            for i in range(10): results.add(f"{i}{number}")
    else:
        results.add(number)
    return list(results)

def parse_quick_lotto(text):
    items = []
    # ล้างอักขระที่ไม่จำเป็น แปลงตัวแยกให้เป็นมาตรฐาน
    # หมายเหตุ: Prompt จะแปลง + หรือ x เป็น * มาให้แล้ว แต่เรากันเหนียวไว้ที่นี่ด้วย
    text = text.replace('=', ' ').replace('x', '*').replace('X', '*').replace('+', '*').replace('-', ' ')
    lines = re.split(r'[\n,]', text)
    
    for line in lines:
        line = line.strip()
        if not line: continue
        parts = line.split()
        if len(parts) < 2: continue
        
        price_part = parts[-1]
        number_parts = parts[:-1]
        
        # ตรวจสอบราคา (ต้องเป็นตัวเลข หรือมี *)
        if not re.match(r'^[\d\*]+$', price_part): continue 
        prices = price_part.split('*')
        
        for num in number_parts:
            # กรองเอาเฉพาะตัวเลขออกมา
            num = re.sub(r'\D', '', num)
            if not num: continue
            
            if len(num) == 3:
                if len(prices) >= 3: 
                    items.extend([{'num': num, 'type': '3 ตัวบน', 'amt': prices[0]}, 
                                  {'num': num, 'type': '3 ตัวโต๊ด', 'amt': prices[1]}, 
                                  {'num': num, 'type': '3 ตัวล่าง', 'amt': prices[2]}])
                elif len(prices) == 2: 
                    # ส่วนใหญ่ถ้ามา 2 ยอดของ 3 ตัว มักจะเป็น บน-โต๊ด (แต่ถ้าลูกค้าตั้งใจเป็น บน-ล่าง ต้องแก้ Logic นี้)
                    # ตาม Prompt: 521=20*20 -> บน*โต๊ด
                    items.extend([{'num': num, 'type': '3 ตัวบน', 'amt': prices[0]}, 
                                  {'num': num, 'type': '3 ตัวโต๊ด', 'amt': prices[1]}])
                elif len(prices) == 1: 
                    items.append({'num': num, 'type': '3 ตัวบน', 'amt': prices[0]})
            elif len(num) == 2:
                if len(prices) >= 2: 
                    items.append({'num': num, 'type': '2 ตัวบน', 'amt': prices[0]})
                    items.append({'num': num, 'type': '2 ตัวล่าง', 'amt': prices[1]})
                elif len(prices) == 1: 
                    items.append({'num': num, 'type': '2 ตัวบน', 'amt': prices[0]})
            elif len(num) == 1:
                if len(prices) >= 2: 
                    items.append({'num': num, 'type': 'วิ่งบน', 'amt': prices[0]})
                    items.append({'num': num, 'type': 'วิ่งล่าง', 'amt': prices[1]})
                elif len(prices) == 1:
                    items.append({'num': num, 'type': 'วิ่งบน', 'amt': prices[0]})

    return [x for x in items if int(x['amt']) > 0]

# --- ฟังก์ชันเรียก Groq AI (Vision) ---
def call_groq_vision(image_bytes):
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    
    # ✅ ใช้โมเดล 90b Preview (ดีที่สุดสำหรับ Vision ตอนนี้)
    model_name = "meta-llama/llama-4-scout-17b-16e-instruct" 
    
    # ✅ PROMPT: ปรับแต่งให้รองรับรูปแบบ +, x และตัดคำฟุ่มเฟือย
    prompt = """
    Role: Expert Thai Lottery OCR.
    Task: Extract numbers and prices from the image strictly for machine processing.

    Rules for Extraction:
    1.  **Standardize Separators:**
        - The input may use '+', 'x', 'X', '=', or spaces.
        - **CONVERT ALL separators to Asterisk (*).**
        - Example: "521=20+20"  MUST become "521=20*20"
        - Example: "286=100x100" MUST become "286=100*100"
    
    2.  **Format Structure (Number=Price...):**
        - 3 Digits: Number=Top*Toad*Bottom (or Number=Top*Toad)
        - 2 Digits: Number=Top*Bottom
        - 1 Digit:  Number=Top*Bottom

    3.  **Clean Noise:**
        - **IGNORE** headers like "บ.ล", "บน", "ล่าง".
        - **IGNORE** names, nicknames, or emojis (e.g., 🇹🇭, P เม่น, ไตรพิชิต).
        - Convert Thai numerals (๐-๙) to Arabic (0-9).

    4.  **Output:** - Return ONLY the formatted data lines. No other text.
    """

    try:
        completion = groq_client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            },
                        },
                    ],
                }
            ],
            temperature=0.0,
            max_tokens=1024,
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"Groq API Error: {e}")
        return f"Error: {e}"

# --- LINE BOT Routes ---
@app.route("/callback", methods=['POST'])
def callback():
    signature = request.headers['X-Line-Signature']
    body = request.get_data(as_text=True)
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        abort(400)
    return 'OK'

@handler.add(MessageEvent, message=ImageMessage)
def handle_image_message(event):
    try:
        with ApiClient(configuration) as api_client:
            line_bot_api_v3 = MessagingApi(api_client)
            line_bot_blob_api_v3 = MessagingApiBlob(api_client)

            try:
                profile = line_bot_api_v3.get_profile(event.source.user_id)
                buyer_name = profile.display_name
            except:
                buyer_name = "LINE User"

            # 1. รับรูป
            message_content = line_bot_blob_api_v3.get_message_content(event.message.id)
            img_data = message_content

            # แจ้งลูกค้าว่ากำลังทำงาน
            line_bot_api_v3.reply_message(
                ReplyMessageRequest(
                    reply_token=event.reply_token,
                    messages=[TextMessageV3(text="🔍 กำลังแกะลายมือ... (รองรับ +, x, บ.ล)")]
                )
            )

            # 2. ส่งให้ AI อ่าน
            try:
                text_result = call_groq_vision(img_data)
                print(f"AI Result: {text_result}")
                
                if "Error:" in text_result:
                    line_bot_api_v3.push_message(
                        PushMessageRequest(
                            to=event.source.user_id,
                            messages=[TextMessageV3(text=f"❌ AI ขัดข้อง: {text_result}")]
                        )
                    )
                    return

            except Exception as e:
                print(e)
                return
            
            # 3. แปลงและบันทึก
            items = parse_quick_lotto(text_result)
            
            if not items:
                line_bot_api_v3.push_message(
                    PushMessageRequest(
                        to=event.source.user_id,
                        messages=[TextMessageV3(text="❌ อ่านตัวเลขไม่ได้ครับ ลองเขียนให้ชัดขึ้นอีกนิดนะครับ")]
                    )
                )
                return

            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            try: cursor.execute("INSERT OR IGNORE INTO buyers (name, discount) VALUES (?, 0)", (buyer_name,))
            except: pass
            
            saved_count = 0
            current_time = (datetime.utcnow() + timedelta(hours=7)).strftime('%Y-%m-%d %H:%M:%S')
            msg_summary = f"👤 {buyer_name}\n"
            
            for item in items:
                cursor.execute("INSERT INTO transactions (buyer_name, number, type, amount, created_at) VALUES (?,?,?,?,?)", 
                                (buyer_name, item['num'], item['type'], item['amt'], current_time))
                saved_count += 1
                msg_summary += f"{item['num']} ({item['type']}) = {item['amt']}\n"
                
            conn.commit()
            conn.close()
            
            msg_summary += f"\n✅ บันทึกสำเร็จ {saved_count} รายการ"
            
            line_bot_api_v3.push_message(
                PushMessageRequest(
                    to=event.source.user_id,
                    messages=[TextMessageV3(text=msg_summary)]
                )
            )

    except Exception as e:
        print(f"System Error: {e}")

# --- WEB Routes ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.form['username'] == 'admin' and request.form['password'] == '1234':
            session['user'] = 'admin'
            return redirect(url_for('home'))
        return render_template('login.html', error="รหัสผิด")
    return render_template('login.html')

@app.route('/logout')
def logout(): session.pop('user', None); return redirect(url_for('login'))

@app.route('/')
def home():
    if not check_auth(): return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/submit_all', methods=['POST'])
def submit_all():
    if not check_auth(): return jsonify({"status": "error"})
    data = request.json
    buyer = data.get('buyer', 'ลูกค้าทั่วไป')
    mode = data.get('mode') 
    items_to_save = []
    
    current_time = (datetime.utcnow() + timedelta(hours=7)).strftime('%Y-%m-%d %H:%M:%S')

    if mode == 'normal':
        number = data.get('number')
        amt_top = int(data.get('top') or 0)
        amt_bottom = int(data.get('bottom') or 0)
        amt_toad = int(data.get('toad') or 0)
        amt_run_top = int(data.get('run_top') or 0)
        amt_run_bottom = int(data.get('run_bottom') or 0)
        if len(number) == 3:
            if amt_top > 0: items_to_save.append({'num': number, 'type': '3 ตัวบน', 'amt': amt_top})
            if amt_bottom > 0: items_to_save.append({'num': number, 'type': '3 ตัวล่าง', 'amt': amt_bottom})
            if amt_toad > 0: items_to_save.append({'num': number, 'type': '3 ตัวโต๊ด', 'amt': amt_toad})
        elif len(number) == 2:
            if amt_top > 0: items_to_save.append({'num': number, 'type': '2 ตัวบน', 'amt': amt_top})
            if amt_bottom > 0: items_to_save.append({'num': number, 'type': '2 ตัวล่าง', 'amt': amt_bottom})
            if amt_toad > 0 and number[0] != number[1]:
                rev_num = number[::-1]
                if amt_top > 0: items_to_save.append({'num': rev_num, 'type': '2 ตัวบน', 'amt': amt_toad})
                if amt_bottom > 0: items_to_save.append({'num': rev_num, 'type': '2 ตัวล่าง', 'amt': amt_toad})
        elif len(number) == 1:
            if amt_run_top > 0: items_to_save.append({'num': number, 'type': 'วิ่งบน', 'amt': amt_run_top})
            if amt_run_bottom > 0: items_to_save.append({'num': number, 'type': 'วิ่งล่าง', 'amt': amt_run_bottom})

    elif mode == 'special':
        base_num = data.get('number')
        spec_type = data.get('spec_type')
        is_top = data.get('check_top')
        is_bottom = data.get('check_bottom')
        is_toad = data.get('check_toad')
        amt = int(data.get('amount') or 0)
        
        if amt > 0:
            expanded_nums = expand_numbers(base_num, spec_type)
            for num in expanded_nums:
                if len(num) == 3:
                    if is_top: items_to_save.append({'num': num, 'type': '3 ตัวบน', 'amt': amt})
                    if is_toad: items_to_save.append({'num': num, 'type': '3 ตัวโต๊ด', 'amt': amt})
                    if is_bottom: items_to_save.append({'num': num, 'type': '3 ตัวล่าง', 'amt': amt})
                elif len(num) == 2:
                    if is_top: items_to_save.append({'num': num, 'type': '2 ตัวบน', 'amt': amt})
                    if is_bottom: items_to_save.append({'num': num, 'type': '2 ตัวล่าง', 'amt': amt})
                elif len(num) == 1:
                    if is_top: items_to_save.append({'num': num, 'type': 'วิ่งบน', 'amt': amt})
                    if is_bottom: items_to_save.append({'num': num, 'type': 'วิ่งล่าง', 'amt': amt})

    elif mode == 'quick':
        items_to_save.extend(parse_quick_lotto(data.get('quick_text')))

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try: cursor.execute("INSERT OR IGNORE INTO buyers (name, discount) VALUES (?, 0)", (buyer,))
    except: pass
    count = 0
    for item in items_to_save:
        cursor.execute("INSERT INTO transactions (buyer_name, number, type, amount, created_at) VALUES (?,?,?,?,?)", 
                        (buyer, item['num'], item['type'], item['amt'], current_time))
        count += 1
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"บันทึก {count} รายการ"})

# --- Reporting APIs ---
@app.route('/api/report_full')
def api_report_full():
    if not check_auth(): return jsonify({})
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT key, value FROM settings")
    settings = dict(cursor.fetchall())
    
    cursor.execute("SELECT type, number, SUM(amount) as total FROM transactions GROUP BY type, number ORDER BY number")
    rows = cursor.fetchall()
    
    data_3 = {}
    data_others = {
        '2_top': [], '2_bottom': [], 'run_top': [], 'run_bottom': [],
        'summary': {'2_top':0, '2_bottom':0, '3_top':0, '3_toad':0, '3_bottom':0, 'run_top':0, 'run_bottom':0, 'total':0}
    }
    
    map_limit = {
        '3 ตัวบน': 'limit_3top',
        '3 ตัวล่าง': 'limit_3bottom',
        '3 ตัวโต๊ด': 'limit_3toad',
        '2 ตัวบน': 'limit_2top',
        '2 ตัวล่าง': 'limit_2bottom',
        'วิ่งบน': 'limit_run_top', 
        'วิ่งล่าง': 'limit_run_bottom'
    }
    
    def calc_cut(ttype, total):
        try:
            key = map_limit.get(ttype)
            limit_val = settings.get(key, 0)
            limit = int(limit_val) if limit_val is not None else 0
        except:
            limit = 0
            
        if limit == 0: limit = 999999999
        return {'total': total, 'keep': min(total, limit), 'send': max(0, total - limit)}

    for r in rows:
        ttype, num = r['type'], r['number']
        try: total = int(r['total'])
        except: total = 0
            
        ks = {'2 ตัวบน':'2_top','2 ตัวล่าง':'2_bottom','3 ตัวบน':'3_top','3 ตัวโต๊ด':'3_toad','3 ตัวล่าง':'3_bottom','วิ่งบน':'run_top','วิ่งล่าง':'run_bottom'}.get(ttype)
        
        if ks: 
            data_others['summary'][ks] += total
            data_others['summary']['total'] += total

        if len(num) == 3:
            if num not in data_3: data_3[num] = {'top': {'total':0,'keep':0,'send':0}, 'toad': {'total':0,'keep':0,'send':0}, 'bottom': {'total':0,'keep':0,'send':0}}
            res = calc_cut(ttype, total)
            if ttype == '3 ตัวบน': data_3[num]['top'] = res
            elif ttype == '3 ตัวโต๊ด': data_3[num]['toad'] = res
            elif ttype == '3 ตัวล่าง': data_3[num]['bottom'] = res
        else:
            res = calc_cut(ttype, total)
            item = {'num': num, **res}
            if ttype == '2 ตัวบน': data_others['2_top'].append(item)
            elif ttype == '2 ตัวล่าง': data_others['2_bottom'].append(item)
            elif ttype == 'วิ่งบน': data_others['run_top'].append(item)
            elif ttype == 'วิ่งล่าง': data_others['run_bottom'].append(item)

    list_3 = []
    for num, vals in data_3.items():
        list_3.append({'num': num, 'top': vals['top'], 'toad': vals['toad'], 'bottom': vals['bottom']})
    
    conn.close()
    return jsonify({'3_digit': list_3, **data_others})

@app.route('/api/ocr_scan', methods=['POST'])
def api_ocr_scan():
    if 'image' not in request.files: return jsonify({"status": "error", "message": "No file"})
    file = request.files['image']
    if file.filename == '': return jsonify({"status": "error", "message": "No selected file"})
    try:
        # ใช้ Logic เดียวกันกับ Line
        text_result = call_groq_vision(file.read())
        return jsonify({"status": "success", "text": text_result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/api/transactions')
def api_all_transactions():
    conn = sqlite3.connect(DB_NAME)
    r = conn.cursor().execute("SELECT id, strftime('%H:%M:%S', created_at) as time, buyer_name, number, type, amount FROM transactions ORDER BY id DESC LIMIT 500").fetchall()
    conn.close()
    return jsonify([{'id':i[0],'time':i[1],'buyer':i[2],'num':i[3],'type':i[4],'amt':i[5]} for i in r])

@app.route('/api/recent')
def api_recent():
    conn = sqlite3.connect(DB_NAME)
    r = conn.cursor().execute("SELECT id, strftime('%H:%M', created_at) as time, buyer_name, number, type, amount FROM transactions ORDER BY id DESC LIMIT 20").fetchall()
    conn.close()
    return jsonify([{'id':i[0],'time':i[1],'buyer':i[2],'num':i[3],'type':i[4],'amt':i[5]} for i in r])

@app.route('/delete/<int:id>', methods=['POST'])
def delete_item(id):
    conn = sqlite3.connect(DB_NAME); conn.cursor().execute("DELETE FROM transactions WHERE id=?",(id,)); conn.commit(); conn.close()
    return jsonify({"status":"success"})

@app.route('/delete_multiple', methods=['POST'])
def delete_multiple():
    ids = request.json.get('ids', [])
    if not ids: return jsonify({"status":"error"})
    conn = sqlite3.connect(DB_NAME)
    conn.cursor().execute(f"DELETE FROM transactions WHERE id IN ({','.join('?'*len(ids))})", ids)
    conn.commit(); conn.close()
    return jsonify({"status":"success"})

@app.route('/api/buyers', methods=['GET','POST','PUT'])
def api_buyers():
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row; cur = conn.cursor()
    if request.method == 'POST': 
        try: cur.execute("INSERT INTO buyers (name, discount) VALUES (?, ?)", (request.json['name'], request.json.get('discount',0))); conn.commit(); return jsonify({"status": "success"})
        except: return jsonify({"status": "error", "message": "ชื่อซ้ำ"})
    elif request.method == 'PUT':
        d = request.json; cur.execute("UPDATE buyers SET name=?, discount=? WHERE id=?", (d['name'], d['discount'], d['id'])); conn.commit(); return jsonify({"status": "success"})
    cur.execute("SELECT b.id, b.name, b.discount, IFNULL(SUM(t.amount),0) as total FROM buyers b LEFT JOIN transactions t ON b.name = t.buyer_name GROUP BY b.id")
    res = []
    for r in cur.fetchall():
        disc_amt = r['total']*r['discount']/100
        res.append({'id':r['id'], 'name':r['name'], 'discount':r['discount'], 'total':r['total'], 'disc_amt':disc_amt, 'net':r['total']-disc_amt})
    conn.close(); return jsonify(res)

@app.route('/api/buyer_details/<path:name>')
def buyer_details(name):
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row
    r = conn.cursor().execute("SELECT * FROM transactions WHERE buyer_name=? ORDER BY id DESC", (name,)).fetchall()
    conn.close(); return jsonify([dict(x) for x in r])

@app.route('/api/settings', methods=['GET','POST'])
def api_settings():
    conn = sqlite3.connect(DB_NAME)
    if request.method=='POST':
        for k,v in request.json.items(): conn.cursor().execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (k,v))
        conn.commit()
    r = dict(conn.cursor().execute("SELECT key, value FROM settings").fetchall())
    conn.close(); return jsonify(r)

@app.route('/check_reward', methods=['POST'])
def check_reward():
    d = request.json; top3=d.get('top3',''); bot2=d.get('bottom2','')
    conn = sqlite3.connect(DB_NAME); conn.row_factory = sqlite3.Row
    rows = conn.cursor().execute("SELECT * FROM transactions").fetchall(); conn.close()
    winners = []; total = 0
    payout = {'3 ตัวบน':900, '3 ตัวโต๊ด':150, '2 ตัวล่าง':90, '2 ตัวบน':90, 'วิ่งบน':3.2, 'วิ่งล่าง':4.2}
    def is_toad(n1, n2): return sorted(n1)==sorted(n2) if len(n2)==3 else False
    for r in rows:
        prize=0; t=r['type']; n=r['number']; a=r['amount']
        if t=='3 ตัวบน' and n==top3: prize=a*payout['3 ตัวบน']
        elif t=='3 ตัวโต๊ด' and is_toad(n, top3): prize=a*payout['3 ตัวโต๊ด']
        elif t=='2 ตัวล่าง' and n==bot2: prize=a*payout['2 ตัวล่าง']
        elif t=='2 ตัวบน' and n==top3[-2:]: prize=a*payout['2 ตัวบน']
        if prize>0: total+=prize; winners.append({'buyer':r['buyer_name'], 'num':n, 'type':t, 'amt':a, 'prize':prize})
    return jsonify({'total':total, 'winners':winners})

@app.route('/clear_data', methods=['POST'])
def clear_data():
    conn = sqlite3.connect(DB_NAME); conn.cursor().execute("DELETE FROM transactions"); conn.commit(); conn.close()
    return jsonify({"status":"success"})

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')