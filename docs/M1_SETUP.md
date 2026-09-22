# Aktivasi M1 - Supabase Auth khusus Isna

Kode M1 sudah disiapkan. Migrasi dan bootstrap belum diterapkan ke project Supabase.
Publishable key tidak dapat menjalankan administrasi database atau membuat owner.
Semua langkah SQL berikut dilakukan melalui SQL Editor sebagai administrator.

## 1. Pengaturan Auth

Di Supabase Dashboard, buka Authentication > Sign In / Providers:
- Email/password aktif.
- **Allow new users to sign up: OFF.** Pemeriksaan awal menemukan setting ini masih ON.
- Anonymous sign-ins: OFF.

URL Configuration > Site URL: `http://localhost:3000` selama development.
M1 memakai email/password langsung; tidak membutuhkan OAuth callback.
Untuk produksi, gunakan domain HTTPS sebenarnya. Jangan deploy data asli dahulu.

## 2. Buat tabel profiles dan RLS

Buka `supabase/migrations/202609220001_profiles.sql`, tinjau, lalu jalankan seluruh
isinya di SQL Editor project DEVELOPMENT. Jalankan satu kali; jangan menimpa tabel
profiles yang sudah ada. Migrasi ini hanya membuat profiles dan policy awal, bukan
tabel keuangan. Jika sudah ada schema lain, hentikan dan review perbedaannya dahulu.

Jika Data API dinonaktifkan, aktifkan untuk schema `public` agar pembacaan profiles
melalui REST tersedia. Jangan menambahkan grant/policy akses publik.

## 3. Verifikasi RLS dengan data sintetis

Sebelum bootstrap owner, jalankan `supabase/tests/profiles_rls.sql` pada project
DEVELOPMENT dengan tabel profiles kosong. Skrip menguji:
- anonymous tidak boleh membaca profile;
- owner hanya melihat profile sendiri;
- developer tidak mendapat akses owner;
- client tidak boleh menulis profile atau menaikkan role.

Skrip menggunakan identitas sintetis dan berakhir dengan ROLLBACK. Jika SQL Editor
berhenti karena error, jalankan ROLLBACK dan periksa error sebelum melanjutkan.
Jangan jalankan pada tabel profiles yang sudah berisi akun; skrip akan menolaknya.

## 4. Buat akun Isna

Authentication > Users > Add user > Create new user. Masukkan email dan password
Isna sendiri di dashboard; jangan kirim password ke chat atau simpan di repository.
Untuk akun yang dibuat administrator, pastikan status email confirmed sesuai
prosedur penyediaan akun tersebut. Salin User UID dari akun yang benar.

Buka `supabase/bootstrap-owner.sql`. Di SQL Editor, ganti UUID nol pada deklarasi
`owner_id` dengan UID akun Isna. Tinjau lalu jalankan. Jangan mengubah UUID nol pada
pemeriksaan guard; jangan commit UID asli ke file repository.

Skrip hanya menambahkan owner yang dipilih secara eksplisit. Tidak ada auto-promotion
untuk pengguna pertama, signup baru, atau role di user metadata. Role operator dan
developer tidak dapat mengakses aplikasi pada M1.

## 5. Konfigurasi aplikasi lokal

`web/.env.local`:
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_LOCALLY
```

`api/.env`:
```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_LOCALLY
```

Konfigurasi lokal dari pengguna sudah disimpan. Tidak perlu service-role key.
Restart server setelah perubahan environment. Perintah startup dan test ada di README.

## 6. Acceptance test langsung

1. Buka `/` tanpa session: harus berpindah ke `/login`.
2. Login dengan akun Isna: hanya owner yang dapat melihat shell.
3. Password salah: pesan umum, tanpa detail internal/provider.
4. Logout: kembali ke login; akses `/` ditolak lagi.
5. `GET /api/v1/me` tanpa token: 401; bearer token owner valid: 200.
6. Akun non-owner/token tidak valid: ditolak. Health tetap dapat diakses tanpa login.
7. Jalankan `npm run build` dan `npm run check:client-secrets` di `web/`.

Belum ada data order, saldo, fitur transfer, ataupun perhitungan keuangan. Jangan
menyatakan M1 selesai secara live sebelum migration, RLS test, dan owner login
berhasil diverifikasi. Pengujian otomatis HTTP memakai mock provider, bukan bukti
bahwa konfigurasi project Supabase live sudah benar.
