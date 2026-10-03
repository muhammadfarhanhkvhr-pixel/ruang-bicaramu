const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase REST API
const SUPABASE_URL = 'https://dasyopaotgsgxvizhqna.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wISyIFeMATmrnp2I7kTvyg_B6UQfTT1';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SandiBK2026Secure!';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Header standar untuk panggil Supabase API
const getHeaders = () => ({
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
});

// 1. API Login Admin
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.json({ success: true, message: 'Login berhasil!' });
    }
    return res.status(401).json({ success: false, message: 'Kata sandi salah!' });
});

// 2. API Kirim Laporan Baru (Siswa -> Supabase)
app.post('/api/reports', async (req, res) => {
    try {
        const { category, description } = req.body;
        
        if (!category || !description) {
            return res.status(400).json({ success: false, message: 'Kategori dan deskripsi wajib diisi!' });
        }

        const ticketCode = 'BK-' + Math.random().toString(36).substring(2, 6).toUpperCase();

        const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                ticket_code: ticketCode,
                category: category,
                description: description,
                status: 'Pending',
                admin_response: ''
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Supabase Error:', errText);
            throw new Error('Gagal menyimpan ke database');
        }

        res.json({
            success: true,
            message: 'Laporan berhasil terkirim!',
            ticketCode: ticketCode,
            ticket_code: ticketCode
        });
    } catch (err) {
        console.error('Error Save Report:', err);
        res.status(500).json({ success: false, message: 'Gagal menyimpan laporan ke database.' });
    }
});

// 3. API Cek Laporan berdasarkan Kode Tiket (Siswa)
app.get('/api/reports/check/:ticketCode', async (req, res) => {
    try {
        const { ticketCode } = req.params;
        const formattedCode = ticketCode.trim().toUpperCase();

        const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?ticket_code=eq.${formattedCode}`, {
            method: 'GET',
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok || !data || data.length === 0) {
            return res.status(404).json({ success: false, message: 'Kode tiket tidak ditemukan.' });
        }

        const report = data[0];

        res.json({
            success: true,
            report: {
                ticketCode: report.ticket_code,
                category: report.category,
                description: report.description,
                status: report.status,
                adminResponse: report.admin_response,
                createdAt: report.created_at
            }
        });
    } catch (err) {
        console.error('Error Check Report:', err);
        res.status(500).json({ success: false, message: 'Gagal mengambil data laporan.' });
    }
});

// 4. API Ambil Semua Laporan (Portal BK Admin)
app.get('/api/admin/reports', async (req, res) => {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?order=created_at.desc`, {
            method: 'GET',
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error('Gagal ambil data');
        }

        const formattedReports = data.map(item => ({
            id: item.id,
            ticketCode: item.ticket_code,
            category: item.category,
            description: item.description,
            status: item.status,
            adminResponse: item.admin_response,
            createdAt: item.created_at
        }));

        res.json({ success: true, reports: formattedReports });
    } catch (err) {
        console.error('Error Fetch Admin Reports:', err);
        res.status(500).json({ success: false, message: 'Gagal mengambil laporan admin.' });
    }
});

// 5. API Balas & Update Status Laporan (Portal BK Admin)
app.post('/api/admin/reply', async (req, res) => {
    try {
        const { ticketCode, status, adminResponse } = req.body;

        const response = await fetch(`${SUPABASE_URL}/rest/v1/reports?ticket_code=eq.${ticketCode}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({
                status: status || 'Diproses',
                admin_response: adminResponse
            })
        });

        if (!response.ok) {
            throw new Error('Gagal memperbarui balasan');
        }

        res.json({ success: true, message: 'Balasan berhasil disimpan!' });
    } catch (err) {
        console.error('Error Reply Report:', err);
        res.status(500).json({ success: false, message: 'Gagal memperbarui balasan.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});