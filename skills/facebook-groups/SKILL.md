---
name: facebook-groups
description: "Monitor 15 Facebook rental groups for 1BHK/rooms in gated societies near Prestige Ferns Galaxy, Bellandur for a couple. Scrapes posts, filters by date, uses AI to analyze relevance, and sends Telegram notifications. Invoke with /facebook-groups or when user asks about rental listings."
user-invocable: true
metadata: {"openclaw": {"emoji": "🏠", "always": true}}
---

# Facebook Rental Finder — Intelligent Group Monitor

You are a rental hunting assistant. Your job is to scrape 15 Facebook groups, analyze posts with your intelligence, verify distances via Google Maps, and notify the user on Telegram about relevant rental listings.

## User Requirements

- **Who**: Couple (male + female partner). Need couple-friendly places. Skip "male only" and "female only" listings.
- **What (in priority order)**:
  1. **P1 (Best)**: Single room with **attached/private washroom** in a **gated society** — fully furnished preferred. THIS IS THE TOP PRIORITY.
  2. **P2 (Good)**: Single room with **dedicated washroom** in a **gated society** (not shared with other tenants, but not attached to the room)
  3. **P3 (Acceptable)**: Single room in a **gated society** without mention of washroom type — include but lower score
  - **GATED SOCIETY IS MANDATORY** — like Sobha societies (Sobha Dream Acres, Sobha Silicon Oasis, Sobha Lake Garden, Sobha Dahlia, etc.), Prestige, Brigade, Mantri, Salarpuria, Puravankara, etc. REJECT listings that are NOT in a gated society.
  - **ONLY looking for sharing rooms** (room in 2BHK/3BHK/4BHK). Do NOT include standalone 1BHK flats, 1RK, or studio apartments.
- **Office**: Prestige Ferns Galaxy, Bellandur, Bangalore
- **Acceptable areas**: Bellandur, Green Glen Layout, Sarjapur Road (near Bellandur), Kadubeesanahalli, Panathur, Outer Ring Road (Bellandur side), Marathahalli (south end), HSR Layout, Haralur, Ambalipura, Devarabisanahalli, Uber Verdant, Prestige Ferns area, Doddanakundi, Varthur
- **Max distance**: 6 km from Prestige Ferns Galaxy, Bellandur
- **Budget**: Not specified (extract from post if mentioned)
- **Couple-friendliness**: CRITICAL. Skip listings that say "bachelor only", "male only", "female only", "girls only", "boys only". Prefer listings that explicitly say "couple friendly", "family", "couple allowed", or don't mention any gender restriction.
- **Preferred societies** (extra priority — always include if available):
  - Any Sobha society (Sobha Dream Acres, Sobha Silicon Oasis, Sobha Lake Garden, Sobha Dahlia, Sobha Forest View, Sobha Morzaria Grandeur, etc.)
  - Mantri Flora
  - Springfield Apartments
  - Elan Homes
  - Suncity Apartments
  - Bren Avalon
  - Brigade Gem
  - Prestige Ferns Residency
  - Adarsh Palm Retreat

## Telegram Delivery — MANDATORY FOR EVERY MESSAGE

⚠️ EVERY message you send MUST include BOTH channel AND target. Omitting target causes silent failure.

Correct: message send --channel telegram --to 8576460636 --text "your message"
Wrong:   message send --text "your message"  ← WILL FAIL (missing channel and target)
Wrong:   message send --channel telegram --text "..."  ← WILL FAIL (missing target)

This applies to ALL messages: rental alerts, scan summaries, error notifications.

## Target Facebook Groups

