# M&H - Elevated Essentials

A premium e-commerce platform showcasing sustainable, timeless fashion with WhatsApp checkout integration and a secure Supabase-powered admin dashboard.

## Features

- **Modern E-Commerce Storefront**: Elegant design with responsive layout for viewing products.
- **WhatsApp Checkout**: Streamlined checkout process directly integrating with WhatsApp.
- **Secure Admin Console**:
  - Protected by Supabase Authentication.
  - Manage products, view orders, and administer the storefront securely.
- **Supabase Backend**: Products and orders data stored in a PostgreSQL database provided by Supabase.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS V4
- **Backend/Database**: Supabase (PostgreSQL, Auth, RLS)
- **Icons**: Lucide React
- **Animations**: Motion

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Supabase account and project

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-github-repo-url>
   cd mh-clothing-store
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Supabase:**
   - Create a new Supabase project.
   - Run the SQL scripts found in the root directory in your Supabase SQL Editor:
     - `supabase_schema.sql`: Sets up the tables for products, orders, and order items.
     - `supabase_security_upgrade.sql`: Sets up Row Level Security (RLS) policies to secure your data.
   - Go to `Authentication > Users` in Supabase and create an admin user (email and password).

4. **Environment Variables:**
   - Create a `.env` file in the root of the project by copying `.env.example`:
     ```bash
     cp .env.example .env
     ```
   - Update the `.env` file with your Supabase credentials:
     ```env
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
     ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Admin Dashboard

To access the admin dashboard:
1. Navigate to the website.
2. Click on the lock icon or footer copyright link to reveal the secure gateway, or navigate to `#secure-owner-console`.
3. Enter your Supabase Admin Email and Password to log in.

## License

This project is proprietary and all rights are reserved by M&H Store.
