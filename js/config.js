// Konfigurasi Supabase
const SUPABASE_URL = 'https://oufcvucxxnfgimryjpbs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZmN2dWN4eG5mZ2ltcnlqcGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTg1NDMsImV4cCI6MjA5MDU5NDU0M30.Gmp3NiQlXTiTzdZFh9XGjjNh39i7TGNozQfSYu9nE38';

// Inisialisasi Supabase
let supabaseClient = null;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error('Supabase library not loaded yet');
}

// Password untuk login (sama untuk semua role)
const APP_PASSWORD = 'KaiSlo2026**';

// Konfigurasi shift
const SHIFT_CONFIG = {
    pagi: { start: '08:00', end: '14:00', nama: 'Pagi (08:00-14:00)' },
    siang: { start: '12:00', end: '18:00', nama: 'Siang (12:00-18:00)' },
    piket: { start: '08:00', end: '16:00', nama: 'Piket (08:00-16:00)' }
};

// Fungsi helper untuk cek keterlambatan
function cekKeterlambatan(shift, jamAbsen) {
    const shiftStart = SHIFT_CONFIG[shift].start;
    const [jamShift, menitShift] = shiftStart.split(':').map(Number);
    const jamAbsenDate = new Date(jamAbsen);
    const jamAbsenValue = jamAbsenDate.getHours() * 60 + jamAbsenDate.getMinutes();
    const jamShiftValue = jamShift * 60 + menitShift;
    
    // Toleransi 15 menit
    if (jamAbsenValue > jamShiftValue + 15) {
        const menitTerlambat = jamAbsenValue - jamShiftValue;
        return `Terlambat ${menitTerlambat} menit`;
    }
    return 'Tepat waktu';
}

// Fungsi helper untuk cek apakah shift masih aktif
function isShiftAktif(shift) {
    const now = new Date();
    const jamSekarang = now.getHours() * 60 + now.getMinutes();
    const shiftEnd = SHIFT_CONFIG[shift].end;
    const [jamEnd, menitEnd] = shiftEnd.split(':').map(Number);
    const jamEndValue = jamEnd * 60 + menitEnd;
    
    // Shift berakhir otomatis jam 24:00 (12 malam)
    const batasMalam = 24 * 60;
    return jamSekarang <= batasMalam && jamSekarang <= jamEndValue;
}

// Fungsi untuk konversi foto ke base64
function fotoToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { supabaseClient, APP_PASSWORD, SHIFT_CONFIG, cekKeterlambatan, isShiftAktif, fotoToBase64 };
}