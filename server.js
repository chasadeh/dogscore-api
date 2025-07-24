const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));  // לתמיכת index.html בתיקיית public

function gradeDogFood({ protein, fat, ash, ingredients }) {
  let score = 0;
  const details = [];

  if (protein >= 28) {
    score += 20;
    details.push("חלבון גבוה");
  } else if (protein >= 22) {
    score += 10;
    details.push("חלבון בינוני");
  } else {
    score += 5;
    details.push("חלבון נמוך");
  }

  if (fat >= 15) {
    score += 10;
    details.push("שומן גבוה");
  }

  if (ash <= 9) {
    score += 5;
    details.push("אפר ברמה מקובלת");
  }

  if (/grain/i.test(ingredients) && !/grain[-\s]?free/i.test(ingredients)) {
    score -= 10;
    details.push("מכיל דגנים");
  } else if (/grain[-\s]?free/i.test(ingredients)) {
    score += 10;
    details.push("ללא דגנים");
  }

  if (/fresh|real|meat/i.test(ingredients)) {
    score += 5;
    details.push("מקור חלבון איכותי");
  }

  if (/chicken meal|lamb meal|fish meal/i.test(ingredients)) {
    score += 3;
    details.push("קמחי בשר איכותיים");
  }

  if (/by-product|corn|wheat|soy/i.test(ingredients)) {
    score -= 5;
    details.push("רכיבים זולים או בעייתיים");
  }

  const total = Math.min(score, 110);
  let grade = "C";

  if (total >= 110) grade = "A+";
  else if (total >= 95) grade = "A";
  else if (total >= 85) grade = "B";
  else if (total >= 70) grade = "C";
  else if (total >= 55) grade = "D";
  else grade = "F";

  return { grade, score: total, details };
}

async function fetchFromSpets(productName) {
  const slug = productName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
  const url = `https://www.spets.co.il/product/primordial-grain-free-for-adult-dogs-${slug}/`;

  try {
    const res = await axios.get(url);
    const html = res.data;
    const $ = cheerio.load(html);

    const ingredients = $('#מאפייני המזון').next('h3 + p').text().trim();
    const nutritionText = $('#אנאליזה תזונתית').next('p').text().trim();

    const proteinMatch = nutritionText.match(/חלבון\s*:?[\s ]*([\d.]+)%/);
    const fatMatch = nutritionText.match(/שומן\s*:?[\s ]*([\d.]+)%/);
    const ashMatch = nutritionText.match(/אפר\s*:?[\s ]*([\d.]+)%/);

    const protein = proteinMatch ? parseFloat(proteinMatch[1]) : 0;
    const fat = fatMatch ? parseFloat(fatMatch[1]) : 0;
    const ash = ashMatch ? parseFloat(ashMatch[1]) : 0;

    return { protein, fat, ash, ingredients };
  } catch (err) {
    console.error("שגיאה ב-fetchFromSpets:", err.message);
    return null;
  }
}

app.post('/api/dogscore', async (req, res) => {
  const { productName } = req.body;
  const data = await fetchFromSpets(productName);
  if (!data) {
    return res.status(404).json({ error: 'לא נמצאו נתונים מתאימים' });
  }

  const { grade, score, details } = gradeDogFood(data);
  res.json({
    product: productName,
    grade,
    score,
    summary: `ציון ${grade} לפי DogScore`,
    points: details,
    details
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
