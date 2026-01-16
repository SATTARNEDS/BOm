let reportData = {};
let currentPopupType = 'keep';
let currentDashTab = {k1:'2_top', k2:'2_bottom', t1:'สองตัวบน', t2:'สองตัวล่าง'};

window.onload = function() {
    navTo('dashboard'); 
    document.addEventListener('keydown', e => { 
        if(e.key === 'Enter') {
            const act = document.querySelector('.tab-pane.active');
            if(act && act.id==='kp-normal') sendNormal();
            if(act && act.id==='kp-special') sendSpecial();
        }
    });
}

function navTo(id) {
    document.querySelectorAll('.page-section').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(e => e.classList.remove('active'));
    document.getElementById('sec-'+id).classList.add('active');
    const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick').includes(id));
    if(btn) btn.classList.add('active');

    if(id === 'dashboard') loadReport();
    if(id === 'keypad') { loadRecent(); loadBuyers(); }
    if(id === 'buyers') loadBuyers();
    if(id === 'settings') loadSettings();
}

function syncData() { 
    loadRecent(); // สั่งโหลดแค่ "ตารางล่าสุด" ให้คนคีย์เห็นก็พอ
}

function loadReport() {
    fetch('/api/report_full').then(r=>r.json()).then(d => {
        reportData = d;
        if(document.getElementById('sec-dashboard').classList.contains('active')) updateDashboardUI();
    });
}

function updateDashboardUI() {
    if(!reportData.summary) return;
    const s = reportData.summary;
    document.getElementById('dash-summary-row').innerHTML = `
        <td>${s['2_top'].toLocaleString()}</td><td>${s['2_bottom'].toLocaleString()}</td>
        <td>${s['run_top'].toLocaleString()}</td><td>${s['run_bottom'].toLocaleString()}</td>
        <td>${s['3_top'].toLocaleString()}</td><td>${s['3_bottom'].toLocaleString()}</td><td>${s['3_toad'].toLocaleString()}</td>
    `;
    document.getElementById('dash-total-sum').innerText = s.total.toLocaleString();
    
    const activeLink = document.querySelector('#dashTabs .nav-link.active');
    if(activeLink) {
        const txt = activeLink.innerText;
        if(txt.includes('2')) renderTab('2digit');
        else if(txt.includes('3')) renderTab('3digit');
        else renderTab('running');
    } else {
        renderTab('3digit');
    }
}

function renderTab(type) {
    document.querySelectorAll('#dashTabs .nav-link').forEach(b => b.classList.remove('active'));
    if(event) event.target.classList.add('active'); 
    
    const container = document.getElementById('dash-content');
    if (type === '3digit') container.innerHTML = generate3DigitGrid('total');
    else if (type === '2digit') container.innerHTML = `<div class="row"><div class="col-6">${buildTable('สองตัวบน', reportData['2_top'], 'total')}</div><div class="col-6">${buildTable('สองตัวล่าง', reportData['2_bottom'], 'total')}</div></div>`;
    else if (type === 'running') container.innerHTML = `<div class="row"><div class="col-6">${buildTable('วิ่งบน', reportData['run_top'], 'total')}</div><div class="col-6">${buildTable('วิ่งล่าง', reportData['run_bottom'], 'total')}</div></div>`;
}

// --- GRID & TABLES ---
function generate3DigitGrid(vType) {
    const data = reportData['3_digit'] || [];
    const buckets = Array.from({length: 10}, () => []);
    data.forEach(item => {
        const digit = parseInt(item.num.charAt(0));
        if(item.top[vType]>0 || item.toad[vType]>0) buckets[digit].push(item);
    });
    let html = '<div class="grid-3-container">';
    for(let i=0; i<10; i++) {
        buckets[i].sort((a,b)=>a.num.localeCompare(b.num));
        let itemsHtml = '';
        buckets[i].forEach(x => {
            let s = `${x.top[vType].toLocaleString()}${x.toad[vType]>0 ? '*'+x.toad[vType].toLocaleString() : ''}`;
            itemsHtml += `<div class="digit-item"><span class="num">${x.num}</span> <span class="val">${s}</span></div>`;
        });
        html += `<div class="digit-box"><div class="digit-header">${i}00 - ${i}99</div><div class="digit-list">${itemsHtml}</div></div>`;
    }
    html += '</div>';
    let botRows = '';
    data.forEach(item => { if(item.bottom[vType]>0) botRows += `<tr><td>${item.num}</td><td>${item.bottom[vType].toLocaleString()}</td></tr>`; });
    if(botRows) html += `<div class="mt-4 row justify-content-center"><div class="col-md-6"><div class="card-header-blue rounded-top">3 ตัวล่าง</div><table class="table table-bordered table-striped text-center"><thead><tr><th>เลข</th><th>เงิน</th></tr></thead><tbody>${botRows}</tbody></table></div></div>`;
    return html;
}

