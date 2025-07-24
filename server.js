const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

  if (/fresh|real|meat/i.test(