1. https://www.facebook.com/groups/876779221120021/?sorting_setting=CHRONOLOGICAL — FLAT AND FLATMATES Marathahalli,Bellandur,HSR
2. https://www.facebook.com/groups/1235942030741083/?sorting_setting=CHRONOLOGICAL — Flat And Flatmate Bellandur Green Glen
3. https://www.facebook.com/groups/591413389157630/?sorting_setting=CHRONOLOGICAL — Flat and Flatmates Bellandur, Kadubeesanahalli (200K Members)
4. https://www.facebook.com/groups/507116087403813/?sorting_setting=CHRONOLOGICAL — Bangalore Flats and room without brokerage
5. https://www.facebook.com/groups/gatedsociety/?sorting_setting=CHRONOLOGICAL — Gated Society Flats for Rent (Bangalore)
6. https://www.facebook.com/groups/232651856416194/?sorting_setting=CHRONOLOGICAL — Gated society flat and flatmates bangalore
7. https://www.facebook.com/groups/findmyroombangalore/?sorting_setting=CHRONOLOGICAL — Flats and Flatmates Bangalore
8. https://www.facebook.com/groups/flat.and.flatmates.without.brokers.bangalore/?sorting_setting=CHRONOLOGICAL — Flat and Flatmates Bangalore (Decent Homes)
9. https://www.facebook.com/groups/145466632749824/?sorting_setting=CHRONOLOGICAL — No Brokage Flats and flatmates in Whitefield, ITPL/ITPB
10. https://www.facebook.com/groups/flatsandflatmateswhitefield/?sorting_setting=CHRONOLOGICAL — Flats and Flatmates Whitefield,Brookefield,Marathahalli
11. https://www.facebook.com/groups/383828602075629/?sorting_setting=CHRONOLOGICAL — Flat and Flatmates - Kadubeesanahalli, Panathur
12. https://www.facebook.com/groups/FlatsandFlatmatesBellandur/?sorting_setting=CHRONOLOGICAL — Flats and Flatmates Bellandur, Bangalore
13. https://www.facebook.com/groups/1918733344819133/?sorting_setting=CHRONOLOGICAL — Flat and Flatmates Bellandur | Marathalli | Panathur
14. https://www.facebook.com/groups/147988655894011/?sorting_setting=CHRONOLOGICAL — Flats and Flatmates Whitefield, Bangalore
15. https://www.facebook.com/groups/1693732298196446/?sorting_setting=CHRONOLOGICAL — Flat and Flatmates in Whitefield/Brookfield (Bangalore)

## EXECUTION PIPELINE

**CRITICAL RULES — DO NOT VIOLATE:**
- You MUST run the scraper script to collect posts. Never try to scrape manually with browser snapshot.
- You MUST NOT decide to "skip this run" because a previous run happened recently. Each run is independent.
- You MUST send results to Telegram using: channel=telegram, target=8576460636
- If you have no context from previous runs, that is FINE — just follow this pipeline from scratch.

### STAGE 1: RUN THE SCRAPER (replaces manual browser scraping)

The scraper is a Node.js script that uses GraphQL interception to extract posts from all 15 groups automatically. It handles session checking, scrolling, and post extraction.

**Run it with the `exec` tool:**
```
exec command="cd ~/.openclaw/workspace/scripts && node fb-scraper.js" timeout=900
```

**What the scraper does automatically:**
- Checks if the Facebook session is alive (exits with code 1 if expired)
- Navigates to each of the 15 groups in chronological order
- Scrolls each group to trigger Facebook's GraphQL API pagination
- Intercepts the GraphQL responses and extracts full post data
- Filters out posts older than 3 days
- Writes results to `~/.openclaw/workspace/fb_scraped_posts.json`

**Exit codes:**
- `0` = success — read the output JSON file
- `1` = Facebook session expired — send error to Telegram and stop
- `2` = fatal error — send error to Telegram and stop

**If exit code is 1 (session expired):**
- Send ONE error message to Telegram (channel=telegram, target=8576460636): "❌ Facebook session expired. Cookie update needed."
- **STOP IMMEDIATELY.** Return the error message as your summary and exit.

**If exit code is 0 (success):**
- Read the output file: `~/.openclaw/workspace/fb_scraped_posts.json`
- The JSON contains: `{ scrapedAt, sessionAlive, groups: [{ groupId, groupName, postsFound, posts: [...] }], totalPosts, errors }`
- Each post has: `postId`, `groupId`, `author`, `authorId`, `timestamp` (ISO 8601), `permalink`, `text`, `hasImages`, `imageDescriptions`, `mapsLink`
- Proceed to Stage 2 with the extracted posts

**Expected output:** 150-250+ posts across 15 groups. If totalPosts is below 50, note it in the summary.

### STAGE 2: AI RELEVANCE ANALYSIS

For each post from the scraper output, use your intelligence to analyze:

**A) Is this a rental OFFERING?**
- YES: "Room available", "Looking for flatmate" (from owner/current tenant offering), "Flat for rent", "1BHK available"
- NO: "I am looking for a room" (seeker post), "Need a flat" (seeker), broker spam with 50 listings
- NO: Furniture sale, moving out sale, unrelated posts

**B) Location Relevance (semantic, not just keyword)**
- HIGH: Bellandur, Green Glen Layout, Prestige Ferns area, Uber Verdant, Kadubeesanahalli, Sarjapur Road (near Bellandur junction), Outer Ring Road (Bellandur side)
- MEDIUM: HSR Layout (Sector 1-3), Haralur Road, Ambalipura, Devarabisanahalli, Panathur, Marathahalli (south end), Doddanakundi, Varthur
- LOW: Marathahalli (north), Whitefield, Brookefield, Koramangala, BTM Layout, Kudlu Gate — farther but possibly within 6km
- REJECT: Electronic City, Yelahanka, JP Nagar, Jayanagar, Indiranagar, Hebbal, Bannerghatta, Banashankari, Whitefield (deep east) — too far

**C) Room Type Match (Priority Order)**
- **P1 BEST**: Single room / private room in a shared flat (2BHK/3BHK/4BHK) with **attached washroom/bathroom/private bathroom/en-suite** in a **gated society** — this is the ideal match
- **P2 GOOD**: Single room in a shared flat with **dedicated washroom** or **separate washroom** in a **gated society** (not shared with other tenants, but not attached to the room)
- **P3 OK**: Single room in a shared flat in a **gated society** without mention of washroom type — include but lower score
- **REJECT**: 1BHK flats, 1RK, studio apartments (we only want sharing rooms)
- **REJECT**: "sharing room", "shared room", "2 sharing", "triple sharing" (we want a private room, not shared occupancy)
- **REJECT**: Any listing NOT in a gated society/apartment complex

**D) Furnishing**
- BEST: "fully furnished", "furnished flat"
- OK: "semi-furnished" — include but note it
- LOWER: "unfurnished" — include but lower score

**E) Deal-Breakers (REJECT if any)**
- "Girls only", "female only", "ladies only", "women only"
- "Boys only", "male only", "bachelor only", "bachelors only"
- "Sharing basis", "shared room", "2/3 sharing in a room"
- 1BHK flats, 1RK, studio apartments (only looking for sharing rooms in gated societies)
- Listings NOT in a gated society/apartment complex
- Commercial/office space
- Posts clearly about a different city
- **Known broker spam** — Skip posts from these repeat brokers who spam across all groups with the same listings: Mahesh Venkat, Vijay Ram, Flats Bhk, Property Destination, Sushma Gowda, Akshay Nayak. If you see the same person posting 5+ listings in a single group, they are a broker — skip all their posts.

**E2) Couple-Friendly Signals (bonus)**
- POSITIVE: "couple friendly", "couple allowed", "family", "married couple", "no restriction" — add bonus
- NEUTRAL: No mention of gender/couple policy — still include (many listings don't mention it)
- NEGATIVE: Any single-gender restriction — REJECT (see above)

**F) Scoring (0-100)**
- Start at 50
- **+30 if room has attached/private washroom** — this is the #1 priority
- **+25 if post mentions a preferred society** (any Sobha society, Mantri Flora, Springfield, Elan Homes, Suncity, Bren Avalon, Brigade Gem, Prestige Ferns Residency, Adarsh Palm Retreat) — top priority
- **+15 if post mentions any other gated society/community** — gated society is mandatory
- **+10 if explicitly "couple friendly" or "couple allowed"** — critical for this user
- +20 if location is HIGH relevance (near Prestige Ferns Galaxy)
- +10 if location is MEDIUM relevance
- +10 if room has dedicated (non-attached) washroom
- +10 if "fully furnished" mentioned
- +5 if photos are attached
- +5 if rent price is mentioned (transparency)
- **-5 if rent is above ₹35,000/month** — flag as "💰 Above budget" in the notification but still include if score is high enough
- -10 if location is LOW relevance
- -15 if "unfurnished"
- -15 if no mention of washroom at all
- -100 if any deal-breaker (drops below threshold)
- -100 if NOT in a gated society (mandatory rejection)
- -100 if listing is a 1BHK/1RK/studio (we only want sharing rooms)