function buildTable(title, list, vType) {
    let rows = '', sum = 0;
    (list || []).sort((a,b) => a.num.localeCompare(b.num)).forEach(i => {
        let val = i[vType];
        if (val > 0) { sum+=val; rows+=`<tr><td class="fw-bold text-primary fs-5">${i.num}</td><td>${val.toLocaleString()}</td></tr>`; }
    });
    let headClass = title.includes('ล่าง') ? 'card-header-blue' : 'card-header-green';
    return `<div class="${headClass} rounded-top">${title}</div><table class="table table-bordered table-striped mb-0 text-center"><thead><tr><th>เลข</th><th>เงิน</th></tr></thead><tbody>${rows||'<tr><td colspan=2 class="text-muted">ไม่มีข้อมูล</td></tr>'}</tbody><tfoot class="table-light fw-bold"><tr><td>รวม</td><td>${sum.toLocaleString()}</td></tr></tfoot></table>`;
}

// --- POPUP ---
function openPopupReport(type) {
    currentPopupType = type;
    const h = document.getElementById('popupHeader');
    const t = document.getElementById('popupTitle');
    if(type==='keep') { h.className='modal-header bg-success text-white'; t.innerHTML='<i class="fas fa-save"></i> รายการตัดเก็บ'; }
    else { h.className='modal-header bg-danger text-white'; t.innerHTML='<i class="fas fa-paper-plane"></i> รายการตัดส่ง'; }
    renderPopup('3digit');
    new bootstrap.Modal(document.getElementById('reportPopupModal')).show();
}
function renderPopup(type) {
    document.querySelectorAll('#popupTabs .nav-link').forEach(b => b.classList.remove('active'));
    if(event) event.target.classList.add('active'); else document.querySelector('#popupTabs .nav-link').classList.add('active');
    const container = document.getElementById('popupContent');
    if(type === '3digit') container.innerHTML = generate3DigitGrid(currentPopupType);
    else if(type === '2digit') container.innerHTML = `<div class="row"><div class="col-6">${buildTable('2 บน', reportData['2_top'], currentPopupType)}</div><div class="col-6">${buildTable('2 ล่าง', reportData['2_bottom'], currentPopupType)}</div></div>`;
    else if(type === 'running') container.innerHTML = `<div class="row"><div class="col-6">${buildTable('วิ่งบน', reportData['run_top'], currentPopupType)}</div><div class="col-6">${buildTable('วิ่งล่าง', reportData['run_bottom'], currentPopupType)}</div></div>`;
}

