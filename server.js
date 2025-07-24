const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function gradeDogFood({ protein, fat, ash }) {
  const score = {
    grade: 'C',
    summary: '',
    points: [],
    details: []
  };

  if (protein >= 30) {
    score.points.push('חלבון גבוה');
    score.details.push('תכולת חלבון גבוהה מהממוצע');
  } else if (protein >= 24) {
    score.points.push('חלבון תקין');
    score.details.push('תכולת חלבון סבירה');
  } else if (protein) {
    score.points.push('חלבון נמוך');
    score.details.push('תכולת חלבון מתחת לרצוי');
    score.grade = 'F';
  }

  if (ash && ash > 10) {
    score.points.push('אפר גבוה');
    score.details.push('אחוז אפר גבוה מהרצוי');
    score.grade = 'D';
  } else if (ash) {
    score.points.push('אפר ברמה מקובלת');
    score.details.push('אחוז אפר תקין');
  }

  if (protein >= 36 && fat >= 18) {
    score.grade = 'A';
    score.summary = 'ציון A לפי DogScore – פורמולה עשירה עם חלבון ושומן גבוהים';
  } else if (protein >= 32) {
    score.grade = 'B';
    score.summary = 'ציון B לפי DogScore – חלבון גבוה';
  } else if (protein >= 24) {
    score.grade = 'C';
    score.summary = 'ציון C לפי DogScore – רמה בינונית';
  } else {
    score.grade = 'F';
    score.summary = 'ציון F לפי DogScore';
  }

  return score;
}

async function fetchFromSpets(productName) {
  const slug = productName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
  const url = `https://www.spets.co.il/product/primordial-grain-free-for-adult-dogs-${slug}/`;

  try {
    const res = await axios.get(url);
    const html = res.data;
    console.log("🔍 HTML length:", html.length);

    const $ = cheerio.load(html);
    const ingredients = $('#מאפייני המזון').next('h3 + p').text().trim();
    const nutritionText = $('#אנאליזה תזונתית').next('p').text().trim();

    console.log("🔍 ingredients:", ingredients);
    console.log("🔍 nutritionText:", nutritionText);

    const proteinMatch = nutritionText.match(/חלבון\s*:?[\s ]*([\d.]+)%/);
    const fatMatch = nutritionText.match(/שומן\s*:?[\s ]*([\d.]+)%/);
    const ashMatch = nutritionText.match(/אפר\s*:?[\s ]*([\d.]+)%/);

    const protein = proteinMatch ? parseFloat(proteinMatch[1]) : null;
    const fat = fatMatch ? parseFloat(fatMatch[1]) : null;
    const ash = ashMatch ? parseFloat(ashMatch[1]) : null;

    console.log(`✅ Parsed → protein: ${protein}, fat: ${fat}, ash: ${ash}`);
    return { protein, fat, ash, ingredients };

  } catch (err) {
    console.error("❌ fetchFromSpets error:", err.message);
    return null;
  }
}

app.post('/api/dogscore', async (req, res) => {
  const { productName } = req.body;
  const data = await fetchFromSpets(productName);

  if (!data) {
    return res.status(404).json({ error: 'לא נמצאו נתונים עבור המוצר הזה.' });
  }

  const result = gradeDogFood(data);
  result.product = productName;
  res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
