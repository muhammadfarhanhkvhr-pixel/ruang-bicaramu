const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware agar server bisa membaca JSON dari frontend
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database sementara di memori (Server Memory)
let reports = [];

// ==========================================
// KATA SANDI GURU BK (BISA KAMU UBAH DISINI)
// ==========================================
const ADMIN_PASSWORD = "konselingbksmektris";

// Function pembuat kode tiket acak (contoh: BK-8X912)
function generateTicketCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BK-';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ------------------------------------------
// 1. API UNTUK SISWA (TIRU/BUAT LAPORAN)
// ------------------------------------------
app.post('/api/reports', (req, res) => {
    const { category, description } = req.body;

    if (!category || !description) {
        return res.status(400).json({ error: 'Kategori dan deskripsi wajib diisi!' });
    }

    const newReport = {
        id: Date.now(),
        ticket_code: generateTicketCode(),
        category,
        description,
        status: 'Pending',
        admin_response: '',
        created_at: new Date().toISOString()
    };

    reports.push(newReport);
    res.status(201).json({ success: true, ticket_code: newReport.ticket_code });
});

// ------------------------------------------
// 2. API UNTUK SISWA (CEK TIKET)
// ------------------------------------------
app.get('/api/reports/track/:code', (req, res) => {
    const ticketCode = req.params.code.toUpperCase();
    const report = reports.find(r => r.ticket_code === ticketCode);

    if (!report) {
        return res.status(404).json({ error: 'Kode tiket tidak ditemukan.' });
    }

    res.json(report);
});

// ------------------------------------------
// 3. API LOGIN GURU BK (VERIFIKASI PASSWORD)
// ------------------------------------------
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }
    return res.status(401).json({ success: false, error: 'Password salah!' });
});

// ------------------------------------------
// 4. API DUA ARAH UNTUK GURU BK (AMBIL & TANGGAPI)
// ------------------------------------------

// Ambil semua laporan
app.get('/api/reports', (req, res) => {
    res.json(reports);
});

// Guru BK memberikan tanggapan / mengubah status
app.put('/api/reports/:id', (req, res) => {
    const { id } = req.params;
    const { status, admin_response } = req.body;

    const report = reports.find(r => r.id == id);
    if (!report) {
        return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }

    if (status) report.status = status;
    if (admin_response !== undefined) report.admin_response = admin_response;

    res.json({ success: true, report });
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server Ruang Bicaramu berjalan di http://localhost:${PORT}`);
});