**Output for each post**: relevance_score, one-line reason, extracted fields (rent, location, furnishing, room_type, contact_info)

### STAGE 3: DISTANCE VERIFICATION (Google Maps)

For posts with relevance_score >= 50 that contain a Google Maps link or a specific recognizable address/apartment name:

1. Open a new browser tab: `browser open https://www.google.com/maps`
2. Search for directions FROM the flat location TO "Prestige Ferns Galaxy, Bellandur, Bangalore"
3. Read the driving distance from the snapshot
4. If distance > 6 km -> reduce relevance_score by 30
5. If distance <= 3 km -> add +10 to relevance_score
6. If distance 3-6 km -> keep score as is
7. Close the Maps tab when done

If no maps link or address is available, skip this stage and rely on your area knowledge from Stage 3.

### STAGE 4: TELEGRAM NOTIFICATION

**Duplicate check**: Before notifying, read the file `{baseDir}/sent_posts.json`. If a post permalink or a hash of its first 100 characters is already in the file, skip it.

For each post with final relevance_score >= 60, send a Telegram message formatted as:

```
🏠 *Rental Alert* (Score: {score}/100)

📝 {one-line summary of the post}

📍 Location: {extracted location}
🏗️ Society/Apartment: {society or apartment complex name if mentioned}
🏢 Distance from Prestige Ferns Galaxy: {distance if checked, else "~estimated area"}
🏘️ Gated society: {Yes — name / No — standalone / Not mentioned}
🛏️ Room: {room type + priority P1/P2/P3}
🚿 Washroom: {attached/dedicated/shared/not mentioned}
💑 Couple-friendly: {Yes/Not mentioned/No}
🪑 Furnishing: {fully/semi/unfurnished}
💰 Rent: {amount if mentioned, else "Not mentioned"}
🔧 Maintenance: {maintenance charges if mentioned, else "Not mentioned"}
👤 Posted by: {author name}
📞 Contact: {phone number, WhatsApp number, or "See post" if not mentioned. Look for digits like 10-digit Indian numbers, +91 prefixed numbers, or "DM me" / "call me" patterns in the post text}
📅 Posted: {timestamp}
⭐ Why relevant: {one-line reason}

🔗 Post: {facebook_post_permalink}
   ↳ Format MUST be: https://www.facebook.com/groups/{group_id}/posts/{post_id}/
   ↳ If post_id is unknown, link to the group page instead: https://www.facebook.com/groups/{group_id}/
```

After sending, append the post identifier to `{baseDir}/sent_posts.json` to prevent re-notification.

**Prune old entries**: Before adding new entries, remove any entries from `sent_posts.json` where `sent_at` is older than 30 days. This keeps the file from growing unbounded.

### STAGE 5: SUMMARY (ALWAYS SEND — even with 0 matches)

After processing all 15 groups, ALWAYS send a summary to Telegram (chat ID 8576460636) so the user knows the job ran:
```
📊 Scan complete ({current_date_time}):
- Groups scanned: 15
- Posts checked: {total} (expect 100-200+ if scrolling worked)
- Posts within 3 days: {filtered}
- Relevant matches found: {matches}
- Notifications sent: {sent}
- Duplicates skipped: {dupes}
- Broker spam skipped: {broker_count}
```

If posts checked is below 40, something went wrong with scrolling — note it in the summary.

If any error occurs during scanning (login expired, browser crash, network error), send an error notification:
```
❌ Rental scan error ({current_date_time}):
{error description}
Action needed: {suggested fix}
```

## Important Notes

1. **The scraper handles all Facebook interaction** — You do NOT need to use browser navigate/snapshot for scraping. Just run the scraper script via `exec` and read the JSON output.
2. **Do NOT click "See more" on individual posts** — The scraper extracts full post text via GraphQL, so "See more" is unnecessary.
3. **Handle login expiry** — If the scraper exits with code 1, the session is expired. Send an error to Telegram and stop.
4. **The sent_posts.json file** — Create it if it does not exist. Format: {"sent": ["id1", "id2"]}.
5. **Google Maps** — Only check Maps if a clear address or Maps link is in the post. Do not check for every post.
6. **Timestamps are ISO 8601** — The scraper outputs timestamps like `2026-03-17T09:41:00.000Z`. Use these for date calculations instead of parsing relative timestamps.
