const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function gradeDogFood({ protein, fat, ash }) {
  const points = [];
  const details = [];
  let score = 0;

  if (protein >= 28) {
    score += 3;
    points.push('חלבון גבוה');
  } else if (protein >= 24) {
    score += 2;
    points.push('חלבון בינוני');
  } else {
    points.push('חלבון נמוך');
  }
  details.push(`חלבון: ${protein}%`);

  if (fat >= 14) {
    score += 2;
    points.push('שומן גבוה');
  } else if (fat >= 10) {
    score += 1;
    points.push('שומן בינוני');
  } else {
    points.push('שומן נמוך');
  }
  details.push(`שומן: ${fat}%`);

  if (ash <= 9) {
    score += 1;
    points.push('אפר ברמה מקובלת');
  } else {
    points.push('אפר גבוה');
  }
  details.push(`אפר: ${ash}%`);

  let grade = 'F';
  if (score >= 6) grade = 'A';
  else if (score >= 5) grade = 'B';
  else if (score >= 4) grade = 'C';
  else if (score >= 3) grade = 'D';

  return {
    grade,
    summary: `ציון ${grade} לפי DogScore`,
    points,
    details
  };
}

async function fetchFromSpets(productName) {
  const slug = productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  const url = `https://www.spets.co.il/product/primordial-grain-free-for-adult-dogs-${slug}/`;

  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const nutritionText = $('#אנאליזה תזונתית').next('p').text();

    const protein = parseFloat(nutritionText.match(/חלבון\s*([\d.]+)%/)?.[1] || 0);
    const fat = parseFloat(nutritionText.match(/שומן\s*([\d.]+)%/)?.[1] || 0);
    const ash = parseFloat(nutritionText.match(/אפר\s*([\d.]+)%/)?.[1] || 0);

    return { protein, fat, ash };
  } catch (err) {
    console.error('שגיאה בסריקה:', err.message);
    return null;
  }
}

app.post('/api/dogscore', async (req, res) => {
  const { productName } = req.body;
  const data = await fetchFromSpets(productName);
  if (!data) {
    return res.status(404).json({ error: 'לא נמצאו נתונים תקפים עבור המוצר הזה.' });
  }
  const result = gradeDogFood(data);
  result.product = productName;
  res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
