# Packet 4.6: Referral & Loyalty Program

Status: Complete
Duration: 3-4 hours
Dependencies: Packets 4.1-4.5

## Overview

Packet 4.6 implements two growth and retention features:

1. Referral Program: Users earn NGN 500 credit for each friend who signs up using their code
2. Loyalty Points System: Users earn points through engagement, tier up for benefits, and redeem for rewards

## Referral Program

### How It Works

- User gets a unique referral code (e.g., JOHN2024LEARN)
- User shares code with friends via email, WhatsApp, or copy-paste
- Friend clicks referral link and signs up using the code
- Upon signup confirmation, both parties receive NGN 500 credit

### Key Features

- Code Format: [USER_INITIALS][YEAR][RANDOM] — unique and human-readable
- Earnings Cap: NGN 5,000 per month per user (auto-resets monthly)
- Monthly Tracking: earnings_month column stores YYYY-MM
- Credit Expiry: 180 days
- One-time Use: Each referred user can only use one code

### API Endpoints

GET    /api/referral/code              Get or create referral code
GET    /api/referral/stats             Get earnings and referral count
POST   /api/referral/apply             Apply code at signup
GET    /api/referral/validate/{code}   Validate code
POST   /api/referral/track-click/{code} Track link click

## Loyalty Points System

### How It Works

1. User earns points through engagement (videos, questions, streaks)
2. Points accumulate and drive tier progression
3. User can redeem points for discounts or free months
4. Tier status determines bonus point multiplier

### Point Awards

video_watch:     10 points
question_answer:  5 points
streak_day:      50 points
upgrade_plan:   100 points
referral_signup: 250 points

### Tier Structure

Bronze       0+     1.0x   Standard support
Silver     500+     1.1x   Early access
Gold      1000+     1.2x   Priority support
Platinum  2000+     1.5x   VIP support + free month

### Redemption Options

- 100 pts = NGN 500 discount
- 250 pts = 1 month free
- 500 pts = 3 months free

### API Endpoints

GET    /api/loyalty/status             Get points and tier
GET    /api/loyalty/tiers              Public tier info
POST   /api/loyalty/redeem             Redeem points
POST   /api/loyalty/reward-code/apply  Apply reward code

## Frontend Pages

/referral - Referral code, earnings, and referral list
/loyalty - Loyalty points, tier progress, and rewards

## Implementation Status

ReferralService | backend/services/referral_service.py | Complete
LoyaltyService | backend/services/loyalty_service.py | Complete
Database Models | backend/models.py | Complete
Referral Router | backend/routers/referral.py | Complete
Loyalty Router | backend/routers/loyalty.py | Complete
Referral Page | frontend/pages/referral.tsx | Complete
Loyalty Page | frontend/pages/loyalty.tsx | Complete
Navbar | frontend/components/Navbar.tsx | Updated

Packet 4.6: Complete and Ready for Testing
