const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfirmasi Koneksi Supabase
const SUPABASE_URL = 'https://dasyopaotgsgxvizhqna.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wISyIFeMATmrnp2I7kTvyg_B6UQfTT1';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Password Admin BK
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SandiBK2026Secure!';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. API Login Admin (Pemeriksaan Password)
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

        const { data, error } = await supabase
            .from('reports')
            .insert([
                { 
                    ticket_code: ticketCode, 
                    category, 
                    description, 
                    status: 'Pending', 
                    admin_response: '' 
                }
            ])
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Laporan berhasil terkirim!',
            ticketCode: ticketCode
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

        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('ticket_code', ticketCode.trim().toUpperCase())
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, message: 'Kode tiket tidak ditemukan.' });
        }

        res.json({
            success: true,
            report: {
                ticketCode: data.ticket_code,
                category: data.category,
                description: data.description,
                status: data.status,
                adminResponse: data.admin_response,
                createdAt: data.created_at
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
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

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

        const { data, error } = await supabase
            .from('reports')
            .update({ 
                status: status || 'Diproses', 
                admin_response: adminResponse 
            })
            .eq('ticket_code', ticketCode)
            .select();

        if (error || !data.length) {
            return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan untuk diperbarui.' });
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