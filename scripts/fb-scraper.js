#!/usr/bin/env node
/**
 * fb-scraper.js — Facebook Group Post Scraper (GraphQL Interception)
 *
 * Connects to an existing Chrome instance via CDP, navigates Facebook groups,
 * intercepts GraphQL API responses to extract full post data without DOM
 * scraping limitations or anti-bot obfuscation.
 *
 * Exit codes: 0 = success, 1 = session expired, 2 = other error
 * Output: writes JSON to --output file (default: ~/.openclaw/workspace/fb_scraped_posts.json)
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const GROUPS = [
  { id: '876779221120021', name: 'Flat and Flatmates Marathahalli,Bellandur,HSR', scrolls: 12 },
  { id: '1235942030741083', name: 'Flat And Flatmate Bellandur Green Glen', scrolls: 12 },
  { id: '591413389157630', name: 'Flat and Flatmates Bellandur, Kadubeesanahalli', scrolls: 12 },
  { id: '507116087403813', name: 'Bangalore Flats and room without brokerage', scrolls: 12 },
  { id: 'gatedsociety', name: 'Gated Society Flats for Rent (Bangalore)', scrolls: 12 },
  { id: '232651856416194', name: 'Gated society flat and flatmates bangalore', scrolls: 12 },
  { id: 'findmyroombangalore', name: 'Flats and Flatmates Bangalore', scrolls: 8 },
  { id: 'flat.and.flatmates.without.brokers.bangalore', name: 'Flat and Flatmates Bangalore (Decent Homes)', scrolls: 8 },
  { id: '145466632749824', name: 'No Brokage Flats Whitefield ITPL', scrolls: 8 },
  { id: 'flatsandflatmateswhitefield', name: 'Flats Whitefield Brookefield Marathahalli', scrolls: 8 },
  { id: '383828602075629', name: 'Flat and Flatmates Kadubeesanahalli Panathur', scrolls: 8 },
  { id: 'FlatsandFlatmatesBellandur', name: 'Flats and Flatmates Bellandur', scrolls: 8 },
  { id: '1918733344819133', name: 'Flat and Flatmates Bellandur Marathalli Panathur', scrolls: 8 },
  { id: '147988655894011', name: 'Flats and Flatmates Whitefield', scrolls: 8 },
  { id: '1693732298196446', name: 'Flat and Flatmates Whitefield Brookfield', scrolls: 8 },
];

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:18800';
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(process.env.HOME, '.openclaw/workspace/fb_scraped_posts.json');
const SCROLL_DELAY_MS = 2500;
const PAGE_LOAD_WAIT_MS = 8000;
const BETWEEN_GROUPS_DELAY_MS = 3000;
// Posts older than this many days are dropped
const MAX_AGE_DAYS = 3;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Recursively walk a parsed GraphQL JSON tree and collect every Story node
 * that has comet_sections (i.e. a real feed post, not an ad placeholder).
 */
function extractStoriesFromJson(obj, depth = 0) {
  const stories = [];
  if (!obj || depth > 25 || typeof obj !== 'object') return stories;

  if (Array.isArray(obj)) {
    for (const item of obj) stories.push(...extractStoriesFromJson(item, depth + 1));
    return stories;
  }

  if (obj.__typename === 'Story' && obj.comet_sections) {
    const fields = extractFieldsFromStory(obj);
    if (fields) stories.push(fields);
  }

  for (const key of Object.keys(obj)) {
    stories.push(...extractStoriesFromJson(obj[key], depth + 1));
  }
  return stories;
}

/**
 * Given a raw Story object from Facebook's GraphQL, pull out the fields we need.
 */
function extractFieldsFromStory(story) {
  let text = '';
  let author = '';
  let authorId = '';
  let creationTime = 0;
  let postUrl = '';
  let postId = '';
  let hasImages = false;
  let imageDescriptions = [];
  let mapsLink = '';

  const walk = (o, d) => {
    if (!o || d > 18 || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(i => walk(i, d + 1)); return; }

    // Post text (longest message wins)
    if (o.message?.text && o.message.text.length > text.length) text = o.message.text;

    // Author
    if (o.__typename === 'User' && o.name && !author) {
      author = o.name;
      if (o.id) authorId = o.id;
    }

    // Timestamp
    if (o.creation_time && typeof o.creation_time === 'number' && o.creation_time > creationTime) {
      creationTime = o.creation_time;
    }

    // Permalink
    if (o.url && typeof o.url === 'string') {
      if (o.url.includes('/posts/') || o.url.includes('/permalink/')) {
        postUrl = o.url.split('?')[0]; // strip tracking params
      }
    }

    // Post ID
    if (o.post_id && !postId) postId = o.post_id;

    // Images
    if (o.__typename === 'Photo' || o.__typename === 'Image') hasImages = true;
    if (o.accessibility_caption && typeof o.accessibility_caption === 'string') {
      imageDescriptions.push(o.accessibility_caption);
    }
    if (o.media && o.media.__typename === 'Photo') hasImages = true;

    // Maps links embedded in post text or attachments
    if (o.url && typeof o.url === 'string' &&
        (o.url.includes('google.com/maps') || o.url.includes('goo.gl/maps') || o.url.includes('maps.app.goo.gl'))) {
      mapsLink = o.url;
    }

    for (const k of Object.keys(o)) walk(o[k], d + 1);
  };

  walk(story, 0);

  // Also check for maps links inside the text itself
  if (!mapsLink && text) {
    const mapsMatch = text.match(/(https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|google\.com\/maps)\S+)/);
    if (mapsMatch) mapsLink = mapsMatch[1];
  }

  if (text.length < 10 && imageDescriptions.length === 0) return null;

  return {
    postId: postId || '',
    author,
    authorId,
    creationTime,
    timestamp: creationTime ? new Date(creationTime * 1000).toISOString() : '',
    postUrl,
    text: text.substring(0, 3000),
    hasImages,
    imageDescriptions: imageDescriptions.slice(0, 5),
    mapsLink,
  };
}

