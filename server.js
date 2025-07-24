const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function fetchFromSpets(productName) {
  // המר שם מוצר ל-URL מתאים
  const slug = productName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
  const url = `https://www.spets.co.il/product/primordial-grain-free-for-adult-dogs-${slug}/`;
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    const ingredients = $('#מאפייני המזון').next('h3 + p').text().trim();
    const nutritionText = $('#אנאליזה תזונתית').next('p').text();
    const protein = parseFloat(nutritionText.match(/חלבון\s*([\d.]+)%/)[1]);
    const fat = parseFloat(nutritionText.match(/שומן\s*([\d.]+)%/)[1]);
    const ash = parseFloat(nutritionText.match(/אפר\s*([\d.]+)%/)[1]);
    return { protein, fat, ash, ingredients };
  } catch {
    return null;
  }
}

app.post('/api/dogscore', async (req, res) => {
  const { productName } = req.body;
  let data = await fetchFromSpets(productName);
  if (!data) {
    return res.status(404).json({ error: 'לא נמצאו נתונים באתר ספץ עבור הפרימורדיאל הזה.' });
  }
  // כאן מקום לקרוא הפונקציה gradeDogFood מהרקורס הקיים ולשלוח אותה  
  const result = gradeDogFood(data);
  result.product = productName;
  res.json(result);
});
