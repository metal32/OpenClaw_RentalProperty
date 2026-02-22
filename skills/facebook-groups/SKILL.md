---
name: facebook-groups
description: "Monitor 6 Facebook rental groups for rooms near Prestige Fern Galaxy, Bellandur. Scrapes posts, filters by date (<7 days), uses AI to analyze relevance, checks Google Maps distance, and sends Telegram notifications. Invoke with /facebook-groups or when user asks about rental listings."
user-invocable: true
metadata: {"openclaw": {"emoji": "🏠", "always": true}}
---

# Facebook Rental Finder — Intelligent Group Monitor

You are a rental hunting assistant. Your job is to scrape 6 Facebook groups, analyze posts with your intelligence, verify distances via Google Maps, and notify the user on Telegram about relevant rental listings.

## User Requirements

- **What**: Fully furnished single room with attached/private washroom
- **Where**: Near Microsoft Prestige Fern Galaxy, Bellandur, Bangalore
- **Acceptable areas**: Bellandur, Sarjapur, Sarjapur Road, Green Glen Layout, Uber Verdant, Prestige Ferns, HSR Layout, Haralur, Ambalipura, Devarabisanahalli, Outer Ring Road (Bellandur side), Marathahalli (south end), Kadabeesanahalli
- **Max distance**: 5-6 km from Microsoft Prestige Fern Galaxy
- **Budget**: Not specified (extract from post if mentioned)
- **Gender**: Male (skip "girls only" / "female only" listings)
- **Preferred societies** (extra priority — always include if available):
  - Mantri Flora
  - Springfield Apartments
  - Elan Homes
  - Sobha Dahlia
  - Suncity Apartments

## Telegram Delivery

Always send messages using: channel=telegram, target=8576460636
Use the message send tool with --channel telegram --target 8576460636

## Target Facebook Groups

1. https://www.facebook.com/groups/876779221120021/?sorting_setting=CHRONOLOGICAL — FLAT AND FLATMATES Marathahalli,Bellandur,HSR
2. https://www.facebook.com/groups/1235942030741083/?sorting_setting=CHRONOLOGICAL — Flat And Flatmate Bellandur Green Glen
3. https://www.facebook.com/groups/591413389157630/?sorting_setting=CHRONOLOGICAL — Flat and Flatmates Bellandur, Kadubeesanahalli (200K Members)
4. https://www.facebook.com/groups/507116087403813/?sorting_setting=CHRONOLOGICAL — Bangalore Flats and room without brokerage
5. https://www.facebook.com/groups/gatedsociety/?sorting_setting=CHRONOLOGICAL — Gated Society Flats for Rent (Bangalore)
6. https://www.facebook.com/groups/232651856416194/?sorting_setting=CHRONOLOGICAL — Gated society flat and flatmates bangalore

## EXECUTION PIPELINE

### STAGE 1: SCRAPE EACH GROUP

For each group URL:

1. Use `browser navigate <group_url>?sorting_setting=CHRONOLOGICAL` to open the group in **chronological order** (NOT algorithmic). The `?sorting_setting=CHRONOLOGICAL` parameter is critical — it ensures newest posts appear first so scrolling reaches all recent posts.
2. Wait 5 seconds for content to load
3. **MANDATORY SCROLLING — DO NOT SKIP THIS STEP:**
   - You MUST scroll the page to load more posts. Facebook uses infinite scroll — without scrolling you only see 3-5 posts.
   - Execute this scroll sequence exactly (15 scrolls total):
     ```
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     browser press End  → wait 3 seconds
     ```
   - That is **15 presses of End** with 3-second waits between each.
   - **EARLY STOP:** If during scrolling you notice posts are older than 2 days, you can stop scrolling early and take the snapshot.
   - Do NOT take a snapshot until you have done at least 10 scrolls OR hit the 2-day cutoff.
