let reportData = {};
let buyersCache = [];
let transactionPage = 1;
let transactionTotalPages = 1;
let transactionItemsCache = [];
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
function openViewAll() {
    const filter = document.getElementById('transactionBuyerFilter');
    const selectedBuyer = filter.value;
    filter.innerHTML = '<option value="">ผู้ซื้อทั้งหมด</option>';
    buyersCache.forEach(b => filter.add(new Option(b.name, b.name)));
    filter.value = selectedBuyer;
    loadTransactionPage(1);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('viewAllModal')).show();
}
function loadTransactionPage(page) {
    if (page < 1) return;
    const buyer = document.getElementById('transactionBuyerFilter').value;
    fetch(`/api/transactions?page=${page}&buyer=${encodeURIComponent(buyer)}`).then(r=>r.json()).then(d=>{
        transactionPage = d.page;
        transactionTotalPages = d.total_pages;
        transactionItemsCache = d.items || [];
        renderRecent(transactionItemsCache, 'viewAllBody', true);
        document.getElementById('transactionsPageInfo').innerText = `หน้า ${d.page} / ${d.total_pages} (${Number(d.total).toLocaleString()} รายการ)`;
        document.getElementById('transactionsPrev').disabled = d.page <= 1;
        document.getElementById('transactionsNext').disabled = d.page >= d.total_pages;
    });
}
function renderRecent(d, id, isModal=false) {
    let h='', cls=isModal?'del-chk-modal':'del-chk';
    d.forEach(i=>{
        let c=i.type.includes('บน')?'text-primary':(i.type.includes('ล่าง')?'text-success':'text-warning');
        const editButton = isModal ? `<button onclick="editTransaction(${i.id})" class="btn btn-sm btn-outline-warning me-1" title="แก้ไขรายการ"><i class="fas fa-pen"></i></button>` : '';
        h+=`<tr><td><input type="checkbox" class="form-check-input ${cls}" value="${i.id}"></td><td class="text-muted small">${escapeHtml(i.time)}</td><td>${escapeHtml(i.buyer)}</td><td class="fw-bold fs-5">${escapeHtml(i.num)}</td><td><span class="badge bg-light border ${c} text-dark">${escapeHtml(i.type)}</span></td><td class="fw-bold text-end">${Number(i.amt).toLocaleString()}</td><td>${editButton}<button onclick="delItem(${i.id}, ${isModal})" class="btn btn-sm btn-outline-danger" title="ลบรายการ"><i class="fas fa-times"></i></button></td></tr>`;
    });
    document.getElementById(id).innerHTML=h;
}
function delItem(id, reloadModal=false) { if(confirm('ลบรายการนี้?')) fetch('/delete/'+id,{method:'POST'}).then(()=>{ syncData(); if(reloadModal) loadTransactionPage(transactionPage); }); }
function deleteSelected() { const ids=Array.from(document.querySelectorAll('.del-chk:checked')).map(c=>parseInt(c.value)); if(ids.length) fetch('/delete_multiple',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})}).then(syncData); }
function deleteFromModal() { const ids=Array.from(document.querySelectorAll('.del-chk-modal:checked')).map(c=>parseInt(c.value)); if(ids.length && confirm(`ลบ ${ids.length} รายการ?`)) fetch('/delete_multiple',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})}).then(()=>{ syncData(); loadTransactionPage(transactionPage); }); }
function editTransaction(id) {
    const item = transactionItemsCache.find(x => Number(x.id) === Number(id));
    if (!item) return alert('ไม่พบรายการ');
    const buyerSelect = document.getElementById('editTransactionBuyer');
    buyerSelect.innerHTML = '';
    buyersCache.forEach(b => buyerSelect.add(new Option(b.name, b.name)));
    if (![...buyerSelect.options].some(o => o.value === item.buyer)) buyerSelect.add(new Option(item.buyer, item.buyer));
    document.getElementById('editTransactionId').value = item.id;
    buyerSelect.value = item.buyer;
    document.getElementById('editTransactionNumber').value = item.num;
    document.getElementById('editTransactionType').value = item.type;
    document.getElementById('editTransactionAmount').value = item.amt;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editTransactionModal')).show();
}
function saveTransactionEdit() {
    const id = document.getElementById('editTransactionId').value;
    const payload = {buyer: val('editTransactionBuyer'), number: val('editTransactionNumber'), type: val('editTransactionType'), amount: val('editTransactionAmount')};
    fetch('/api/transactions/' + id, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
        .then(async r => ({ok:r.ok, data:await r.json()})).then(({ok,data}) => {
            if (!ok) return alert(data.message || 'แก้ไขไม่สำเร็จ');
            bootstrap.Modal.getInstance(document.getElementById('editTransactionModal')).hide();
            syncData(); loadBuyers(); loadTransactionPage(transactionPage);
        }).catch(() => alert('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'));
}
function toggleAll(e) { document.querySelectorAll('.del-chk').forEach(c=>c.checked=e.checked); }
function toggleAllModal(e) { document.querySelectorAll('.del-chk-modal').forEach(c=>c.checked=e.checked); }

// --- BUYERS ---
function loadBuyers() {
    fetch('/api/buyers')
        .then(r => {
            if (!r.ok) throw new Error('โหลดข้อมูลผู้ซื้อไม่สำเร็จ');
            return r.json();
        })
        .then(d => {
            if (!Array.isArray(d)) d = [];
            buyersCache = d;

            const s = document.getElementById('k_buyer');
            if (s && s.options.length !== d.length) {
                s.innerHTML = '';
                d.forEach(b => s.add(new Option(b.name, b.name)));
                if (d.length) s.value = d[0].name;
            }

            let h = '';
            d.forEach(b => {
                const total = Number(b.total) || 0;
                const discount = Number(b.discount) || 0;
                const discAmt = Number(b.disc_amt) || 0;
                const net = Number(b.net) || 0;
                const encodedName = encodeURIComponent(b.name);
                h += `<tr>
                <td class="fw-bold text-start ps-3 text-primary">${escapeHtml(b.name)}</td>
                <td>${total.toLocaleString()}</td>
                <td>${discount}%</td>
                <td class="text-danger fw-bold">-${discAmt.toLocaleString()}</td>
                <td class="fw-bold text-success fs-5">${net.toLocaleString()}</td>
                <td>
                    <a href="/export/excel/${encodedName}" target="_blank" class="btn btn-sm btn-success me-1 shadow-sm" title="Excel"><i class="fas fa-file-excel"></i></a>
                    <a href="/print/bill/${encodedName}" target="_blank" class="btn btn-sm btn-secondary me-1 shadow-sm" title="PDF/Print"><i class="fas fa-print"></i></a>
                    <button class="btn btn-sm btn-warning me-1 shadow-sm" onclick="editBuyer(${b.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-sm btn-info text-white me-1 shadow-sm" onclick="viewBuyById(${b.id})"><i class="fas fa-list"></i></button>
                    <button class="btn btn-sm btn-danger shadow-sm" onclick="deleteBuyer(${b.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
            });
            document.getElementById('buyerBody').innerHTML = h;
        })
        .catch(err => {
            console.error('loadBuyers:', err);
            alert('ไม่สามารถโหลดรายชื่อผู้ซื้อได้ กรุณารีเฟรชหน้าเว็บ');
        });
}
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function getBuyerById(id) {
    return buyersCache.find(b => String(b.id) === String(id));
}
function addBuyer() { document.getElementById('manageBuyerTitle').innerText="เพิ่มผู้ซื้อ"; document.getElementById('mb_id').value=""; document.getElementById('mb_name').value=""; document.getElementById('mb_discount').value="0"; new bootstrap.Modal(document.getElementById('manageBuyerModal')).show(); }
function deleteBuyer(id) {
    const buyer = getBuyerById(id);
    if (!buyer) return alert('ไม่พบข้อมูลผู้ซื้อ');
    if(confirm('⚠️ คำเตือน: คุณต้องการลบ "' + buyer.name + '" ใช่หรือไม่?\n\n‼️ ยอดซื้อและรายการทั้งหมดของคนนี้จะถูกลบหายไปทันที และกู้คืนไม่ได้')) {
        fetch('/delete_buyer/' + id, { method: 'POST' })
            .then(r => r.json())
            .then(d => {
                if(d.status === 'success') {
                    loadBuyers();
                    loadRecent();
                    loadReport();
                } else {
                    alert('เกิดข้อผิดพลาด ไม่พบข้อมูลผู้ใช้งาน');
                }
            });
    }
}
function editBuyer(id) {
    const buyer = getBuyerById(id);
    if (!buyer) return alert('ไม่พบข้อมูลผู้ซื้อ');
    document.getElementById('manageBuyerTitle').innerText="แก้ไขข้อมูล";
    document.getElementById('mb_id').value=buyer.id;
    document.getElementById('mb_name').value=buyer.name;
    document.getElementById('mb_discount').value=buyer.discount ?? 0;
    new bootstrap.Modal(document.getElementById('manageBuyerModal')).show();
}
function viewBuyById(id) {
    const buyer = getBuyerById(id);
    if (!buyer) return alert('ไม่พบข้อมูลผู้ซื้อ');
    viewBuy(buyer.name);
}
function saveBuyerData() {
    const id = document.getElementById('mb_id').value;
    const name = document.getElementById('mb_name').value.trim();
    const discount = document.getElementById('mb_discount').value;
    if(!name) return alert('กรุณาใส่ชื่อ');
    fetch('/api/buyers', {
        method: id ? 'PUT' : 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, name, discount: discount === '' ? 0 : discount})
    })
        .then(r => r.json())
        .then(d => {
            if(d.status === 'success') {
                const modalEl = document.getElementById('manageBuyerModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
                loadBuyers();
            } else {
                alert(d.message || 'บันทึกไม่สำเร็จ');
            }
        })
        .catch(() => alert('บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่'));
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
