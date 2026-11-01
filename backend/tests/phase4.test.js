const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { setup, teardown, freshData, accounts } = require('./helpers');
const { Complaint } = require('../models');
const ai = require('../utils/ai');

before(setup);
after(teardown);

beforeEach(async () => {
  await freshData();
});

describe('Smart classification (rules, no API key)', () => {
  it('suggests category and priority from the text', async () => {
    const student = await accounts.student();
    const wifi = await student.post('/api/ai/classify').send({ title: 'Wi-Fi not working', description: 'Internet is very slow and the router keeps disconnecting in the lab' });
    assert.equal(wifi.status, 200);
    assert.equal(wifi.body.data.category, 'Network & IT');
    assert.ok(wifi.body.data.categoryId);
    assert.equal(wifi.body.data.source, 'rules');

    const fire = await student.post('/api/ai/classify').send({ title: 'Sparks from socket', description: 'There is smoke and a burning smell from the wall socket' });
    assert.equal(fire.body.data.category, 'Electrical');
    assert.equal(fire.body.data.priority, 'critical');
  });

  it('understands common Bangla words', () => {
    const r = ai.ruleClassify('ক্লাসরুমে ফ্যান চলছে না, লাইট নষ্ট', ['Electrical', 'Plumbing', 'Cleaning']);
    assert.equal(r.category, 'Electrical');
  });
});

describe('Duplicate detection', () => {
  it('finds a similar open complaint while writing a new one', async () => {
    const student = await accounts.student2();
    const res = await student.post('/api/ai/similar').send({ title: 'Wi-Fi not working in lab', description: 'Computers in the lab cannot connect to the internet', building: 'Engineering Building' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].title, 'Lab Wi-Fi is not working');
    assert.ok(res.body.data[0].score >= 0.3);
  });

  it('returns nothing for unrelated text', async () => {
    const student = await accounts.student();
    const res = await student.post('/api/ai/similar').send({ title: 'Library book request', description: 'Please buy more copies of the algorithms textbook' });
    assert.equal(res.body.data.length, 0);
  });
});

describe('Help chatbot', () => {
  it('answers tracking-code and "my complaints" questions within the user\'s scope', async () => {
    const student = await accounts.student();
    const mine = await Complaint.findOne({ title: 'Lab Wi-Fi is not working' });
    const status = await student.post('/api/ai/chat').send({ message: `what is the status of ${mine.trackingCode.toLowerCase()}?` });
    assert.match(status.body.data.reply, /In Progress/);
    assert.equal(status.body.data.links[0].to, `/complaints/${mine._id}`);

    const other = await Complaint.findOne({ title: 'Broken chairs in classroom' }); // belongs to student2
    const denied = await student.post('/api/ai/chat').send({ message: other.trackingCode });
    assert.match(denied.body.data.reply, /couldn't find/);

    const list = await student.post('/api/ai/chat').send({ message: 'show my complaints' });
    assert.match(list.body.data.reply, /open complaint/);

    const help = await student.post('/api/ai/chat').send({ message: 'hello' });
    assert.match(help.body.data.reply, /I can help/);
  });
});

describe('Sentiment', () => {
  it('reads tone from rating and comment', () => {
    assert.equal(ai.sentiment(5, 'Very quick and professional, thanks!'), 'positive');
    assert.equal(ai.sentiment(1, 'Too slow and still broken'), 'negative');
    assert.equal(ai.sentiment(3, ''), 'neutral');
  });
});

describe('Analytics & export', () => {
  it('returns trend, heatmap, leaderboard and sentiment for admins only', async () => {
    const admin = await accounts.admin();
    const res = await admin.get('/api/admin/analytics');
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.ok(d.trend.length > 1);
    assert.ok(d.trend.every((t) => typeof t.created === 'number' && typeof t.resolved === 'number'));
    assert.equal(d.heatmap.reduce((n, h) => n + h.count, 0), await Complaint.countDocuments());
    assert.ok(d.leaderboard.length >= 2);
    assert.equal(typeof d.sentiment.positive, 'number');
    assert.equal((await (await accounts.staff()).get('/api/admin/analytics')).status, 403);
  });

  it('exports a valid Excel workbook', async () => {
    const admin = await accounts.admin();
    const res = await admin.get('/api/admin/reports/export.xlsx').buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /spreadsheetml/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet('Complaints');
    assert.equal(ws.getRow(1).getCell(1).value, 'Tracking ID');
    assert.equal(ws.rowCount - 1, await Complaint.countDocuments());
  });

  it('writes a weekly summary without an API key', async () => {
    const admin = await accounts.admin();
    const res = await admin.get('/api/admin/ai/summary');
    assert.equal(res.body.data.source, 'rules');
    assert.match(res.body.data.text, /new complaints this week/);
  });
});