4. Use `browser snapshot` to capture the full page content (should now show 25-50+ posts)
5. If the snapshot shows fewer than 15 posts, scroll 5 more times and snapshot again.
6. From the snapshot, extract each visible post:
   - Post text/message content
   - Author name
   - Timestamp (e.g., "2h", "1d", "3d", "February 15", "Just now")
   - Permalink URL (look for links to individual posts)
   - Any Google Maps links or location mentions
   - Whether the post has photos/images attached

### STAGE 2: DATE FILTER (Hard Cutoff — 1 Day)

Since the cron runs every 6 hours, we only need posts from the last 24 hours:
- "Just now", "Xm" (minutes), "Xh" (hours) -> KEEP (today)
- "1d" or "Yesterday" -> KEEP (within 1 day)
- "2d" or older -> REJECT, skip entirely
- Specific dates -> Calculate if within last 1 day from today

If you cannot determine the date, KEEP the post (benefit of the doubt).

**STOP SCROLLING EARLY:** While scrolling, if you start seeing posts older than 2 days, you have reached the end of relevant content — stop scrolling and take the snapshot immediately. This saves time and avoids loading irrelevant old posts.

### STAGE 3: AI RELEVANCE ANALYSIS

For each post that passed Stage 2, use your intelligence to analyze:

**A) Is this a rental OFFERING?**
- YES: "Room available", "Looking for flatmate" (from owner/current tenant offering), "Flat for rent", "1BHK available"
- NO: "I am looking for a room" (seeker post), "Need a flat" (seeker), broker spam with 50 listings
- NO: Furniture sale, moving out sale, unrelated posts

**B) Location Relevance (semantic, not just keyword)**
- HIGH: Bellandur, Prestige Ferns, Fern Galaxy, Fern Residency, Green Glen Layout, Uber Verdant, Sarjapur Road (near Bellandur junction)
- MEDIUM: HSR Layout (Sector 1-3), Haralur Road, Ambalipura, Kadabeesanahalli, Devarabisanahalli, Outer Ring Road (Bellandur-Marathahalli stretch)
- LOW: Marathahalli (north), Whitefield, Koramangala, BTM Layout — farther but possibly within 6km
- REJECT: Electronic City, Yelahanka, JP Nagar, Jayanagar, Indiranagar, Hebbal — too far

**C) Room Type Match**
- STRONG: "single room", "1BHK", "1RK", "studio apartment", "one room"
- GOOD: "room in 2BHK/3BHK" with "attached washroom" or "attached bathroom" or "private bathroom" or "en-suite"
- WEAK: "room in 2BHK/3BHK" without mention of attached washroom — still include but lower score
- REJECT: "sharing room", "shared room", "2 sharing", "triple sharing"

**D) Furnishing**
- BEST: "fully furnished", "furnished flat"
- OK: "semi-furnished" — include but note it
- LOWER: "unfurnished" — include but lower score

**E) Deal-Breakers (REJECT if any)**
- "Girls only", "female only", "ladies only", "women only"
- "Sharing basis", "shared room", "2/3 sharing in a room"
- Commercial/office space
- Posts clearly about a different city

**F) Scoring (0-100)**
- Start at 50
- **+25 if post mentions a preferred society** (Mantri Flora, Springfield Apartments, Elan Homes, Sobha Dahlia, Suncity Apartments) — these are top priority
- +20 if location is HIGH relevance
- +10 if location is MEDIUM relevance
- +15 if "single room" or "1BHK" explicitly mentioned
- +10 if "attached washroom/bathroom" mentioned
- +10 if "fully furnished" mentioned
- +5 if photos are attached
- +5 if rent price is mentioned (transparency)
- -10 if location is LOW relevance
- -15 if "unfurnished"
- -10 if no mention of attached washroom
- -20 if any deal-breaker -> score drops below threshold

**Output for each post**: relevance_score, one-line reason, extracted fields (rent, location, furnishing, room_type, contact_info)

### STAGE 4: DISTANCE VERIFICATION (Google Maps)

For posts with relevance_score >= 50 that contain a Google Maps link or a specific recognizable address/apartment name:

