const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// דירוג איכות
function gradeDogFood({ protein, fat, ash, ingredients }) {
  let score = 0;
  const details = [];

  if (protein >= 28) {
    score += 20; details.push("חלבון גבוה");
  } else if (protein >= 22) {
    score += 10; details.push("חלבון בינוני");
  } else {
    score += 5; details.push("חלבון נמוך");
  }

  if (fat >= 15) {
    score += 10; details.push("שומן גבוה");
  }

  if (ash <= 9) {
    score += 5; details.push("אפר ברמה מקובלת");
  }

  if (/grain/i.test(ingredients) && !/grain[-\s]?free/i.test(ingredients)) {
    score -= 10; details.push("מכיל דגנים");
  } else if (/grain[-\s]?free/i.test(ingredients)) {
    score += 10; details.push("ללא דגנים");
  }

  if (/fresh|real|meat/i.test(ingredients)) {
    score += 5; details.push("מקור חלבון איכותי");
  }

  if (/chicken meal|lamb meal|fish meal/i.test(ingredients)) {
    score += 3; details.push("קמחי בשר איכותיים");
  }

  if (/by-product|corn|wheat|soy/i.test(ingredients)) {
    score -= 5; details.push("רכיבים זולים או בעייתיים");
  }

  const total = Math.min(score, 110);
  let grade = "C", color = "#FFA500";

  if (total >= 110) { grade = "A+"; color = "#006400"; }
  else if (total >= 95) { grade = "A"; color = "#009900"; }
  else if (total >= 85) { grade = "B"; color = "#33cc33"; }
  else if (total >= 70) { grade = "C"; color = "#FFA500"; }
  else if (total >= 55) { grade = "D"; color = "#FF6666"; }
  else { grade = "F"; color = "#CC0000"; }

  return { grade, score: total, details, color };
}

// גרידת נתונים
async function fetchFromSpets(productName) {
  const slug = productName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
  const url = `https://www.spets.co.il/product/primordial-grain-free-for-adult-dogs-${slug}/`;

  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const ingredients = $('#מאפייני המזון').next('h3 + p').text().trim();
    const nutritionText = $('#אנאליזה תזונתית').next('p').text();
    const protein = parseFloat(nutritionText.match(/חלבון\s*([\d.]+)%/)?.[1]) || 0;
    const fat = parseFloat(nutritionText.match(/שומן\s*([\d.]+)%/)?.[1]) || 0;
    const ash = parseFloat(nutritionText.match(/אפר\s*([\d.]+)%/)?.[1]) || null;

    return { protein, fat, ash, ingredients };
  } catch {
    return null;
  }
}

app.post('/api/dogscore', async (req, res) => {
  const { productName } = req.body;
  const data = await fetchFromSpets(productName);
  if (!data) return res.status(404).json({ error: 'לא נמצאו נתונים עבור המוצר הזה.' });

  const rating = gradeDogFood(data);
  const result = {
    product: productName,
    grade: rating.grade,
    score: rating.score,
    summary: `ציון ${rating.grade} לפי DogScore`,
    points: rating.details,
    details: rating.details,
    color: rating.color
  };

  res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
