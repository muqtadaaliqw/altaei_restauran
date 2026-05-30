# 🚀 دليل رفع المشروع على GitHub وربطه مع Railway

## 📁 الملفات المطلوبة للرفع

| الملف | الوصف | إجراء |
|-------|-------|-------|
| `server.js` | السيرفر Backend | تعديل |
| `index.html` | الواجهة الأمامية SPA | تعديل |
| `package.json` | إعدادات Node.js | تعديل |
| `Procfile` | أمر التشغيل على Railway | رفع جديد |
| `railway.json` | إعدادات Railway | رفع جديد |
| `.gitignore` | ملفات يتم تجاهلها | رفع جديد |
| `README.md` | التوثيق | تعديل |

---

## 📝 الخطوة 1: تعديل ملف موجود (Edit)

### 1. افتح مستودعك على GitHub:
```
https://github.com/muqtadaaliqw/altaei_restauran
```

### 2. اضغط على اسم الملف

### 3. اضغط ✏️ (أيقونة القلم)

### 4. احذف كل المحتوى القديم:
```
Ctrl + A  →  Delete
```

### 5. افتح الملف الجديد من جهازك:
- افتح `server.js` بـ Notepad
- اضغط `Ctrl + A` ثم `Ctrl + C`

### 6. الصق في GitHub:
```
Ctrl + V
```

### 7. اضغط **Commit changes** → **Commit changes**

---

## 📤 الخطوة 2: رفع ملف جديد (Upload)

### 1. في صفحة المستودع اضغط:
```
Add file → Upload files
```

### 2. اسحب الملف أو اضغط:
```
choose your files
```

### 3. اضغط **Commit changes**

---

## ⚡ الخطوة 3: التحقق من Railway

بعد رفع كل الملفات، Railway يحدّث تلقائياً خلال **60 ثانية**.

تحقق من:
- 🔗 `https://altaeirestauran-production.up.railway.app` — الموقع
- 🔧 `https://altaeirestauran-production.up.railway.app/dev` — لوحة المطوّر
- 🏪 `https://altaeirestauran-production.up.railway.app/admin` — لوحة الأدمن

---

## 🔑 إعدادات مهمة

### متغير البيئة في Railway:
1. افتح لوحة Railway
2. اذهب إلى **Variables**
3. أضف:
```
DEV_PASS = dev@muqtada2025
```

---

## 📋 قائمة الملفات النهائية

```
altaei_restauran/
├── server.js          ✅ السيرفر
├── index.html         ✅ الواجهة
├── package.json       ✅ إعدادات Node
├── Procfile           ✅ أمر التشغيل
├── railway.json       ✅ إعدادات Railway
├── .gitignore         ✅ تجاهل الملفات
├── README.md          ✅ التوثيق
└── data/              📁 (يُنشأ تلقائياً)
    ├── restaurants.json
    ├── orders.json
    ├── tables.json
    └── dev-config.json
```

---

## 🎯 بعد الرفع

1. **لوحة المطوّر:**
   - افتح: `https://altaeirestauran-production.up.railway.app/dev`
   - كلمة المرور: `dev@muqtada2025`

2. **إنشاء مطعم جديد:**
   - من تبويب "➕ مطعم جديد"
   - أدخل الاسم واسم المستخدم
   - انسخ الرابط: `/menu/[slug]`

3. **لوحة الأدمن:**
   - افتح: `https://altaeirestauran-production.up.railway.app/admin`
   - سجل الدخول باسم المستخدم وكلمة المرور

4. **المنيو العامة:**
   - افتح: `https://altaeirestauran-production.up.railway.app/menu/[slug]`

---

## ⚠️ ملاحظات مهمة

- **لا ترفع** مجلد `data/` على GitHub (موجود في `.gitignore`)
- البيانات تُحفظ في Railway تلقائياً
- عند إعادة تشغيل السيرفر، البيانات تبقى محفوظة

---

## 🆘 الدعم

إذا واجهت أي مشكلة:
1. تحقق من Logs في Railway
2. تأكد من رفع كل الملفات
3. تأكد من إعداد `DEV_PASS` في Variables
