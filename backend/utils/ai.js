/**
 * "Smart" helpers for complaints. Everything works offline with transparent
 * rules (keyword classifier, text similarity, sentiment lexicon). When
 * ANTHROPIC_API_KEY is set, classification, summaries and the chatbot use
 * Claude instead, and fall back to the rules if the call fails.
 */
const Anthropic = require('@anthropic-ai/sdk').default;
const { PRIORITIES } = require('./constants');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const aiEnabled = () => Boolean(client);

/* ------------------------------ Text tools ----------------------------- */

const STOPWORDS = new Set(
  'a an the is are was were be been in on at of for to from and or not no it its this that these those with by as my our your we i you he she they them there here very please since every all any some has have had do does did can cannot cant will would should could just also than then so but if when while into out up down over again more most room lab floor building'.split(' ')
);

/** Lower-case word stems (very light stemming) without stopwords. */
function tokens(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ''));
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

/* ---------------------------- Classification --------------------------- */

// Keywords per category (English + common Bangla words students type).
const CATEGORY_KEYWORDS = {
  'Network & IT': 'wifi wi-fi internet network lan router switch ethernet cable connect connection slow ping computer pc software login password printer server ইন্টারনেট ওয়াইফাই নেট কম্পিউটার',
  Electrical: 'light bulb tube fan socket plug switch power electricity voltage short circuit spark shock wire wiring generator ups breaker fuse flicker লাইট ফ্যান বিদ্যুৎ কারেন্ট সুইচ',
  'Lab Equipment': 'oscilloscope multimeter equipment machine lathe instrument bench kit sensor microcontroller arduino probe meter apparatus device projector যন্ত্র',
  'AC & Ventilation': 'ac air conditioner conditioning cooling cool hot heat temperature ventilation exhaust humid এসি গরম',
  Plumbing: 'water leak leakage tap pipe drain sink toilet flush flood clog basin tank পানি লিক কল',
  Cleaning: 'clean dirty dust garbage trash waste smell bad odour odor washroom toilet bathroom soap mop নোংরা ময়লা পরিষ্কার দুর্গন্ধ',
  Furniture: 'chair desk table bench board whiteboard cupboard shelf door handle broken wobbly চেয়ার টেবিল বেঞ্চ',
  'Safety & Security': 'lock door cctv camera fire extinguisher alarm emergency theft stolen security guard hazard danger unsafe তালা চুরি আগুন',
};

const URGENT = {
  critical: 'fire smoke spark sparking shock electrocute burning flood flooding gas danger dangerous injury injured emergency আগুন ধোঁয়া শক',
  high: 'urgent asap exam class blocked cannot unable entire whole all completely leak not working dead stopped broken জরুরি',
  low: 'minor small cosmetic slight suggestion whenever',
};

const KW = Object.fromEntries(Object.entries(CATEGORY_KEYWORDS).map(([k, v]) => [k, tokens(v)]));
const URG = Object.fromEntries(Object.entries(URGENT).map(([k, v]) => [k, tokens(v)]));

function ruleClassify(text, categoryNames) {
  const t = tokens(text);
  const set = new Set(t);
  let best = null;
  let bestScore = 0;
  let total = 0;
  for (const name of categoryNames) {
    const kws = KW[name] || tokens(name);
    const score = kws.reduce((n, k) => n + (set.has(k) ? 1 : 0), 0);
    total += score;
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  const hit = (level) => URG[level].some((k) => set.has(k));
  const priority = hit('critical') ? 'critical' : hit('high') ? 'high' : hit('low') ? 'low' : 'medium';
  const confidence = best ? Math.min(0.95, 0.4 + 0.55 * (bestScore / Math.max(total, 1)) * Math.min(1, bestScore / 2)) : 0;
  return { category: best, priority, confidence: Math.round(confidence * 100) / 100, reason: best ? `Matched keywords for ${best}` : 'No clear keywords', source: 'rules' };
}

/** Text of the first text block, after checking the model did not decline. */
function replyText(response) {
  if (response.stop_reason === 'refusal') throw new Error('The model declined this request');
  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('Empty model response');
  return block.text;
}

/** Calls Claude with the server-side refusal fallback enabled. */
function ask(params) {
  return client.beta.messages.create({
    model: MODEL,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    ...params,
  });
}

/** Suggests a category and priority for a complaint. */
async function classify({ title = '', description = '' }, categoryNames) {
  const text = `${title}\n${description}`;
  if (client) {
    try {
      const response = await ask({
        max_tokens: 1024,
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                category: { type: 'string', enum: categoryNames },
                priority: { type: 'string', enum: [...PRIORITIES] },
                confidence: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['category', 'priority', 'confidence', 'reason'],
              additionalProperties: false,
            },
          },
        },
        system:
          'You triage maintenance complaints for a university engineering campus in Bangladesh. Pick the single best category and a priority: critical = danger to people or property (fire, electric shock, flooding); high = blocks classes or labs; medium = inconvenient; low = minor. confidence is 0-1. reason is one short sentence.',
        messages: [{ role: 'user', content: text.slice(0, 4000) }],
      });
      const out = JSON.parse(replyText(response));
      return { ...out, confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0)), source: 'claude' };
    } catch (err) {
      console.error('AI classify failed, using rules:', err.message);
    }
  }
  return ruleClassify(text, categoryNames);
}

