#!/usr/bin/env bash
# Quick deploy script for JobPilot AI
# Usage: ./deploy.sh [environment]
# environment: production (default) | preview

set -euo pipefail

ENV="${1:-production}"
PROJECT_NAME="jobpilot-ai"

echo "🚀 Deploying JobPilot AI to Vercel ($ENV)..."

# Check prerequisites
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not installed. Run: npm i -g vercel"
    exit 1
fi

# Verify required env vars are set locally (for reference)
required_vars=(
    "APP_URL"
    "DATABASE_URL"
    "APP_ENCRYPTION_KEY"
    "CRON_SECRET"
    "WORKER_TOKEN"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_STORAGE_BUCKET"
    "AI_API_KEY"
)

echo "📋 Checking required environment variables..."
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "  ⚠️  $var not set in shell (must be configured in Vercel dashboard)"
    else
        echo "  ✅ $var"
    fi
done

# Build locally first to catch errors
echo "🔨 Building locally..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm run test

# Type check
echo "🔍 Type checking..."
npm run typecheck

# Deploy
echo "📦 Deploying to Vercel ($ENV)..."
if [[ "$ENV" == "production" ]]; then
    vercel --prod --yes --name "$PROJECT_NAME"
else
    vercel --yes --name "$PROJECT_NAME"
fi

echo "✅ Deployment complete!"
echo "🔗 Check your Vercel dashboard for the deployment URL"
echo "🔧 Don't forget to update APP_URL in Vercel env vars after first deploy"
echo "🤖 Deploy worker separately: cd worker && fly deploy  (or use Render blueprint)"