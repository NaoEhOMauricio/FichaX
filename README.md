# Restaurant Cost Calculator App

A React Native app built with Expo for calculating restaurant costs, featuring ingredient management, recipe creation, and user authentication.

## Features

- User authentication with Supabase
- Ingredient management
- Recipe creation
- Stripe integration for subscriptions

## Setup

1. Install dependencies: `npm install`
2. Set up Supabase:
   - Create a Supabase project
   - Update `lib/supabase.ts` with your URL and anon key
   - Create tables:
     - `ingredients` (id, name, cost, package_weight, package_unit)
     - `recipes` (id, name, ingredients)
   - The app calculates ingredient portion cost as `cost / package_weight * used_amount`
   - The recipe total is the sum of all ingredient portion costs
3. Set up Stripe:
   - Update `lib/stripe.ts` with your publishable key
4. Run the app: `npx expo start`

## Project Structure

- `app/`: Screens using Expo Router
- `lib/`: Supabase and Stripe clients
- `.github/`: Copilot instructions

## Technologies

- React Native
- Expo
- Supabase
- Stripe
- TypeScript