/* ------------------------------ Similarity ----------------------------- */

/** Scores how alike two complaints are (0–1): text overlap plus same place/category. */
function similarity(a, b) {
  let score = jaccard(tokens(`${a.title} ${a.description}`), tokens(`${b.title} ${b.description}`));
  if (a.building && b.location?.building && a.building.toLowerCase() === b.location.building.toLowerCase()) score += 0.15;
  if (a.room && b.location?.room && b.location.room.toLowerCase().includes(a.room.toLowerCase())) score += 0.1;
  if (a.category && String(a.category) === String(b.category?._id || b.category)) score += 0.1;
  return Math.min(1, Math.round(score * 100) / 100);
}

/* ------------------------------ Sentiment ------------------------------ */

const POSITIVE = tokens('good great excellent quick quickly fast fixed helpful thanks thank nice perfect professional satisfied happy polite resolved well ভালো ধন্যবাদ দ্রুত');
const NEGATIVE = tokens('bad slow late delay delayed poor rude worst again still broken never unhelpful useless disappointed dirty not angry complain খারাপ দেরি');

/** Feedback sentiment from the star rating and comment words. */
function sentiment(rating, comment = '') {
  const t = tokens(comment);
  const words = t.reduce((n, w) => n + (POSITIVE.includes(w) ? 1 : 0) - (NEGATIVE.includes(w) ? 1 : 0), 0);
  const score = (Number(rating) - 3) / 2 + Math.max(-1, Math.min(1, words / 3)) * 0.5;
  return score > 0.25 ? 'positive' : score < -0.25 ? 'negative' : 'neutral';
}

/* ------------------------------- Summary ------------------------------- */

/** One-paragraph weekly briefing for admins, from aggregated numbers. */
async function summarize(stats) {
  const fallback = () => {
    const parts = [`${stats.created} new complaints this week (${stats.change >= 0 ? '+' : ''}${stats.change}% vs last week), ${stats.resolved} resolved.`];
    if (stats.topCategory) parts.push(`Most reported: ${stats.topCategory.name} (${stats.topCategory.count}).`);
    if (stats.topBuilding) parts.push(`Busiest building: ${stats.topBuilding.name} (${stats.topBuilding.count}).`);
    if (stats.overdue) parts.push(`${stats.overdue} complaint(s) are past their SLA deadline and need attention.`);
    if (stats.sentiment) parts.push(`Student feedback: ${stats.sentiment.positive} positive, ${stats.sentiment.negative} negative.`);
    return parts.join(' ');
  };
  if (client) {
    try {
      const response = await ask({
        max_tokens: 2048,
        output_config: { effort: 'low' },
        system: 'Write a short (3–4 sentence) plain-English weekly briefing for a university facilities administrator. Mention the most important trend and one concrete recommendation. No headings, no bullet points.',
        messages: [{ role: 'user', content: JSON.stringify(stats) }],
      });
      return { text: replyText(response).trim(), source: 'claude' };
    } catch (err) {
      console.error('AI summary failed, using template:', err.message);
    }
  }
  return { text: fallback(), source: 'rules' };
}

/** Free-text answer for the chatbot when Claude is available; null otherwise. */
async function chatAnswer(question, context) {
  if (!client) return null;
  try {
    const response = await ask({
      max_tokens: 2048,
      output_config: { effort: 'low' },
      system:
        'You are the IUBAT Smart Campus help assistant for students and staff. Answer in 1–3 short sentences, in the language the user wrote in (English or Bangla). Use only the provided context about the user\'s complaints. To report a new issue, tell them to use "New Complaint". Never invent tracking codes or statuses.',
      messages: [{ role: 'user', content: `Context: ${JSON.stringify(context)}\n\nQuestion: ${question.slice(0, 1000)}` }],
    });
    return replyText(response).trim();
  } catch (err) {
    console.error('AI chat failed, using rules:', err.message);
    return null;
  }
}

module.exports = { aiEnabled, classify, ruleClassify, similarity, sentiment, summarize, chatAnswer, tokens };
