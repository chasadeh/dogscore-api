const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function gradeDogFood({ protein, fat, ash }) {
  const points = [];
  let score = 0;

  if (protein >= 28) {
    score += 2;
  } else if (protein >= 22) {
    score += 1;
  } else {
    points.push('חלבון נמוך');
  }

  if (fat >= 12) {
    score += 2;
  } else if (fat >= 8) {
    score += 1;
  } else {
    points.push('שומן נמוך');
  }

  if (ash && ash <= 9) {
    score += 1;
  } else if (ash && ash > 12) {
    points.push('אפר גבוה מהמומלץ');
  } else {
    points.push('אפר ברמה מקובלת');
  }

  let grade = 'F';
  if (score >= 5) grade = 'A';
  else if (score >= 4) grade = 'B';
  else if (score >= 3) grade = 'C';
  else if (score >= 2) grade = 'D';

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

async function fetchFromSpets(productName) {
  const slug = productName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
  const url = `https://www.spets.co.il/product/${slug}/`;

  try {
    console.log('🔗 Fetching URL:', url);
    const res = await axios.get(encodeURI(url));
    const $ = cheerio.load(res.data);

    const nutritionText = $('#אנאליזה תזונתית').next('p').text();
    console.log('🔍 nutritionText:', nutritionText);

    const protein = parseFloat(nutritionText.match(/חלבון\s*:?[\s]*([\d.]+)%/)?.[1] || '0');
    const fat = parseFloat(nutritionText.match(/שומן\s*:?[\s]*([\d.]+)%/)?.[1] || '0');
    const ash = parseFloat(nutritionText.match(/אפר\s*:?[\s]*([\d.]+)%/)?.[1] || '0');

    return { protein, fat, ash };
  } catch (err) {
    console.log('❌ fetchFromSpets error:', err.message);
    return null;
  }
}

app.post('/api/dogscore', async (req, res) => {
  const { productName } = req.body;
  if (!productName) return res.status(400).json({ error: 'חסר שם מוצר.' });

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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
