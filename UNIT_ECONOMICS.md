# Spotcoin Unit Economics (Management)

## Spotcoin Overview

Spotcoin is an internal employee recognition and rewards platform. It helps teams recognize impactful work in real time, track recognition behavior, and convert earned Spot Tokens into payout value based on company policy.

## Key Features

- Recognition feed where employees publicly recognize peers with a value and message.
- Wallet and transaction history showing `coinsToGive` usage and `spotTokensEarned` accumulation.
- Monthly allowance refill for sender budgets (`coinsToGive`) without reducing earned balances.
- Slack integration for recognition posting and recurring recognition nudges.
- Admin controls for workspace settings, user management, analytics, and payout operations.
- Payout workflow that converts earned Spot Tokens into settlement records for finance operations.

## Purpose

This document explains what Spotcoin costs the company, how to budget it monthly and annually, and how exchange rate movement affects Ghana Cedi reporting.

## What Unit Economics Means Here

For Spotcoin, unit economics is the employer-funded recognition liability created by token usage.

- A token is set to a cash value for payout accounting.
- In this workspace model, `1 Spotcoin = 1000 NGN`.
- Company cost scales with headcount, allowance policy, and actual usage rate.

## Core Assumptions

- Employees: `20`
- Token value: `1000 NGN` per Spotcoin
- Baseline monthly allowance policy: `5` Spotcoins per employee (schema default)
- FX snapshot source/date: [ExchangeRate-API NGN base](https://open.er-api.com/v6/latest/NGN), `Tue, 11 Aug 2026 00:02:31 +0000`
- FX used for conversion: `1 NGN = 0.008619 GHS`
  - Therefore, `1000 NGN = 8.619 GHS`

## Budget Formula

- Monthly Spotcoins minted (max usable):  
  `employees × monthlyAllowance`
- Monthly NGN budget (full utilization):  
  `employees × monthlyAllowance × 1000`
- Annual NGN budget (full utilization):  
  `monthlyNGN × 12`
- GHS equivalents:  
  `NGN amount × 0.008619`

## Baseline Budget (20 employees, 5 Spotcoins each)

- Monthly Spotcoins: `20 × 5 = 100`
- Monthly budget: `100 × 1000 = 100,000 NGN`
- Annual budget: `100,000 × 12 = 1,200,000 NGN`
- Monthly GHS equivalent: `100,000 × 0.008619 = 861.90 GHS`
- Annual GHS equivalent: `1,200,000 × 0.008619 = 10,342.80 GHS`

## Sensitivity by Utilization

The payroll impact depends on how much of allocated Spotcoins are actually used.

- 100% utilization:
  - `100,000 NGN` per month
  - `1,200,000 NGN` per year
  - `861.90 GHS` per month
  - `10,342.80 GHS` per year
- 85% utilization:
  - `85,000 NGN` per month
  - `1,020,000 NGN` per year
  - `732.62 GHS` per month
  - `8,791.38 GHS` per year
- 70% utilization:
  - `70,000 NGN` per month
  - `840,000 NGN` per year
  - `603.33 GHS` per month
  - `7,240.00 GHS` per year

## Allowance Scenario Planning (20 Employees, 100% Utilization)

- 5 Spotcoins/employee/month:
  - `100,000 NGN` monthly
  - `1,200,000 NGN` annually
- 10 Spotcoins/employee/month:
  - `200,000 NGN` monthly
  - `2,400,000 NGN` annually
- 15 Spotcoins/employee/month:
  - `300,000 NGN` monthly
  - `3,600,000 NGN` annually

## Management Notes

- Main budget drivers:
  - Headcount
  - Monthly allowance policy
  - Real utilization rate
  - NGN/GHS exchange rate movement
- Recommended governance:
  - Review utilization monthly.
  - Re-forecast FX quarterly (or monthly in volatile periods).
  - Keep a budget buffer for usage spikes and FX swings.
