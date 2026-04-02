-- Tabel Sekolah
CREATE TABLE sekolah (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    alamat TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabel Siswa
CREATE TABLE siswa (
    id SERIAL PRIMARY KEY,
    nis VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    sekolah_id INTEGER REFERENCES sekolah(id) ON DELETE CASCADE,
    shift VARCHAR(20) CHECK (shift IN ('pagi', 'siang', 'piket')) NOT NULL,
    status VARCHAR(20) DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabel Absensi
CREATE TABLE absensi (
    id SERIAL PRIMARY KEY,
    siswa_id INTEGER REFERENCES siswa(id) ON DELETE CASCADE,
    shift VARCHAR(20) CHECK (shift IN ('pagi', 'siang', 'piket')) NOT NULL,
    tanggal TIMESTAMP NOT NULL,
    status VARCHAR(20) CHECK (status IN ('hadir', 'terlambat')) NOT NULL,
    keterlambatan VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX idx_absensi_tanggal ON absensi(tanggal);
CREATE INDEX idx_absensi_siswa ON absensi(siswa_id);
CREATE INDEX idx_siswa_sekolah ON siswa(sekolah_id);

-- Sample data awal
INSERT INTO sekolah (nama, alamat) VALUES 
('SMK Negeri 1 Bandung', 'Jl. Wastukancana No. 1 Bandung'),
('SMK Negeri 2 Bandung', 'Jl. Ciliwung No. 4 Bandung');

INSERT INTO siswa (nis, nama, sekolah_id, shift, status) VALUES 
('001', 'Ahmad Fauzi', 1, 'pagi', 'aktif'),
('002', 'Budi Santoso', 1, 'siang', 'aktif'),
('003', 'Citra Dewi', 2, 'piket', 'aktif');

-- Enable Row Level Security
ALTER TABLE sekolah ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since using single password)
CREATE POLICY "Enable all for authenticated users" ON sekolah
    FOR ALL USING (true);

CREATE POLICY "Enable all for authenticated users" ON siswa
    FOR ALL USING (true);

CREATE POLICY "Enable all for authenticated users" ON absensi
    FOR ALL USING (true);