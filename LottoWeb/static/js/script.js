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

function syncData() { loadReport(); loadRecent(); loadBuyers(); }

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
            h+=`<tr><td class="fw-bold text-start ps-3 text-primary">${b.name}</td><td>${b.total.toLocaleString()}</td><td>${b.discount}%</td><td class="text-danger fw-bold">-${b.disc_amt.toLocaleString()}</td><td class="fw-bold text-success fs-5">${b.net.toLocaleString()}</td><td><button class="btn btn-sm btn-warning me-1 shadow-sm" onclick="editBuyer(${b.id},'${b.name}',${b.discount})"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-info text-white shadow-sm" onclick="viewBuy('${b.name}')"><i class="fas fa-list"></i></button></td></tr>`; 
        });
        document.getElementById('buyerBody').innerHTML=h;
    });
}
function addBuyer() { document.getElementById('manageBuyerTitle').innerText="เพิ่มผู้ซื้อ"; document.getElementById('mb_id').value=""; document.getElementById('mb_name').value=""; document.getElementById('mb_discount').value="0"; new bootstrap.Modal(document.getElementById('manageBuyerModal')).show(); }
function editBuyer(id,n,d) { document.getElementById('manageBuyerTitle').innerText="แก้ไขข้อมูล"; document.getElementById('mb_id').value=id; document.getElementById('mb_name').value=n; document.getElementById('mb_discount').value=d; new bootstrap.Modal(document.getElementById('manageBuyerModal')).show(); }
function saveBuyerData() {
    const id=document.getElementById('mb_id').value, name=document.getElementById('mb_name').value, discount=document.getElementById('mb_discount').value;
    if(!name) return alert('กรุณาใส่ชื่อ');
    fetch('/api/buyers', { method:id?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,name,discount}) }).then(r=>r.json()).then(d=>{ if(d.status==='success'){ bootstrap.Modal.getInstance(document.getElementById('manageBuyerModal')).hide(); loadBuyers(); } else alert(d.message); });
}
function viewBuy(n) { document.getElementById('modalTitle').innerText='ประวัติการซื้อ: '+n; fetch('/api/buyer_details/'+encodeURIComponent(n)).then(r=>r.json()).then(d=>{ let h=''; d.forEach(i=>h+=`<tr><td>${i.type}</td><td class="fw-bold">${i.number}</td><td>${i.amount.toLocaleString()}</td></tr>`); document.getElementById('buyerDetailBody').innerHTML=h; new bootstrap.Modal(document.getElementById('buyerModal')).show(); }); }

// --- OTHER ---
function loadSettings() { fetch('/api/settings').then(r=>r.json()).then(d=>{ const f=document.getElementById('settingsForm'); for(let [k,v] of Object.entries(d)) if(f[k]) f[k].value=v; }); }
function saveSettings() { fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(document.getElementById('settingsForm'))))}).then(()=>{alert('บันทึกเรียบร้อย'); syncData();}); }
function clearData() { if(confirm('ยืนยันล้างข้อมูลทั้งหมด?')) fetch('/clear_data',{method:'POST'}).then(syncData); }
function doCheck() { fetch('/check_reward',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({top3:val('chk_top3'),bottom2:val('chk_bot2')})}).then(r=>r.json()).then(d=>{ let h=`<div class="alert alert-info text-center shadow-sm">ยอดจ่ายรวม: <strong>${d.total.toLocaleString()}</strong> บาท</div>`; if(d.winners.length) d.winners.forEach(w=>h+=`<div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"><span>${w.buyer} (${w.type}) [${w.num}]</span><span class="badge bg-success rounded-pill">${w.prize.toLocaleString()}</span></div>`); else h+='<div class="text-center text-muted p-3">ไม่พบผู้ถูกรางวัล</div>'; document.getElementById('checkResult').innerHTML=h; }); }