async function checkSessionAlive(page) {
  const content = await page.content();
  const isLoginPage = content.includes('login_form') ||
                      content.includes('Log in to Facebook') ||
                      content.includes('Find your account') ||
                      content.includes('loginbutton');

  const title = await page.title();
  const titleLogin = title.toLowerCase().includes('log in') ||
                     title.toLowerCase().includes('sign up') ||
                     title.toLowerCase().includes('facebook – log in');

  return !(isLoginPage || titleLogin);
}

/**
 * Scrape one group by navigating to it, scrolling, and collecting GraphQL
 * responses that contain group_feed Story data.
 */
async function scrapeGroup(page, group) {
  const groupUrl = `https://www.facebook.com/groups/${group.id}/?sorting_setting=CHRONOLOGICAL`;

  // Collect GraphQL responses for this group
  const graphqlBuffers = [];
  const onResponse = async (response) => {
    try {
      const url = response.url();
      if (!url.includes('api/graphql')) return;
      const body = await response.text();
      if (body.length > 5000) graphqlBuffers.push(body);
    } catch (_) { /* ignore network errors on response read */ }
  };
  page.on('response', onResponse);

  try {
    // Clear browser cache via CDP to force fresh GraphQL requests
    const cdp = await page.createCDPSession();
    await cdp.send('Network.clearBrowserCache');
    await cdp.detach();
    await page.setCacheEnabled(false);

    await page.goto(groupUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(PAGE_LOAD_WAIT_MS);

    // Check session mid-scan
    const alive = await checkSessionAlive(page);
    if (!alive) return { expired: true, posts: [] };

    // Scroll with realistic behavior to trigger pagination API calls
    for (let s = 0; s < group.scrolls; s++) {
      const scrollAmt = 600 + Math.floor(Math.random() * 500);
      await page.evaluate((amt) => window.scrollBy({ top: amt, behavior: 'smooth' }), scrollAmt);
      const delay = SCROLL_DELAY_MS + Math.floor(Math.random() * 1000);
      await sleep(delay);
    }
    // Final wait for last responses to arrive
    await sleep(3000);
  } finally {
    page.off('response', onResponse);
  }

  // Parse all captured GraphQL responses for Story nodes
  const seenIds = new Set();
  const posts = [];
  const cutoff = (Date.now() / 1000) - (MAX_AGE_DAYS * 86400);

  for (const raw of graphqlBuffers) {
    // Facebook sometimes concatenates multiple JSON objects per response
    const lines = raw.split('\n').filter(l => l.trim().startsWith('{'));
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        const stories = extractStoriesFromJson(json);
        for (const s of stories) {
          const dedup = s.postId || s.postUrl || s.text.substring(0, 80);
          if (seenIds.has(dedup)) continue;
          seenIds.add(dedup);

          // Date filter
          if (s.creationTime && s.creationTime < cutoff) continue;

          posts.push({
            postId: s.postId,
            groupId: group.id,
            author: s.author,
            authorId: s.authorId,
            timestamp: s.timestamp,
            permalink: s.postUrl || `https://www.facebook.com/groups/${group.id}/`,
            text: s.text,
            hasImages: s.hasImages,
            imageDescriptions: s.imageDescriptions,
            mapsLink: s.mapsLink,
          });
        }
      } catch (_) { /* skip malformed JSON lines */ }
    }
  }

  return { expired: false, posts };
}

async function main() {
  let browser;
  const result = {
    scrapedAt: new Date().toISOString(),
    sessionAlive: true,
    groups: [],
    totalPosts: 0,
    errors: [],
  };

  try {
    browser = await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: null,
    });

    const page = await browser.newPage();

    // Stage 0: Check session
    console.error('[Stage 0] Checking Facebook session...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);

    const alive = await checkSessionAlive(page);
    if (!alive) {
      console.error('[Stage 0] Session EXPIRED — login page detected');
      result.sessionAlive = false;
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
      await page.close();
      process.exit(1);
    }
    console.error('[Stage 0] Session alive ✓');

    // Scrape each group
    for (let i = 0; i < GROUPS.length; i++) {
      const group = GROUPS[i];
      console.error(`[Group ${i + 1}/${GROUPS.length}] ${group.name}...`);

      try {
        const { expired, posts } = await scrapeGroup(page, group);

        if (expired) {
          console.error(`[Group ${i + 1}] Session expired mid-scan!`);
          result.sessionAlive = false;
          result.errors.push(`Session expired at group ${i + 1}`);
          break;
        }

        console.error(`  Extracted ${posts.length} posts (via GraphQL interception)`);

        result.groups.push({
          groupId: group.id,
          groupName: group.name,
          postsFound: posts.length,
          posts,
        });
        result.totalPosts += posts.length;
      } catch (err) {
        console.error(`  Error scraping group: ${err.message}`);
        result.errors.push(`Group ${group.id}: ${err.message}`);
      }

      // Rate limit between groups
      if (i < GROUPS.length - 1) {
        await sleep(BETWEEN_GROUPS_DELAY_MS);
      }
    }

    await page.close();
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    result.errors.push(`Fatal: ${err.message}`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    process.exit(2);
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.error(`\nDone! ${result.totalPosts} posts from ${result.groups.length} groups → ${OUTPUT_FILE}`);

  if (!result.sessionAlive) {
    process.exit(1);
  }
  process.exit(0);
}

main();
