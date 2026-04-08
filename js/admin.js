// ==================== VARIABLES ====================
let currentData = {};
let allSiswa = [];

// ==================== FUNGSI WAKTU WIB (MANUAL OFFSET +7 JAM) ====================
function getWIBDate(date = null) {
    const d = date ? new Date(date) : new Date();
    d.setHours(d.getHours() + 7);
    return d;
}

function getTodayWIB() {
    const now = new Date();
    now.setHours(now.getHours() + 7);
    return now.toISOString().split('T')[0];
}

function formatDateWIB(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    date.setHours(date.getHours() + 7);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
}

function formatTimeWIB(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    date.setHours(date.getHours() + 7);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds} WIB`;
}

// ==================== FACE RECOGNITION THRESHOLD ====================
const FACE_MATCH_THRESHOLD = 0.35; // LEBIH KETAT (default 0.6 terlalu longgar)

// ==================== CHECK SUPABASE ====================
function checkSupabase() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        console.error('Supabase client not initialized');
        alert('Error: Database connection not ready. Please refresh the page.');
        return false;
    }
    return true;
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    if (!checkSupabase()) return;
    
    try {
        // Total siswa
        const { count: siswaCount } = await supabaseClient
            .from('siswa')
            .select('*', { count: 'exact', head: true });
        document.getElementById('totalSiswa').textContent = siswaCount || 0;
        
        // Total sekolah
        const { count: sekolahCount } = await supabaseClient
            .from('sekolah')
            .select('*', { count: 'exact', head: true });
        document.getElementById('totalSekolah').textContent = sekolahCount || 0;
        
        // Absensi hari ini (pakai WIB)
        const today = getTodayWIB();
        const { data: absensi, error } = await supabaseClient
            .from('absensi')
            .select(`*, siswa:siswa_id(*, sekolah:sekolah_id(*))`)
            .gte('tanggal', today)
            .lte('tanggal', today + ' 23:59:59');
        
        if (!error && absensi) {
            const hadir = absensi.filter(a => a.status === 'hadir').length;
            const terlambat = absensi.filter(a => a.status === 'terlambat').length;
            document.getElementById('hadirHariIni').textContent = hadir;
            document.getElementById('terlambatHariIni').textContent = terlambat;
            
            const tbody = document.querySelector('#recentTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                absensi.slice(0, 10).forEach(absen => {
                    const row = tbody.insertRow();
                    const siswaNama = absen.siswa?.nama || '-';
                    const tglWIB = formatDateWIB(absen.tanggal);
                    const jamWIB = formatTimeWIB(absen.tanggal);
                    
                    row.insertCell(0).innerHTML = absen.foto ? `<img src="${absen.foto}" class="foto-thumb" onclick="showFoto('${absen.foto}', '${siswaNama} - ${tglWIB} ${jamWIB}')">` : '-';
                    row.insertCell(1).textContent = siswaNama;
                    row.insertCell(2).textContent = absen.siswa?.sekolah?.nama || '-';
                    row.insertCell(3).textContent = SHIFT_CONFIG[absen.shift]?.nama || absen.shift;
                    row.insertCell(4).textContent = jamWIB;
                    row.insertCell(5).innerHTML = `<span class="status-${absen.status}">${absen.status === 'hadir' ? 'Hadir' : 'Terlambat'}</span>`;
                    row.insertCell(6).textContent = absen.lokasi || '-';
                });
            }
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ==================== SISWA ====================
async function loadSiswa() {
    if (!checkSupabase()) return;
    
    const { data, error } = await supabaseClient
        .from('siswa')
        .select('*, sekolah:sekolah_id(*)')
        .order('nama');
    
    if (!error && data) {
        allSiswa = data;
        const tbody = document.querySelector('#siswaTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            data.forEach(siswa => {
                const row = tbody.insertRow();
                row.insertCell(0).textContent = siswa.nis;
                row.insertCell(1).textContent = siswa.nama;
                row.insertCell(2).textContent = siswa.sekolah?.nama || '-';
                row.insertCell(3).innerHTML = `<span class="status-${siswa.status}">${siswa.status}</span>`;
                const aksi = row.insertCell(4);
                aksi.innerHTML = `
                    <button class="btn-secondary btn-sm" onclick="editSiswa('${siswa.id}')">Edit</button>
                    <button class="btn-danger btn-sm" onclick="hapusSiswa('${siswa.id}')">Hapus</button>
                    ${siswa.has_face ? `<button class="btn-danger btn-sm" onclick="hapusFaceSiswa('${siswa.id}')">Hapus Wajah</button>` : ''}
                `;
            });
        }
        
        // Update dropdown filter siswa
        const filterSiswa = document.getElementById('filterSiswaId');
        if (filterSiswa) {
            filterSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
            data.forEach(siswa => {
                filterSiswa.innerHTML += `<option value="${siswa.id}">${siswa.nama} (${siswa.nis})</option>`;
            });
        }
    }
}

// Hapus face data siswa
async function hapusFaceSiswa(id) {
    if (!checkSupabase()) return;
    if (confirm('Yakin ingin menghapus data wajah siswa ini?')) {
        const { error } = await supabaseClient
            .from('siswa')
            .update({ face_descriptor: null, has_face: false })
            .eq('id', id);
        if (!error) {
            alert('Data wajah berhasil dihapus');
            loadSiswa();
        } else {
            alert('Error: ' + error.message);
        }
    }
}

async function simpanSiswa(event) {
    event.preventDefault();
    if (!checkSupabase()) return;
    
    const id = document.getElementById('siswaId').value;
    const data = {
        nis: document.getElementById('nis').value,
        nama: document.getElementById('nama').value,
        sekolah_id: parseInt(document.getElementById('sekolahId').value),
        status: document.getElementById('status').value
    };
    
    let result;
    if (id) {
        result = await supabaseClient.from('siswa').update(data).eq('id', id);
    } else {
        result = await supabaseClient.from('siswa').insert([data]);
    }
    
    if (!result.error) {
        alert('Data siswa berhasil disimpan');
        closeModal('siswaModal');
        loadSiswa();
        loadDashboard();
    } else {
        alert('Error: ' + result.error.message);
    }
}

async function editSiswa(id) {
    if (!checkSupabase()) return;
    
    const { data, error } = await supabaseClient.from('siswa').select('*').eq('id', id).single();
    if (!error && data) {
        document.getElementById('siswaId').value = data.id;
        document.getElementById('nis').value = data.nis;
        document.getElementById('nama').value = data.nama;
        document.getElementById('sekolahId').value = data.sekolah_id;
        document.getElementById('status').value = data.status;
        document.getElementById('siswaModal').style.display = 'block';
    }
}

async function hapusSiswa(id) {
    if (!checkSupabase()) return;
    
    if (confirm('Yakin ingin menghapus siswa ini?')) {
        const { error } = await supabaseClient.from('siswa').delete().eq('id', id);
        if (!error) {
            alert('Siswa berhasil dihapus');
            loadSiswa();
            loadDashboard();
        } else {
            alert('Error: ' + error.message);
        }
    }
}

// ==================== SEKOLAH ====================
async function loadSekolah() {
    if (!checkSupabase()) return;
    
    const { data, error } = await supabaseClient
        .from('sekolah')
        .select('*')
        .order('nama');
    
    if (!error && data) {
        const tbody = document.querySelector('#sekolahTable tbody');
        if (tbody) {
            tbody.innerHTML = '';
            data.forEach(sekolah => {
                const row = tbody.insertRow();
                row.insertCell(0).textContent = sekolah.id;
                row.insertCell(1).textContent = sekolah.nama;
                row.insertCell(2).textContent = sekolah.alamat || '-';
                const aksi = row.insertCell(3);
                aksi.innerHTML = `
                    <button class="btn-secondary btn-sm" onclick="editSekolah('${sekolah.id}')">Edit</button>
                    <button class="btn-danger btn-sm" onclick="hapusSekolah('${sekolah.id}')">Hapus</button>
                `;
            });
        }
        
        const selectSekolah = document.getElementById('sekolahId');
        if (selectSekolah) {
            selectSekolah.innerHTML = '<option value="">Pilih Sekolah</option>';
            data.forEach(sekolah => {
                selectSekolah.innerHTML += `<option value="${sekolah.id}">${sekolah.nama}</option>`;
            });
        }
    }
}

async function simpanSekolah(event) {
    event.preventDefault();
    if (!checkSupabase()) return;
    
    const id = document.getElementById('sekolahIdEdit').value;
    const data = {
        nama: document.getElementById('namaSekolah').value,
        alamat: document.getElementById('alamat').value
    };
    
    let result;
    if (id) {
        result = await supabaseClient.from('sekolah').update(data).eq('id', id);
    } else {
        result = await supabaseClient.from('sekolah').insert([data]);
    }
    
    if (!result.error) {
        alert('Data sekolah berhasil disimpan');
        closeModal('sekolahModal');
        loadSekolah();
    } else {
        alert('Error: ' + result.error.message);
    }
}

async function editSekolah(id) {
    if (!checkSupabase()) return;
    
    const { data, error } = await supabaseClient.from('sekolah').select('*').eq('id', id).single();
    if (!error && data) {
        document.getElementById('sekolahIdEdit').value = data.id;
        document.getElementById('namaSekolah').value = data.nama;
        document.getElementById('alamat').value = data.alamat || '';
        document.getElementById('sekolahModal').style.display = 'block';
    }
}

async function hapusSekolah(id) {
    if (!checkSupabase()) return;
    
    if (confirm('Yakin ingin menghapus sekolah ini? Data siswa yang terkait akan terpengaruh.')) {
        const { error } = await supabaseClient.from('sekolah').delete().eq('id', id);
        if (!error) {
            alert('Sekolah berhasil dihapus');
            loadSekolah();
            loadDashboard();
        } else {
            alert('Error: ' + error.message);
        }
    }
}

// ==================== LAPORAN ABSENSI ====================
async function loadLaporan() {
    if (!checkSupabase()) return;
    
    const filterTanggal = document.getElementById('filterTanggal')?.value;
    const shift = document.getElementById('filterShift')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';
    
    let tanggal = filterTanggal;
    if (!tanggal) {
        tanggal = getTodayWIB();
        const filterTanggalEl = document.getElementById('filterTanggal');
        if (filterTanggalEl) filterTanggalEl.value = tanggal;
    }
    
    let query = supabaseClient
        .from('absensi')
        .select(`*, siswa:siswa_id(*, sekolah:sekolah_id(*))`)
        .gte('tanggal', tanggal)
        .lte('tanggal', tanggal + ' 23:59:59');
    
    if (shift) query = query.eq('shift', shift);
    if (status) query = query.eq('status', status);
    
    const { data, error } = await query.order('tanggal', { ascending: false });
    
    const tbody = document.querySelector('#laporanTable tbody');
    if (!tbody) return;
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center">Tidak ada data absensi</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    data.forEach(absen => {
        const row = tbody.insertRow();
        const siswaNama = absen.siswa?.nama || '-';
        const tglWIB = formatDateWIB(absen.tanggal);
        const jamWIB = formatTimeWIB(absen.tanggal);
        
        row.insertCell(0).innerHTML = absen.foto ? `<img src="${absen.foto}" class="foto-thumb" onclick="showFoto('${absen.foto}', '${siswaNama} - ${tglWIB} ${jamWIB}')">` : '-';
        row.insertCell(1).textContent = tglWIB;
        row.insertCell(2).textContent = absen.siswa?.nis || '-';
        row.insertCell(3).textContent = siswaNama;
        row.insertCell(4).textContent = absen.siswa?.sekolah?.nama || '-';
        row.insertCell(5).textContent = SHIFT_CONFIG[absen.shift]?.nama || absen.shift;
        row.insertCell(6).textContent = jamWIB;
        row.insertCell(7).innerHTML = `<span class="status-${absen.status}">${absen.status === 'hadir' ? 'Hadir' : 'Terlambat'}</span>`;
        row.insertCell(8).textContent = absen.keterlambatan || '-';
        row.insertCell(9).textContent = absen.lokasi || '-';
        row.insertCell(10).textContent = absen.ip_address || '-';
    });
}

function downloadLaporan() {
    const table = document.getElementById('laporanTable');
    if (!table) return;
    
    const cloneTable = table.cloneNode(true);
    const images = cloneTable.querySelectorAll('img');
    images.forEach(img => {
        img.parentNode.textContent = 'Ada Foto';
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(cloneTable, { raw: true });
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Absensi');
    const todayWIB = getTodayWIB();
    XLSX.writeFile(wb, `laporan_absensi_${todayWIB}.xlsx`);
}

// ==================== LAPORAN PER SISWA ====================
async function loadLaporanPerSiswa() {
    if (!checkSupabase()) return;
    
    const siswaId = document.getElementById('filterSiswaId')?.value;
    if (!siswaId) {
        alert('Pilih siswa terlebih dahulu');
        return;
    }
    
    let dariTanggal = document.getElementById('filterDariTanggal')?.value;
    let sampaiTanggal = document.getElementById('filterSampaiTanggal')?.value;
    
    const todayWIB = getTodayWIB();
    if (!dariTanggal) {
        dariTanggal = todayWIB;
        document.getElementById('filterDariTanggal').value = todayWIB;
    }
    if (!sampaiTanggal) {
        sampaiTanggal = todayWIB;
        document.getElementById('filterSampaiTanggal').value = todayWIB;
    }
    
    // Get siswa info
    const { data: siswa } = await supabaseClient
        .from('siswa')
        .select('*, sekolah:sekolah_id(*)')
        .eq('id', siswaId)
        .single();
    
    if (siswa) {
        document.getElementById('infoSiswa').innerHTML = `
            <div class="stat-card" style="display: inline-block; margin-right: 10px;">
                <strong>Nama:</strong> ${siswa.nama}<br>
                <strong>NIS:</strong> ${siswa.nis}<br>
                <strong>Sekolah:</strong> ${siswa.sekolah?.nama || '-'}
            </div>
        `;
    }
    
    // Get absensi siswa
    const { data, error } = await supabaseClient
        .from('absensi')
        .select('*')
        .eq('siswa_id', siswaId)
        .gte('tanggal', dariTanggal)
        .lte('tanggal', sampaiTanggal + ' 23:59:59')
        .order('tanggal', { ascending: false });
    
    const tbody = document.querySelector('#laporanSiswaTable tbody');
    if (!tbody) return;
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Tidak ada data absensi untuk siswa ini</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    data.forEach(absen => {
        const row = tbody.insertRow();
        const tglWIB = formatDateWIB(absen.tanggal);
        const jamWIB = formatTimeWIB(absen.tanggal);
        
        row.insertCell(0).innerHTML = absen.foto ? `<img src="${absen.foto}" class="foto-thumb" onclick="showFoto('${absen.foto}', '${siswa?.nama} - ${tglWIB} ${jamWIB}')">` : '-';
        row.insertCell(1).textContent = tglWIB;
        row.insertCell(2).textContent = SHIFT_CONFIG[absen.shift]?.nama || absen.shift;
        row.insertCell(3).textContent = jamWIB;
        row.insertCell(4).innerHTML = `<span class="status-${absen.status}">${absen.status === 'hadir' ? 'Hadir' : 'Terlambat'}</span>`;
        row.insertCell(5).textContent = absen.keterlambatan || '-';
        row.insertCell(6).textContent = absen.lokasi || '-';
        row.insertCell(7).textContent = absen.ip_address || '-';
    });
}

function downloadLaporanPerSiswa() {
    const table = document.getElementById('laporanSiswaTable');
    if (!table) return;
    
    const cloneTable = table.cloneNode(true);
    const images = cloneTable.querySelectorAll('img');
    images.forEach(img => {
        img.parentNode.textContent = 'Ada Foto';
    });
    
    const siswaSelect = document.getElementById('filterSiswaId');
    const siswaNama = siswaSelect?.options[siswaSelect.selectedIndex]?.text || 'siswa';
    const todayWIB = getTodayWIB();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(cloneTable, { raw: true });
    XLSX.utils.book_append_sheet(wb, ws, `Laporan_${siswaNama}`);
    XLSX.writeFile(wb, `laporan_${siswaNama}_${todayWIB}.xlsx`);
}

// ==================== UI FUNCTIONS ====================
function showFoto(fotoUrl, info) {
    const modal = document.getElementById('fotoModal');
    const img = document.getElementById('detailFoto');
    const infoP = document.getElementById('detailInfo');
    
    if (modal && img && infoP) {
        img.src = fotoUrl;
        infoP.textContent = info;
        modal.style.display = 'block';
    }
}

function showTambahSiswaModal() {
    const form = document.getElementById('siswaForm');
    if (form) form.reset();
    document.getElementById('siswaId').value = '';
    document.getElementById('siswaModal').style.display = 'block';
}

function showTambahSekolahModal() {
    const form = document.getElementById('sekolahForm');
    if (form) form.reset();
    document.getElementById('sekolahIdEdit').value = '';
    document.getElementById('sekolahModal').style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// ==================== TAB NAVIGATION ====================
function initTabs() {
    const tabs = document.querySelectorAll('.nav-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            if (tabId === 'logout') {
                logout();
                return;
            }
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const targetTab = document.getElementById(`${tabId}Tab`);
            if (targetTab) targetTab.classList.add('active');
            
            if (tabId === 'dashboard') loadDashboard();
            else if (tabId === 'siswa') loadSiswa();
            else if (tabId === 'sekolah') loadSekolah();
            else if (tabId === 'laporan') loadLaporan();
            else if (tabId === 'laporan-siswa') {
                loadSiswa();
                loadLaporanPerSiswa();
            }
        });
    });
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadDashboard();
    loadSiswa();
    loadSekolah();
    
    // Set default dates with WIB
    const todayWIB = getTodayWIB();
    const filterTanggal = document.getElementById('filterTanggal');
    if (filterTanggal) filterTanggal.value = todayWIB;
    
    const filterDariTanggal = document.getElementById('filterDariTanggal');
    if (filterDariTanggal) filterDariTanggal.value = todayWIB;
    
    const filterSampaiTanggal = document.getElementById('filterSampaiTanggal');
    if (filterSampaiTanggal) filterSampaiTanggal.value = todayWIB;
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.onclick = () => {
            const modal = closeBtn.closest('.modal');
            if (modal) closeModal(modal.id);
        };
    });
    
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
    
    const siswaForm = document.getElementById('siswaForm');
    if (siswaForm) siswaForm.addEventListener('submit', simpanSiswa);
    
    const sekolahForm = document.getElementById('sekolahForm');
    if (sekolahForm) sekolahForm.addEventListener('submit', simpanSekolah);
    
    const filterShift = document.getElementById('filterShift');
    if (filterShift) filterShift.addEventListener('change', loadLaporan);
    
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.addEventListener('change', loadLaporan);
    
    const filterSiswaId = document.getElementById('filterSiswaId');
    if (filterSiswaId) filterSiswaId.addEventListener('change', loadLaporanPerSiswa);
    
    const filterDariTanggalInput = document.getElementById('filterDariTanggal');
    if (filterDariTanggalInput) filterDariTanggalInput.addEventListener('change', loadLaporanPerSiswa);
    
    const filterSampaiTanggalInput = document.getElementById('filterSampaiTanggal');
    if (filterSampaiTanggalInput) filterSampaiTanggalInput.addEventListener('change', loadLaporanPerSiswa);
    
    console.log('Admin panel loaded - WIB Time:', formatTimeWIB(new Date().toISOString()));
});