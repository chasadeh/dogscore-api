const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // כאן נטען את index.html מתוך תיקיית public

const recentQueries = [];

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

  const total = Math.min(score, 110); // ניקוד מקסימלי עם +10 לחיזוק
  let grade = "C";
  let color = "#FFA500";

  if (total >= 110) {
    grade = "A+";
    color = "#006400";
  } else if (total >= 95) {
    grade = "A";
    color = "#009900";
  } else if (total >= 85) {
    grade = "B";
    color = "#33cc33";
  } else if (total >= 70) {
    grade = "C";
    color = "#FFA500";
  } else if (total >= 55) {
    grade = "D";
    color = "#FF6666";
  } else {
    grade = "F";
    color = "#CC0000";
  }

  return { grade, score: total, details, color };
}

app.post("/api/dogscore", async (req, res) => {
  const { productName } = req.body;

  try {
    const dummyData = {
      protein: 25,
      fat: 15,
      ash: 7.5,
      ingredients: "lamb meal, grain-free, sweet potato, peas, natural flavor, vitamins",
    };

    const result = gradeDogFood(dummyData);
    recentQueries.unshift({ productName, ...result });
    if (recentQueries.length > 10) recentQueries.pop();

    res.json({
      product: productName,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ error: "שגיאה בעיבוד הנתונים" });
  }
});

app.get("/api/recent", (req, res) => {
  res.json(recentQueries);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