// --- KEYPAD LOGIC ---
function validateNum(e) { e.value=e.value.replace(/[^0-9]/g,''); }
function sendData(p) { fetch('/submit_all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).then(r=>r.json()).then(d=>{if(d.status==='success'){ syncData(); document.getElementById('n_num').value=''; document.getElementById('s_num').value=''; document.getElementById('q_text').value=''; if(p.mode==='normal')document.getElementById('n_num').focus(); if(p.mode==='special')document.getElementById('s_num').focus(); }}); }
function sendNormal() { const p={mode:'normal',buyer:val('k_buyer'),number:val('n_num'),top:val('n_top'),bottom:val('n_bot'),toad:val('n_toad'),run_top:val('n_rtop'),run_bottom:val('n_rbot')}; if(p.number) sendData(p); }
function sendSpecial() { const p={mode:'special',buyer:val('k_buyer'),number:val('s_num'),amount:val('s_amt'),spec_type:val('s_type'),check_top:document.getElementById('s_chk_top').checked,check_bottom:document.getElementById('s_chk_bot').checked,check_toad:document.getElementById('s_chk_toad').checked}; if(p.number) sendData(p); }
function sendQuick() { sendData({mode:'quick',buyer:val('k_buyer'),quick_text:val('q_text')}); }
function val(id) { const el=document.getElementById(id); return el?el.value:''; }

// --- RECENT & VIEW ALL ---
function loadRecent() { fetch('/api/recent').then(r=>r.json()).then(d=>{ renderRecent(d, 'recentBody'); }); }
function openViewAll() { fetch('/api/transactions').then(r=>r.json()).then(d=>{ renderRecent(d, 'viewAllBody', true); new bootstrap.Modal(document.getElementById('viewAllModal')).show(); }); }
function renderRecent(d, id, isModal=false) {
    let h='', cls=isModal?'del-chk-modal':'del-chk';
    d.forEach(i=>{
        let c=i.type.includes('บน')?'text-primary':(i.type.includes('ล่าง')?'text-success':'text-warning');
        h+=`<tr><td><input type="checkbox" class="form-check-input ${cls}" value="${i.id}"></td><td class="text-muted small">${i.time}</td><td>${i.buyer}</td><td class="fw-bold fs-5">${i.num}</td><td><span class="badge bg-light border ${c} text-dark">${i.type}</span></td><td class="fw-bold text-end">${i.amt.toLocaleString()}</td><td><button onclick="delItem(${i.id})" class="btn btn-sm btn-outline-danger border-0"><i class="fas fa-times"></i></button></td></tr>`;
    });
    document.getElementById(id).innerHTML=h;
}
function delItem(id) { if(confirm('ลบรายการนี้?')) fetch('/delete/'+id,{method:'POST'}).then(syncData); }
function deleteSelected() { const ids=Array.from(document.querySelectorAll('.del-chk:checked')).map(c=>parseInt(c.value)); if(ids.length) fetch('/delete_multiple',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})}).then(syncData); }
function deleteFromModal() { const ids=Array.from(document.querySelectorAll('.del-chk-modal:checked')).map(c=>parseInt(c.value)); if(ids.length && confirm(`ลบ ${ids.length} รายการ?`)) fetch('/delete_multiple',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})}).then(()=>{ syncData(); openViewAll(); }); }
function toggleAll(e) { document.querySelectorAll('.del-chk').forEach(c=>c.checked=e.checked); }
function toggleAllModal(e) { document.querySelectorAll('.del-chk-modal').forEach(c=>c.checked=e.checked); }

