# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: peers and network: people Andrew Nguyen meets through chess, soccer, Purdue, the semiconductor student org, and work. They land on anguy.app from a link in a bio, a chat, or a conversation, usually on a phone, and want to know who he is and what he cares about. Personality and interests come first; the resume is secondary but must be reachable.

Secondary: recruiters and hiring managers in industrial engineering, data, and semiconductors. They should be able to find experience and impact without hunting.

## Product Purpose

A personal site for Andrew Nguyen, an Industrial Engineering student with a Statistics minor at Purdue (est. graduation May 2028). It introduces him as a person (interests, taste, how he thinks), documents his learning, experience, and work, and invites people to get in touch. Success means a visitor leaves knowing something specific about him and has a clear way to reach him.

## Positioning

The site is about one person whose interests sit at a real intersection: competitive chess (2000+ rapid, CCL captain), soccer analytics for Purdue D1, semiconductor fab operations (Micron), and probability and decision theory. Nobody else can truthfully claim that combination.

## Operating Context

- Hosted on GitHub Pages at the custom domain anguy.app (CNAME). The repo is public.
- Visitors arrive from links shared one to one; mobile matters as much as desktop.
- Live chess data is pulled client-side from the public Lichess API for the account an_d22.

## Capabilities and Constraints

- Static site: plain HTML, CSS, and JavaScript, no build step.
- Must keep: live Lichess stats (ratings by format, game record) and a live bullet-rating history chart. The repertoire and CCL record were removed from the Chess section by user directive (2026-11-25).
- Retired in this revamp: the WebGL 3D "ride" homepage (index.html + ride.js/ride.css), classic.html, background audio, the Markets sheet, and the pitch-zone map. They remain in git history.
- No personal contact details beyond the school email, LinkedIn, GitHub, and Lichess (see .gitignore notes): no phone, home address, or personal email.

## Brand Commitments

- Name: Andrew Nguyen. Domain: anguy.app. Favicon: clownfish SVG (favicon-clownfish.svg).
- Voice: professional and plain (user directive, 2026-11-24): sentence case, factual copy, no jokes. Andrew's own opening line: "Hi there, check out some of my projects and experiences."

## Evidence on Hand

- No Projects section and no mentions of projects on the site (user directive, 2026-11-24); project facts below are background only.
- The site shows only the four most recent roles (Micron, Purdue D1 Women's Soccer, Semiconductor Student Alliance, The Data Mine) per user directive; older roles below stay as background facts.
- Resume content in the previous index.html: Purdue (GPA 3.89, scholarships, certifications, coursework), Micron Technology IE intern (8x shortlist precision, ~1,500 tools, 13 datastores, 40 hrs/quarter saved), Purdue D1 Women's Soccer predictive analyst (18 Big Ten teams), The Data Mine researcher (200+ emails/week, 5-person team, top 15%, 20 hrs/month), Semiconductor Student Alliance chair, CCL captain, Wonderland + Purdue IE lead mentor (~60 students), Solar PV economic modeling (6 models, 40-year DCF).
- Personal: favorites (Ip Man 3, JYP/Rain, $INTC), interests (rapid chess, soccer, hiking, game/decision theory, tech sector coverage, kung fu movies, racquet sports).
- Chess repertoire: Goring Gambit, Scotch, Italian (White); Caro-Kann, Modern (Black). CCL record 4W-5L-3D vs UT Dallas, Arizona State, Drexel, Tulane.
- No photographs of Andrew anywhere on the site (user directive, 2026-11-24); the former IMG_6641.jpg was removed from the repo. No testimonials, press, or logos; do not invent any.

## Product Principles

1. A person first, a resume second.
2. Real specifics over adjectives: numbers, openings, names, favorites.
3. Live where it can be live (chess), honest where it cannot.
4. Fast and readable on a phone from a shared link.
