const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

const app = express();

// 1. Inisialisasi Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("CRITICAL ERROR: SUPABASE_URL atau SUPABASE_KEY belum terpasang di Environment Variables!");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Middleware Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Konfigurasi Sesi (Session) untuk Admin
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'kunci_rahasia_sesi_bk_default',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 Hari
  })
);

// Serve Static Files dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// Middleware Proteksi Halaman Admin
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
}

// ==========================================
// API ROUTES FOR SISWA (PENGADUAN)
// ==========================================

// API: Kirim Laporan Pengaduan Baru
app.post('/api/reports', async (req, res) => {
  try {
    const { category, description } = req.body;

    if (!category || !description) {
      return res.status(400).json({ success: false, message: 'Kategori dan deskripsi wajib diisi.' });
    }

    // Generate kode tiket acak (contoh: BK-7A29B)
    const ticket_code = 'BK-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // Simpan ke database Supabase
    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          ticket_code,
          category,
          description,
          status: 'Pending',
          admin_response: ''
        }
      ])
      .select();

    if (error) {
      console.error('Supabase Error (Insert):', error);
      return res.status(500).json({ success: false, message: 'Gagal menyimpan laporan ke database: ' + error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Laporan berhasil terkirim!',
      ticket_code: ticket_code,
      data: data[0]
    });
  } catch (err) {
    console.error('Server Error (Post Report):', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan internal pada server.' });
  }
});

// API: Cek Status Laporan Berdasarkan Kode Tiket
app.get('/api/reports/check/:ticketCode', async (req, res) => {
  try {
    const { ticketCode } = req.params;

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('ticket_code', ticketCode.trim().toUpperCase())
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Kode tiket tidak ditemukan.' });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Server Error (Check Ticket):', err);
    return res.status(500).json({ success: false, message: 'Gagal mengecek status laporan.' });
  }
});

// ==========================================
// API ROUTES FOR ADMIN
// ==========================================

// API: Login Admin
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'adminBK123';

  if (password === adminPassword) {
    req.session.isAdmin = true;
    return res.status(200).json({ success: true, message: 'Login berhasil!' });
  } else {
    return res.status(401).json({ success: false, message: 'Password salah.' });
  }
});

// API: Logout Admin
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal logout.' });
    }
    res.clearCookie('connect.sid');
    return res.status(200).json({ success: true, message: 'Berhasil logout.' });
  });
});

// API: Cek Status Sesi Login Admin
app.get('/api/admin/session', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.status(200).json({ authenticated: true });
  }
  return res.status(200).json({ authenticated: false });
});

// API: Ambil Semua Laporan (Hanya untuk Admin yang sudah login)
app.get('/api/admin/reports', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Error (Fetch Admin Reports):', error);
      return res.status(500).json({ success: false, message: 'Gagal mengambil data dari database: ' + error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Server Error (Admin Fetch):', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
});

// API: Update Status & Tanggapan Admin
app.put('/api/admin/reports/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_response } = req.body;

    const { data, error } = await supabase
      .from('reports')
      .update({ status, admin_response })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase Error (Update Report):', error);
      return res.status(500).json({ success: false, message: 'Gagal memperbarui laporan.' });
    }

    return res.status(200).json({ success: true, message: 'Laporan berhasil diperbarui.', data });
  } catch (err) {
    console.error('Server Error (Update Report):', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});

module.exports = app;