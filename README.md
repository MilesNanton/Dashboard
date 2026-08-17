# CLASSMATES

A beginner-friendly Next.js website for a student learning community.

## Run the project

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Connect Firebase login

1. Create a Firebase project and add a Web App.
2. In Firebase Console, open **Authentication → Sign-in method** and enable **Email/Password**.
3. Copy `.env.example` to `.env.local`.
4. Copy the values from your Firebase Web App configuration into `.env.local`.
5. Restart the development server with `npm run dev`.

## Important files

- `app/page.js` — the content and structure of the home page
- `app/globals.css` — colours, spacing, responsive styles, and design
- `app/layout.js` — shared page layout and website metadata
- `package.json` — project dependencies and commands

## Useful commands

```bash
npm run dev    # Start development mode
npm run build  # Check and create a production build
npm start      # Run the production build
npm run lint   # Check code quality
```

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` automatically builds and deploys
the site whenever code is pushed to the `main` branch. In the GitHub repository,
open **Settings → Pages** and select **GitHub Actions** as the source.
