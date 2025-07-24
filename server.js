const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60000, max: 10 }));

const ratings = []; // דירוגים בזיכרון בלבד

function gradeDogFood(data) {
  const points = [];
  let score = 0;

  const { protein, fat, ash, ingredients } = data;
  const ing = ingredients.toLowerCase();

  if (protein > 28) {
    score += 2;
    points.push('חלבון גבוה מ־28% → +2');
  }
  if (ash > 9) {
    score -= 2;
    points.push('אפר גולמי גבוה מ־9% → −2');
  }
  if (/(corn|wheat|soy)/.test(ing)) {
    score -= 5;
    points.push('רכיבים זולים (חיטה/תירס/סויה) → −5');
  }
  if (/grain[-\s]?free/.test(ing)) {
    score += 2;
    points.push('ללא דגנים → +2');
  }
  if (/(meat meal|fresh lamb|chicken|fish|duck)/.test(ing)) {
    score += 3;
    points.push('מקורות חלבון איכותיים → +3');
  }
  if (/(sweet potato|lentil|pea|blueberry|cranberry|chicory)/.test(ing)) {
    score += 3;
    points.push('ירקות שורש / פירות / פרוביוטיקה → +3');
  }

  const total = 90 + score;
  const finalScore = Math.min(total, 100);

  const grade = total > 100 ? 'A+' :
                total >= 94 ? 'A' :
                total >= 86 ? 'B' :
                total >= 78 ? 'C' :
                total >= 70 ? 'D' : 'F';

  return {
    grade,
    summary: `ציון ${grade} לפי DogScore – ניתוח של רכיבים ואחוזים.`,
    points,
    details: `חלבון: ${protein}% | שומן: ${fat}% | אפר: ${ash || '?'}%\nרכיבים: ${ingredients}`
  };
}

app.post('/api/dogscore', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'שם מוצר נדרש' });

  try {
    const search = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(query + ' dog food ingredients')}`);
    const $ = cheerio.load(search.data);
    const snippets = $('div').text();
    const ingredientsMatch = snippets.match(/ingredients?:?\s*([^\n]+)/i);
    const proteinMatch = snippets.match(/protein[:\s]*([0-9.]+)%?/i);
    const fatMatch = snippets.match(/fat[:\s]*([0-9.]+)%?/i);
    const ashMatch = snippets.match(/ash[:\s]*([0-9.]+)%?/i);

    const ingredients = ingredientsMatch ? ingredientsMatch[1] : 'unknown';
    const protein = proteinMatch ? parseFloat(proteinMatch[1]) : 0;
    const fat = fatMatch ? parseFloat(fatMatch[1]) : 0;
    const ash = ashMatch ? parseFloat(ashMatch[1]) : null;

    const result = gradeDogFood({ protein, fat, ash, ingredients });

    ratings.unshift({ query, ...result, createdAt: new Date() });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'נכשל בלהשיג מידע' });
  }
});

app.get('/api/recent', (req, res) => {
  res.json(ratings.slice(0, 10));
});

app.get('/api/top', (req, res) => {
  const order = ['A+', 'A', 'B', 'C', 'D', 'F'];
  const sorted = [...ratings].sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade));
  res.json(sorted.slice(0, 5));
});

app.listen(3001, () => console.log('Server running on port 3001'));