// --- BUYERS ---
function loadBuyers() {
    fetch('/api/buyers').then(r=>r.json()).then(d=>{
        const s=document.getElementById('k_buyer'); 
        if(s.options.length!==d.length){ s.innerHTML=''; d.forEach(b=>s.add(new Option(b.name,b.name))); if(d.length) s.value=d[0].name; }
        let h=''; 
        d.forEach(b=>{ 
            h+=`<tr>
                <td class="fw-bold text-start ps-3 text-primary">${b.name}</td>
                <td>${b.total.toLocaleString()}</td>
                <td>${b.discount}%</td>
                <td class="text-danger fw-bold">-${b.disc_amt.toLocaleString()}</td>
                <td class="fw-bold text-success fs-5">${b.net.toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-warning me-1 shadow-sm" onclick="editBuyer(${b.id},'${b.name}',${b.discount})"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-sm btn-info text-white me-1 shadow-sm" onclick="viewBuy('${b.name}')"><i class="fas fa-list"></i></button>
                    <button class="btn btn-sm btn-danger shadow-sm" onclick="deleteBuyer(${b.id},'${b.name}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`; 
        });
        document.getElementById('buyerBody').innerHTML=h;
    });
}
function addBuyer() { document.getElementById('manageBuyerTitle').innerText="เพิ่มผู้ซื้อ"; document.getElementById('mb_id').value=""; document.getElementById('mb_name').value=""; document.getElementById('mb_discount').value="0"; new bootstrap.Modal(document.getElementById('manageBuyerModal')).show(); }
function deleteBuyer(id, name) {
    if(confirm('⚠️ คำเตือน: คุณต้องการลบ "' + name + '" ใช่หรือไม่?\n\n‼️ ยอดซื้อและรายการทั้งหมดของคนนี้จะถูกลบหายไปทันที และกู้คืนไม่ได้')) {
        fetch('/delete_buyer/' + id, { method: 'POST' })
            .then(r => r.json())
            .then(d => {
                if(d.status === 'success') {
                    // โหลดตารางรายชื่อใหม่
                    loadBuyers(); 
                    // โหลดรายการล่าสุด และยอดรวม Dashboard ใหม่ด้วย เพราะยอดหายไปแล้ว
                    loadRecent();
                    loadReport(); 
                } else {
                    alert('เกิดข้อผิดพลาด ไม่พบข้อมูลผู้ใช้งาน');
                }
            });
    }
}
function editBuyer(id,n,d) { document.getElementById('manageBuyerTitle').innerText="แก้ไขข้อมูล"; document.getElementById('mb_id').value=id; document.getElementById('mb_name').value=n; document.getElementById('mb_discount').value=d; new bootstrap.Modal(document.getElementById('manageBuyerModal')).show(); }
function saveBuyerData() {
    const id=document.getElementById('mb_id').value, name=document.getElementById('mb_name').value, discount=document.getElementById('mb_discount').value;
    if(!name) return alert('กรุณาใส่ชื่อ');
    fetch('/api/buyers', { method:id?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,name,discount}) }).then(r=>r.json()).then(d=>{ if(d.status==='success'){ bootstrap.Modal.getInstance(document.getElementById('manageBuyerModal')).hide(); loadBuyers(); } else alert(d.message); });
}

// -------------------------------------------------------------------------
// ✅ ส่วนที่คงเดิม: ดูประวัติ 00-99 (เรียงเลข) และ 3 ตัว
// -------------------------------------------------------------------------
function viewBuy(n) { 
    document.getElementById('modalTitle').innerText = 'สรุปยอดซื้อ: ' + n; 
    fetch('/api/buyer_details/' + encodeURIComponent(n))
    .then(r => r.json())
    .then(d => { 
        let html = '<div class="container-fluid p-2">';

        // --- ส่วน 2 ตัว (00-99) ---
        html += '<div class="card mb-3 border-0 shadow-sm">';
        html += '<div class="card-header bg-primary text-white fw-bold"><i class="fas fa-list-ol me-2"></i> สรุป 2 ตัว (00-99)</div>';
        html += '<div class="card-body p-0">';
        html += '<div class="table-responsive" style="max-height: 50vh;">';
        html += '<table class="table table-bordered table-sm text-center table-striped table-hover mb-0 align-middle">';
        html += '<thead class="table-dark sticky-top" style="z-index:10;"><tr><th width="20%">เลข</th><th width="40%">บน</th><th width="40%">ล่าง</th></tr></thead><tbody>';
        
        d.two_digit.forEach(i => {
            let cTop = i.top > 0 ? 'fw-bold text-primary fs-5' : 'text-muted opacity-25';
            let cBot = i.bottom > 0 ? 'fw-bold text-success fs-5' : 'text-muted opacity-25';
            let bgRow = (i.top > 0 || i.bottom > 0) ? 'bg-white' : ''; 
            
            html += `<tr class="${bgRow}">
                <td class="fw-bold bg-light font-monospace">${i.num}</td>
                <td class="${cTop}">${i.top > 0 ? i.top.toLocaleString() : '0'}</td>
                <td class="${cBot}">${i.bottom > 0 ? i.bottom.toLocaleString() : '0'}</td>
            </tr>`;
        });
        html += '</tbody></table></div></div></div>';

        // --- ส่วน 3 ตัว ---
        if(d.three_digit.length > 0) {
            html += '<div class="card mb-3 border-0 shadow-sm">';
            html += '<div class="card-header bg-success text-white fw-bold"><i class="fas fa-cubes me-2"></i> สรุป 3 ตัว</div>';
            html += '<div class="card-body p-0">';
            html += '<div class="table-responsive">';
            html += '<table class="table table-bordered table-sm text-center table-striped mb-0 align-middle">';
            html += '<thead class="table-dark"><tr><th>เลข</th><th>บน</th><th>โต๊ด</th><th>ล่าง</th></tr></thead><tbody>';
            d.three_digit.forEach(i => {
                html += `<tr>
                    <td class="fw-bold font-monospace fs-5">${i.num}</td>
                    <td class="${i.top>0 ? 'text-primary fw-bold': 'text-muted opacity-25'}">${i.top>0 ? i.top.toLocaleString() : '0'}</td>
                    <td class="${i.toad>0 ? 'text-warning fw-bold': 'text-muted opacity-25'}">${i.toad>0 ? i.toad.toLocaleString() : '0'}</td>
                    <td class="${i.bottom>0 ? 'text-success fw-bold': 'text-muted opacity-25'}">${i.bottom>0 ? i.bottom.toLocaleString() : '0'}</td>
                </tr>`;
            });
            html += '</tbody></table></div></div></div>';
        }

        if(d.running && (d.running.top.length > 0 || d.running.bottom.length > 0)) {
            html += '<div class="card border-0 shadow-sm"><div class="card-header bg-secondary text-white fw-bold">เลขวิ่ง</div><div class="card-body p-2">';
            d.running.top.forEach(x => html+= `<span class="badge bg-light text-dark border me-1">วิ่งบน ${x.num} = ${x.amt}</span>`);
            d.running.bottom.forEach(x => html+= `<span class="badge bg-light text-dark border me-1">วิ่งล่าง ${x.num} = ${x.amt}</span>`);
            html += '</div></div>';
        }

        html += '</div>'; 
        document.getElementById('buyerModalBody').innerHTML = html; 
        new bootstrap.Modal(document.getElementById('buyerModal')).show(); 
    }); 
}

