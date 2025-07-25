const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// grading logic
function gradeDogFood({ protein, fat, ash }) {
  const points = [];
  let score = 0;

  // חלבון
  if (typeof protein === 'number') {
    if (protein >= 28) score += 2;
    else if (protein >= 22) score += 1;
    else points.push('חלבון נמוך');
  } else {
    points.push('חלבון חורג או חסר');
  }

  // שומן
  if (typeof fat === 'number') {
    if (fat >= 12) score += 2;
    else if (fat >= 8) score += 1;
    else points.push('שומן נמוך');
  } else {
    points.push('שומן חורג או חסר');
  }

  // אפר
  if (typeof ash === 'number') {
    if (ash <= 9) score += 1;
    else if (ash > 12) points.push('אפר גבוה מהמומלץ');
    // אחרת: אפר ברמה מקובלת, לא מוסיפים נקודה
  } else {
    points.push('אפר חורג או חסר');
  }

  // קביעת דרגה
  let grade = 'F';
  if (score >= 5) grade = 'A';
  else if (score >= 4) grade = 'B';
  else if (score >= 3) grade = 'C';
  else if (score >= 2) grade = 'D';

  // פירוט נתונים
  const details = [];
  if (typeof protein === 'number') details.push(`חלבון: ${protein}%`);
  if (typeof fat === 'number') details.push(`שומן: ${fat}%`);
  if (typeof ash === 'number') details.push(`אפר: ${ash}%`);

  return {
    grade,
    summary: `ציון ${grade} לפי DogScore`,
    points,
    details
  };
}

// שליפה ופרסינג מהאתר
async function fetchFromSpets(productName) {
  const slug = productName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
  const url = `https://www.spets.co.il/product/${slug}/`;

  try {
    console.log('🔗 Fetching URL:', url);
    const res = await axios.get(encodeURI(url));
    const $ = cheerio.load(res.data);

    // בודקים כותרות h2/h3/h4 עם הטקסט 'אנליזה תזונתית'
    const header = $('h2, h3, h4')
      .filter((i, el) => $(el).text().trim() === 'אנליזה תזונתית')
      .first();
    const nutritionText = header.next('p').text().trim();
    console.log('🔍 nutritionText:', nutritionText);

    const proteinMatch = nutritionText.match(/חלבון\s*:?[\s]*([\d.]+)%/);
    const fatMatch     = nutritionText.match(/שומן\s*:?[\s]*([\d.]+)%/);
    const ashMatch     = nutritionText.match(/אפר\s*:?[\s]*([\d.]+)%/);

    const protein = proteinMatch ? parseFloat(proteinMatch[1]) : null;
    const fat     = fatMatch     ? parseFloat(fatMatch[1])     : null;
    const ash     = ashMatch     ? parseFloat(ashMatch[1])     : null;

    if (protein == null && fat == null && ash == null) {
      throw new Error('No valid nutrition data found');
    }

    return { protein, fat, ash };
  } catch (err) {
    console.error('❌ fetchFromSpets error:', err.message);
    return null;
  }
}

// API endpoints
app.post('/api/dogscore', async (req, res) => {
  const { productName } = req.body;
  if (!productName) {
    return res.status(400).json({ error: 'חסר שם מוצר.' });
  }

  const data = await fetchFromSpets(productName);
  if (!data) {
    return res.status(404).json({ error: 'לא נמצאו נתונים תקפים עבור המוצר הזה.' });
  }

  const result = gradeDogFood(data);
  result.product = productName;
  res.json(result);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
