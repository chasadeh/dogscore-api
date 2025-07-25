const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();

// לוג של כל בקשה נכנסת
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ▶️ ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// פונקציית דירוג חלבון-שומן-אפר
function gradeDogFood({ protein, fat, ash }) {
  const points = [];
  let score = 0;

  if (typeof protein === 'number') {
    if (protein >= 28) score += 2;
    else if (protein >= 22) score += 1;
    else points.push('חלבון נמוך');
  } else points.push('חלבון חורג או חסר');

  if (typeof fat === 'number') {
    if (fat >= 12) score += 2;
    else if (fat >= 8) score += 1;
    else points.push('שומן נמוך');
  } else points.push('שומן חורג או חסר');

  if (typeof ash === 'number') {
    if (ash <= 9) score += 1;
    else if (ash > 12) points.push('אפר גבוה מהמומלץ');
  } else points.push('אפר חורג או חסר');

  let grade = 'F';
  if (score >= 5) grade = 'A';
  else if (score >= 4) grade = 'B';
  else if (score >= 3) grade = 'C';
  else if (score >= 2) grade = 'D';

  const details = [];
  if (typeof protein === 'number') details.push(`חלבון: ${protein}%`);
  if (typeof fat === 'number')     details.push(`שומן: ${fat}%`);
  if (typeof ash === 'number')     details.push(`אפר: ${ash}%`);

  return { grade, summary: `ציון ${grade} לפי DogScore`, points, details };
}

// שליפה חכמה עם חיפוש באתר WooCommerce
async function fetchFromSpets(productName) {
  try {
    // השתמש ב-post_type=product כדי להגביל למוצרים
    const searchUrl = `https://www.spets.co.il/?post_type=product&s=${encodeURIComponent(productName)}`;
    console.log('🔎 Searching URL:', searchUrl);
    const searchRes = await axios.get(searchUrl);
    const $search = cheerio.load(searchRes.data);

    // מציאת הקישור הראשון למוצר מתוך עוגיות hrefs המכילות '/product/'
    const links = $search('a[href*="/product/"]')
      .map((i, el) => {
        let href = $search(el).attr('href');
        if (href.startsWith('/')) href = `https://www.spets.co.il${href}`;
        return href;
      }).get();

    if (!links.length) {
      console.error('❌ No product link found on search page');
      return null;
    }

    const productUrl = links[0];
    console.log('🔗 Fetching product page:', productUrl);
    const resPage = await axios.get(productUrl);
    const $ = cheerio.load(resPage.data);

    // ניסיון למצוא את הכותרת 'אנליזה תזונתית'
    let nutritionText = '';
    const header = $('h2, h3, h4')
      .filter((i, el) => $(el).text().trim() === 'אנליזה תזונתית')
      .first();
    if (header.length) {
      nutritionText = header.next('p').text().trim();
    } else {
      // גיבוי: בחר פסקה עם 'חלבון:' בפנים
      nutritionText = $('p').filter((i, el) => /חלבון\s*:/.test($(el).text())).first().text().trim();
    }
    console.log('🔍 nutritionText:', nutritionText);

    const proteinMatch = nutritionText.match(/חלבון\s*:?\s*([\d.]+)%/);
    const fatMatch     = nutritionText.match(/שומן\s*:?\s*([\d.]+)%/);
    const ashMatch     = nutritionText.match(/אפר\s*:?\s*([\d.]+)%/);

    const protein = proteinMatch ? parseFloat(proteinMatch[1]) : null;
    const fat     = fatMatch     ? parseFloat(fatMatch[1])     : null;
    const ash     = ashMatch     ? parseFloat(ashMatch[1])     : null;

    if (protein == null && fat == null && ash == null) {
      throw new Error('No valid nutrition data found after search');
    }

    return { protein, fat, ash };
  } catch (err) {
    console.error('❌ fetchFromSpets error:', err.message);
    return null;
  }
}

app.post('/api/dogscore', async (req, res, next) => {
  try {
    const { productName } = req.body;
    if (!productName) return res.status(400).json({ error: 'חסר שם מוצר.' });

    const data = await fetchFromSpets(productName);
    if (!data) return res.status(404).json({ error: 'לא נמצאו נתונים תקפים עבור המוצר הזה.' });

    const result = gradeDogFood(data);
    result.product = productName;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// טיפול גלובלי בשגיאות
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', err);
  res.status(500).json({ error: 'שגיאת שרת פנימית.' });
});

// הפעלת השרת
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
