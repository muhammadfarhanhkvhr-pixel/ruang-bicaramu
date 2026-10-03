require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'your-supabase-anon-key';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Menyajikan file html dari folder public

// Session untuk autentikasi Admin/Guru BK
app.use(session({
    secret: process.env.SESSION_SECRET || 'rahasia-guru-bk-super-aman',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 // Valid selama 24 jam
    }
}));

// Helper untuk membuat Kode Tiket Acak (Contoh: BK-8A2F)
function generateTicketCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'BK-';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Middleware Proteksi Halaman Admin
function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
    }
}

// ==========================================
// ENDPOINT SISWA (PUBLIC)
// ==========================================

// 1. Kirim Laporan Baru
app.post('/api/reports', async (req, res) => {
    try {
        const { category, description } = req.body;

        if (!category || !description) {
            return res.status(400).json({ success: false, message: 'Kategori dan deskripsi wajib diisi.' });
        }

        const ticketCode = generateTicketCode();

        const { data, error } = await supabase
            .from('reports')
            .insert([
                {
                    ticket_code: ticketCode,
                    category: category,
                    description: description,
                    status: 'Pending',
                    admin_response: ''
                }
            ])
            .select();

        if (error) throw error;

        return res.json({
            success: true,
            ticketCode: ticketCode,
            message: 'Laporan berhasil dibuat.'
        });
    } catch (err) {
        console.error('Error insert report:', err.message);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan laporan ke server.' });
    }
});

// 2. Cek Laporan Berdasarkan Kode Tiket
app.get('/api/reports/check/:ticketCode', async (req, res) => {
    try {
        const ticketCode = req.params.ticketCode.toUpperCase();

        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('ticket_code', ticketCode)
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, message: 'Kode tiket tidak ditemukan.' });
        }

        return res.json({
            success: true,
            report: data
        });
    } catch (err) {
        console.error('Error check report:', err.message);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
});

// ==========================================
// ENDPOINT ADMIN / GURU BK (PROTECTED)
// ==========================================

// 1. Check Status Session Login Admin
app.get('/api/admin/check-auth', (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.json({ authenticated: true });
    }
    return res.json({ authenticated: false });
});

// 2. Login Admin
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminBK123'; // Password Login Guru BK

    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true, message: 'Login berhasil.' });
    } else {
        return res.status(401).json({ success: false, message: 'Kata sandi salah!' });
    }
});

// 3. Logout Admin
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal logout.' });
        }
        res.clearCookie('connect.sid');
        return res.json({ success: true, message: 'Logout berhasil.' });
    });
});

// 4. Ambil Seluruh Laporan (Wajib Login)
app.get('/api/admin/reports', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.json({ success: true, reports: data });
    } catch (err) {
        console.error('Error fetch reports:', err.message);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data dari database.' });
    }
});

// 5. Simpan Balasan BK (Wajib Login)
app.post('/api/admin/reply', requireAuth, async (req, res) => {
    try {
        const { ticketCode, status, adminResponse } = req.body;

        const { data, error } = await supabase
            .from('reports')
            .update({
                status: status || 'Diproses',
                admin_response: adminResponse
            })
            .eq('ticket_code', ticketCode)
            .select();

        if (error) throw error;

        return res.json({ success: true, message: 'Balasan berhasil disimpan.' });
    } catch (err) {
        console.error('Error reply report:', err.message);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan balasan.' });
    }
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});