// --- OTHER ---
function loadSettings() { fetch('/api/settings').then(r=>r.json()).then(d=>{ const f=document.getElementById('settingsForm'); for(let [k,v] of Object.entries(d)) if(f[k]) f[k].value=v; }); }
function saveSettings() { fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(document.getElementById('settingsForm'))))}).then(()=>{alert('บันทึกเรียบร้อย'); syncData();}); }
function clearData() { if(confirm('ยืนยันล้างข้อมูลทั้งหมด?')) fetch('/clear_data',{method:'POST'}).then(syncData); }

// -------------------------------------------------------------------------
// ✅ ส่วนที่แก้ไข: ตรวจหวย (เพิ่มการแสดง Badge ยอดเงินรวม)
// -------------------------------------------------------------------------
function doCheck() { 
    fetch('/check_reward',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({top3:val('chk_top3'),bottom2:val('chk_bot2')})})
    .then(r=>r.json())
    .then(d=>{ 
        let h=`<div class="alert alert-success text-center shadow-sm fs-5">ถูกรางวัลทั้งหมด: <strong>${d.count}</strong> รายการ</div>`; 
        
        if(d.winners.length) {
            h += '<div class="list-group">';
            d.winners.forEach(w=>{
                let c = w.type.includes('บน') ? 'text-primary' : (w.type.includes('ล่าง') ? 'text-success' : 'text-warning');
                // เพิ่ม w.amt.toLocaleString() เพื่อแสดงยอดเงินรวม
                h+=`<div class="list-group-item d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${w.buyer}</span>
                        <span>
                            <span class="badge bg-light border ${c} text-dark me-2">${w.type}</span>
                            <span class="fs-5 fw-bold text-danger me-3">${w.num}</span>
                            <span class="badge bg-success rounded-pill">${w.amt.toLocaleString()} บ.</span>
                        </span>
                    </div>`;
            });
            h += '</div>';
        } else {
            h+='<div class="text-center text-muted p-4 border rounded bg-light">ไม่พบรายการถูกรางวัล</div>'; 
        }
        document.getElementById('checkResult').innerHTML=h; 
    }); 
}