1. Open a new browser tab: `browser open https://www.google.com/maps`
2. Search for directions FROM the flat location TO "Microsoft Prestige Fern Galaxy, Bellandur, Bangalore"
3. Read the driving distance from the snapshot
4. If distance > 6 km -> reduce relevance_score by 30
5. If distance <= 3 km -> add +10 to relevance_score
6. If distance 3-6 km -> keep score as is
7. Close the Maps tab when done

If no maps link or address is available, skip this stage and rely on your area knowledge from Stage 3.

### STAGE 5: TELEGRAM NOTIFICATION

**Duplicate check**: Before notifying, read the file `{baseDir}/sent_posts.json`. If a post permalink or a hash of its first 100 characters is already in the file, skip it.

For each post with final relevance_score >= 60, send a Telegram message formatted as:

```
🏠 *Rental Alert* (Score: {score}/100)

📝 {one-line summary of the post}

📍 Location: {extracted location}
🏗️ Society/Apartment: {society or apartment complex name if mentioned}
🏢 Distance from office: {distance if checked, else "~estimated area"}
🛏️ Room: {room type}
🚿 Washroom: {attached/shared/not mentioned}
🪑 Furnishing: {fully/semi/unfurnished}
💰 Rent: {amount if mentioned, else "Not mentioned"}
🔧 Maintenance: {maintenance charges if mentioned, else "Not mentioned"}
👤 Posted by: {author name}
📞 Contact: {phone number, WhatsApp number, or "See post" if not mentioned. Look for digits like 10-digit Indian numbers, +91 prefixed numbers, or "DM me" / "call me" patterns in the post text}
📅 Posted: {timestamp}
⭐ Why relevant: {one-line reason}

🔗 {facebook_post_permalink}
```

After sending, append the post identifier to `{baseDir}/sent_posts.json` to prevent re-notification.

### STAGE 6: SUMMARY (ALWAYS SEND — even with 0 matches)

After processing all 6 groups, ALWAYS send a summary to Telegram (chat ID 8576460636) so the user knows the job ran:
```
📊 Scan complete ({current_date_time}):
- Groups scanned: 6
- Posts checked: {total} (expect 100-200+ if scrolling worked)
- Posts per group: G1:{n} G2:{n} G3:{n} G4:{n} G5:{n} G6:{n}
- Posts within 1 day: {filtered}
- Relevant matches found: {matches}
- Notifications sent: {sent}
- Duplicates skipped: {dupes}
- Scrolls performed: {total_scrolls} (should be ~60-90 = 10-15 per group)
```

If posts checked is below 40, something went wrong with scrolling — note it in the summary.

If any error occurs during scanning (login expired, browser crash, network error), send an error notification:
```
❌ Rental scan error ({current_date_time}):
{error description}
Action needed: {suggested fix}
```
- Notifications sent: {sent}
- Duplicates skipped: {dupes}
```

## Important Notes

1. **Be patient with page loads** — Facebook is heavy. Wait 5+ seconds after navigation.
2. **SCROLLING IS CRITICAL** — Facebook uses infinite scroll. You MUST press End at least 10 times per group before taking a snapshot. If you skip scrolling, you will only see 3-5 posts and miss 90% of recent listings. This is the most common failure mode.
3. **Do NOT click "See more" on individual posts** during the initial scan — it wastes time. Extract what you can from the feed view. Only click "See more" if a post scores ≥60 and you need missing details (contact info, exact address).
4. **Handle login expiry** — If you see a login page instead of group content, send an error notification to Telegram and stop scanning.
5. **Rate limit yourself** — Wait 3-5 seconds between group navigations to avoid Facebook blocking.
6. **The sent_posts.json file** — Create it if it does not exist. Format: {"sent": ["id1", "id2"]}.
7. **Google Maps** — Only check Maps if a clear address or Maps link is in the post. Do not check for every post.
8. **Obfuscated timestamps** — Facebook sometimes scrambles timestamp text in the DOM. If timestamps appear garbled, treat the post as recent (within 7 days) rather than skipping it.
