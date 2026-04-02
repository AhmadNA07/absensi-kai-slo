let siswaData = [];
let currentSiswa = null;
let currentShift = null;
let capturedPhoto = null;
let videoStream = null;

function checkSupabase() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        console.error('Supabase client not initialized');
        alert('Error: Database connection not ready. Please refresh the page.');
        return false;
    }
    return true;
}

async function loadSiswaList() {
    if (!checkSupabase()) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('siswa')
            .select('*, sekolah:sekolah_id(*)')
            .eq('status', 'aktif')
            .order('nama');
        
        if (!error && data) {
            siswaData = data;
            displaySiswaList(data);
            console.log('Siswa loaded:', data.length); // Debug
        } else {
            console.error('Error loading siswa:', error);
            alert('Gagal memuat data siswa: ' + error?.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

function displaySiswaList(siswa) {
    const container = document.getElementById('siswaList');
    if (!container) {
        console.error('Container siswaList tidak ditemukan');
        return;
    }
    
    if (siswa.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;">Tidak ada data siswa</p>';
        return;
    }
    
    container.innerHTML = siswa.map(siswa => `
        <div class="siswa-card" onclick="showShiftModal('${siswa.id}')">
            <h3>${escapeHtml(siswa.nama)}</h3>
            <p><strong>NIS:</strong> ${escapeHtml(siswa.nis)}</p>
            <p><strong>Sekolah:</strong> ${escapeHtml(siswa.sekolah?.nama || '-')}</p>
        </div>
    `).join('');
}

// Escape HTML untuk keamanan
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showShiftModal(siswaId) {
    console.log('showShiftModal called for ID:', siswaId); // Debug
    
    currentSiswa = siswaData.find(s => s.id === siswaId);
    if (!currentSiswa) {
        console.error('Siswa tidak ditemukan:', siswaId);
        alert('Siswa tidak ditemukan');
        return;
    }
    
    const modal = document.getElementById('shiftModal');
    if (!modal) {
        console.error('Modal shift tidak ditemukan');
        return;
    }
    
    const modalNama = document.getElementById('shiftModalNama');
    if (modalNama) modalNama.textContent = `Pilih Shift untuk ${currentSiswa.nama}`;
    
    // Setup shift options
    document.querySelectorAll('.shift-option').forEach(btn => {
        btn.onclick = () => {
            const shift = btn.getAttribute('data-shift');
            currentShift = shift;
            closeModal('shiftModal');
            showCameraModal();
        };
    });
    
    modal.style.display = 'block';
}

async function showCameraModal() {
    const modal = document.getElementById('absenModal');
    if (!modal) {
        console.error('Modal absen tidak ditemukan');
        return;
    }
    
    const modalNama = document.getElementById('modalNamaSiswa');
    if (modalNama) modalNama.textContent = currentSiswa.nama;
    
    const infoShift = document.getElementById('infoShift');
    if (infoShift && currentShift) {
        infoShift.innerHTML = `<p>Shift: ${SHIFT_CONFIG[currentShift]?.nama || currentShift}</p>`;
    }
    
    // Reset captured photo
    capturedPhoto = null;
    const previewDiv = document.getElementById('previewPhoto');
    if (previewDiv) previewDiv.style.display = 'none';
    
    const btnAbsen = document.getElementById('btnAbsen');
    if (btnAbsen) btnAbsen.disabled = true;
    
    // Start camera
    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        const video = document.getElementById('video');
        if (video) {
            video.srcObject = videoStream;
        }
    } catch (err) {
        console.error('Camera error:', err);
        alert('Tidak dapat mengakses kamera: ' + err.message + '\nPastikan Anda memberikan izin kamera.');
    }
    
    // Setup capture button
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.onclick = capturePhoto;
    }
    
    modal.style.display = 'block';
}

function capturePhoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    
    if (!video || !canvas) {
        console.error('Video atau canvas tidak ditemukan');
        return;
    }
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);
    
    // Show preview
    const previewDiv = document.getElementById('previewPhoto');
    const photoPreview = document.getElementById('photoPreview');
    if (previewDiv && photoPreview) {
        photoPreview.src = capturedPhoto;
        previewDiv.style.display = 'block';
    }
    
    // Enable absen button
    const btnAbsen = document.getElementById('btnAbsen');
    if (btnAbsen) btnAbsen.disabled = false;
    
    // Stop camera stream
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        video.srcObject = null;
    }
}

async function doAbsen() {
    if (!checkSupabase()) return;
    
    if (!capturedPhoto) {
        alert('Silakan ambil foto terlebih dahulu!');
        return;
    }
    
    if (!currentShift) {
        alert('Shift belum dipilih!');
        return;
    }
    
    const now = new Date();
    const keterlambatan = cekKeterlambatan(currentShift, now);
    const status = keterlambatan === 'Tepat waktu' ? 'hadir' : 'terlambat';
    
    // Cek apakah sudah absen hari ini
    const today = new Date().toISOString().split('T')[0];
    const { data: existingAbsensi, error: checkError } = await supabaseClient
        .from('absensi')
        .select('*')
        .eq('siswa_id', currentSiswa.id)
        .gte('tanggal', today)
        .lte('tanggal', today + ' 23:59:59');
    
    if (checkError) {
        console.error('Error checking existing absensi:', checkError);
    }
    
    if (existingAbsensi && existingAbsensi.length > 0) {
        alert('Anda sudah melakukan absen hari ini!');
        closeModal('absenModal');
        return;
    }
    
    const absenData = {
        siswa_id: currentSiswa.id,
        shift: currentShift,
        tanggal: now.toISOString(),
        status: status,
        keterlambatan: keterlambatan,
        foto: capturedPhoto
    };
    
    console.log('Saving absen:', absenData); // Debug
    
    const { error } = await supabaseClient.from('absensi').insert([absenData]);
    
    if (!error) {
        alert(`Absen berhasil! ${status === 'hadir' ? 'Selamat datang!' : keterlambatan}`);
        closeModal('absenModal');
        loadSiswaList(); // Refresh list
    } else {
        console.error('Error saving absen:', error);
        alert('Error: ' + error.message);
    }
}

// Search functionality
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...'); // Debug
    loadSiswaList();
    
    const searchInput = document.getElementById('searchSiswa');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = siswaData.filter(s => 
                s.nama.toLowerCase().includes(searchTerm) || 
                s.nis.includes(searchTerm)
            );
            displaySiswaList(filtered);
        });
    }
    
    // Modal close and cleanup
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.onclick = () => {
            const modal = closeBtn.closest('.modal');
            if (modal) {
                closeModal(modal.id);
                // Stop camera if open
                if (videoStream) {
                    videoStream.getTracks().forEach(track => track.stop());
                    videoStream = null;
                }
            }
        };
    });
    
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
                videoStream = null;
            }
        }
    };
    
    const btnAbsen = document.getElementById('btnAbsen');
    if (btnAbsen) btnAbsen.onclick = doAbsen;
});

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}