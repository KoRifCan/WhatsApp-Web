const langs = {
  id: {
    'app.name': 'WhatsApp Web',
    'app.use.on.computer': 'Gunakan WhatsApp di komputer Anda',
    'app.extension': 'WhatsApp Web adalah ekstensi dari akun ponsel Anda.',
    'qr.step1.title': 'Buka WhatsApp di ponsel Anda',
    'qr.step1.hint': 'Pastikan ponsel Anda terhubung ke internet',
    'qr.step2.title': 'Buka menu Perangkat Tertaut',
    'qr.step2.hint': 'Android: ⋮ > Perangkat tertaut > Hubungkan perangkat',
    'qr.step2.hint.ios': 'iPhone: Setelan > Perangkat tertaut > Hubungkan perangkat',
    'qr.step3.title': 'Arahkan kamera ke kode QR ini',
    'qr.step3.hint': 'Pindai kode untuk menautkan akun Anda',
    'qr.alt.text': 'Hubungkan dengan nomor telepon saja',
    'qr.alt.link': 'Gunakan nomor telepon',
    'phone.title': 'Hubungkan dengan nomor telepon',
    'phone.desc': 'Masukkan nomor telepon Anda untuk mendapatkan kode tautan yang akan dimasukkan di ponsel Anda.',
    'phone.label': 'Nomor Telepon',
    'phone.placeholder': '812 3456 7890',
    'phone.submit': 'Dapatkan kode',
    'phone.loading': 'Memproses...',
    'phone.alt': 'Gunakan kode QR',
    'code.title': 'Masukkan kode di ponsel Anda',
    'code.desc': 'Buka WhatsApp di ponsel Anda, buka Perangkat Tertaut > Hubungkan Perangkat, lalu masukkan kode di atas.',
    'code.alt': 'Gunakan kode QR',
    'loading': 'Menghubungkan...',
    'search.placeholder': 'Cari atau mulai chat baru',
    'search.placeholder.short': 'Cari chat',
    'msg.you': 'Anda',
    'msg.input': 'Ketik pesan',
    'no.chat': 'Tidak ada chat',
    'nochat.title': 'WhatsApp Web',
    'nochat.subtitle': 'Kirim dan terima pesan tanpa perlu membuka ponsel.',
    'nochat.hint': 'Pilih chat dari sidebar untuk mulai berbicara',
    'chat.status': 'WhatsApp',
    'theme.toggle.dark': 'Ganti ke tema terang',
    'theme.toggle.light': 'Ganti ke tema gelap',
    'logout.confirm': 'Putuskan sambungan WhatsApp?',
    'logout.title': 'Putuskan sambungan',
    'encryption': 'Pesan pribadi Anda dilindungi dengan enkripsi end-to-end',
    'country.select': 'Pilih negara',
    'country.search': 'Cari negara...',
  },
  en: {
    'app.name': 'WhatsApp Web',
    'app.use.on.computer': 'Use WhatsApp on your computer',
    'app.extension': 'WhatsApp Web is an extension of your phone account.',
    'qr.step1.title': 'Open WhatsApp on your phone',
    'qr.step1.hint': 'Make sure your phone is connected to the internet',
    'qr.step2.title': 'Go to Linked Devices',
    'qr.step2.hint': 'Android: ⋮ > Linked devices > Link a device',
    'qr.step2.hint.ios': 'iPhone: Settings > Linked devices > Link a device',
    'qr.step3.title': 'Point your camera at this QR code',
    'qr.step3.hint': 'Scan the code to link your account',
    'qr.alt.text': 'Connect using your phone number instead',
    'qr.alt.link': 'Use phone number',
    'phone.title': 'Link with phone number',
    'phone.desc': 'Enter your phone number to get a linking code to enter on your phone.',
    'phone.label': 'Phone Number',
    'phone.placeholder': '812 3456 7890',
    'phone.submit': 'Get code',
    'phone.loading': 'Processing...',
    'phone.alt': 'Scan QR code instead',
    'code.title': 'Enter code on your phone',
    'code.desc': 'Open WhatsApp on your phone, go to Linked Devices > Link a Device, then enter the code above.',
    'code.alt': 'Scan QR code instead',
    'loading': 'Connecting...',
    'search.placeholder': 'Search or start new chat',
    'search.placeholder.short': 'Search chat',
    'msg.you': 'You',
    'msg.input': 'Type a message',
    'no.chat': 'No chats',
    'nochat.title': 'WhatsApp Web',
    'nochat.subtitle': 'Send and receive messages without opening your phone.',
    'nochat.hint': 'Select a chat from the sidebar to start talking',
    'chat.status': 'WhatsApp',
    'theme.toggle.dark': 'Switch to light theme',
    'theme.toggle.light': 'Switch to dark theme',
    'logout.confirm': 'Disconnect WhatsApp?',
    'logout.title': 'Disconnect',
    'encryption': 'Your personal messages are protected with end-to-end encryption',
    'country.select': 'Select country',
    'country.search': 'Search countries...',
  },
}

let currentLang = 'id'
try {
  const saved = localStorage.getItem('wa_lang')
  if (saved && langs[saved]) currentLang = saved
} catch {}

export function t(key) {
  return langs[currentLang]?.[key] || langs['en']?.[key] || key
}

export function getLang() {
  return currentLang
}

export function setLang(lang) {
  if (langs[lang]) {
    currentLang = lang
    try { localStorage.setItem('wa_lang', lang) } catch {}
  }
}

export function useLang() {
  return [currentLang, setLang]
}

export default langs
