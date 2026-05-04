'use strict';

// Rule-based merchant → category mapper. Replaces the free-text `category`
// field on transactions with something we can budget against. Order matters:
// the first matching rule wins. We treat both description and explicit
// category as input so legacy hand-typed entries still get bucketed.

const RULES = [
  { cat: 'Food & Dining', re: /\b(swiggy|zomato|domino|pizza|cafe|coffee|restaurant|food|dine|udupi|dhaba|biryani|kfc|mcdonald|subway|starbucks|dunkin)\b/i },
  { cat: 'Groceries',     re: /\b(grocer|bigbasket|grofers|blinkit|zepto|dmart|reliance fresh|nature's basket|kirana|sabji|mandi)\b/i },
  { cat: 'Transport',     re: /\b(uber|ola|rapido|metro|irctc|train|flight|indigo|vistara|spicejet|petrol|diesel|fuel|fastag)\b/i },
  { cat: 'Entertainment', re: /\b(netflix|prime|hotstar|disney|spotify|gaana|youtube|movie|bookmyshow|pvr|inox|game|play store)\b/i },
  { cat: 'Shopping',      re: /\b(amazon|flipkart|myntra|ajio|nykaa|tatacliq|meesho|shop|store|mall|lifestyle|max)\b/i },
  { cat: 'Bills & Utilities', re: /\b(bill|electric|jio|airtel|vi |vodafone|bsnl|gas|water|broadband|tata sky|dth|recharge|wifi|internet)\b/i },
  { cat: 'Rent & EMI',    re: /\b(rent|emi|loan|mortgage|landlord)\b/i },
  { cat: 'Healthcare',    re: /\b(hospital|pharmacy|apollo|fortis|max healthcare|doctor|clinic|medplus|netmeds|1mg|pharmeasy)\b/i },
  { cat: 'Education',     re: /\b(school|college|tuition|byju|unacademy|coursera|udemy|fees|exam)\b/i },
  { cat: 'Investment',    re: /\b(mutual fund|sip|stock|equity|fd|fixed deposit|gold|bond|nps|ppf|elss)\b/i },
  { cat: 'Travel',        re: /\b(hotel|booking|airbnb|oyo|makemytrip|goibibo|cleartrip|vacation|holiday|travel)\b/i },
  { cat: 'Transfer',      re: /\b(transfer|sent|received|imps|neft|rtgs|upi)\b/i }
];

function categorize({ description = '', category = '', merchant = '' } = {}) {
  const haystack = `${merchant} ${description} ${category}`.trim();
  if (!haystack) return 'Other';
  for (const r of RULES) {
    if (r.re.test(haystack)) return r.cat;
  }
  // If the user already supplied a non-empty category and nothing else matched,
  // honor it — this lets explicit user input override the rule engine.
  if (category && category.trim()) return category.trim();
  return 'Other';
}

module.exports = { categorize, RULES };
